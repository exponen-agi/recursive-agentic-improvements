# CrewAI Research Crew — Create New Agent

<!-- Validated against: crewai==1.15.17 — 2026-09-10 -->

Create a multi-agent research crew using CrewAI. A research crew typically has a researcher who gathers data and an analyst who synthesises findings into a report.

---

## Preconditions

- `pip install crewai crewai-tools`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set.
- Understanding of CrewAI's three core primitives: **Agent** (who), **Task** (what), **Crew** (how).

---

## Step 1 — Define the Crew

Confirm with the user:

1. **Research topic domain** — technology, finance, market research, academic, etc.
2. **Agent roster** — typically 2–3 agents:
   - `senior_researcher` — searches and gathers raw data
   - `reporting_analyst` — synthesises into a polished report
   - Optional: `fact_checker` — validates claims from researcher
3. **Output format** — markdown report, JSON, plain prose
4. **Process type** — `sequential` (default) or `hierarchical` (manager oversees)
5. **Memory** — should agents remember across crew runs?

---

## Step 2 — Project Structure

Use the CrewAI CLI to scaffold:

```bash
crewai create crew <crew-slug>
cd <crew-slug>
```

This generates:

```
<crew-slug>/
├── src/
│   └── <crew_slug>/
│       ├── __init__.py
│       ├── main.py              # entry point
│       ├── crew.py              # Crew class definition
│       ├── tools/
│       │   ├── __init__.py
│       │   └── custom_tool.py   # custom tools
│       └── config/
│           ├── agents.yaml      # agent definitions
│           └── tasks.yaml       # task definitions
├── .env
└── pyproject.toml
```

---

## Step 3 — Define Agents in YAML

The three pillars of every CrewAI agent: **role**, **goal**, **backstory**.

```yaml
# src/<crew_slug>/config/agents.yaml

senior_researcher:
  role: >
    Senior Research Analyst for {topic}
  goal: >
    Uncover groundbreaking developments and comprehensive insights about {topic}.
    Find at least 5 credible sources. Prioritise recency (last 6 months).
  backstory: >
    You are a seasoned researcher with 15 years of experience in academic and
    industry research. You know how to evaluate source credibility, identify
    primary vs secondary sources, and spot misinformation. You never cite a source
    you have not verified. You are thorough, methodical, and sceptical by default.
  verbose: true
  allow_delegation: false
  llm: anthropic/claude-sonnet-5-5

reporting_analyst:
  role: >
    Reporting Analyst and Technical Writer
  goal: >
    Transform raw research findings into a clear, well-structured report on {topic}
    that a non-expert can understand. Ensure all claims are backed by cited sources.
  backstory: >
    You are an expert at synthesising complex information into compelling narratives.
    You have written hundreds of research reports for executives and technical teams.
    You understand that a good report tells a story: context, finding, implication.
    You never add information not present in the research you receive.
  verbose: true
  allow_delegation: false
  llm: anthropic/claude-sonnet-5-5
```

**Critical YAML guidelines:**
- **Role**: job title only, describes the agent's function
- **Goal**: the measurable outcome — be specific about quantity and quality
- **Backstory**: shapes the LLM's reasoning style; include domain expertise and quality standards, not just personality
- Use `{topic}` and other placeholders for runtime variable substitution

---

## Step 4 — Define Tasks in YAML

```yaml
# src/<crew_slug>/config/tasks.yaml

research_task:
  description: >
    Conduct comprehensive research on {topic}.
    
    Specifically:
    1. Search for the latest developments (last 6 months preferred).
    2. Identify key players, trends, and data points.
    3. Find at least 5 credible sources (news, academic papers, official reports).
    4. Note any conflicting information or contested claims.
    5. Extract direct quotes where impactful.
    
    Context: {additional_context}
  expected_output: >
    A structured research brief containing:
    - Executive summary (3–5 sentences)
    - Key findings (at least 5 bullet points with source citations)
    - Data and statistics (with source and date)
    - Notable quotes (with attribution)
    - Sources list (title, URL or reference, date accessed)
    - Open questions for further research
  agent: senior_researcher

reporting_task:
  description: >
    Using the research brief provided, write a comprehensive report on {topic}.
    
    The report must:
    1. Be written for a non-expert audience.
    2. Start with a compelling executive summary.
    3. Organise findings into logical sections with headers.
    4. Cite every factual claim with the source from the research brief.
    5. End with conclusions and recommendations.
    
    Do NOT introduce any information not present in the research brief.
  expected_output: >
    A polished markdown report with:
    - Title and date
    - Executive Summary
    - Background / Context
    - Key Findings (with inline citations)
    - Analysis and Implications
    - Conclusions and Recommendations
    - References section
  agent: reporting_analyst
  context:
    - research_task       # receives output of research_task as input
  output_file: output/report_{topic}.md
```

---

## Step 5 — Define the Crew Class

```python
# src/<crew_slug>/crew.py
from crewai import Agent, Task, Crew, Process
from crewai.project import CrewBase, agent, task, crew
from crewai_tools import SerperDevTool, WebsiteSearchTool

@CrewBase
class ResearchCrew:
    """Research crew for in-depth topic analysis."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def senior_researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["senior_researcher"],
            tools=[
                SerperDevTool(),       # Google search
                WebsiteSearchTool(),   # RAG on specific URLs
            ],
            verbose=True,
        )

    @agent
    def reporting_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["reporting_analyst"],
            # Analyst does not need external tools — works from researcher output
            verbose=True,
        )

    @task
    def research_task(self) -> Task:
        return Task(config=self.tasks_config["research_task"])

    @task
    def reporting_task(self) -> Task:
        return Task(config=self.tasks_config["reporting_task"])

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,   # researcher → analyst
            verbose=True,
            memory=True,                  # enable short-term + long-term memory
            output_log_file="logs/crew_run.log",
        )
```

---

## Step 6 — Entry Point

```python
# src/<crew_slug>/main.py
import sys
from <crew_slug>.crew import ResearchCrew

def run():
    inputs = {
        "topic": sys.argv[1] if len(sys.argv) > 1 else "artificial intelligence in healthcare",
        "additional_context": "",
    }
    result = ResearchCrew().crew().kickoff(inputs=inputs)
    print(result.raw)

if __name__ == "__main__":
    run()
```

```bash
cd src
python -m <crew_slug>.main "quantum computing breakthroughs 2026"
```

---

## Step 7 — Smoke Tests

**Probe 1 — Full pipeline runs without error:**
```python
from <crew_slug>.crew import ResearchCrew
result = ResearchCrew().crew().kickoff(inputs={"topic": "AI regulation", "additional_context": ""})
assert result.raw is not None
assert len(result.raw) > 200
```

**Probe 2 — Report contains citations:**
```python
assert "http" in result.raw or "source" in result.raw.lower()
```

**Probe 3 — Output file created:**
```python
import os
assert os.path.exists("output/report_AI regulation.md")
```

---

## Step 8 — Commit

```bash
git add src/ output/ logs/
git commit -m "feat: scaffold <crew-slug> research crew (CrewAI)"
```

---

## Success Criteria

- Crew runs end-to-end without agent errors.
- Report is generated with proper structure.
- Sources are cited in the output.
- Output file is created at the configured path.
