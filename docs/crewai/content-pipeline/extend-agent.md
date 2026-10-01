# CrewAI Content Pipeline — Extend Agent

<!-- Validated against: crewai==1.15.17 — 2026-09-10 -->

Add new stages, distribution channels, or content formats to an existing content pipeline.

---

## Preconditions

- Pipeline passes its current probe suite.

---

## Common Extensions

### Extension A — Add SEO Specialist Agent

```yaml
# config/agents.yaml
seo_specialist:
  role: >
    SEO Content Specialist
  goal: >
    Optimise the final article about {topic} for search engines while preserving
    the quality and natural flow of the writing.
  backstory: >
    You have optimised content for 200+ websites achieving top-3 rankings.
    You know that good SEO in 2026 means genuinely useful content with natural
    keyword placement, strong headings, and clear meta descriptions.
    You never keyword-stuff. You add SEO value without hurting readability.
  llm: anthropic/claude-sonnet-5-5
```

```yaml
# config/tasks.yaml
seo_task:
  description: >
    Optimise the article about {topic} for SEO.
    1. Suggest an optimised title tag (60 chars max) and meta description (155 chars max).
    2. Verify primary keyword "{primary_keyword}" appears in H1, first paragraph, and 2–3 subheadings.
    3. Add internal linking placeholders: [INTERNAL_LINK: relevant topic].
    4. Suggest 3 related keywords to sprinkle naturally.
    5. Score the current content: Low / Medium / High SEO readiness.
  expected_output: >
    SEO recommendations document plus an optimised version of the article.
  agent: seo_specialist
  context:
    - editing_task
  output_file: output/seo_{topic}.md
```

---

### Extension B — Add Social Media Adaptation Stage

```yaml
# config/agents.yaml
social_media_writer:
  role: >
    Social Media Content Specialist
  goal: >
    Create platform-optimised social media posts promoting the article about {topic}.
  backstory: >
    You write social media content that gets engagement, not just impressions.
    You know LinkedIn rewards professional insights, Twitter/X rewards brevity and controversy,
    and Instagram rewards visual hooks. You adapt the same core message to each platform's
    culture and format constraints.
  llm: anthropic/claude-sonnet-5-5
```

```yaml
# config/tasks.yaml
social_media_task:
  description: >
    Create social media posts to promote the article about {topic}.
    Produce one post for each platform:
    - LinkedIn: 150–200 words, professional insight angle, 3 relevant hashtags
    - Twitter/X: 240 chars max, hook + value + link placeholder
    - Newsletter teaser: 80 words, FOMO-driven, subscriber-only tone
  expected_output: >
    Three social media posts clearly labelled by platform, formatted for copy-paste.
  agent: social_media_writer
  context:
    - editing_task
  output_file: output/social_{topic}.md
```

---

### Extension C — Add Quality Scorer

Add a simple scoring step that rates the final content objectively:

```python
# src/<pipeline_slug>/tools/quality_scorer.py
from crewai.tools import BaseTool

class ContentQualityScorer(BaseTool):
    name: str = "score_content_quality"
    description: str = "Score content quality on readability, structure, and completeness (1–10)."

    def _run(self, content: str) -> str:
        checks = {
            "has_title": content.strip().startswith("#"),
            "has_sections": content.count("##") >= 3,
            "has_cta": any(kw in content.lower() for kw in ["click", "learn more", "get started", "contact", "download"]),
            "word_count_ok": 400 <= len(content.split()) <= 1500,
            "no_placeholder_text": "[PLACEHOLDER]" not in content,
        }
        score = sum(checks.values()) * 2  # max 10
        return f"Quality score: {score}/10\nChecks: {checks}"
```

---

### Extension D — Parallel Content Generation

Generate multiple content pieces simultaneously using `Process.parallel` (experimental in CrewAI):

```python
from crewai import Process

@crew
def crew(self) -> Crew:
    return Crew(
        agents=[copywriter_1, copywriter_2],
        tasks=[writing_task_1, writing_task_2],  # two independent writing tasks
        process=Process.parallel,
        verbose=True,
    )
```

---

## Validation After Extension

1. New stage probe: does the new agent produce correct output?
2. Handoff probe: does the new stage use the previous stage's output?
3. Regression: do the first three pipeline stages still produce the same quality?

---

## Commit

```bash
git add src/<pipeline_slug>/
git commit -m "feat(<pipeline-slug>): add <extension-name> stage"
```
