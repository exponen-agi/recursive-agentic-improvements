# Google ADK Tool-Using Agent — Extend Agent

<!-- Validated against: google-adk==2.9.1 — 2026-09-17 -->

Add new tools, MCP server integrations, or sub-agents to an existing ADK tool-using agent.

---

## Preconditions

- Agent passes its current probe suite.

---

## Common Extensions

### Extension A — Add an MCP Server Tool

Connect the agent to any MCP-compatible server:

```python
# <agent_slug>/agent.py
import asyncio
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

async def get_agent():
    """Build agent with MCP tools (async because MCP connection is async)."""
    mcp_tools, exit_stack = await MCPToolset.from_server(
        connection_params=StdioServerParameters(
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        )
    )
    from google.adk.agents import LlmAgent
    agent = LlmAgent(
        name="<agent_slug>",
        model="gemini-2.5-flash",
        instruction=INSTRUCTION,
        tools=[*mcp_tools],  # spread MCP tools into the tools list
    )
    return agent, exit_stack

# In run.py:
async def main():
    agent, exit_stack = await get_agent()
    async with exit_stack:
        # run agent here
        pass
```

Update `INSTRUCTION` to describe the MCP server's capabilities.

---

### Extension B — Add Code Execution Tool

```python
def execute_python(code: str) -> dict:
    """Execute a Python code snippet safely in a sandboxed environment.

    Use this tool when the user asks for data analysis, calculations,
    file processing, or any task that benefits from code execution.
    Only use safe, read-only operations. Do not execute code that
    modifies the filesystem or network.

    Args:
        code: Valid Python code string to execute.

    Returns:
        A dict with keys: stdout (str), stderr (str), success (bool).
    """
    import subprocess
    import sys
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out after 10 seconds", "success": False}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "success": False}
```

---

### Extension C — Add a Specialist Sub-Agent

```python
from google.adk.agents import LlmAgent

data_analyst = LlmAgent(
    name="data_analyst",
    model="gemini-2.5-pro",
    instruction="""You are a data analyst. Given raw data, perform statistical analysis
    and produce clear insights. Always provide: mean, median, range, and 3 key insights.
    Format output as a structured report.""",
    tools=[execute_python],
)

root_agent = LlmAgent(
    name="<agent_slug>",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[fetch_user_data, update_user_plan],
    sub_agents=[data_analyst],  # add specialist
)
```

Add to `INSTRUCTION`: "Delegate data analysis tasks to the `data_analyst` sub-agent."

---

### Extension D — Add Structured Output

Enforce a consistent response format using ADK output schemas:

```python
from pydantic import BaseModel, Field
from typing import Optional
from google.adk.agents import LlmAgent

class ActionResult(BaseModel):
    action_taken: str = Field(description="What action was performed")
    success: bool = Field(description="Whether the action succeeded")
    result_summary: str = Field(description="Human-readable result")
    next_steps: Optional[list[str]] = Field(default=None, description="Suggested follow-up actions")

root_agent = LlmAgent(
    name="<agent_slug>",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[fetch_user_data, update_user_plan],
    output_schema=ActionResult,
)
```

---

## Validation After Extension

1. New tool probe: request that specifically requires the new tool.
2. Sequencing probe: verify new tool is called in the correct position in the workflow.
3. Regression: 2 existing probes still pass.

---

## Commit

```bash
git add <agent_slug>/
git commit -m "feat(<agent-slug>): add <extension-name>"
```
