---
name: discovery-framework
description: How to gather evidence from a client before generating the demand landscape. Interview structure, per-department angles, evidence types, workshop patterns.
---

# Discovery Framework

The stable knowledge that governs the pre-generation phase. Discovery produces **evidence**, which becomes the input to signal extraction, which becomes the input to generation. No evidence → no generation.

## Sister Skills

1. **demand-space-framework** — taxonomy and formats for the generated landscape
2. **discovery-framework** (this file) — how to gather evidence from the client
3. **signal-mapping-framework** — how evidence becomes Problems / Needs / Opportunities / Gaps

---

## The Consultancy Workflow (8 steps)

```
1. Client Workspace        → create workspace, upload artifacts
2. Operating Context       → industry, tech stack, products, personas
3. Brief                   → business description, goals, pain points
4. Discovery Plan          → question set, per-department interviews
5. Discovery Capture       → interview notes, docs, quotes
6. Signal Extraction       → Problems / Needs / Opportunities / Gaps
7. Review & Approve        → PM reviews, approves signals
8. Regenerate Landscape    → phases → demand spaces → dimensions → activations
```

This skill governs steps **4 and 5**. The output of step 5 is a `DiscoveryBundle` that contains approved evidence.

---

## 1. Evidence Types

Everything collected in discovery is an **Evidence** record. The type matters because it affects confidence.

| Type | What it is | Confidence baseline |
|------|------------|--------------------|
| `interview` | Notes from a 1:1 or small-group conversation | High (primary source) |
| `workshop` | Notes from a multi-stakeholder session | High (cross-validated) |
| `document` | Internal doc: strategy deck, org chart, CX map, brief | Medium (point-in-time) |
| `quote` | Direct verbatim from a stakeholder | High (traceable) |
| `metric` | Quant data: CSAT, NPS, conversion, churn | High (if sourced) |
| `observation` | Consultant field notes, store visit, usage session, **ethnographic field notes** | Medium |
| `artifact` | Customer-facing asset: email, screen, script, **subject-produced material (diary, photo, video, drawing)** | High (factual) |

### Ethnographic Research — Classification Rules

Ethnographic research produces several kinds of output. Route each to the right evidence type so later signal extraction weighs them correctly:

| Output | Evidence Type | Why |
|--------|---------------|-----|
| Researcher-written field notes from an observation session | `observation` | Observer's own voice, interpretive |
| Verbatim transcript of a contextual inquiry or think-aloud | `interview` | Subject's own voice, specific person |
| Diaries, photos, videos, or drawings produced by the subject | `artifact` | Factual material, not commentary |
| Written ethnographic report or synthesis document | `document` | Structured, point-in-time synthesis |
| Specific sharp line from a subject in any of the above | `quote` (in addition to the parent record) | Preserve for citation |

**Rule for ethnographic summaries:** preserve descriptive texture. Do not over-summarize into abstract claims. A good observation summary reads like a field note, not a consulting slide.

### Evidence record shape
```
Evidence = {
  id: string,
  type: 'interview' | 'workshop' | 'document' | 'quote' | 'metric' | 'observation' | 'artifact',
  department: string,        // see Section 2 — which function is speaking
  source: string,            // person name, doc title, metric system
  date: Date,
  summary: string,           // 2-3 sentences, ONE idea per record
  rawText?: string,          // optional full transcript or excerpt
  tags: string[],            // free-form: "churn", "loyalty", "onboarding"
  confidence: 'high' | 'medium' | 'low'
}
```

**Rule:** one Evidence record = one idea. Split long interviews into multiple records so each can be traced to a specific signal.

---

## 2. The 10 Departments

Every client has these functions (or a subset). Discovery should cover each that is relevant to the engagement. For each, we have a default question angle.

| # | Department | What they know | Primary signals they surface |
|---|------------|----------------|-----------------------------|
| 1 | **Marketing** | Brand, campaigns, audience perception | Positioning gaps, message fatigue, awareness funnel |
| 2 | **Digital Product** | App/web experience, feature roadmap | UX friction, feature requests, adoption blockers |
| 3 | **CRM** | Lifecycle comms, email/push/SMS, segmentation | Lifecycle gaps, underused levers, data quality |
| 4 | **Sales** | Pre-sale conversations, objections, close reasons | Buying hesitation, competitor mentions, deal breakers |
| 5 | **Customer Service / Contact Center** | Call drivers, complaints, escalations | Recurring pain, root cause, handoff failures |
| 6 | **Operations** | Fulfillment, SLAs, logistics, staffing | Capacity constraints, process breaks, throughput issues |
| 7 | **IT / Data** | Stack, data model, integrations, AI readiness | Tech debt, data gaps, integration bottlenecks |
| 8 | **Loyalty** | Tier program, rewards, retention mechanics | Engagement drop-off, tier friction, perceived value |
| 9 | **Ecommerce** | Online conversion, cart, checkout, merchandising | Funnel leak, pricing perception, stock visibility |
| 10 | **Retail / On-ground experience** | Physical stores, events, field service | In-person friction, staff gaps, atmosphere mismatch |

### Per-department question angles

**Marketing**
- What do customers consistently misunderstand about us?
- Which campaign narratives fall flat and why?
- Where is awareness strong but conversion weak?

**Digital Product**
- Which features get built but aren't used?
- Where do users drop off in-app?
- What have you wanted to ship but couldn't?

**CRM**
- Which lifecycle moments have no message today?
- Which messages have the lowest engagement and why?
- What data do you NOT have that would change what you send?

**Sales**
- What's the most common last objection before a deal closes?
- Which competitor do you lose to most often, and why?
- What do customers believe about our product that isn't true?

**Customer Service**
- What are your top 5 call drivers, ranked by volume?
- Which issues are "solved" but keep coming back?
- Where do agents lack the tools or knowledge to resolve on first contact?

**Operations**
- Where is the biggest gap between promise and delivery?
- Which SLA do you miss most often and why?
- What would break if volume doubled tomorrow?

**IT / Data**
- Which data would the business want that doesn't exist yet?
- Where are your integration edges brittle?
- What AI have you piloted, and what stopped it from scaling?

**Loyalty**
- At which tier do members disengage?
- Which reward is redeemed most / least and why?
- What do non-members say about why they haven't joined?

**Ecommerce**
- Where does cart abandonment cluster?
- Which product pages convert worst and why?
- What's the #1 reason customers email before buying online?

**Retail / On-ground**
- What do customers ask staff most often that the site should have answered?
- Where does the in-store experience diverge from what was promised digitally?
- Which stores outperform peers and why?

---

## 3. Interview Structure

Each interview should produce **3-7 Evidence records**, one per discrete idea. Use this structure:

```
1. CONTEXT (2 min)
   - Role, tenure, remit
   - Their top KPI today

2. CURRENT STATE (10 min)
   - What's working that we should not break
   - What's the biggest drag on performance right now
   - What have you tried that didn't work

3. CUSTOMER LENS (10 min)
   - Walk me through a recent moment where a customer was frustrated
   - Which customer segment is hardest to serve and why
   - What do you wish you knew about your customers that you don't

4. AMBITION (5 min)
   - If you had 18 months and no constraints, what would you build
   - What does "winning" look like in this function
   - What's the one metric you want to move

5. OPEN (3 min)
   - Anything I didn't ask that I should have
   - Who else should I talk to
```

### Capture rules
- **Quote literally** when a stakeholder says something sharp — a verbatim quote is high-trust evidence
- **Don't paraphrase emotion** — if someone is frustrated, note it
- **Timestamp** quotes to the full transcript if available
- **Tag liberally** — tags become the signal-mapping hooks later

---

## 4. Workshop Patterns

When interviewing alone won't surface the right evidence, run a workshop. Patterns:

| Pattern | Use when | Output |
|---------|----------|--------|
| **Pains & Gains** | Team can't articulate problems directly | Wall of sticky notes sorted into pain/gain buckets |
| **Journey Walk** | Need to ground team in customer reality | Annotated journey map with friction flags |
| **Red-team the brief** | Leadership brief feels too polished | List of assumptions that might not hold |
| **Capability gap** | Deciding build vs buy vs partner | 2×2 of capability × importance |
| **Signal speed-dating** | 20+ stakeholders, limited time | Each stakeholder ranks pre-written pain statements |

Each workshop produces Evidence records with `type: 'workshop'`.

---

## 4b. The Workshop Inventory (Plan step deliverable)

Modern Digitas engagements orchestrate discovery as a **sequence of scoped
workshops**, not a flat list of interviews. The Plan step produces a
**workshop inventory** — the canonical list the client and agency teams
both read, schedule against, and prep for. Every workshop in the inventory
has a fixed shape so it can be sorted, filtered, and exported to a client
deck cleanly.

### Workshop record shape

```
Workshop = {
  id: string,
  code: string,                 // "W01", "W02", … (display id)
  phase: string,                // "Discovery" | "Alignment" | "Strategy" | "Activation"
  name: string,                 // short, action-oriented label
  track: string,                // owning workstream: "CX", "CRM", "Data", …
  duration: string,             // "90 min", "2h"
  mode: 'onsite' | 'hybrid' | 'remote',
  status: 'draft' | 'proposed' | 'scheduled' | 'done' | 'skipped',
  summary: string,              // 1-3 sentences: what & why
  mainOutcomes: string[],       // 3-5 concrete deliverables or decisions
  agenda: AgendaItem[],         // tentative agenda slots with durations
  clientAttendees: Attendee[],  // roles on the client side
  agencyAttendees: Attendee[],  // roles on the Digitas side
  preReads: string[],           // docs to send 48h in advance
  dependencies: string[],       // "Needs W03 complete"
  notes?: string
}

Attendee = {
  id: string,
  title: string,                // role title, e.g. "Head of CRM"
  names?: string[]              // optional: specific people filling the role
}

AgendaItem = {
  id: string,
  label: string,                // "Context-set", "Friction mapping", "Close"
  duration?: string,            // "15 min"
  notes?: string                // facilitator prompt
}
```

**Attendee rules.** The workshop-planner sub-agent proposes **role titles
only** — it never fills in specific people's names. Names are a human
concern, added in the Plan UI once the roster is real. A workshop
attendee record with no `names` is perfectly valid; the title alone is
what question-targeting and invite-sizing depend on.

### Rules for the inventory

1. **Every workshop is scoped.** No "workshop 1" that tries to cover
   everything. A workshop that doesn't fit on one agenda page is actually
   two workshops.
2. **Outcomes are concrete, not generic.** "Align on demand spaces" is bad;
   "Agreed list of 6-8 demand spaces for Pre-Arrival phase, signed off by
   Head of CX" is good.
3. **Mode drives attendee sizing.** Remote sessions cap at ~8 participants,
   hybrid at ~10, onsite can scale to ~15 with facilitation help.
4. **Phase dictates ordering.** Discovery before Alignment before Strategy.
   Don't propose a Strategy workshop that runs before the Discovery
   evidence exists.
5. **Pre-reads are mandatory for anything that's not a first-meeting.** If
   the workshop depends on a prior deliverable, list it.
6. **Status reflects scheduling reality.** AI proposals start at `proposed`.
   Humans move them to `scheduled` once a calendar slot exists, `done` once
   notes land in Capture.

### The question inventory (per workshop)

Each workshop carries a set of **WorkshopQuestion** records. A workshop
question is *not* an interview question — it is a facilitated prompt
tuned to produce signal in the room.

```
WorkshopQuestion = {
  id: string,
  workshopId: string,
  targetRole: string,           // role title from clientAttendees/agencyAttendees
  text: string,                 // the question itself
  intent: 'context' | 'problem' | 'jtbd' | 'circumstance' |
          'need' | 'opportunity' | 'gap' | 'contradiction',
  journeyPhase?: string,        // optional: which journey phase this probes
  rationale?: string,           // facilitator's why-we-ask
  notes?: string                // captured answers / field observations
}
```

**Design rules for workshop questions:**

1. **General framing, specific aim.** The question should read as natural
   conversation ("Walk me through the last time…"), but the `intent` tag
   tells the facilitator what signal type we want it to surface.
2. **One role per question.** Different attendees see different things;
   don't ask one prompt to the whole room. `targetRole` must match an
   attendee `title` verbatim.
3. **Balance intents.** Over ~12 questions, aim for: ~1 `context`, ~3
   `problem`, ~2 `jtbd`, ~2 `circumstance`, ~1 `need`, ~1 `opportunity`,
   ~1 `gap`, ~1 `contradiction`.
4. **Probe contradictions last.** Place contradiction questions at the
   end — they land after trust is built.
5. **Tag journey phases when defined.** If the engagement has journey
   phases, set `journeyPhase` to the exact label of the phase the
   question probes. Leave it empty for phase-agnostic questions.
6. **All edits stay human-owned.** AI proposes; PMs and strategists edit.
   The Plan UI groups questions by intent so humans can see the balance
   at a glance.

The Claude subagent that proposes the inventory is `workshop-planner`.
The subagent that builds the per-workshop question set is
`discovery-question-generator` in `workshop` scope — it follows the
full phrasing playbook in
`.claude/skills/workshop-questions-generator/SKILL.md` (how to phrase
problem / jtbd / circumstance / context / need / opportunity / gap /
contradiction questions, with intent-specific anti-patterns).

---

## 5. Discovery Plan Format

Before step 5 (capture), output a **Discovery Plan** — the set of interviews + workshops we commit to. Format:

```json
{
  "plan": {
    "interviews": [
      {
        "department": "Marketing",
        "role": "CMO",
        "questions": ["...", "...", "..."],
        "duration": "45 min",
        "priority": "must-have"
      }
    ],
    "workshops": [
      {
        "name": "Pains & Gains",
        "participants": ["CMO", "Head of CRM", "Head of Retention"],
        "duration": "90 min",
        "priority": "should-have"
      }
    ],
    "documents": [
      {
        "title": "FY26 Marketing Strategy Deck",
        "askedOf": "CMO",
        "priority": "must-have"
      }
    ],
    "coverage": {
      "departments": ["Marketing", "CRM", "Service"],
      "missing": ["IT / Data", "Operations"],
      "risk": "Tech feasibility claims cannot be validated without IT interview"
    }
  }
}
```

### Rules for building a plan
1. **Cover the relevant departments** — if the engagement is CX/CRM, all 10 probably apply; if it's a narrow product brief, 3-5 may be enough
2. **Flag missing coverage explicitly** — the `coverage.risk` field tells the PM what they're accepting when they approve an incomplete plan
3. **Prioritize must-have vs should-have** — must-haves must happen; should-haves are stretch
4. **Ask for documents alongside interviews** — stakeholders will reference docs they assume we've seen

---

## 6. Quality Checks Before Approval

Before the PM approves the evidence set and moves to signal extraction:

1. **Coverage** — at least one Evidence record per relevant department, OR a justified gap
2. **Confidence balance** — ≥ 50% of records tagged `high` confidence (if everything is `low`, we haven't really done discovery)
3. **Customer voice present** — at least 5 direct quotes (`type: 'quote'`)
4. **Quant + qual mix** — at least one `metric` record to anchor the narrative
5. **Contradiction check** — if two Evidence records conflict, flag it for discussion, don't resolve silently

### Red flags (DO NOT PROCEED)
- All evidence comes from one department → echo chamber
- All evidence comes from leadership, none from frontline → sanitized view
- Every evidence record is `high` confidence with no contradictions → too clean, probably missing friction
- No `metric` records → you only have opinions

---

## 7. What Discovery Is NOT

- **Not the brief** — the brief is the hypothesis; discovery stress-tests it
- **Not generation** — discovery does not produce demand spaces; that happens later
- **Not exhaustive research** — we are sampling the evidence space, not auditing it
- **Not a Claude task alone** — Claude structures and analyzes; humans interview

The Claude subagents available for this step are:
- `discovery-question-generator` — builds the Discovery Plan from the brief
- `evidence-summarizer` — turns raw interview transcripts or long docs into clean Evidence records

Both are defined in `.claude/agents/`.
