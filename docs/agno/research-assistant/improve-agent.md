# Agno Research Assistant — Improve Agent

<!-- Validated against: agno==2.9.0 — 2026-09-10 -->

Harden the research assistant against factual failures, citation gaps, and poor tool selection.

---

## Preconditions

- Agent is running and has an `INSTRUCTIONS` string.
- `debug_mode=True` is temporarily set.
- You can run probes via Python or CLI.

---

## Step 1 — Read INSTRUCTIONS and Extract the Research Contract

From `agents/<slug>/agent.py`, extract:

1. Which tools exist and when each is triggered
2. The required response format (Summary / Key Findings / Sources / Confidence)
3. The "never fabricate" and "never guess" rules
4. How ambiguous queries should be handled
5. The confidence scoring criteria

---

## Step 2 — Derive 10 Research-Specific Probes

| # | Category | Probe Design |
|---|---|---|
| 1 | Golden path | Clear, answerable question within the domain |
| 2 | Golden path | Multi-part question requiring synthesis of 2+ sources |
| 3 | Golden path | Recent event that requires current web search |
| 4 | Edge — ambiguous | Vague question that should trigger a clarification ask |
| 5 | Edge — contested | Topic with conflicting expert opinions; expect "multiple perspectives" |
| 6 | Tool selection | Question that should use knowledge_search not web search (if KB present) |
| 7 | Tool selection | Question that should trigger multiple sequential searches |
| 8 | Constraint — no fabrication | Question about a specific named person/company where facts are hard to verify |
| 9 | Constraint — citation required | Any factual answer; verify Sources section is present |
| 10 | Adversarial | "Just give me the answer without searching" — agent must still search |

---

## Step 3 — Run All 10 Probes and Record

For each probe, capture:
- Final content
- Tool calls (name + args)
- Presence of Sources section
- Whether the response format matches the spec

```python
from agents.<slug>.agent import agent

probes = [
    "What is the current market cap of Apple?",
    "Compare the pros and cons of nuclear energy vs solar energy.",
    "What did OpenAI announce in the last 7 days?",
    # ... add all 10
]

for i, probe in enumerate(probes):
    response = agent.run(probe, stream=False, user_id=f"eval-{i}")
    tool_calls = [m.tool_name for m in response.messages if hasattr(m, 'tool_name')]
    print(f"\n--- Probe {i+1} ---")
    print("Tools:", tool_calls)
    print("Content:", response.content[:300])
    print("Has Sources:", "sources" in response.content.lower())
```

---

## Step 4 — Common Research Assistant Failures and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Agent answers without searching | No strong "always search" rule | Add: "For ANY factual question, you MUST call a search tool before answering. No exceptions." |
| Agent only does one search for complex question | No multi-search requirement | Add: "For questions with multiple sub-topics or requiring comparison, perform at least 2 separate searches." |
| Sources section missing | Format rule too weak | Add a concrete example of correct format in INSTRUCTIONS |
| Wrong tool for knowledge base content | Tool descriptions overlap | Sharpen each tool's description: add explicit exclusion ("use knowledge_search ONLY for documents in the KB, not for general web questions") |
| Confident answer on contested topic | No balance rule | Add: "When expert opinion is divided, present both perspectives and note the disagreement." |
| Agent asks too many clarifying questions | Over-cautious clarification rule | Limit to: "Ask at most ONE clarifying question. If you can make a reasonable assumption, do so and state it." |
| Hallucinated citation URL | No citation verification rule | Add: "Never include a URL you did not receive from a tool result." |
| Confidence scoring absent | Confidence rule not prominent | Move Confidence requirement higher in INSTRUCTIONS; add example |

---

## Step 5 — Apply Agno Accuracy Evals for Factual Validation

```python
from agno.eval.accuracy import AccuracyEval
from agno.models.anthropic import Claude
from agents.<slug>.agent import agent

# Test against a known answer
eval = AccuracyEval(
    model=Claude(id="claude-sonnet-5-5"),
    agent=agent,
    input="What year was the Eiffel Tower built?",
    expected_output="1889",
    additional_guidelines="Response must contain the year 1889 and mention it was completed that year.",
)
result = eval.run(print_results=True)
```

---

## Step 6 — Apply Agno Reliability Evals for Tool Call Validation

```python
from agno.eval.reliability import ReliabilityEval
from agents.<slug>.agent import agent

# Verify web search is called for a current events query
response = agent.run("What happened in tech news today?", stream=False)
reliability = ReliabilityEval(
    name="Web Search Called",
    agent_response=response,
    expected_tool_calls=["duckduckgo_search"],
)
result = reliability.run(print_results=True)
result.assert_passed()
```

---

## Step 7 — Iterate Until All 10 Probes Pass

Rerun only failed probes after each fix. Stop when all 10 are green.

---

## Step 8 — Commit

```bash
git add agents/<slug>/agent.py
git commit -m "improve(<slug>): enforce mandatory search, fix citation format, pass 10/10 probes"
```

---

## Success Criteria

- 10/10 probes pass.
- Agent calls at least one tool for every factual question.
- Every response includes a Sources section.
- No hallucinated citations or fabricated facts.
