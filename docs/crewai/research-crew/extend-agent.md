# CrewAI Research Crew — Extend Agent

<!-- Validated against: crewai==1.15.17 — 2026-09-10 -->

Add new agents, tools, or capabilities to a CrewAI research crew.

---

## Preconditions

- Crew passes its current probe suite.
- You know which extension to add.

---

## Common Extensions

### Extension A — Add a Fact-Checker Agent

Add a third agent that validates the researcher's claims before passing to the analyst.

**In `config/agents.yaml`:**
```yaml
fact_checker:
  role: >
    Independent Fact Checker
  goal: >
    Verify the accuracy of claims in the research brief for {topic}.
    Flag any unverifiable claims, hallucinated citations, or logical inconsistencies.
  backstory: >
    You are a rigorous fact checker with a background in investigative journalism.
    You treat every claim as suspect until verified. You search for contradicting
    evidence as actively as confirming evidence. You never pass a report that
    contains unverified statistics or broken source links.
  verbose: true
  llm: anthropic/claude-sonnet-5-5
```

**In `config/tasks.yaml`:**
```yaml
fact_checking_task:
  description: >
    Review the research brief for {topic} and verify each factual claim.
    For every claim:
    1. Mark as VERIFIED (source confirmed), UNVERIFIED (cannot confirm), or FALSE (contradicted).
    2. For unverified claims, note what additional search would be needed.
    3. Remove or flag claims with fabricated URLs.
  expected_output: >
    An annotated research brief with each claim marked VERIFIED / UNVERIFIED / FALSE,
    plus a summary of issues found (if any) and a final verdict: PASS or NEEDS REVISION.
  agent: fact_checker
  context:
    - research_task
```

**In `crew.py`:**
```python
@agent
def fact_checker(self) -> Agent:
    return Agent(
        config=self.agents_config["fact_checker"],
        tools=[SerperDevTool()],
        verbose=True,
    )

@task
def fact_checking_task(self) -> Task:
    return Task(config=self.tasks_config["fact_checking_task"])

@crew
def crew(self) -> Crew:
    return Crew(
        agents=self.agents,
        tasks=self.tasks,
        process=Process.sequential,
        # New order: researcher → fact_checker → analyst
    )
```

Update `reporting_task` context to include `fact_checking_task`.

---

### Extension B — Switch to Hierarchical Process

Use a manager LLM to orchestrate the crew dynamically:

```python
@crew
def crew(self) -> Crew:
    return Crew(
        agents=self.agents,
        tasks=self.tasks,
        process=Process.hierarchical,
        manager_llm="anthropic/claude-sonnet-5-5",
        verbose=True,
    )
```

Remove `agent:` assignments from tasks.yaml — the manager decides which agent handles each task.

---

### Extension C — Add Long-Term Memory

```python
from crewai.memory import LongTermMemory
from crewai.memory.storage.ltm_sqlite_storage import LTMSQLiteStorage

@crew
def crew(self) -> Crew:
    return Crew(
        agents=self.agents,
        tasks=self.tasks,
        process=Process.sequential,
        memory=True,
        long_term_memory=LongTermMemory(
            storage=LTMSQLiteStorage(db_path="./memory/<crew-slug>.db")
        ),
    )
```

---

### Extension D — Add Custom Tool

```python
# src/<crew_slug>/tools/arxiv_tool.py
from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import requests

class ArxivSearchInput(BaseModel):
    query: str = Field(description="Search query for academic papers")
    max_results: int = Field(default=5, description="Number of results to return")

class ArxivSearchTool(BaseTool):
    name: str = "arxiv_search"
    description: str = (
        "Search for academic papers on arXiv. "
        "Use this for scientific topics requiring peer-reviewed sources."
    )
    args_schema: Type[BaseModel] = ArxivSearchInput

    def _run(self, query: str, max_results: int = 5) -> str:
        url = f"http://export.arxiv.org/api/query?search_query=all:{query}&max_results={max_results}"
        response = requests.get(url)
        # Parse and return results
        return response.text[:3000]  # truncate for LLM context
```

Add to researcher agent in `crew.py`:
```python
from <crew_slug>.tools.arxiv_tool import ArxivSearchTool

@agent
def senior_researcher(self) -> Agent:
    return Agent(
        config=self.agents_config["senior_researcher"],
        tools=[SerperDevTool(), WebsiteSearchTool(), ArxivSearchTool()],
        verbose=True,
    )
```

Update researcher's goal in agents.yaml:
```yaml
goal: >
  ...
  For scientific topics, search arXiv for peer-reviewed papers in addition to web sources.
```

---

### Extension E — Add Structured Output with Pydantic

```python
from pydantic import BaseModel
from typing import Optional

class ResearchReport(BaseModel):
    title: str
    executive_summary: str
    key_findings: list[str]
    sources: list[str]
    confidence: str  # Low / Medium / High
    word_count: Optional[int] = None

# In crew.py, add to reporting_task:
@task
def reporting_task(self) -> Task:
    return Task(
        config=self.tasks_config["reporting_task"],
        output_pydantic=ResearchReport,
    )
```

Access structured output:
```python
result = ResearchCrew().crew().kickoff(inputs=inputs)
report: ResearchReport = result.pydantic
print(report.executive_summary)
```

---

## Validation After Extension

1. Run 2 new probes targeting the new capability.
2. Run 2 existing probes to confirm no regressions.
3. Check `output_log_file` for unexpected errors.

---

## Commit

```bash
git add src/<crew_slug>/
git commit -m "feat(<crew-slug>): add <extension-name>"
```
