# Decision Principle — Subagents vs Skills

**Read this file before creating any new skill or sub-agent, or before recommending one in a plan.**

This file is the single source of truth for choosing between Claude Code's three delegation mechanisms: **skills**, **sub-agents**, and **agent teams**. Every decision about how to package new capability in this repo MUST be checked against this file.

---

## Subagents in Claude Code

*Delegate smarter, keep your context clean, and get more done in every session.*

As your projects grow more complex, you'll start to notice a natural tension. The more Claude Code does in a single session i.e. reading files, running tests, exploring the codebase, and debugging, the longer your conversation grows. And the longer it grows, the heavier it becomes. Eventually, the conversation history itself becomes a burden: every message carries the weight of everything that came before it, and Claude Code's responses start to feel slower and less focused.

Subagents are how you break out of this pattern.

A subagent is a separate Claude Code instance which has its own fresh session with its own clean context window that your main agent can spawn to handle a specific task. It goes off, does the work, and comes back with just the result. Your main conversation never sees the details. It only sees the summary.

Think of a subagent the way you'd think of delegating to a colleague. You don't need to watch them work. You give them a clear task, they come back with what you need, and you continue with your main focus.

---

## How Subagents Work

When Claude Code spawns a subagent, here's what happens:

1. Your main agent identifies a task that's better handled separately, something large, noisy, or specialised.
2. It spawns a subagent with a specific prompt containing all the context that subagent needs to do its job.
3. The subagent starts with a completely clean context window. It has no memory of your main conversation, it knows only what was passed to it in that prompt.
4. The subagent carries out its task independently, using whatever tools it has been given access to.
5. It returns a summary of its findings to the main agent. Not the full output, just what matters.
6. Your main conversation continues, enriched with that summary, without ever being cluttered by the details.

The key thing to understand is what stays separate: the subagent's entire working process including all the file reads, command outputs, debug logs, and intermediate steps lives in its own context. None of that reaches your main session. Only the final result comes back.

This is why subagents are described as one of the most effective tools for context management in longer sessions. They let you do more without paying the token cost of doing it all in one place.

---

## Their Role in Context Window Management

To understand why subagents matter, it helps to understand the context window problem.

Every Claude Code session has a context window which is a limit on how much information it can hold in its working memory at once. As a session runs, that window fills up with conversation history, file contents, command outputs, skill instructions, and memory. The fuller it gets, the more expensive each request becomes, and the more likely Claude Code is to start losing track of earlier decisions or drifting from your intent.

The standard tools for managing this — `/compact` and `/clear` — help, but they're blunt instruments. `/compact` summarises everything, which means some detail is lost. `/clear` wipes the slate, which means you lose the whole thread.

Subagents offer a more precise solution. Instead of managing what's already in your context, you prevent the clutter from entering in the first place.

### The before and after

**Without subagents:** You ask Claude Code to run your test suite and fix failures. It runs the tests, the full test output floods into your context, it reads multiple files to understand the failures, and all of that detail, most of which is noise, now lives in your session permanently.

**With subagents:** Claude Code spawns a subagent to run the tests and investigate the failures. The subagent does all the heavy work in its own context. It comes back with: "Three tests are failing. Two are in the auth module due to a token expiry bug on line 47. One is in the API module due to a missing null check." That's all that enters your main session.

Anthropic's official documentation recommends using subagents especially early in a conversation or task, noting it "tends to preserve context availability without much downside in terms of lost efficiency."

---

## Where Subagents Are Defined

Custom subagents are defined as Markdown files with YAML frontmatter, stored in a specific folder in your project. The structure mirrors what you already know from Skills.

The frontmatter tells Claude Code the subagent's name, when to use it, which tools it's allowed to access, and which model it should run on. The markdown body contains the system prompt — the instructions that define how this subagent behaves.

You can also define personal subagents that follow you across all projects, stored at the user level.

---

## Example Use Cases

Subagents shine in four main situations.

### 🔇 Isolating noisy operations

Some tasks produce enormous amounts of output that you don't need in your main session such as test runs, log analysis, dependency audits, documentation fetches. Delegating these to a subagent keeps your context clean.

- Run the full test suite → return only failures with their error messages
- Fetch and read a third-party API's documentation → return the relevant endpoints
- Scan all files matching a pattern → return a summary of what was found

### 🔍 Parallel investigation

When you need to understand something about multiple distinct parts of your project, you can spawn several subagents to investigate simultaneously rather than one at a time.

- Research the authentication module, database module, and API module in parallel, each in its own subagent, then synthesise the findings
- Investigate three different bug reports at the same time and report back which is most critical
- Audit three separate microservices for security issues concurrently

### ✅ Independent verification

One of the most valuable uses of subagents is asking a fresh, unbiased instance to verify your work. Because the subagent has no history of how the code was built, it evaluates it more objectively.

- Have a subagent verify that an implementation doesn't just pass tests by coincidence
- Ask a subagent to review the security implications of an approach you're taking
- Spawn a subagent to check whether a refactor broke any existing functionality

### 🏗️ Specialist roles

Custom subagents with tailored system prompts can be specialists that consistently bring domain expertise to a task reliably, every time.

- A data-scientist subagent that writes optimised SQL queries and interprets results
- A proofreader subagent that reviews documentation for grammar and clarity
- A security-reviewer subagent that checks code for vulnerabilities with strict criteria
- A commit-message subagent that generates properly formatted messages following your team's convention

---

## When to Use Subagents

Not every task needs a subagent. They add a small amount of overhead, and for quick, simple actions the overhead isn't worth it.

### Use a subagent when:

- The task will produce a large amount of output you don't need in your main session
- You want independent verification of something, without the bias of shared context
- Multiple tasks can run in parallel and don't need to communicate with each other
- You want specialised behaviour i.e. a specific persona, restricted tools, a different model
- You're early in a session and want to preserve your context window for the main work ahead

### Skip the subagent when:

- The task is quick and the output is small i.e. no context savings worth having
- The task needs access to your full conversation history
- You need the subagent and main agent to share findings and update each other mid-task (use Agent Teams instead)
- You're doing a simple one-off action that doesn't benefit from specialisation

---

## Subagents vs Agent Teams — Know the Difference

As you explore Claude Code's multi-agent capabilities, you'll come across Agent Teams which is a related but distinct feature. Understanding the difference will save you from using the wrong tool.

The practical rule, based on real-world usage: subagents cover around 90% of what most people need. Reach for Agent Teams only when your workers genuinely need to share findings with each other mid-task, not just report back to you at the end. The extra token cost of Agent Teams is only worth it when there's real coordination happening.

---

## Creating Your First Subagent

The easiest way to get started is to ask Claude Code to create a subagent for you. It understands the format and can generate a well-structured agent file based on your description of what you need.

1. Create the agents directory in your project.
2. Ask Claude Code to generate a subagent and describe its role clearly.
3. Claude Code generates the markdown file and saves it to `.claude/agents/`. Review it, adjust the instructions if needed, and it's ready to use.

To invoke it, you can either let Claude Code decide when it's relevant automatically, or tell it explicitly.

You don't need to build complex subagent systems from day one. Start with one subagent for the task you find yourself delegating most often, for example, test running, code review, documentation lookup. One well-designed subagent used consistently is worth more than ten that sit unused.

---

## A Few Things to Keep in Mind

- **Subagents start fresh every time.** They have no memory of previous invocations or your main conversation. Whatever context they need must be in the prompt that spawns them.
- **Only the final message comes back.** The subagent's working process, all the intermediate steps, file reads, and command outputs, stays in its own context. Your main session only receives the result.
- **Restrict tools deliberately.** A subagent that only needs to read files should only have read access. A subagent that shouldn't deploy anything shouldn't have deployment tools. Scoped permissions make subagents safer and more predictable.
- **You can specify which model to use.** A fast, lightweight model (Sonnet) is usually the right choice for subagents doing research or running tests. Save Opus for tasks that genuinely need deep reasoning.
- **They still cost tokens.** Each subagent has its own context window. Using them saves tokens in your main session, but the subagent's work isn't free. Use them where the context savings in your main session justify the cost.

Subagents represent a shift in how you think about working with Claude Code. Instead of asking one agent to do everything in one long, increasingly cluttered session, you start thinking about delegation i.e. which parts of the work can be handed off, focused, and done in isolation. That shift is what separates people who hit their limits regularly from people who can work on complex projects all day without friction.

---

## Decision rule for THIS repo

When choosing between a **skill**, a **sub-agent**, and "do nothing extra":

| You want to package… | Use a… |
|---|---|
| Stable domain knowledge, taxonomies, format specs, persona rules — knowledge any session that touches this domain should consult | **Skill** (under `.claude/skills/`) |
| A specific noisy / parallel / independently-verifiable / specialist *task* you'd otherwise do inline and pollute the main session with | **Sub-agent** (under `.claude/agents/`) |
| Coordinated multi-worker effort where workers must update each other mid-task | **Agent Team** (rare; only when sub-agents aren't enough) |
| One-off, small, quick action with no reuse value | **Nothing** — just do it inline |

**Application notes for this codebase:**
- Runtime LLM calls from the Next.js app (e.g. `/api/classify-problems`) are NOT sub-agents — sub-agents are a Claude-Code-time concept. The running app makes plain OpenAI calls.
- A skill becomes valuable as soon as the same taxonomy or rubric will be referenced by more than one feature or session. If only one place will ever use it, inline the prompt.
- A sub-agent becomes valuable as soon as a sub-task in implementation work would dump lots of output (test runs, multi-file scans, dependency audits, prompt stress tests, build/typecheck loops) into the main session. Spawn one to keep the main planning thread clean.
