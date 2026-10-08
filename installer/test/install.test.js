'use strict';

// Unit tests for installer/bin/install.js — the npx installer that copies
// skill files into a target project for each supported agentic tool.
//
// Run with: node --test test/
// (Node's built-in test runner — no extra dependency needed.)

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INSTALL_BIN = path.join(__dirname, '..', 'bin', 'install.js');

function runInstaller(args, cwd) {
  return spawnSync(process.execPath, [INSTALL_BIN, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function makeTmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rai-installer-test-'));
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('default install (claude) writes the 3 skills and the test constitution', () => {
  const dir = makeTmpProject();
  try {
    const result = runInstaller([], dir);
    assert.equal(result.status, 0, result.stderr);

    const commandsDir = path.join(dir, '.claude', 'commands');
    for (const name of ['create-agent.md', 'improve-agent.md', 'extend-agent.md']) {
      assert.ok(fs.existsSync(path.join(commandsDir, name)), `${name} should be installed`);
    }

    const constPath = path.join(dir, 'tests', 'TEST_CONSTITUTION.md');
    assert.ok(fs.existsSync(constPath), 'TEST_CONSTITUTION.md should be installed under tests/');
  } finally {
    cleanup(dir);
  }
});

test('installed skill content matches the source file exactly', () => {
  const dir = makeTmpProject();
  try {
    runInstaller([], dir);
    const installed = fs.readFileSync(
      path.join(dir, '.claude', 'commands', 'create-agent.md'),
      'utf8'
    );
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', '.claude', 'commands', 'create-agent.md'),
      'utf8'
    );
    assert.equal(installed, source);
  } finally {
    cleanup(dir);
  }
});

test('--agent cursor installs .mdc files with a frontmatter block', () => {
  const dir = makeTmpProject();
  try {
    const result = runInstaller(['--agent', 'cursor'], dir);
    assert.equal(result.status, 0, result.stderr);

    const filePath = path.join(dir, '.cursor', 'rules', 'create-agent.mdc');
    assert.ok(fs.existsSync(filePath));

    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /^---\ndescription: .+\nglobs: \nalwaysApply: false\n---\n\n/);
  } finally {
    cleanup(dir);
  }
});

test('--agent codex installs to the project root and skips the test constitution', () => {
  const dir = makeTmpProject();
  try {
    const result = runInstaller(['--agent', 'codex'], dir);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(fs.existsSync(path.join(dir, 'create-agent.md')));
    assert.ok(fs.existsSync(path.join(dir, 'improve-agent.md')));
    assert.ok(fs.existsSync(path.join(dir, 'extend-agent.md')));
    assert.ok(
      !fs.existsSync(path.join(dir, 'tests', 'TEST_CONSTITUTION.md')),
      'codex should not receive TEST_CONSTITUTION.md (see install.js agentName check)'
    );
  } finally {
    cleanup(dir);
  }
});

test('an unsupported --agent value exits non-zero with a clear error', () => {
  const dir = makeTmpProject();
  try {
    const result = runInstaller(['--agent', 'not-a-real-agent'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown agent "not-a-real-agent"/);
  } finally {
    cleanup(dir);
  }
});

test('--help exits 0 and prints usage without touching the filesystem', () => {
  const dir = makeTmpProject();
  try {
    const result = runInstaller(['--help'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: npx/);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    cleanup(dir);
  }
});

test('a positional target-dir argument installs into that directory, not cwd', () => {
  const cwd = makeTmpProject();
  const target = makeTmpProject();
  try {
    const result = runInstaller([target, '--agent', 'claude'], cwd);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(fs.existsSync(path.join(target, '.claude', 'commands', 'create-agent.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude')), 'cwd itself should be untouched');
  } finally {
    cleanup(cwd);
    cleanup(target);
  }
});

test('running the installer twice reports [UPDATE] the second time', () => {
  const dir = makeTmpProject();
  try {
    const first = runInstaller([], dir);
    assert.match(first.stdout, /\[NEW\s+\] create-agent\.md/);

    const second = runInstaller([], dir);
    assert.match(second.stdout, /\[UPDATE\] create-agent\.md/);
  } finally {
    cleanup(dir);
  }
});

test('--agent with no value exits with an error instead of installing silently', () => {
  const dir = makeTmpProject();
  try {
    const result = runInstaller(['--agent'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--agent needs a value/);
    assert.ok(!fs.existsSync(path.join(dir, '.claude')));
  } finally {
    cleanup(dir);
  }
});

for (const [agent, subdir] of [
  ['copilot', path.join('.github', 'instructions')],
  ['roo', path.join('.roo', 'rules')],
  ['windsurf', path.join('.windsurf', 'rules')],
  ['antigravity', path.join('.agents', 'rules')],
]) {
  test(`--agent ${agent} installs into ${subdir}`, () => {
    const dir = makeTmpProject();
    try {
      const result = runInstaller(['--agent', agent], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(dir, subdir, 'create-agent.md')));
    } finally {
      cleanup(dir);
    }
  });
}
