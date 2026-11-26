"""Static checks for the Core Invariants in CLAUDE.md (no network, no model calls)."""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SKILLS = sorted((ROOT / ".claude" / "commands").glob("*.md"))
FRAMEWORKS = ["Agno", "CrewAI", "LangGraph", "Google ADK"]
GATED = ["create-agent.md", "extend-agent.md"]  # skills that write code after a Blueprint


def _text(path):
    return path.read_text(encoding="utf-8")


def test_three_skills_exist():
    assert [p.name for p in SKILLS] == ["create-agent.md", "extend-agent.md", "improve-agent.md"]


@pytest.mark.parametrize("skill", SKILLS, ids=lambda p: p.name)
def test_skill_is_standalone(skill):
    # Invariant 1: a skill must not point at this repo's docs/ folder
    assert not re.search(r"(?<![\w.-])docs/", _text(skill)), "skill references docs/"


@pytest.mark.parametrize("skill", SKILLS, ids=lambda p: p.name)
def test_skill_covers_all_frameworks(skill):
    text = _text(skill)
    for name in FRAMEWORKS:
        assert name in text, f"{skill.name} is missing {name}"


@pytest.mark.parametrize("skill", SKILLS, ids=lambda p: p.name)
def test_skill_has_mcp_fallback(skill):
    text = _text(skill)
    assert "WebFetch" in text and "WebSearch" in text


@pytest.mark.parametrize("name", GATED)
def test_blueprint_confirmation_gate(name):
    # Invariant 5: explicit wait-for-confirmation gate before Phase 3
    text = _text(ROOT / ".claude" / "commands" / name)
    assert re.search(r"Wait for confirmation before (continuing|proceeding) to Phase 3", text)


@pytest.mark.parametrize("path", [*SKILLS, ROOT / "tests" / "TEST_CONSTITUTION.md"], ids=lambda p: p.name)
def test_fake_chat_model_import_is_core(path):
    # GenericFakeChatModel lives in langchain_core; langchain_community is an optional extra
    # that `pip install langgraph langchain` does not install, so generated tests would fail to import.
    assert "langchain_community.chat_models import GenericFakeChatModel" not in _text(path)


def test_crewai_scaffold_uses_classic_layout():
    # In crewai 1.15.x, `crewai create crew` without --classic builds a JSON project (no crew.py),
    # which breaks the @CrewBase structural pattern the skill relies on.
    for line in _text(ROOT / ".claude" / "commands" / "create-agent.md").splitlines():
        if line.startswith("crewai create crew"):
            assert "--classic" in line
