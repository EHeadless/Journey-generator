# Claude Code in Practice

**A hands-on course for product managers and builders.**
[Enroll on Maven →](https://maven.com/boring-bot/claude-code-in-practice)

Taught by **Hamza Farooq** — Founder at Traversaal.ai · UCLA Anderson · ex-Google

---

## What this repo is

This is the **official central repository** for [Claude Code in Practice](https://maven.com/boring-bot/claude-code-in-practice). All course code, templates, skills, and resources live here. If you're a student, bookmark this page — come back here whenever you need code from class.

---

## Course Modules

### Module 1 — From Idea to Shipped Product

Set up Claude Code, configure your workspace, and go from blank page to a full PRD without writing code.

**What you'll build:**
- Your `CLAUDE.md` — a standing briefing that makes Claude context-aware for your project
- Your first skills: `/prd-generator` and `/user-story-writer`
- A live PRD builder app that runs in your browser

**Resources:**
- [claude-code-in-practice/CLAUDE.md](claude-code-in-practice/CLAUDE.md) — template to customize for your project
- [claude-code-in-practice/prd-generator/index.html](claude-code-in-practice/prd-generator/index.html) — open in browser, no install needed
- [claude-code-in-practice/.claude/skills/prd-generator/](claude-code-in-practice/.claude/skills/prd-generator/SKILL.md) — PRD generator skill
- [claude-code-in-practice/.claude/skills/user-story-writer/](claude-code-in-practice/.claude/skills/user-story-writer/SKILL.md) — user story skill

---

## Built with Claude Code

Real apps built using Claude Code — demoed live in class. Explore, fork, and learn from them.

| Repo | What it does |
|------|-------------|
| [word-humanizer](https://github.com/hamzafarooq/word-humanizer/) | Rewrites AI-sounding text to sound human |
| [seo-writer](https://github.com/hamzafarooq/seo-writer) | SEO-optimized content generator |

> More repos will be added here as the course progresses.

---

## Quick Start

**1. Set up your workspace:**

Open Claude Code in the `claude-code-in-practice` folder and run:
```
I'm a product manager. Help me create a CLAUDE.md file for my project. Ask me the questions you need to write a good one.
```

**2. Install your skills:**

Your skills are already in `.claude/skills/`. Test them:
```
/prd-generator
```
```
/user-story-writer
```

**3. Try the PRD builder app:**

Open [claude-code-in-practice/prd-generator/index.html](claude-code-in-practice/prd-generator/index.html) in your browser. Add your Anthropic API key (top right) and generate a full PRD from a form.

---

## What is Claude Code?

Claude Code is an AI assistant that lives inside your project folder and works directly with your files.

| Claude.ai / ChatGPT | Claude Code |
|---|---|
| You paste text into a chat box | Claude reads your actual files |
| Starts fresh every conversation | Remembers your project through `CLAUDE.md` |
| You copy-paste results manually | Edits files for you in real time |
| General-purpose | Configured for your team's way of working |

---

## Setup Guide

### Step 1 — Install Claude Code

Open your terminal and run:
```
npm install -g @anthropic/claude-code
```

If `npm` is not found, install Node.js from [nodejs.org](https://nodejs.org) (download the LTS version), then re-run.

Confirm it worked:
```
claude --version
```

### Step 2 — Set up your API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account (or log in) → **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`)

Set it in your terminal:
```
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

To make it permanent:
```
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.zshrc
source ~/.zshrc
```

Never share this key or commit it to GitHub.

### Step 3 — Open the course folder

```
cd path/to/claude-code-starter/claude-code-in-practice
claude
```

---

## Useful Prompts for PMs

| What you want | What to type |
|---|---|
| Generate a full PRD | `/prd-generator` |
| Write user stories | `/user-story-writer` |
| Find gaps in a spec | `"Review docs/prd.md and tell me what's missing"` |
| Write for execs | `"Rewrite this as 3 bullets for a VP with 10 seconds"` |
| Prep for engineering | `"What questions will engineers ask about this PRD?"` |
| Create a sprint plan | `"Turn the must-have stories into a 2-week sprint plan"` |
| Check for edge cases | `"What edge cases am I missing in this flow?"` |

---

## Troubleshooting

**"command not found: claude"**
Run `npm install -g @anthropic/claude-code` again. Check Node.js is installed with `node --version`.

**"API key not set" or authentication error**
Run `export ANTHROPIC_API_KEY=your-key-here`. Make sure you copied the full key including `sk-ant-`.

**Claude isn't reading my CLAUDE.md**
The file must be named exactly `CLAUDE.md` (all caps) and live in the folder where you ran `claude`.

**Skill not triggering**
Check that the path is `.claude/skills/<name>/SKILL.md` and the frontmatter `name:` matches what you typed after `/`.

---

*[Claude Code in Practice](https://maven.com/boring-bot/claude-code-in-practice) · Taught by Hamza Farooq · Traversaal.ai*
