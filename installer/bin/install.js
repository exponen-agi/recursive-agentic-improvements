#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let agentName = 'claude';
let targetProject = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--agent' || args[i] === '-a') {
    if (!args[i + 1] || args[i + 1].startsWith('-')) {
      console.error('Error: --agent needs a value, for example: --agent cursor');
      process.exit(1);
    }
    agentName = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Usage: npx github:cloudbloqavi/recursive-agentic-improvements [target-dir] [--agent <name>]

Options:
  --agent, -a   Target agentic AI environment (default: claude)
  --help, -h    Show this help message

Supported agents:
  claude        Claude Code      →  .claude/commands/       (default)
  cursor        Cursor           →  .cursor/rules/
  copilot       GitHub Copilot   →  .github/instructions/
  roo           Roo Code         →  .roo/rules/
  windsurf      Windsurf         →  .windsurf/rules/
  codex         OpenAI Codex     →  . (project root)
  antigravity   Google Antigravity → .agents/rules/

Examples:
  npx github:cloudbloqavi/recursive-agentic-improvements
  npx github:cloudbloqavi/recursive-agentic-improvements --agent cursor
  npx github:cloudbloqavi/recursive-agentic-improvements /path/to/project --agent copilot
`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    targetProject = path.resolve(args[i]);
  }
}

// ---------------------------------------------------------------------------
// Agent configurations
// ---------------------------------------------------------------------------
const AGENTS = {
  claude: {
    label: 'Claude Code',
    dir: path.join('.claude', 'commands'),
    ext: '.md',
  },
  cursor: {
    label: 'Cursor',
    dir: path.join('.cursor', 'rules'),
    ext: '.mdc',
    frontmatter: true,
  },
  copilot: {
    label: 'GitHub Copilot',
    dir: path.join('.github', 'instructions'),
    ext: '.md',
  },
  roo: {
    label: 'Roo Code',
    dir: path.join('.roo', 'rules'),
    ext: '.md',
  },
  windsurf: {
    label: 'Windsurf',
    dir: path.join('.windsurf', 'rules'),
    ext: '.md',
  },
  codex: {
    label: 'OpenAI Codex',
    dir: '.',
    ext: '.md',
  },
  antigravity: {
    label: 'Google Antigravity',
    dir: path.join('.agents', 'rules'),
    ext: '.md',
  },
};

const agent = AGENTS[agentName];
if (!agent) {
  const supported = Object.keys(AGENTS).join(', ');
  console.error(`\nERROR: Unknown agent "${agentName}". Supported: ${supported}\n`);
  process.exit(1);
}

const targetDir = path.join(targetProject, agent.dir);

const skills = [
  'create-agent.md',
  'improve-agent.md',
  'extend-agent.md',
];

// ---------------------------------------------------------------------------
// Source resolution: package skills/ → dev fallback .claude/commands/
// ---------------------------------------------------------------------------
let sourceDir = path.join(__dirname, '..', 'skills');
if (!fs.existsSync(sourceDir)) {
  const devSourceDir = path.resolve(__dirname, '..', '..', '.claude', 'commands');
  if (fs.existsSync(devSourceDir)) {
    sourceDir = devSourceDir;
  }
}

console.log(`\nRecursive Agentic Improvement Skills — Installer`);
console.log(`=================================================`);
console.log(`Agent:   ${agent.label}`);
console.log(`Source:  ${sourceDir}`);
console.log(`Target:  ${targetDir}\n`);

if (!fs.existsSync(sourceDir)) {
  console.error(`ERROR: Source skills directory not found. Please ensure the repository is correct.`);
  process.exit(1);
}

if (!fs.existsSync(targetProject)) {
  console.error(`ERROR: Target project directory not found: ${targetProject}`);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    console.error(`ERROR: Failed to create target directory ${targetDir}:`, err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Cursor .mdc frontmatter helper
// ---------------------------------------------------------------------------
function wrapWithFrontmatter(content, skillName) {
  // Extract description from the first heading line, e.g. "# /create-agent — ..."
  const firstLine = content.split('\n').find(l => l.trim());
  const description = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : skillName;
  return `---\ndescription: ${description}\nglobs: \nalwaysApply: false\n---\n\n${content}`;
}

// ---------------------------------------------------------------------------
// Install skills
// ---------------------------------------------------------------------------
let installedCount = 0;

for (const skill of skills) {
  const srcPath = path.join(sourceDir, skill);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  WARNING: Skill not found, skipping: ${skill}`);
    continue;
  }

  const baseName = path.basename(skill, '.md');
  const destFile = baseName + agent.ext;
  const dstPath = path.join(targetDir, destFile);

  const isUpdate = fs.existsSync(dstPath);
  console.log(`  [${isUpdate ? 'UPDATE' : 'NEW   '}] ${destFile}`);

  try {
    let content = fs.readFileSync(srcPath, 'utf8');
    if (agent.frontmatter) {
      content = wrapWithFrontmatter(content, baseName);
    }
    fs.writeFileSync(dstPath, content, 'utf8');
    installedCount++;
  } catch (err) {
    console.error(`  ERROR: Failed to install ${skill}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Install TEST_CONSTITUTION.md (skip for codex — root would be cluttered)
// ---------------------------------------------------------------------------
// The packaged installer keeps it alongside the skills (skills/), but a dev
// checkout (no `npm run prepare` yet) only has it under tests/ at repo root.
let constSrcPath = path.join(sourceDir, 'TEST_CONSTITUTION.md');
if (!fs.existsSync(constSrcPath)) {
  const devConstPath = path.resolve(__dirname, '..', '..', 'tests', 'TEST_CONSTITUTION.md');
  if (fs.existsSync(devConstPath)) {
    constSrcPath = devConstPath;
  }
}
if (fs.existsSync(constSrcPath) && agentName !== 'codex') {
  const testsDirName =
    fs.existsSync(path.join(targetProject, 'test')) && !fs.existsSync(path.join(targetProject, 'tests'))
      ? 'test'
      : 'tests';
  const targetTestsDir = path.join(targetProject, testsDirName);
  const constDstPath = path.join(targetTestsDir, 'TEST_CONSTITUTION.md');

  if (!fs.existsSync(targetTestsDir)) {
    try { fs.mkdirSync(targetTestsDir, { recursive: true }); } catch (_) {}
  }

  if (fs.existsSync(targetTestsDir)) {
    const isUpdate = fs.existsSync(constDstPath);
    console.log(`  [${isUpdate ? 'UPDATE' : 'NEW   '}] TEST_CONSTITUTION.md → ${testsDirName}/`);
    try {
      fs.copyFileSync(constSrcPath, constDstPath);
    } catch (err) {
      console.error(`  ERROR: Failed to copy TEST_CONSTITUTION.md:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Usage hint
// ---------------------------------------------------------------------------
console.log(`\nInstalled ${installedCount} skill(s) to ${targetDir}\n`);

const usageHints = {
  claude:   `Usage in Claude Code:\n  /create-agent agno chatbot\n  /improve-agent\n  /extend-agent langgraph react-agent`,
  cursor:   `Rules are now active in Cursor for this project.\nOpen Cursor Settings → Rules to verify.`,
  copilot:  `Instructions added to .github/instructions/.\nGitHub Copilot will pick these up automatically.`,
  roo:      `Rules installed for Roo Code.\nThey apply automatically to this project.`,
  windsurf: `Rules installed for Windsurf.\nThey apply automatically to this project.`,
  codex:       `Skill files installed at project root.\nReference them in your AGENTS.md or pass them as context to Codex.`,
  antigravity: `Rules installed for Google Antigravity.\nThey are active in the Agent Manager under .agents/rules/.`,
};

console.log(usageHints[agentName] + '\n');
