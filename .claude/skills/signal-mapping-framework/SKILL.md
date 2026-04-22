---
name: signal-mapping-framework
description: How evidence becomes signals (Problems, Needs, Opportunities, Gaps), how signals are mapped to an existing demand landscape or proposed as new, and the confidence rules that govern both.
---

# Signal Mapping Framework

Evidence on its own is noise. Signals are the structured, named, traceable ideas that drive generation. This skill defines the grammar.

## Sister Skills

1. **demand-space-framework** — taxonomy and formats for the generated landscape
2. **discovery-framework** — how we gather evidence from the client
3. **signal-mapping-framework** (this file) — how evidence becomes signals, and how signals drive the landscape

---

## 1. The Four Signal Types

Every signal extracted from evidence falls into exactly one of four categories. One Evidence record can produce multiple signals (often one per category).

| Type | Definition | Example |
|------|------------|---------|
| **Problem** | A pain the client has NAMED and felt | "Our CSAT drops 12 pts after the 90-day mark" |
| **Need** | An explicit request or capability ask | "We need a way to suppress comms for bereaved customers" |
| **Opportunity** | A growth play the client sees but hasn't pursued | "International travelers convert 3x but we have no dedicated journey" |
| **Gap** | A missing capability, data point, or process the consultant identifies | "No unified ID across app and web — personalization will fail at scale" |

### Key distinctions

- **Problem vs Need** — a problem is felt ("churn is high"); a need is requested ("we need churn prediction")
- **Opportunity vs Gap** — an opportunity is named by the client ("we should launch in Gulf markets"); a gap is named by the consultant ("you have no mid-funnel nurture, period")
- Problems and Needs come from the client's voice. Opportunities and Gaps can come from either side, but gaps are usually consultant-identified.

---

## 2. Signal Shape

```
Signal = {
  id: string,
  type: 'problem' | 'need' | 'opportunity' | 'gap',
  text: string,                        // 1-2 sentences, specific
  department: string,                  // which function does this live in
  sources: {                           // at least one required
    evidenceId: string,
    quote?: string
  }[],
  relatedSignalIds?: string[],         // clusters of signals often mean something
  confidence: 'high' | 'medium' | 'low',
  confidenceReason: string,            // why this confidence level
  proposedAction?: string              // optional: what the consultant would do with this
}
```

### Confidence rules

A signal's confidence is derived from its evidence, not assigned arbitrarily.

| Confidence | Required evidence |
|------------|-------------------|
| **high** | ≥ 2 Evidence records OR 1 `quote` + 1 `metric` — triangulated |
| **medium** | 1 Evidence record, or multiple records of the same `type` from the same person |
| **low** | Inferred (consultant-identified gap with no direct evidence) OR single low-confidence source |

**Rule:** a `low` confidence signal can still be valid — but it MUST be flagged and the PM must consciously accept it before it drives generation.

---

## 3. Extraction Rules

When turning raw evidence into signals:

### 3.1 One idea, one signal
Don't bundle. If a stakeholder says "our emails are stale AND we have no SMS AND our CDP is broken," that's three signals, not one.

### 3.2 Use the client's language first
If the stakeholder said "we're losing the plot with millennials," the signal text is closer to that, not "declining brand resonance among 25-34 demographic." Translate for clarity, not for polish.

### 3.3 Preserve traceability
Every signal must cite at least one `evidenceId`. If you can't point to evidence, you're guessing — move it to a separate "hypothesis" list and flag for discussion.

### 3.4 Cluster before you name
Read the full evidence set first. If five stakeholders from three departments all describe the same friction, that's one signal with five sources (high confidence), not five signals.

### 3.5 Separate what from why
Problems describe **what is happening**. Resist the urge to explain why in the signal text — the why belongs in the mapper's analysis or the activation's reasoning.

---

## 4. Map vs Propose Logic

Once signals are extracted, the mapper agent does one of two things with each:

```
For each signal:
  IF an existing demand space / dimension / phase describes this signal
    → MAP (attach signal to existing entity as supporting evidence)
  ELSE
    → PROPOSE (create a candidate new entity with signal as justification)
```

### Map decision

A signal maps to an existing entity when:
- The motivation described by the signal is already captured by a demand space (passes the remove-the-product test)
- The constraint / moment / intent / knowledge described by the signal is already captured by a dimension value
- The capability ask described by the signal is already covered by an activation

When mapping: **add the signal ID to the target entity's `supportingSignalIds` array**. Do not rewrite the entity.

### Propose decision

A signal proposes a new entity when:
- It reveals a motivation not captured (propose demand space)
- It reveals a dimension of customer context not captured (propose dimension or dimension value)
- It reveals a capability the landscape has no activation for (propose activation)

When proposing: output a **candidate** — a full entity with a `status: 'proposed'` flag. The PM reviews candidates before they're accepted into the live model.

### Proposed-entity shape

```
ProposedEntity = {
  kind: 'phase' | 'demandSpace' | 'dimension' | 'dimensionValue' | 'activation',
  payload: { ... full entity as defined in lib/types.ts ... },
  justification: {
    signalIds: string[],
    reasoning: string                  // 2-3 sentences, why this doesn't fit existing
  },
  status: 'proposed',
  confidence: 'high' | 'medium' | 'low'
}
```

---

## 5. Confidence Thresholds for Generation

The generator does not treat all signals equally. Rules:

| Signal confidence | Effect on generation |
|-------------------|---------------------|
| **high** | Drives generation directly; entity inherits high confidence |
| **medium** | Drives generation; entity flagged for PM review |
| **low** | Surfaced as a **candidate** only; does not auto-generate; PM must approve |

### The "floor" rule
Any demand space or dimension proposed with ONLY low-confidence signals must carry a "speculative" flag in the UI. This prevents the model from silently optimizing for unverified pain.

---

## 6. Citation Format

When generators reference signals, use this format inline:

```
"Navigate unfamiliar environment" [signal: S-042, S-047]
```

Where `S-042` is the signal ID. This is rendered in the UI as a pill showing the source evidence and quote.

### Why this matters
1. **Traceability** — strategists can defend their work to clients
2. **Prioritization** — high-signal-count entities often warrant more investment
3. **Confidence visibility** — users see at a glance which parts of the model are evidence-rich vs. inferred

---

## 7. Output Format (Mapping Run)

After a signal-extraction and mapping pass, the output has this shape:

```json
{
  "signals": [
    { "id": "S-001", "type": "problem", "text": "...", "department": "CRM",
      "sources": [{"evidenceId": "E-023", "quote": "..."}],
      "confidence": "high", "confidenceReason": "..." }
  ],
  "mappings": [
    { "signalId": "S-001", "action": "map",
      "target": { "kind": "demandSpace", "id": "ds-uuid-42" },
      "rationale": "..." }
  ],
  "proposals": [
    { "signalIds": ["S-015", "S-018"],
      "kind": "dimensionValue",
      "payload": { "label": "Post-payment anxiety", "description": "...", "impact": "..." },
      "justification": { "reasoning": "..." },
      "confidence": "medium" }
  ],
  "contradictions": [
    { "signalIds": ["S-003", "S-019"],
      "note": "Marketing says tone should be aspirational; Service says customers call in distressed. Needs PM resolution." }
  ],
  "coverage": {
    "problemsMapped": 18,
    "problemsUnmapped": 2,
    "unmappedReason": "Two problems don't fit any phase — propose new phase?"
  }
}
```

---

## 8. Quality Checks Before Approval

Before the PM approves the mapping and moves to regeneration:

1. **Every signal is actioned** — no signal sits in limbo; every signal is either mapped or used in a proposal
2. **Contradictions are surfaced** — at least scanned for; contradictions do not block approval but must be visible
3. **Proposal count is reasonable** — if >30% of signals produce proposals, the landscape is stale and needs a rethink, not a patch
4. **No zero-signal entities drive generation** — if a demand space has no supporting signals AND no high-confidence evidence-based dimensions, flag it
5. **Department coverage** — check that mapping output reflects all departments in the evidence, not just one

### Red flags (DO NOT PROCEED)
- All signals are `problem` type → we're not seeing needs or opportunities → we've only listened to pain, not ambition
- All signals map, zero propose → mapper is force-fitting; the landscape has not actually been updated
- All signals propose, zero map → landscape is so stale it might as well be regenerated from scratch

---

## 9. What This Framework Is NOT

- **Not a full root-cause analysis** — that's a strategist's job, not the mapper's
- **Not a scoring model** — confidence is evidence-based, not weighted math
- **Not automatic** — the PM is the gate between signal extraction and generation
- **Not final** — signals can be re-mapped later as evidence accumulates

The Claude subagents available for this step are:
- `signal-extractor` — reads Evidence records and produces Signal records
- `mapper-agent` — reads Signals + existing landscape and produces mappings + proposals

Both are defined in `.claude/agents/`.
