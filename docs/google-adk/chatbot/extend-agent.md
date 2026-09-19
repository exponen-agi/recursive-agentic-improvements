# Google ADK Chatbot — Extend Agent

<!-- Validated against: google-adk==2.9.1 — 2026-09-17 -->

Add new tools, sub-agents, or capabilities to an existing Google ADK chatbot.

---

## Preconditions

- Agent passes its current probe suite.
- You have access to ADK docs context.

---

## Common Extensions

### Extension A — Add a New Tool

```python
# <agent_slug>/tools.py

def query_knowledge_base(question: str) -> str:
    """Search the internal knowledge base for answers.

    Use this tool for questions about company policies, product documentation,
    or internal procedures. Prefer this over web search for internal topics.

    Args:
        question: The question to search the knowledge base for.

    Returns:
        Relevant passages from the knowledge base, or 'Not found' if no match.
    """
    # Implement with your vector store (Vertex AI Search, Pinecone, etc.)
    return "Knowledge base result placeholder"
```

Add to agent:
```python
from <agent_slug>.tools import get_current_time, search_web, query_knowledge_base

root_agent = LlmAgent(
    ...
    tools=[get_current_time, search_web, query_knowledge_base],
)
```

Update `INSTRUCTION` with trigger condition for the new tool.

---

### Extension B — Add Sub-Agents (Multi-Agent)

ADK supports sub-agents via `sub_agents` parameter:

```python
from google.adk.agents import LlmAgent

# Specialist sub-agent
search_specialist = LlmAgent(
    name="search_specialist",
    model="gemini-2.5-flash",
    instruction="""You are a web search specialist.
    Given a query, perform a targeted web search and return a structured summary.
    Always include source URLs.""",
    tools=[search_web],
)

# Main chatbot with sub-agent
root_agent = LlmAgent(
    name="<agent_slug>",
    model="gemini-2.5-pro",
    instruction=INSTRUCTION,
    sub_agents=[search_specialist],
    tools=[get_current_time],
)
```

Update `INSTRUCTION` to describe when to delegate to sub-agents.

---

### Extension C — Add Session State and Callbacks

Track custom state across conversation turns:

```python
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse, LlmRequest
from typing import Optional

def before_model_callback(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    """Inject session state into the model request."""
    state = callback_context.state
    user_name = state.get("user_name", "")
    if user_name:
        # Prepend user name to context
        callback_context.state["injected_context"] = f"The user's name is {user_name}."
    return None  # return None to continue normally; return LlmResponse to short-circuit

root_agent = LlmAgent(
    name="<agent_slug>",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[get_current_time, search_web],
    before_model_callback=before_model_callback,
)
```

---

### Extension D — Add Grounding with Google Search

Enable Google Search grounding directly in Gemini:

```python
from google.adk.tools import google_search

root_agent = LlmAgent(
    name="<agent_slug>",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[
        google_search,  # built-in ADK tool for Google Search grounding
        get_current_time,
    ],
)
```

Update `INSTRUCTION`: "Use `google_search` for any question requiring current information from the web."

---

### Extension E — Non-Gemini Model (via LiteLLM)

Switch to Claude or another provider:

```python
root_agent = LlmAgent(
    name="<agent_slug>",
    model="anthropic/claude-sonnet-4-6",   # LiteLLM format
    instruction=INSTRUCTION,
    tools=[get_current_time, search_web],
)
```

Ensure `ANTHROPIC_API_KEY` is set. The `instruction` format remains identical.

---

## Validation After Extension

1. New tool probe: question that specifically triggers the new tool.
2. Tool routing probe: question where old and new tools could both apply — verify correct choice.
3. Regression: 2 existing passing probes still pass.

---

## Commit

```bash
git add <agent_slug>/
git commit -m "feat(<agent-slug>): add <extension-name>"
```
