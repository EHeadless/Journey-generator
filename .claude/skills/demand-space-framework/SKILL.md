---
name: demand-space-framework
description: The behavioral strategy framework — rules, taxonomy, and format specs that all generators must follow.
---

# Demand Space Framework

This is the stable knowledge that governs all generation. Subagents reference these rules; they don't redefine them.

## Sister Skills (read together)

This skill is one of three. They work as a set:

1. **demand-space-framework** (this file) — the taxonomy, formats, and anti-patterns for generation
2. **discovery-framework** — how we gather evidence from clients before generating (interview structure, department angles, evidence types)
3. **signal-mapping-framework** — how evidence becomes Problems / Needs / Opportunities / Gaps, and when to map vs. propose

The consultancy workflow is:
```
Brief → Discovery Plan → Discovery Capture → Signal Extraction → Review & Approve
     → Generate Landscape (this skill governs here)
```

Generators read approved evidence + candidate signals as input. They do NOT invent context — everything traces back to evidence from discovery.

---

## Core Concepts

### The Personalization Formula
```
Demand Space → 5 Circumstances (one per axis tuple) → Activation
```
Each Circumstance is a composite position across all 5 universal axes (Knowledge / Intent / Composition / Constraint / Moment) plus a JTBD narrative and Struggle/Progress forces.

### Hierarchy
```
Journey Phase → Demand Space → Circumstance (exactly 5) → Activation [deferred]
```

---

## 1. Journey Phases

**Definition:** Business lifecycle stages that ALL customers move through, regardless of their specific motivation.

**Rules:**
- 4-7 sequential phases per business
- Each phase has: label, description, trigger (what event marks entry)
- Phases are business-specific, NOT generic marketing funnels

**Good Examples:**
- Real Estate: Search → Onboarding → In-Life
- Theme Park: Inspire → Purchase → Pre-Arrival → On-Site → Post-Visit
- Airline: Pre-Booking → Post-Booking → Pre-Journey → Arrival → Dwell → Boarding → In-Flight → Feedback

**Bad Examples (REJECT):**
- Generic funnel: Awareness → Consideration → Decision → Purchase → Retention
- Too granular: Homepage → Browse → Add to Cart → Checkout Step 1...
- Demand spaces disguised as phases: Family Planning → Business Travel → Solo Adventure

---

## 2. Demand Spaces (Jobs to Be Done)

**Definition:** Human life motivations that exist independently of any product. The underlying "why" that brings customers into a journey phase.

### The "Remove the Product" Test
> If you remove the company's product entirely, does the demand space still exist?

- ✅ "Planned Family Holiday" — exists whether or not Miral has an app
- ✅ "Live Comfortably Without Friction" — exists whether or not the property has a portal
- ❌ "I want the app to enhance my visit" — does NOT exist without the app

### Format
- **Label:** 2-4 evocative words (NOT "I want to...")
- **Job to Be Done:** "When I [situation], I want to [action], so that [outcome]"
- **Circumstances:** Generated separately — exactly 5 per demand space, each a composite across the 5 axes (see section 3).

### Rules
- 8-12 demand spaces per journey phase
- Each must pass the remove-the-product test
- No product features disguised as motivations
- No UX requirements ("Seamless experience")
- No use cases ("Book a ticket")

---

## 3. Universal Axis Taxonomy (for Circumstances)

Every Circumstance picks ONE value on each of these 5 axes. A demand space's 5 Circumstances must show contrast — at least 2 distinct values on every axis across the set. The axes below are the invisible scaffolding; write industry-specific values, NOT the axis names.

### Type 1: Knowledge (The Friction Dimension)
**What it captures:** The gap between the user's current mental model and the expert path.

| Industry | Axis Label | Example Values |
|----------|-----------------|----------------|
| Banking | Financial literacy | First-time homebuyer, Seasoned trader |
| SaaS | Technical proficiency | Non-technical manager, Engineer |
| Theme park | Familiarity | First-time visitor, Annual passholder |

### Type 2: Intent (The Stakes Dimension)
**What it captures:** The urgency, emotional weight, and definition of success.

| Industry | Axis Label | Example Values |
|----------|-----------------|----------------|
| Travel | Trip purpose | Board meeting (reliability), Family vacation (joy) |
| Retail | Purchase context | Replenishing essentials, Gifting |
| Healthcare | Visit urgency | Routine checkup, Scary new diagnosis |

### Type 3: Composition (The Ecosystem Dimension)
**What it captures:** The social or technical environment surrounding the user.

| Industry | Axis Label | Example Values |
|----------|-----------------|----------------|
| Streaming | Viewing context | Watching solo, Co-viewing with partner |
| Theme park | Group | Solo thrill-seeker, Multi-generational family |
| B2B | User role | Individual contributor, Decision maker |

### Type 4: Constraint (The Limitation Dimension)
**What it captures:** External factors limiting what's possible right now.

| Industry | Axis Label | Example Values |
|----------|-----------------|----------------|
| Theme park | Accessibility | Wheelchair user, Stroller-dependent |
| E-commerce | Fulfillment | Rural delivery, Payment limitation |
| Aviation | Travel constraints | Tight connection, Visa restriction |

### Type 5: Moment (The Temporal Dimension)
**What it captures:** The life context, calendar context, or emotional moment.

| Industry | Axis Label | Example Values |
|----------|-----------------|----------------|
| Theme park | Life moment | Birthday, Last day of trip |
| E-commerce | Life context | Holiday rush, Moving house |
| Aviation | Travel occasion | Honeymoon, Bereavement travel |

### Generation Rules for Circumstances
1. Produce **exactly 5 Circumstances** per demand space.
2. Each Circumstance is a tuple — one value on each of the 5 axes.
3. Across the 5 Circumstances, every axis must show **contrast** — at least 2 distinct values on that axis (e.g. at least one Novice and one Expert on Knowledge).
4. Each Circumstance carries a JTBD narrative: "When I am [context], I want to [action], so that [outcome]."
5. Each Circumstance carries a **Struggle** (what pushes them away from the current habit) and a **Progress** (what they're reaching for). One short sentence each, in the customer's voice.
6. Moment values are vivid real-life contexts ("Flying with a toddler", "First week postpartum") — never marketing-funnel labels.

### The Quality Test
> "Would a customer use this word to describe their situation?"

- ✅ "I'm on a budget" → Constraint axis value
- ✅ "I'm here with my grandparents" → Composition axis value
- ❌ "My digital engagement is high" — no customer says this
- ❌ "I'm in the consideration phase" — marketing funnel, not situation

---

## 4. Activation Output Formats

### Marketing Activations: The 6 CRM Levers

| Lever | Options | Purpose |
|-------|---------|---------|
| messageDepth | awareness / consideration / action | Funnel position |
| urgency | low / medium / high | Time sensitivity |
| channel | email / SMS / push / in-app | Primary channel |
| tone | informative / empathetic / urgent / celebratory / reassuring | Message personality |
| offer | Deals, features, content | What value to present |
| cadence | Timing and frequency | When and how often |

**Output Format:**
```json
{
  "dimensionValueLabel": "First-time visitor",
  "messageDepth": "awareness",
  "urgency": "low",
  "channel": "email",
  "tone": "reassuring",
  "offer": "What to expect guides, FAQs",
  "cadence": "Drip sequence: 7, 3, 1 days before"
}
```

### Product Activations: Jira-Ready User Stories

| Field | Format | Purpose |
|-------|--------|---------|
| feature | 2-5 word name | Quick reference |
| description | 1-2 sentences | What it does |
| userStory | As a... I want... so that... | Jira-ready |
| priority | high / medium / low | Frequency × impact |

**Output Format:**
```json
{
  "dimensionValueLabel": "Budget-conscious",
  "feature": "Price Alert System",
  "description": "Monitors prices and notifies when items drop below threshold.",
  "userStory": "As a budget-conscious traveler, I want to set price alerts so that I can book when prices fit my budget.",
  "priority": "high"
}
```

### Service Activations: Agent Specifications

| Field | What it contains | Purpose |
|-------|------------------|---------|
| tools | CRM actions, backend systems | What agent can DO |
| knowledge | Articles, scripts, procedures | What agent should KNOW |
| c360Signals | Customer data points | What agent should SEE |
| handoffRules | Escalation triggers | When to ESCALATE |

**Output Format:**
```json
{
  "dimensionValueLabel": "VIP member",
  "tools": "VIP protocol activation, privacy mode toggle",
  "knowledge": "VIP handling procedures, privacy requirements",
  "c360Signals": "VIP tier, special requirements, relationship manager",
  "handoffRules": "Immediate transfer to VIP desk, never place on hold"
}
```

---

## 5. PRD Format

### Structure
1. **Problem Statement** — What pain, for whom, why now
2. **Goals** — 3-5 measurable outcomes: "Increase [metric] by [amount] within [timeframe]"
3. **Non-Goals** — What this explicitly will NOT do
4. **Users & Use Cases** — 2-3 concrete scenarios
5. **User Stories** — Must-have / Should-have / Nice-to-have
6. **Acceptance Criteria** — Given/When/Then format
7. **Risks & Assumptions** — Two columns
8. **Open Questions** — What must be decided before engineering
9. **Success Metrics** — Leading and lagging indicators

### User Story Format
```
As a [user type], I want to [action] so that [outcome].

Acceptance Criteria:
- Given [context], when [action], then [result]
```

---

## 6. Reference Engagements

These PDFs are the source of truth. Subagents should read them when needed:

- **docs/Digitas_MiralCXConsultancy_CRMStrategyScope.pdf** — Gold standard for marketing activation
- **docs/Genome_AI_Transformation_Program.pdf** — Gold standard for service activation

---

## Anti-Patterns (REJECT these)

| Bad Pattern | Why it's bad |
|-------------|--------------|
| "I want to track my request" | Product feature, not motivation |
| "Seamless booking experience" | UX requirement |
| "Digital Engagement" dimension | System metric, not customer situation |
| "Pass Holder Lifecycle" dimension | CRM segment, not situation |
| Generic "personalized messaging" | Too vague to implement |
| Same activation for different values | Defeats the purpose of dimensions |

---

## 7. Evidence-Driven Input Contract

Generators now run AFTER discovery. They accept a `DiscoveryBundle` as input alongside the existing ModelInput:

```
DiscoveryBundle = {
  approvedEvidence: Evidence[],        // interview notes, docs, quotes — summarized and approved
  candidateSignals: {
    problems:       Signal[],          // pain points named by the client
    needs:          Signal[],          // explicit requests
    opportunities:  Signal[],          // growth plays the client sees
    gaps:           Signal[]           // missing capabilities / data / process
  },
  approvedBy: string,                  // PM/strategist who signed off
  approvedAt: Date
}

Signal = {
  id: string,
  text: string,                        // 1-2 sentences
  source: { evidenceId: string, quote?: string },  // traceability
  department: string,                  // Marketing, CRM, Product, Service, etc.
  confidence: 'high' | 'medium' | 'low'
}
```

### Rules for Generators

1. **Evidence traceability** — every demand space, dimension, and activation should cite at least one signal by ID when possible
2. **Do not invent pain points** — use only problems from `candidateSignals.problems`
3. **Do not invent capabilities** — dimensions must be detectable given the tech stack described in approved evidence
4. **Confidence flags propagate** — if input signals are `low` confidence, mark the downstream output with a confidence caveat
5. **Map first, propose second** — if an approved signal already describes a demand space, map to it; only propose new spaces when evidence reveals a gap

### When Evidence is Absent

If the generator is called WITHOUT a `DiscoveryBundle` (legacy flow, or user skipped discovery), proceed with the original brief-only logic but flag the output as `evidence: 'brief-only'` so the UI can surface a warning.
