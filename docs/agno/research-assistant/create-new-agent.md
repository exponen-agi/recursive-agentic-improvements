# Agno Research Assistant — Create New Agent

<!-- Validated against: agno==2.9.0 — 2026-09-10 -->

Create a research-capable Agno agent that uses web search, knowledge bases, and structured reporting to answer complex questions.

---

## Preconditions

- `pip install agno duckduckgo-search`
- `ANTHROPIC_API_KEY` is set.
- Optional: `OPENAI_API_KEY` for knowledge base embeddings.

---

## Step 1 — Define the Research Domain

Confirm with the user:

1. **Research domain** — general web research, academic papers, financial data, competitive intelligence, etc.
2. **Primary tools** — web search, PDF knowledge base, Wikipedia, news feeds, financial APIs
3. **Output format** — prose report, bullet points, structured JSON, citations required?
4. **Depth vs speed trade-off** — quick summary (1 search) or deep analysis (multiple tools, multiple queries)?
5. **Knowledge base** — static documents to embed, or purely dynamic search?

---

## Step 2 — Project Structure

```
agents/
└── <slug>/
    ├── __init__.py
    ├── agent.py       # agent definition
    └── knowledge.py   # knowledge base setup (if needed)
data/
└── docs/              # PDFs / text files for knowledge base
tmp/
└── <slug>.db          # SQLite for session persistence
```

---

## Step 3 — Write the INSTRUCTIONS

```python
INSTRUCTIONS = """
You are an expert research assistant specialising in <DOMAIN>.

## Research Process
1. ALWAYS search for information before answering factual questions — never rely on training knowledge alone.
2. For complex questions, perform at least 2 independent searches to cross-validate findings.
3. Synthesise results from multiple sources. Do not just concatenate them.
4. Cite your sources: include tool result origins where available.

## What You Must NOT Do
- NEVER state facts not returned by a tool or found in the knowledge base.
- NEVER fabricate citations, URLs, or author names.
- NEVER present one source as definitive on a contested topic — present multiple perspectives.

## Tools
- `duckduckgo_search`: Use for general web queries, news, and current events.
- `knowledge_search`: Use for questions about <DOMAIN_SPECIFIC_DOCUMENTS>.
  Prefer knowledge_search over web search for questions about <OWNED_CONTENT>.

## Response Format
Structure all research responses as:

**Summary** (2–3 sentences): What is the direct answer?
**Key Findings**: Bullet list of supporting evidence.
**Sources**: List all tools used and key URLs or document references.
**Confidence**: Low / Medium / High — based on source quality and agreement.

## Handling Ambiguous Queries
Ask one clarifying question before researching if the query is ambiguous.
Do not ask multiple clarifying questions at once.
"""
```

---

## Step 4 — Write the Agent File

```python
# agents/<slug>/agent.py
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.db.sqlite import SqliteDb

# Optional: knowledge base
# from agents.<slug>.knowledge import get_knowledge_base

INSTRUCTIONS = """..."""  # from Step 3

db = SqliteDb(db_file="tmp/<slug>.db")

agent = Agent(
    name="<AgentName>ResearchAssistant",
    model=Claude(id="claude-sonnet-5-5"),
    instructions=INSTRUCTIONS,
    tools=[
        DuckDuckGoTools(),
        # get_knowledge_base(),   # uncomment if using KB
    ],
    db=db,
    add_history_to_context=True,
    num_history_runs=3,          # research agents rarely need long history
    markdown=True,
    show_tool_calls=True,        # display tool calls in response during dev
    debug_mode=False,
)
```

---

## Step 5 — Optional: Add a Knowledge Base

Use a knowledge base when you have static documents the agent should reference:

```python
# agents/<slug>/knowledge.py
from agno.knowledge.pdf import PDFKnowledgeBase
from agno.knowledge.text import TextKnowledgeBase
from agno.vectordb.lancedb import LanceDb
from agno.embedder.openai import OpenAIEmbedder

def get_knowledge_base():
    return PDFKnowledgeBase(
        path="data/docs/",
        vector_db=LanceDb(
            table_name="<slug>_kb",
            uri="tmp/<slug>_lancedb",
            embedder=OpenAIEmbedder(),
        ),
    )
```

Load the knowledge base once before first run:

```python
kb = get_knowledge_base()
kb.load(recreate=False)  # recreate=True to rebuild from scratch
```

---

## Step 6 — Run Script

```python
# agents/<slug>/run.py
import sys
from agents.<slug>.agent import agent

if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "What are the latest trends in AI?"
    agent.print_response(query, stream=True, user_id="dev-user")
```

```bash
python -m agents.<slug>.run "What are the major risks of large language models?"
```

---

## Step 7 — Smoke Tests

**Probe 1 — Tool usage (must call DuckDuckGo):**
```python
from agents.<slug>.agent import agent
response = agent.run("What happened in AI news this week?", stream=False)
tool_calls = [m.tool_name for m in response.messages if hasattr(m, 'tool_name')]
assert "duckduckgo_search" in tool_calls, "Agent must search, not rely on memory"
```

**Probe 2 — Citation format:**
```python
response = agent.run("What is the GDP of Germany?", stream=False)
assert "sources" in response.content.lower() or "source" in response.content.lower()
```

**Probe 3 — No hallucination on unknown:**
```python
response = agent.run("What did CEO John Smith of TechCorp announce yesterday?", stream=False)
# Should search rather than fabricate
tool_calls = [m.tool_name for m in response.messages if hasattr(m, 'tool_name')]
assert len(tool_calls) > 0, "Agent must search before answering"
```

---

## Step 8 — Commit

```bash
git add agents/<slug>/ data/ 
git commit -m "feat: scaffold <slug> research assistant agent (Agno)"
```

---

## Success Criteria

- All 3 smoke tests pass.
- Agent calls at least one tool for factual questions — never guesses.
- Response includes Sources section.
- No hallucinated citations.
