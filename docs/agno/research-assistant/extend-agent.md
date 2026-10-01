# Agno Research Assistant — Extend Agent

<!-- Validated against: agno==2.9.0 — 2026-09-10 -->

Add new data sources, analytical capabilities, or output formats to an existing Agno research assistant.

---

## Preconditions

- Agent passes its current probe suite.
- You know which extension to add.
- Agno MCP server is available for docs queries.

---

## Common Extensions for Research Assistants

### Extension A — Add Financial Data Tool

```python
from agno.tools.yfinance import YFinanceTools

# Add to agent tools:
tools=[..., YFinanceTools(stock_price=True, analyst_recommendations=True, company_info=True)]

# Add to INSTRUCTIONS:
"""
## Financial Data
- `yfinance`: Use when the user asks for stock prices, financial metrics, earnings, or analyst ratings.
  Always include the ticker symbol in your query.
  Prefer yfinance over web search for real-time financial data.
"""
```

### Extension B — Add Wikipedia Tool

```python
from agno.tools.wikipedia import WikipediaTools

tools=[..., WikipediaTools()]

# Add to INSTRUCTIONS:
"""
- `wikipedia_search`: Use for background/historical questions and entity definitions.
  Use duckduckgo_search for current events; use wikipedia for established facts.
"""
```

### Extension C — Add PDF Knowledge Base

See `create-new-agent.md` Step 5 for full setup. When adding to an existing agent:

```python
from agents.<slug>.knowledge import get_knowledge_base

kb = get_knowledge_base()
kb.load(recreate=False)

# Update agent:
agent = Agent(
    ...
    knowledge=kb,
    search_knowledge=True,   # agent decides when to search KB
)
```

Update INSTRUCTIONS with explicit KB trigger: "Use knowledge_search for questions about <specific document set>."

### Extension D — Add Structured Output (Pydantic)

Convert the free-text research report to a structured model:

```python
from pydantic import BaseModel, Field

class ResearchReport(BaseModel):
    summary: str = Field(description="2–3 sentence executive summary")
    key_findings: list[str] = Field(description="Bullet list of evidence")
    sources: list[str] = Field(description="URLs or document names cited")
    confidence: str = Field(description="Low, Medium, or High")
    follow_up_questions: list[str] = Field(
        default=[],
        description="2–3 suggested follow-up research questions"
    )

agent = Agent(
    ...
    output_model=ResearchReport,
)
```

### Extension E — Add Reasoning Mode

Enable the agent to reason before searching (improves query formulation):

```python
agent = Agent(
    ...
    reasoning=True,
    # reasoning_model=Claude(id="claude-opus-4-7"),  # separate model for reasoning
)
```

Add to INSTRUCTIONS:
```
## Research Planning
Before executing any search, think through:
1. What is the core question?
2. What search queries will best surface the answer?
3. What sources are most credible for this topic?
```

### Extension F — Add Team-Based Deep Research

For multi-step research requiring specialist sub-agents:

```python
from agno.team import Team
from agno.agent import Agent

web_researcher = Agent(
    name="WebResearcher",
    role="Search the web for current information on a topic",
    tools=[DuckDuckGoTools()],
)

data_analyst = Agent(
    name="DataAnalyst",
    role="Analyse and synthesise research findings into a structured report",
)

research_team = Team(
    name="ResearchTeam",
    members=[web_researcher, data_analyst],
    model=Claude(id="claude-sonnet-5-5"),
    instructions="Delegate research tasks to WebResearcher, then have DataAnalyst synthesise.",
    markdown=True,
)
```

---

## Validation After Extension

Run these probes after every extension:

1. **New tool probe** — input that specifically requires the new tool
2. **Tool routing probe** — input where the agent must choose correctly between old and new tools
3. **Regression probe** — one of the original passing probes

---

## Commit

```bash
git add agents/<slug>/
git commit -m "feat(<slug>): add <extension-name> to research assistant"
```
