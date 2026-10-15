"""Checks that framework pins in tests/*/pyproject.toml match tests/README.md and CLAUDE.md."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKGS = {"agno": "Agno", "crewai": "CrewAI", "langgraph": "LangGraph", "google_adk": "Google ADK"}


def _pin(folder):
    text = (ROOT / "tests" / folder / "pyproject.toml").read_text(encoding="utf-8")
    return re.search(r'"[\w-]+==([\d.]+)"', text).group(1)


def test_pins_match_docs_tables():
    readme = (ROOT / "tests" / "README.md").read_text(encoding="utf-8")
    claude = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    for folder, name in PKGS.items():
        pin = _pin(folder)
        assert re.search(rf"\*\*{name}\*\* \| {re.escape(pin)} \|", readme), f"tests/README.md out of sync: {name}"
        assert re.search(rf"\| {name} \| {re.escape(pin)} \|", claude), f"CLAUDE.md out of sync: {name}"
