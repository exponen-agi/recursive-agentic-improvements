'use strict';

// Drift guard: the minimum Node.js version must be the same everywhere
// (both package.json "engines" fields, README, QUICKSTART, CI matrix),
// and must not be an end-of-life release line.
// Run with: node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

// Release lines with no more security fixes (see nodejs.org/en/about/previous-releases).
const EOL_MAJORS = [16, 18, 20];

const minFromEngines = (file) => {
  const range = JSON.parse(read(file)).engines.node;
  const m = range.match(/^>=(\d+)$/);
  assert.ok(m, `${file}: engines.node must look like ">=N", got "${range}"`);
  return Number(m[1]);
};

test('both package.json files declare the same minimum Node major', () => {
  assert.equal(minFromEngines('package.json'), minFromEngines('installer/package.json'));
});

test('minimum Node major is not end-of-life', () => {
  assert.ok(!EOL_MAJORS.includes(minFromEngines('installer/package.json')));
});

test('README, QUICKSTART and CI use the same minimum Node major', () => {
  const min = minFromEngines('installer/package.json');
  assert.match(read('README.md'), new RegExp(`Requires Node\\.js ${min} or newer`));
  assert.match(read('QUICKSTART.md'), new RegExp(`needs Node\\.js ${min} or newer`));
  const ci = read('.github', 'workflows', 'ci.yml');
  const nodes = ci.match(/node: \[([^\]]+)\]/);
  assert.ok(nodes, 'ci.yml must test the installer on a node matrix');
  const majors = nodes[1].split(',').map((v) => Number(v.replace(/["'\s]/g, '')));
  assert.equal(Math.min(...majors), min, 'CI must test the oldest supported Node major');
});
