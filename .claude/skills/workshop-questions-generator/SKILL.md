---
name: workshop-questions-generator
description: >
  Build the question inventory for a single workshop so the room opens up,
  then sharpens. Every workshop starts with free-form open questions and
  only layers intent/phase silos where they actually help. Used by the
  `discovery-question-generator` sub-agent in its `workshop` scope.
---

# Workshop Questions Generator

> A discovery workshop is a conversation, not an audit. The job of the
> question inventory is to give the client room to talk, then guide the
> room toward specific signals when the flow calls for it. Rigid intent
> ratios on every workshop produce flat, interview-style question lists.

## 1. Two-pass structure (applies to every workshop)

Every inventory has two passes:

**Pass A — Open questions (always first).** Broad, conversational prompts
the client answers in their own frame. Usually untagged, or tagged only
if the intent is obvious. 5-10 questions per workshop minimum. These open
the room.

**Pass B — Structured silos (only when they help).** Depending on the
workshop type, Pass B stacks one of:
- **Phase silos** — "for each phase of the journey, ask these probes"
- **Intent silos** — context → problem → jtbd → circumstance → need →
  opportunity → gap → contradiction (only use the intents that sharpen
  *this* workshop)
- **Topic silos** — stack, governance, data, measurement (for tech /
  governance / analytics workshops)

Pass B is optional. If the workshop is genuinely free-form (kick-off,
readouts, general discovery), skip it entirely and stay in open mode.

## 2. Per-workshop profiles

Select the profile that matches the workshop's name/phase. Volume
guidance is a **floor, not a ceiling** — the number listed is the
minimum the room must leave with. **Do not cap the client.** When the
brief and research provide more material, write more questions; when
they don't, never go below the floor by trimming for tidiness.

### Kick-off / objectives workshops
_Trigger words: "kick-off", "objectives", "introduction"._

All open questions, no intent forcing. **At least 15 questions (floor; go to 25+ when the brief is rich).** Topics:
- business objectives (next 6 / 12 / 24 months)
- pain points the leadership team already sees
- the opportunity size, how they frame it internally
- benchmarks and competitors they admire or fear
- success criteria for this engagement specifically
- decision rights and executive sponsors
- constraints (regulatory, political, timing)
- what would make this engagement a failure

### Governance / delivery workshops
_Trigger words: "governance", "delivery", "operations", "RACI"._

Open questions first, then a topic silo on methodology. **At least 15 questions (floor; 25+ when evidence supports).** Topics:
- governance model (steering committees, working groups, RACI)
- operational reporting cadence and format
- delivery methodology — SAFe, Scrum, Kanban, waterfall, hybrid
- escalation paths
- vendor ecosystem and partner coordination
- how success is measured on prior engagements
- tooling for PM, docs, design handoff
- what has broken in past engagements

### High-level journey workshops (one per journey)
_Trigger words: "high-level journey", "journey overview"._

Open Pass A (5-8 questions on the journey overall), then a **phase
silo** — for each phase in the journey, ask the same probe set:
- pain points in this phase (all of them, not "the top one")
- what does "success" look like for the customer in this phase
- what does the northstar look like if everything worked perfectly
- any ideas / hypotheses they already have
- what signals tell them the phase is going well / badly
- who internally owns this phase

Total volume scales with phase count. For a 5-phase journey, **at least 25 questions (floor; 40+ when the journey is rich).**

### Channel / product workshops (one per channel or product)
_Trigger words: product name, channel name, "CRM", "email", "web",
"mobile", "contact centre"._

Open Pass A (5-8 questions), then a topic silo. **At least 20 questions (floor; 30+ when channel is broad).** Topics:
- current audience strategy and segmentation
- content strategy and message frameworks
- orchestration rules and triggers
- measurement and attribution
- handoffs to/from other channels
- data dependencies (where identity, consent, preference live)
- current performance — not just the top issue, all the issues they
  care about
- failure modes they've seen this year
- tooling and operational workflow

### Journey deep-dive workshops
_Trigger words: "deep-dive" + journey name._

**Requires a phase to be selected before generation.** The inventory is
scoped to that one phase. Structure:

Pass A — 5-8 open questions about the phase generally.

Pass B — a topic silo that goes wide within the phase. **At least 25 questions per phase (floor; 40+ when research surfaces more pains/opps).** Cover:
- experience design — every touchpoint in the phase, what works, what
  doesn't, edge cases
- tech — all systems involved, integrations, data flows, latency, auth
- data — signals captured, what's missing, identity resolution, consent
- innovation — use-cases, AI opportunities, automation candidates
- measurement — how the phase is instrumented today, what's blind
- pain points — every pain point they'll articulate, not the top one
- opportunities — unclaimed moments in the phase
- contradictions — tensions between stated goals and observed behavior

### Tech deep-dive workshops
_Trigger words: "tech deep-dive", "technology workshop", "integration"._

Open Pass A, then a topic silo. **At least 30 questions (floor; 50+ when stack is broad).** Go wide — ask about *all* their stack, *all* their integrations, *all* their challenges. Topics:
- stack inventory across CRM / CDP / CEP / DXP / analytics / AI
- every integration they rely on and how it fails
- data flows end-to-end (capture → store → activate)
- identity and consent architecture
- observability, SLAs, incident history
- security posture, compliance constraints
- tech roadmap and investment priorities
- tech debt they carry and what it costs them
- vendor lock-in and exit readiness
- AI / automation readiness — data, eval, guardrails
- team shape, skills gaps, staffing model

### Audit readouts (Current-state experience / data / tech / JTBD)
_Trigger words: "audit", "current state", "read-out", "readout"._

Audit-style open questions, then a topic silo. **At least 15 questions (floor; 25+ when the audit surfaces more).** Topics:
- what exists today (inventory)
- what's working well (keep list)
- what's broken (stop list)
- evidence sources behind the claims
- ownership and accountability
- when it was last reviewed / updated
- dependencies on other audits / teams

### Definition workshops
_Trigger words: "design scoping", "DAM", "CMP", "IA", "sitemap", "KPI",
"backlog", "RACI", "define readout"._

Scoping-style open questions, then a topic silo. **At least 15 questions (floor; 25+ when scope is wide).** Topics:
- scope boundaries (in / out)
- success criteria for this workstream
- stakeholders and approvers
- dependencies on other workstreams
- assumptions that could bite us later
- risks and mitigations
- timeline and sequencing constraints

## 3. Intent vocabulary (reference only)

Use intent tags when they sharpen a question, leave them off (or use
`context` as a safe default) when the question is genuinely open. The
taxonomy exists so signal-extraction downstream can classify answers;
it's not a ratio the room has to hit.

| Intent         | Use when you want to surface…                              |
|----------------|------------------------------------------------------------|
| `context`      | Scene-setting, grounding. Also the safe default for open.  |
| `problem`      | A specific pain that already exists.                       |
| `jtbd`         | The underlying motivation independent of the product.      |
| `circumstance` | The triggering context / forces before the moment.         |
| `need`         | An explicit stated requirement.                            |
| `opportunity`  | Unclaimed territory / expansion vectors.                   |
| `gap`          | Delta between today and desired state.                     |
| `contradiction`| Pressure-test of stated beliefs against evidence.          |

Stacking order when a silo is used: context → problem → jtbd →
circumstance → need → opportunity → gap → contradiction. Contradictions
go last.

## 4. Phrasing rules — avoid narrow framing

A discovery workshop is not a deep-dive interview on a single incident.
The question inventory must invite the client to talk about **all** of
something, not just the latest instance.

### Do

- "Walk us through your integrations — where do they break, how often,
  and which ones cost you the most?"
- "Across your stack, where is the data story hardest to tell?"
- "Tell us about the ways onboarding falls short today — for different
  segments, different devices, different intents."

### Do not

- "Tell us about the **last** challenging integration you had." — caps
  the answer to one anecdote
- "What's the **biggest** pain point in onboarding?" — closes the door
  on the other four pain points they have
- "Have you ever had a data issue?" — binary / closed

### Quick rewrites

| Narrow (don't) | Open (do) |
|---|---|
| What was the last bad customer interaction? | What kinds of bad interactions do your customers have today, and how often? |
| Tell me about a time your CRM failed. | Where does your CRM fall short across your customer lifecycle? |
| What's the top feature request? | What feature requests do you hear most — from customers, from internal teams, from partners? |

## 5. Grounding — how to make questions client-specific

A question that could be asked at any client is a failed question. Each
question should include at least one of:

- a **product / channel name** from the brief,
- a **persona label** from the brief,
- a **pain point phrase** from the brief,
- a **specific metric or artifact** (churn rate, NPS, CAC, lifecycle
  map), or
- an **industry-specific detail** (seasonality, regulation, device
  type).

Example — weak vs. strong:

- ❌ "What frustrates your customers the most?"
- ✅ "Across first-time theme-park guests in their first hour on-site,
  what complaints do your contact-centre agents hear most — and which
  of those do you already have a plan for?"

## 6. Targeting — which role gets which question

Each question names **one** role (`targetRole`), chosen from the
workshop's `clientAttendees[].title` or `agencyAttendees[].title`.

- The `targetRole` must match a title in the attendee list verbatim.
- If a role appears on both sides, prefer the client side.
- Don't target facilitators or note-takers.
- Distribute questions across attendees — a workshop where every
  question goes to the Head of CRM is an interview, not a workshop.
- When no attendees are listed, fall back to `"(any attendee)"`.

## 7. Phase tagging

If the engagement has defined **journey phases**, tag questions with
the `journeyPhase` they probe (use the exact phase label). Omit for
phase-agnostic questions.

For journey deep-dive workshops, the phase is supplied as input — every
generated question MUST carry that phase label.

## 8. Output contract

Produce JSON: `{ "questions": [ … ] }`. Each question:

```json
{
  "targetRole": "Head of CRM",
  "text": "…",
  "intent": "problem",
  "journeyPhase": "Onboarding",
  "rationale": "One sentence: why we ask",
  "sourceContext": "research",
  "sourceCitations": {
    "researchDocId": "doc_abc123",
    "researchExcerpt": "≤200-char verbatim snippet that seeded the question"
  }
}
```

- `intent` — any of the 8 vocabulary values. `context` is the safe
  default for open questions.
- `journeyPhase` — optional; required when the workshop is a journey
  deep-dive and a phase is supplied.
- `rationale` — one sentence for the facilitator. Required.
- `sourceContext` — REQUIRED on every question. One of:
  - `"form"` → derived from the structured brief form alone.
  - `"brief"` → inspired by the verbatim brief document.
  - `"research"` → inspired by an uploaded research artifact.
  - `"mixed"` → drew on more than one of the above.
- `sourceCitations` — REQUIRED whenever `sourceContext` is not `"form"`.
  - `briefExcerpt` (≤200 chars, verbatim from the brief) when the brief
    seeded the question.
  - `researchDocId` (must equal the `id` of one of the supplied research
    docs — never invent ids) when research seeded it, paired with
    `researchExcerpt` (≤200 chars, verbatim from that doc's summary or
    quote list).
- No duplicates. No double-barreled questions.

Ordering: Pass A first (open), then Pass B silos in the stacking order
above. Contradictions last. No prose, no markdown outside the JSON.

## 9. Editability contract

The inventory is an editable draft. Humans in the Plan UI will add,
remove, re-tag, retarget, and rewrite. Prefer copy-pasteable,
distinct, sharp questions over a high count of overlapping ones —
volume is a **floor, not a ceiling**, and never an excuse for padding.
