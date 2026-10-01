# LangGraph Multi-Agent Supervisor — Create New Agent

<!-- Validated against: langgraph==1.2.11 — 2026-09-10 -->

Create a multi-agent system where a supervisor LLM routes tasks to specialist sub-agents using LangGraph. This pattern is ideal for systems that need different tools or expertise for different query types.

---

## Preconditions

- `pip install langgraph langchain langchain-anthropic langsmith`
- `ANTHROPIC_API_KEY` and `LANGSMITH_API_KEY` are set.
- Clear understanding of the specialist agents needed.

---

## Step 1 — Define the Multi-Agent System

Confirm with the user:

1. **Supervisor role** — what decisions does the supervisor make? (route, decompose tasks, synthesise results)
2. **Specialist agents** — list each agent, its domain, and its tools
3. **Routing logic** — how does the supervisor decide which agent to call?
4. **Response synthesis** — does the supervisor synthesise results, or return sub-agent output directly?
5. **State sharing** — what state is shared across all agents?

---

## Step 2 — Project Structure

```
src/
└── <slug>/
    ├── __init__.py
    ├── supervisor.py       # supervisor node and routing
    ├── agents/
    │   ├── __init__.py
    │   ├── researcher.py
    │   ├── analyst.py
    │   └── writer.py
    ├── state.py            # shared state definition
    ├── graph.py            # assembled multi-agent graph
    └── run.py
```

---

## Step 3 — Define Shared State

```python
# src/<slug>/state.py
from typing import Annotated, TypedDict
from langgraph.graph.message import add_messages

class SupervisorState(TypedDict):
    messages: Annotated[list, add_messages]
    next_agent: str          # supervisor decision: which agent runs next
    task_result: str         # accumulated results from sub-agents
```

---

## Step 4 — Define Specialist Agents

Each specialist is a compiled sub-graph or a single node:

```python
# src/<slug>/agents/researcher.py
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain.agents import create_agent

RESEARCHER_PROMPT = """You are a research specialist.
Your job: gather factual information using web search.
ALWAYS search before stating facts. Return only verified information.
Format: bullet list with source for each fact."""

search = DuckDuckGoSearchRun()

@tool
def web_search(query: str) -> str:
    """Search the web for current information.
    Args:
        query: Search query string.
    Returns:
        Top search results as text.
    """
    return search.run(query)

researcher_model = init_chat_model("claude-sonnet-5-5", model_provider="anthropic")
researcher_agent = create_agent(
    model=researcher_model,
    tools=[web_search],
    system_prompt=RESEARCHER_PROMPT,
)

def researcher_node(state: dict) -> dict:
    """Wrap researcher agent as a graph node."""
    result = researcher_agent.invoke(state)
    return {"messages": result["messages"], "task_result": result["messages"][-1].content}
```

Repeat this pattern for each specialist agent.

---

## Step 5 — Define the Supervisor

```python
# src/<slug>/supervisor.py
from typing import Literal
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage

SUPERVISOR_SYSTEM = """You are a supervisor that routes tasks to specialist agents.

Available agents:
- researcher: Gathers factual information and current data via web search.
- analyst: Analyses data, identifies patterns, and draws conclusions.
- writer: Produces polished written output from research and analysis.

Decision rules:
1. Route to 'researcher' when current facts, data, or news are needed.
2. Route to 'analyst' after research is complete and analysis is needed.
3. Route to 'writer' when research and analysis are done and a final output is needed.
4. Route to 'FINISH' when the task is complete.

Respond with ONLY ONE of: researcher, analyst, writer, FINISH
"""

supervisor_model = init_chat_model("claude-sonnet-5-5", model_provider="anthropic")

def supervisor_node(state: dict) -> dict:
    """Route to the appropriate agent."""
    messages = [SystemMessage(content=SUPERVISOR_SYSTEM)] + state["messages"]
    response = supervisor_model.invoke(messages)
    next_agent = response.content.strip()

    # Validate the routing decision
    valid = ["researcher", "analyst", "writer", "FINISH"]
    if next_agent not in valid:
        next_agent = "FINISH"

    return {"next_agent": next_agent}
```

---

## Step 6 — Assemble the Graph

```python
# src/<slug>/graph.py
from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import InMemorySaver

from src.<slug>.state import SupervisorState
from src.<slug>.supervisor import supervisor_node
from src.<slug>.agents.researcher import researcher_node
from src.<slug>.agents.analyst import analyst_node
from src.<slug>.agents.writer import writer_node

def build_graph():
    workflow = StateGraph(SupervisorState)

    # Add nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("analyst", analyst_node)
    workflow.add_node("writer", writer_node)

    # Supervisor routes to agents
    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state["next_agent"],
        {
            "researcher": "researcher",
            "analyst": "analyst",
            "writer": "writer",
            "FINISH": END,
        }
    )

    # All agents return to supervisor after completing
    workflow.add_edge("researcher", "supervisor")
    workflow.add_edge("analyst", "supervisor")
    workflow.add_edge("writer", "supervisor")

    # Start at supervisor
    workflow.add_edge(START, "supervisor")

    return workflow.compile(checkpointer=InMemorySaver())

graph = build_graph()
```

---

## Step 7 — Run Script

```python
# src/<slug>/run.py
import sys
from langchain_core.messages import HumanMessage
from src.<slug>.graph import graph

def run(message: str, thread_id: str = "default"):
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(
        {"messages": [HumanMessage(content=message)], "next_agent": "", "task_result": ""},
        config=config,
    )
    return result["messages"][-1].content

if __name__ == "__main__":
    msg = " ".join(sys.argv[1:]) or "Research and write a brief report on AI regulation in 2026."
    print(run(msg))
```

---

## Step 8 — Smoke Tests

**Probe 1 — Supervisor routes correctly:**
```python
from src.<slug>.run import run
response = run("What is the stock price of NVDA today?")
# Check LangSmith trace: supervisor → researcher → supervisor → FINISH
assert len(response) > 50
```

**Probe 2 — Multi-agent pipeline completes:**
```python
response = run("Research and write a 200-word summary of quantum computing breakthroughs in 2026.")
# Should go: supervisor → researcher → analyst → writer → FINISH
assert len(response) > 150
```

**Probe 3 — Supervisor terminates correctly:**
```python
response = run("Hello, how are you?")  # simple greeting, no agents needed
# Should go: supervisor → FINISH directly
assert len(response) > 0
```

---

## Step 9 — Commit

```bash
git add src/<slug>/
git commit -m "feat: scaffold <slug> multi-agent supervisor (LangGraph)"
```

---

## Success Criteria

- Supervisor routes to correct agent for each probe.
- Multi-agent pipeline completes without infinite loops.
- FINISH condition works correctly.
- All agent traces visible in LangSmith.
