# Google ADK Tool-Using Agent — Create New Agent

<!-- Validated against: google-adk==2.9.1 — 2026-09-17 -->

Create an ADK agent that heavily relies on tools to accomplish structured tasks: data retrieval, API integration, code execution, or workflow automation.

---

## Preconditions

- `pip install google-adk`
- API keys for both the LLM (`GOOGLE_API_KEY`) and any external services the tools will call.

---

## Step 1 — Define the Tool Contract

This agent type is tool-first. Before writing any agent code, define the tools:

1. **List every tool** the agent needs
2. **For each tool, define**:
   - Trigger condition (when should the LLM call it?)
   - Input parameters and types
   - Return format (dict? string?)
   - Error states and how to handle them
3. **Tool execution order** — can tools be called in any order, or is there a required sequence?
4. **Confirmation requirement** — should any tool require human approval before executing?

---

## Step 2 — Project Structure

```
<agent_slug>/
├── __init__.py
├── agent.py              # root_agent definition
├── tools/
│   ├── __init__.py
│   ├── <tool_a>.py       # one file per domain area
│   └── <tool_b>.py
└── config.py             # API clients and configuration
```

---

## Step 3 — Write Tools First

Each tool is a Python function. ADK auto-wraps it as a `FunctionTool`.

```python
# <agent_slug>/tools/data_tools.py

import json
from typing import Optional

def fetch_user_data(user_id: str) -> dict:
    """Fetch profile and account data for a specific user.

    Use this tool whenever the user asks about a customer's details,
    account status, or any user-specific information. Always call this
    before making any changes to a user's account.

    Args:
        user_id: The unique user identifier (e.g., "usr_12345" or email address).

    Returns:
        A dict with keys: user_id, name, email, plan, status, created_at.
        Returns {"error": "not_found"} if the user does not exist.
    """
    # Replace with real API call
    return {
        "user_id": user_id,
        "name": "Example User",
        "email": f"{user_id}@example.com",
        "plan": "pro",
        "status": "active",
        "created_at": "2024-01-15",
    }


def update_user_plan(user_id: str, new_plan: str) -> dict:
    """Update a user's subscription plan.

    Use this tool ONLY when the user explicitly asks to change a plan
    AND you have already confirmed the user's current plan with fetch_user_data.
    Do NOT call this without first fetching the user's current data.

    Args:
        user_id: The unique user identifier.
        new_plan: The plan to switch to: "free", "basic", "pro", "enterprise".

    Returns:
        A dict with keys: success (bool), user_id, old_plan, new_plan, message.
    """
    valid_plans = ["free", "basic", "pro", "enterprise"]
    if new_plan not in valid_plans:
        return {"success": False, "error": f"Invalid plan. Must be one of: {valid_plans}"}
    return {
        "success": True,
        "user_id": user_id,
        "old_plan": "basic",
        "new_plan": new_plan,
        "message": f"Plan updated to {new_plan}",
    }


def list_recent_transactions(user_id: str, limit: int = 10) -> dict:
    """List recent billing transactions for a user.

    Use this tool when the user asks about charges, invoices, billing history,
    or payment status. Limit defaults to 10 most recent transactions.

    Args:
        user_id: The unique user identifier.
        limit: Number of transactions to return (1–50). Default: 10.

    Returns:
        A dict with key "transactions" containing a list of transaction dicts,
        each with: id, date, amount, currency, description, status.
    """
    return {
        "transactions": [
            {"id": "txn_001", "date": "2026-05-01", "amount": 29.99, "currency": "USD",
             "description": "Pro plan monthly", "status": "paid"},
        ]
    }
```

---

## Step 4 — Write the INSTRUCTION

Tool-using agents need explicit orchestration rules:

```python
INSTRUCTION = """You are a <DOMAIN> automation agent. You use tools to complete user requests accurately.

## Core Workflow
1. Before taking any action, fetch current data to understand the state.
2. Confirm your understanding of what the user wants before making changes.
3. Execute the action using the appropriate tool.
4. Confirm the result to the user.

## Tools Available
- `fetch_user_data(user_id)`: ALWAYS call first before any user-specific action.
- `update_user_plan(user_id, new_plan)`: ONLY after fetching current data. REQUIRES confirmation if plan is being downgraded.
- `list_recent_transactions(user_id, limit)`: Use for billing and payment questions.

## Mandatory Rules
- NEVER make changes without first reading the current state.
- NEVER downgrade a plan without explicit user confirmation ("yes, downgrade me").
- NEVER fabricate data — use tools to get real information.
- If a tool returns an error, report it clearly and ask the user how to proceed.

## Response Format
After completing a tool action:
1. State what you did: "I've updated your plan to Pro."
2. Show the key result: plan name, effective date, etc.
3. Ask if there is anything else needed.
"""
```

---

## Step 5 — Define the Agent

```python
# <agent_slug>/agent.py
from google.adk.agents import LlmAgent
from <agent_slug>.tools.data_tools import (
    fetch_user_data,
    update_user_plan,
    list_recent_transactions,
)

INSTRUCTION = """..."""  # from Step 4

root_agent = LlmAgent(
    name="<agent_slug>",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[
        fetch_user_data,
        update_user_plan,
        list_recent_transactions,
    ],
)
```

---

## Step 6 — Run Programmatically

```python
# run.py
import asyncio
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from <agent_slug>.agent import root_agent

async def run_agent(message: str, user_id: str = "dev-user", session_id: str = "session-1"):
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        state={}, app_name="<agent_slug>", user_id=user_id,
    )
    runner = Runner(app_name="<agent_slug>", agent=root_agent, session_service=session_service)
    content = types.Content(role="user", parts=[types.Part(text=message)])
    async for event in runner.run_async(
        user_id=user_id, session_id=session.id, new_message=content,
    ):
        if event.is_final_response():
            return event.content.parts[0].text
    return ""

if __name__ == "__main__":
    import sys
    print(asyncio.run(run_agent(" ".join(sys.argv[1:]) or "Fetch data for user usr_001")))
```

---

## Step 7 — Smoke Tests

**Probe 1 — Data fetch is called before action:**
```python
response = asyncio.run(run_agent("Upgrade user usr_001 to enterprise plan"))
# ADK logs must show: fetch_user_data called BEFORE update_user_plan
assert "enterprise" in response.lower() or "updated" in response.lower()
```

**Probe 2 — Error handling:**
```python
response = asyncio.run(run_agent("Fetch data for user nonexistent_user_xyz"))
assert "not found" in response.lower() or "error" in response.lower() or "cannot" in response.lower()
```

**Probe 3 — Confirmation before downgrade:**
```python
response = asyncio.run(run_agent("Downgrade user usr_001 to free plan"))
# Agent should ask for confirmation, not execute immediately
assert "confirm" in response.lower() or "sure" in response.lower() or "downgrade" in response.lower()
```

---

## Step 8 — Commit

```bash
git add <agent_slug>/ run.py
git commit -m "feat: scaffold <agent-slug> tool-using agent (Google ADK)"
```

---

## Success Criteria

- Agent always fetches data before modifying it.
- Confirmation is sought before destructive actions.
- Error states from tools are handled gracefully.
- All 3 smoke tests pass.
