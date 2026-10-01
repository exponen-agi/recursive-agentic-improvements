# CrewAI Content Pipeline — Create New Agent

<!-- Validated against: crewai==1.15.17 — 2026-09-10 -->

Create a multi-agent content generation crew using CrewAI. A content pipeline typically produces blog posts, social media content, newsletters, or marketing copy through a chain of specialist agents.

---

## Preconditions

- `pip install crewai crewai-tools`
- `ANTHROPIC_API_KEY` is set.
- Content brief or style guide available (optional but recommended).

---

## Step 1 — Define the Pipeline

Confirm with the user:

1. **Content type** — blog post, LinkedIn post, newsletter, product description, email campaign
2. **Target audience** — technical, executive, consumer, developer, etc.
3. **Brand voice** — formal/informal, enthusiastic/measured, UK/US English
4. **Pipeline stages** — which of these agents do you need:
   - `content_strategist` — plans the content angle and structure
   - `copywriter` — writes the first draft
   - `editor` — improves clarity, flow, and tone
   - `seo_specialist` — optimises for search (optional)
   - `social_media_writer` — adapts for social platforms (optional)
5. **Input** — topic only, or full brief with keywords, audience, length?
6. **Output format** — markdown file, JSON with sections, plain text

---

## Step 2 — Scaffold with CLI

```bash
crewai create crew <pipeline-slug>
cd <pipeline-slug>
```

---

## Step 3 — Define Agents in YAML

```yaml
# src/<pipeline_slug>/config/agents.yaml

content_strategist:
  role: >
    Senior Content Strategist
  goal: >
    Plan a compelling content angle, structure, and key messages for an article about {topic}
    targeting {audience}. The plan must differentiate the content from generic takes on the topic.
  backstory: >
    You have 12 years of experience planning content for SaaS, fintech, and B2B tech companies.
    You know what hooks grab attention and what structures keep readers engaged.
    You always think about the reader's problem before thinking about the content.
    You write briefs that give writers clear direction without restricting their creativity.
  verbose: true
  allow_delegation: false
  llm: anthropic/claude-sonnet-5-5

copywriter:
  role: >
    Expert Copywriter
  goal: >
    Write a high-quality first draft of a {content_type} about {topic} following the
    content brief exactly. Match the voice: {brand_voice}.
  backstory: >
    You write with clarity, wit, and precision. You follow briefs closely but bring
    your own voice and originality to every piece. You never write generic filler content.
    You write like a human who cares about the reader's time. You always start with a
    hook that makes the reader want to continue. You follow the outline given to you.
  verbose: true
  allow_delegation: false
  llm: anthropic/claude-sonnet-5-5

editor:
  role: >
    Senior Editor and Proofreader
  goal: >
    Review and improve the draft {content_type} about {topic} for clarity, accuracy,
    tone consistency, and readability. Eliminate jargon, passive voice, and empty phrases.
  backstory: >
    You have edited content for leading tech publications and Fortune 500 company blogs.
    You have strong opinions about what makes writing excellent. You catch inconsistencies,
    weak arguments, and unclear passages. You improve without rewriting — you enhance the
    writer's voice, not replace it. You know the difference between a style preference
    and an actual error.
  verbose: true
  allow_delegation: false
  llm: anthropic/claude-sonnet-5-5
```

---

## Step 4 — Define Tasks in YAML

```yaml
# src/<pipeline_slug>/config/tasks.yaml

strategy_task:
  description: >
    Create a detailed content brief for a {content_type} about {topic} for {audience}.
    
    The brief must include:
    1. A compelling headline option (primary + 2 alternatives)
    2. The core angle / unique perspective (why this piece, why now)
    3. Target reader persona (1 paragraph)
    4. Key messages (5 bullet points)
    5. Recommended structure / outline (with section headers and 1-line descriptions)
    6. Tone and style notes
    7. Keywords to naturally include: {keywords}
    
    Length of brief: 300–500 words.
  expected_output: >
    A structured content brief document with all 7 sections listed above,
    formatted in markdown with clear headers.
  agent: content_strategist

writing_task:
  description: >
    Write a complete {content_type} about {topic} following the content brief exactly.
    
    Requirements:
    - Length: {word_count} words (±10%)
    - Voice: {brand_voice}
    - Format: markdown with headers, subheaders, and bullet lists where appropriate
    - Must include a compelling opening hook (first sentence must grab attention)
    - Must have a clear call-to-action at the end
    - Must naturally incorporate keywords from the brief
    - Do NOT add a conclusion that just summarises what was said — end with impact
  expected_output: >
    A complete, publication-ready first draft in markdown format.
    Must include: title, introduction with hook, body sections per outline,
    and a strong conclusion with CTA.
  agent: copywriter
  context:
    - strategy_task
  output_file: output/draft_{topic}.md

editing_task:
  description: >
    Edit and improve the draft {content_type} about {topic}.
    
    Edit for:
    1. Clarity: eliminate jargon, unexplained acronyms, and abstract statements
    2. Flow: ensure smooth transitions between sections
    3. Tone: consistent {brand_voice} throughout
    4. Concision: cut unnecessary words without losing meaning
    5. Accuracy: flag any claims that seem questionable (do not fix — just note)
    6. Headlines and subheads: ensure they are scannable and descriptive
    
    Track changes: show what you changed and why for major edits (optional inline comments).
  expected_output: >
    A polished final version of the {content_type} in markdown, ready for publishing.
    Optional: a brief editorial notes section at the end listing major changes made.
  agent: editor
  context:
    - writing_task
  output_file: output/final_{topic}.md
```

---

## Step 5 — Define the Crew Class

```python
# src/<pipeline_slug>/crew.py
from crewai import Agent, Task, Crew, Process
from crewai.project import CrewBase, agent, task, crew

@CrewBase
class ContentPipeline:
    """Multi-agent content creation pipeline."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def content_strategist(self) -> Agent:
        return Agent(config=self.agents_config["content_strategist"])

    @agent
    def copywriter(self) -> Agent:
        return Agent(config=self.agents_config["copywriter"])

    @agent
    def editor(self) -> Agent:
        return Agent(config=self.agents_config["editor"])

    @task
    def strategy_task(self) -> Task:
        return Task(config=self.tasks_config["strategy_task"])

    @task
    def writing_task(self) -> Task:
        return Task(config=self.tasks_config["writing_task"])

    @task
    def editing_task(self) -> Task:
        return Task(config=self.tasks_config["editing_task"])

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            output_log_file="logs/pipeline.log",
        )
```

---

## Step 6 — Entry Point

```python
# src/<pipeline_slug>/main.py
import sys
from <pipeline_slug>.crew import ContentPipeline

def run():
    inputs = {
        "topic": sys.argv[1] if len(sys.argv) > 1 else "AI in healthcare",
        "content_type": "blog post",
        "audience": "healthcare executives",
        "brand_voice": "authoritative but approachable, US English",
        "word_count": "800",
        "keywords": "AI healthcare, clinical AI, patient outcomes",
    }
    result = ContentPipeline().crew().kickoff(inputs=inputs)
    print(result.raw)

if __name__ == "__main__":
    run()
```

---

## Step 7 — Smoke Tests

**Probe 1 — Full pipeline runs:**
```python
from <pipeline_slug>.crew import ContentPipeline
result = ContentPipeline().crew().kickoff(inputs={
    "topic": "remote work productivity",
    "content_type": "blog post",
    "audience": "HR managers",
    "brand_voice": "professional and empathetic",
    "word_count": "600",
    "keywords": "remote work, productivity, hybrid teams",
})
assert result.raw is not None
assert len(result.raw) > 400
```

**Probe 2 — Output file created:**
```python
import os
assert os.path.exists("output/final_remote work productivity.md")
```

**Probe 3 — Content has proper structure:**
```python
content = result.raw
assert "#" in content   # has headers
assert len(content.split()) > 400  # meets word count
```

---

## Step 8 — Commit

```bash
git add src/ output/
git commit -m "feat: scaffold <pipeline-slug> content pipeline (CrewAI)"
```

---

## Success Criteria

- All three stages run without errors.
- Final output file is created.
- Content has proper markdown structure.
- Word count is within ±10% of target.
