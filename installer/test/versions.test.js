'use strict';

// Drift guard: the "Min version tested" column in CLAUDE.md and tests/README.md
// must match the version pinned in each tests/<framework>/pyproject.toml.
// Run with: node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

// label used in the docs tables -> [tests/ folder, PyPI package]
const FRAMEWORKS = {
  Agno: ['agno', 'agno'],
  CrewAI: ['crewai', 'crewai'],
  LangGraph: ['langgraph', 'langgraph'],
  'Google ADK': ['google_adk', 'google-adk'],
};

for (const [label, [dir, pkg]] of Object.entries(FRAMEWORKS)) {
  test(`${label}: pin in pyproject.toml matches CLAUDE.md and tests/README.md`, () => {
    const toml = read('tests', dir, 'pyproject.toml');
    const pin = toml.match(new RegExp(`"${pkg}==([0-9][^"]*)"`));
    assert.ok(pin, `${pkg} must be pinned with == in tests/${dir}/pyproject.toml`);

    const claudeRow = read('CLAUDE.md').split(/\r?\n/).find((l) => l.startsWith(`| ${label} |`));
    assert.ok(claudeRow, `CLAUDE.md needs a "${label}" row`);
    assert.equal(claudeRow.split('|')[2].trim(), pin[1], 'CLAUDE.md version is out of date');

    const readmeRow = read('tests', 'README.md').split(/\r?\n/).find((l) => l.startsWith(`| **${label}**`));
    assert.ok(readmeRow, `tests/README.md needs a "${label}" row`);
    assert.equal(readmeRow.split('|')[2].trim(), pin[1], 'tests/README.md version is out of date');
  });
}
