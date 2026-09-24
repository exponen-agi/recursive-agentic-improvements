# Improve Agent — Universal Entry Point

This runbook drives the **recursive improvement loop**: derive probes from the agent's own instructions, run them against the live agent, judge results, apply targeted fixes, and iterate until all probes pass.

This is the most powerful workflow in this repository. Run it any time you want to close the gap between what your agent *promises* and what it *delivers*.

---

## Preconditions

- The target agent exists and can be started locally.
- The agent has an `INSTRUCTIONS` or `instruction` string that describes its responsibilities and constraints.
- You can reach the agent via Python SDK, CLI, or HTTP endpoint.
- Logging is enabled so you can read tool calls, errors, and warnings — not just the final response.

---

## Step 1 — Identify the Target Agent

Ask the user:

1. **Which agent do you want to improve?** — Provide the file path (e.g., `agents/research_assistant.py`).
2. **Which framework?** — Agno / CrewAI / LangGraph / Google ADK.
3. **Are there known failure modes?** — Optional: describe any specific failures to prioritise.

---

## Step 2 — Delegate to the Framework-Specific Guide

| Framework | Guide Path |
|---|---|
| Agno | `docs/agno/<use-case>/improve-agent.md` |
| CrewAI | `docs/crewai/<use-case>/improve-agent.md` |
| LangGraph | `docs/langgraph/<use-case>/improve-agent.md` |
| Google ADK | `docs/google-adk/<use-case>/improve-agent.md` |

Determine the use case from the agent's slug, directory, or by reading its `INSTRUCTIONS`.

---

## Universal Improvement Loop (applies to all frameworks)

If no framework-specific guide is available, follow this universal loop:

### Phase A — Read the Spec

1. Read the agent's `INSTRUCTIONS` / `instruction` / `system_prompt` fully.
2. Extract all explicit promises: things the agent says it *will* do, *will not* do, or *should* do.
3. Extract all tool names and their stated purposes.
4. List the output format requirements.

### Phase B — Derive Probes

Generate exactly 10 test probes covering these categories:

| Category | Count | Description |
|---|---|---|
| Golden path | 3 | Inputs the agent is clearly designed for; expect clean, complete responses |
| Edge cases | 2 | Boundary conditions: empty input, very long input, ambiguous phrasing, different language |
| Tool selection | 2 | Inputs that should trigger a specific tool; verify the right tool is called with correct args |
| Constraint | 2 | Inputs that test a "must not" rule (e.g., should not make up citations) |
| Adversarial | 1 | Jailbreak attempts, prompt injections, or inputs designed to break the format |

For each probe, record:
- **Input**: exact text sent to the agent
- **Expected behaviour**: what a passing response looks like
- **Pass criterion**: how to judge PASS vs FAIL (exact match, contains keyword, tool was called, etc.)

If a probe's quality (tone, reasoning, helpfulness) can't be reduced to a simple match rule, add an LLM-as-judge score as a secondary note — it informs the fix but never replaces the deterministic Pass Criterion; every probe still needs a binary PASS/FAIL.

### Phase C — Run Probes

For each probe:
1. Send the input to the agent.
2. Capture: final response, tool calls made (name + args + result), any errors or warnings in logs.
3. Judge against the pass criterion. Record PASS or FAIL.

### Phase D — Fix Failures

For each FAIL, choose a lever:

| Failure Mode | Lever |
|---|---|
| Agent ignores a rule | Tighten the rule wording; move it earlier in INSTRUCTIONS |
| Agent uses the wrong tool | Add explicit trigger condition in tool description or INSTRUCTIONS |
| Agent uses no tool when it should | Add a rule: "Always use `<tool>` when `<condition>`" |
| Agent hallucinates facts | Add "Never fabricate information not returned by a tool" rule |
| Agent breaks output format | Add a concrete format example to INSTRUCTIONS |
| Agent fails edge cases | Add an edge-case handling rule or example |
| Agent is too slow / expensive | Reduce `num_history_runs`, simplify instructions, or use a faster model |
| Adversarial probe succeeds | Add explicit refusal rule; add guardrails |

Make one targeted change per failure. Edit the agent file. Hot-reload (see framework-specific guide).

### Phase E — Iterate & Sync Test Cases

1. Re-run only the probes that previously FAILED. If they now PASS, mark them green. If they FAIL differently, diagnose and re-apply. Continue until all 10 probes are green.
2. Update the corresponding unit/behavioral test file `tests/test_<slug>.py` conforming to the [Test Constitution](../tests/TEST_CONSTITUTION.md) to match the improved agent behavior.
3. Run `pytest tests/` to confirm that all static and mocked behavioral tests pass.

---

## Step 3 — Commit Improvements

```bash
# Stage both agent files and corresponding test files
git add agents/<slug>.py tests/test_<slug>.py  # adjust to project structure
git commit -m "improve(<agent-slug>): tighten rules, fix tool selection, pass all probes"
```

---

## Success Criteria

- All 10 probes return PASS.
- No regressions on previously passing probes.
- Changes are minimal and targeted (no wholesale rewrites).
- The mocked test suite `tests/test_<slug>.py` is updated in sync with agent prompt/instruction adjustments.
- Running `pytest tests/` returns success for all tests.
- Commit message lists which probe categories were fixed.
