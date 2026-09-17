# /extend-agent — Research, Plan, and Add a New Capability

Add any new capability to an existing agent without breaking what already works.
The skill researches what tools and patterns actually exist for the capability before writing code.

**Usage:** `/extend-agent [framework] [agent-path]`
**Examples:**
- `/extend-agent agno agents/travel-assistant/agent.py`
- `/extend-agent crewai src/research-crew`
- `/extend-agent langgraph src/my-agent`
- `/extend-agent google-adk my_agent`
- `/extend-agent` (will ask)

---

## Step 1 — Clarify the Extension

If `$ARGUMENTS` is provided, parse framework and agent path. Ask all remaining questions at once:

1. **Which agent are you extending?** File path and framework.
2. **What new capability do you want to add?** Describe freely — no need to match a preset category. Examples:
   - "Add flight search so the travel agent can find real-time prices"
   - "Add a human approval step before any booking is confirmed"
   - "Add a fact-checker agent to the research crew"
   - "Return structured JSON output instead of plain text"
   - "Connect to our internal CRM via MCP"
   - "Add memory so the agent remembers user preferences across sessions"
3. **Why is this needed?** What user problem does it solve?
4. **Are there constraints?** Things the new capability must NOT do (e.g., "never auto-book, always confirm first").

---

## Step 2 — Read the Current Agent & Test Suite

Before changing anything, read the full current state:

1. Read the spec (INSTRUCTIONS / INSTRUCTION / SYSTEM_PROMPT / agents.yaml + tasks.yaml).
2. Read all existing tool definitions and their docstrings.
3. Note the current output format and any constraints already in place.
4. Note what imports and dependencies are already present.
5. Identify where the new capability fits in the existing flow — does it add to, replace, or wrap something existing?
6. Locate and read the Test Constitution at `tests/TEST_CONSTITUTION.md` and the existing test file `tests/test_<slug>.py` (or equivalent) to understand current unit/behavioral coverage.

---

## Phase 1 — Research: Discover the Right Implementation

Use the docs source for the chosen framework (MCP tool, WebFetch, or WebSearch) to find the correct API for the new capability. Do not implement from training-data memory — always verify against current docs.

### Docs source check

Try each in order for the chosen framework — use the first that succeeds:

| Framework | Try first | Try second | Fallback |
|---|---|---|---|
| Agno | `search_agno` MCP tool | `query_docs_filesystem_agno` MCP tool | `WebFetch https://docs.agno.com/llms-full.txt` |
| LangGraph | `search_docs_by_lang_chain` MCP tool | `query_docs_filesystem_docs_by_lang_chain` MCP tool | `WebFetch https://langchain-ai.github.io/langgraph/llms.txt` |
| Google ADK | Context7 MCP tool (library `/google/adk-python`) | `WebFetch https://google.github.io/adk-docs/llms.txt` | `WebSearch "google adk [capability]"` |
| CrewAI | `search_crewai` MCP tool | `WebFetch https://docs.crewai.com/llms.txt` | `WebSearch "crewai [capability]"` |

Google ADK has no framework-dedicated MCP server. Context7 is a general-purpose docs MCP that covers it — try it before falling back to WebFetch.

**If no docs source is available for Agno, LangGraph, CrewAI, or Google ADK**, warn the user:
```
⚠ No documentation source available for [framework].
  /extend-agent relies heavily on current API docs — generated code may use
  outdated class names, import paths, or parameter signatures.

  To fix: add MCP server to .claude/settings.json:
    Agno:    "agno-docs":     { "type": "http", "url": "https://docs.agno.com/mcp" }
    LangGraph: "langchain-docs": { "type": "http", "url": "https://docs.langchain.com/mcp" }
    CrewAI:  "crewai-docs":   { "type": "http", "url": "https://docs.crewai.com/mcp" }
    Google ADK: "context7":   { "type": "http", "url": "https://mcp.context7.com/mcp" }

  Continue without live docs (verify all generated imports manually)?
```
Wait for user's answer before continuing.

### Research queries

Run targeted searches for the capability the user described. Construct queries from the capability description:

**Query 1 — Does a native implementation exist?**
Search: `"[capability keyword] [framework]"` — e.g., `"human approval confirmation agno"`, `"structured output pydantic agno"`, `"memory long-term user agno"`

**Query 2 — What is the correct API?**
Search: `"[class or pattern name] example"` — e.g., `"MCPTools example"`, `"interrupt langgraph human-in-the-loop"`, `"LlmAgent sub-agent tool"` 

**Query 3 — Any required extras?**
Search: `"[capability] install dependencies"` or `"[capability] api key"` — find if new packages or credentials are needed

### Research Report

After searching, compile:

```
EXTENSION RESEARCH REPORT
==========================
Capability requested: [user's description]
Docs source used: [MCP / WebFetch / WebSearch / training data]

NATIVE IMPLEMENTATION FOUND: Yes / No / Partial
  [If yes:]
  Class/function: [name]
  Import path: [exact import]
  Parameters: [key parameters]
  Example usage: [minimal code snippet from docs]

  [If partial — native exists but needs custom work:]
  Native part: [what the framework provides]
  Custom part: [what needs to be built]

  [If no — full custom implementation needed:]
  Approach: [recommended library or API]
  New dependency: [pip install ...]
  New API key: [KEY_NAME if needed]

IMPACT ON EXISTING AGENT:
  Files to modify: [list]
  Files to create: [list]
  Spec changes needed: [summary of INSTRUCTIONS/config additions]
```

---

## Phase 2 — Plan: Extension Blueprint

Using the Research Report and current agent state, generate a precise Extension Blueprint.

```
EXTENSION BLUEPRINT
===================
Agent: [path]
Framework: [framework]
Capability: [name]

FILES TO CREATE:
  [filename]: [purpose]

FILES TO MODIFY:
  [filename]: [what changes and why]

SPEC ADDITIONS (exact text to add to INSTRUCTIONS / agent.yaml / system prompt):
  """
  ## [New Capability Name]
  Trigger: Use [tool_name] when [specific condition derived from user's description].
  Constraint: [any must-not rules the user specified].
  [Sequencing rule if needed: "Always call X before Y."]
  """

TEST SUITE MODIFICATIONS (Conforming to tests/TEST_CONSTITUTION.md):
  File: tests/test_[slug].py
  Test Cases to Add:
  - `test_[slug]_[new_capability]_happy_path`: mock model response to assert new capability routing.
  - `test_[slug]_[new_capability]_edge_case`: mock model response for edge conditions.

IMPLEMENTATION STEPS:
  1. [Concrete step — e.g., "Add AgentMemory import and update_memory_on_run=True"]
  2. [Next step]
  ...

NEW TEST PROBES (minimum 2):
  Probe 1: "[input that triggers the new capability]"
    Expected: [what a passing response looks like]
    Criterion: [TOOL_CALLED / CONTAINS / FORMAT_OK]
  Probe 2: "[edge case for the new capability]"
    Expected: [graceful handling]
    Criterion: [NOT_CONTAINS "error" / CONTAINS "confirm"]

REGRESSION PROBES (from existing spec):
  Probe R1: "[existing golden-path probe that should still pass]"
  Probe R2: "[existing constraint probe that should still pass]"
```

**Show the full blueprint to the user and ask: "Does this plan look right? Any changes before I implement?"**

Wait for confirmation before continuing to Phase 3.

---

## Phase 3 — Implement

### Step 3a — Implement using framework-specific patterns

Follow the correct pattern for the chosen framework and capability type:

#### AGNO — Implementation Patterns

**Adding a built-in toolkit tool:**
```python
# Verify the exact import path from Research Phase first
from agno.tools.[module] import [ToolkitClass]

agent = Agent(..., tools=[..., [ToolkitClass]()])
```

**Adding a custom tool:**
```python
from agno.tools import tool

@tool()
def [tool_name]([param]: [type]) -> [return_type]:
    """[Trigger condition — when to call this tool].

    Args:
        [param]: [description].
    Returns:
        [description of return value].
    """
    # implementation using [library/API from research]
    return result
```
The docstring IS the tool spec — make the trigger condition precise and unambiguous.

**Adding an MCP server tool:**
```python
from agno.tools.mcp import MCPTools
# HTTP-based:
mcp = MCPTools(transport="streamable-http", url="[mcp_server_url]")
# stdio-based:
mcp = MCPTools(command="npx -y @modelcontextprotocol/[server-name]")
```

**Adding structured output:**
```python
from pydantic import BaseModel, Field

class [ResponseModel](BaseModel):
    [field]: [type] = Field(description="[what this field contains]")
    ...

agent = Agent(..., output_model=[ResponseModel])
```

**Adding long-term memory:**
```python
# Low-cost — extracts facts after each run:
agent = Agent(..., update_memory_on_run=True)

# Real-time — updates memory mid-conversation (higher cost):
agent = Agent(..., enable_agentic_memory=True)
```

**Adding human-in-the-loop confirmation:**
```python
from agno.tools import tool

@tool(requires_confirmation=True)   # pauses run and asks user to approve
def [sensitive_action]([params]) -> str:
    """[Description. Requires user confirmation before executing.]"""
    # implementation
    return "[confirmation message]"
```

#### CREWAI — Implementation Patterns

**Adding a tool to an existing agent** → update `crew.py` agent method:
```python
from crewai_tools import [NewTool]

@agent
def [agent_name](self) -> Agent:
    return Agent(config=..., tools=[..., [NewTool]()])
```
Update the agent's `goal` in `agents.yaml` to describe when to use the new tool.

**Adding a new agent + task** → add to `agents.yaml` + `tasks.yaml` + add `@agent` and `@task` methods to `crew.py`. Add `context: [upstream_task]` to the new task if it depends on previous output.

**Changing process type** → edit `Crew(process=Process.[sequential|hierarchical])`. For hierarchical: add a `manager_llm` parameter.

#### LANGGRAPH — Implementation Patterns

**Adding a new tool to a ReAct agent:**
```python
# tools.py — add new @tool function with precise docstring
@tool
def [new_tool]([param]: str) -> str:
    """[Trigger condition]. Do NOT use for [exclusion].
    Args: [param]: [description].
    Returns: [description].
    """
    ...

# agent.py — add to tools list
graph = create_agent(model=model, tools=[..., new_tool], ...)  # from langchain.agents
```

**Adding a new specialist node to a supervisor graph:**
1. Create `agents/[specialist].py` with `create_agent` (from `langchain.agents`) + node wrapper function.
2. Add node to `graph.py`: `workflow.add_node("[name]", [node_fn])`; add edge back to supervisor.
3. Update `SUPERVISOR_SYSTEM` routing rules to include the new agent.

**Adding human-in-the-loop interrupt:**
```python
from langgraph.types import interrupt

def [confirmation_node](state: dict) -> dict:
    decision = interrupt({"question": "Proceed?", "details": state["pending_action"]})
    return {"approved": decision == "yes"}
```

**Adding custom state fields:**
```python
# state.py — extend TypedDict
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    [new_field]: [type]    # add here
```

#### GOOGLE ADK — Implementation Patterns

**Adding a new tool function:**
```python
# tools/[domain]_tools.py
def [new_tool]([param]: [type]) -> dict:
    """[Trigger condition]. 
    Args: [param]: [description].
    Returns: dict with keys: [list key names].
    """
    # implementation
    return {"[key]": result}
```
Return `dict` for structured data, `str` for text. Always handle exceptions — return `{"error": "..."}` instead of raising.

**Adding a sub-agent (agent-as-tool):**
```python
from google.adk.agents import LlmAgent

[specialist] = LlmAgent(
    name="[specialist_name]",
    model="gemini-2.5-flash",
    instruction="[Specialist's focused instruction]",
    tools=[specialist_tools...],
)

root_agent = LlmAgent(
    ...,
    tools=[..., [specialist]],   # LlmAgent instances are valid tools
)
```
Update `INSTRUCTION` to describe when to delegate to the sub-agent.

---

### Step 3b — Update the Spec

Add the spec text from the blueprint's "SPEC ADDITIONS" section to the correct location:

| Framework | Where to add |
|---|---|
| Agno | `INSTRUCTIONS` string in `agent.py` |
| CrewAI | `goal` / `backstory` in `agents.yaml`; `description` / `expected_output` in `tasks.yaml` |
| LangGraph | `SYSTEM_PROMPT` in `agent.py`; tool docstrings in `tools.py` |
| Google ADK | `INSTRUCTION` string in `agent.py`; tool docstrings in `tools/` |

Do not disrupt existing spec content — add the new section cleanly without changing existing rules.

---

### Step 3c — Validate & Update Test Suite

**Part A — Regression probes** (from blueprint): run both regression probes to confirm nothing broke:
```bash
# run with existing framework command, using the regression probe inputs
```

**Part B — New capability probes** (from blueprint): run both new probes:
```bash
# verify Probe 1: new tool is called / new behaviour is visible
# verify Probe 2: edge case is handled gracefully
```

For tool-call verification, check debug logs:
- **Agno:** `debug_mode=True` shows tool calls in stdout
- **CrewAI:** `verbose=True` + `output_log_file`
- **LangGraph:** stream mode or LangSmith trace
- **Google ADK:** `GOOGLE_ADK_LOG_LEVEL=debug`

If any probe fails, apply the diagnosis process from `/improve-agent` Step 6 — classify as spec / tool / API / config problem, search docs if API-related, apply fix, re-run.

**Update Mocked Test Suite:**
1. Open `tests/test_<slug>.py` (or equivalent).
2. Append the new mocked test cases (as planned in the Extension Blueprint) matching the Test Constitution.
3. Run the complete test suite to ensure that both old tests (regression check) and new tests pass:
   ```bash
   pytest tests/
   ```

---

### Step 3d — Commit

```bash
git add [modified and new files] tests/test_<slug>.py
git commit -m "feat(<slug>): add [capability-name]"
```

---

## Success Criteria

- Phase 1 Research Report identifies a concrete implementation path (native or custom).
- Extension Blueprint was reviewed and confirmed by the user before any code was written.
- Both new capability probes pass.
- Both regression probes pass (no existing behaviour broken).
- Spec accurately describes the new capability and its trigger condition.
- The mocked test suite `tests/test_<slug>.py` is updated with the new capability tests.
- Running `pytest tests/` returns success for all tests.
- No unhandled exceptions in debug logs.
- Changes committed.
