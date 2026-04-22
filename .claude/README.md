# `.claude/` — Architecture Overview

This folder holds the brain of Journey Generator:
- **Skills** — stable rules, taxonomy, formats. Read by humans AND referenced by agents.
- **Agents** — prompt files loaded server-side, sent to OpenAI as instructions for specific generation steps.

The split is: **skills encode WHAT things are; agents encode HOW to produce them.**

---

## The 8-Step Consultancy Workflow

Journey Generator is not just a generator — it's a full consultancy operating model. The workflow:

```
1. Client Workspace      → create workspace, upload artifacts
2. Operating Context     → industry, tech stack, products, personas
3. Brief                 → business description, goals, pain points
4. Discovery Plan        → question set, per-department interviews    [agent: discovery-question-generator]
5. Discovery Capture     → interview notes, docs, quotes               [agent: evidence-summarizer]
6. Signal Extraction     → Problems / Needs / Opportunities / Gaps    [agent: signal-extractor]
7. Review & Approve      → PM gate — approves signals to feed gen
8. Regenerate Landscape  → phases → demand spaces → 5 Circumstances    [agents: journey-phase,
                           → activations [deferred]                                demand-space,
                                                                                  circumstance,
                                                                                  marketing/product/service-
                                                                                    activation,
                                                                                  persona-mapper]
```

Steps 1-3 are input. Steps 4-7 are **discovery**. Step 8 is **generation**.

The PM is the gate between step 7 and step 8. No generation runs on unapproved evidence.

---

## Skills (3)

Stable knowledge, kept in the main context. These files are the source of truth for rules.

| Skill | Path | What it governs |
|-------|------|-----------------|
| `demand-space-framework` | `skills/demand-space-framework/SKILL.md` | Landscape taxonomy: phases, demand spaces (JTBD), 5-axis Circumstance Taxonomy (Knowledge / Intent / Composition / Constraint / Moment), activation formats (deferred), anti-patterns, evidence-input contract |
| `discovery-framework` | `skills/discovery-framework/SKILL.md` | Pre-generation discovery: 10 departments, per-dept question angles, 7 evidence types, interview structure, workshop patterns, Discovery Plan format, approval quality checks |
| `signal-mapping-framework` | `skills/signal-mapping-framework/SKILL.md` | Evidence → signals: 4 signal types (problem/need/opportunity/gap), confidence rules, map-vs-propose logic, citation format, health checks |

Plus a focused helper:
| `user-story-writer` | `skills/user-story-writer/SKILL.md` | Jira-ready user stories with acceptance criteria |

### How to read the skills

Read all three core skills TOGETHER before starting any consultancy engagement. They are designed as a set:
- discovery-framework tells you how to **gather**
- signal-mapping-framework tells you how to **structure**
- demand-space-framework tells you how to **generate**

---

## Agents (12)

Workers that run in isolated context and produce structured output. All live in `.claude/agents/` as plain markdown prompts. They're loaded by API routes (`app/api/generate-*`) and sent to OpenAI as the system prompt.

### Discovery agents (NEW — step 4-6)

| Agent | Step | Input | Output |
|-------|------|-------|--------|
| `discovery-question-generator` | 4 | Brief + scope + available stakeholders | Discovery Plan (interviews, workshops, document asks, coverage risks) |
| `evidence-summarizer` | 5 | Raw transcript / notes / doc excerpt | Atomic Evidence records |
| `signal-extractor` | 6 | Approved Evidence set | Signal records (Problems/Needs/Opportunities/Gaps) + contradictions |
| `mapper-agent` | 6-7 | Signals + existing landscape | Mappings + proposals + health check |

### Generation agents (EXISTING — step 8)

| Agent | Step | Input | Output |
|-------|------|-------|--------|
| `journey-phase-generator` | 8 | Brief + (optional) DiscoveryBundle | 4-7 journey phases |
| `demand-space-generator` | 8 | Phase + brief + (optional) DiscoveryBundle | 8-12 demand spaces per phase |
| `circumstance-generator` | 8 | Demand space + brief + (optional) DiscoveryBundle | Exactly 5 Circumstances (5-axis tuple + narrative + Struggle/Progress) |
| `marketing-activation-generator` | 8 [deferred] | Circumstances + stack | 6-CRM-lever activations |
| `product-activation-generator` | 8 [deferred] | Circumstances + stack | Feature + Jira-ready user story |
| `service-activation-generator` | 8 [deferred] | Circumstances + stack | Agent spec (tools, knowledge, C360, handoffs) |
| `persona-mapper` | 8 | Full landscape + personas | Persona → phase → demand space × Circumstance mapping |
| `prd-generator` | on-demand | Feature request + full context | 9-section PRD |

All generation agents have been updated to:
1. Reference the 3 skills at the top (Skill References section)
2. Accept an optional `Approved Evidence` + `Approved Signals` block in their input
3. Cite signals via `supportingSignalIds` in their output
4. Fall back to brief-only logic when no evidence is provided (tagged `evidence: "brief-only"`)

---

## Data Flow

```
  ┌─────────────────────┐
  │   Brief (step 3)    │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ discovery-question- │  → Discovery Plan (interviews + workshops + doc asks)
  │     generator       │
  └──────────┬──────────┘
             │ PM runs interviews, collects raw notes
             ▼
  ┌─────────────────────┐
  │ evidence-summarizer │  → Evidence records (atomic, tagged, confidence-rated)
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  signal-extractor   │  → Signal records (problem/need/opportunity/gap)
  └──────────┬──────────┘
             │
             ▼  existing landscape (if any)
  ┌─────────────────────┐
  │    mapper-agent     │  → Mappings + Proposals + health check
  └──────────┬──────────┘
             │
             ▼  ─── PM REVIEW & APPROVE GATE (step 7) ───
             │
             ▼
  ┌─────────────────────┐
  │  journey-phase-gen  │ → Phases [signal-backed]
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │  demand-space-gen   │ → Demand Spaces [signal-backed]
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │  circumstance-gen   │ → 5 Circumstances (5-axis tuple + narrative + Struggle/Progress) [signal-backed]
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │  activation-gens    │ → Marketing / Product / Service activations [deferred]
  │   (by exp. type)    │
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │   persona-mapper    │ → Persona × phase × DS × Circumstance mapping
  └─────────────────────┘
```

Every arrow carries the `DiscoveryBundle` (approved evidence + signals) through so that every generator can cite back to source.

---

## The DiscoveryBundle Contract

Defined formally in `skills/demand-space-framework/SKILL.md` Section 7. Summary:

```typescript
DiscoveryBundle = {
  approvedEvidence: Evidence[],
  candidateSignals: {
    problems: Signal[],
    needs: Signal[],
    opportunities: Signal[],
    gaps: Signal[]
  },
  approvedBy: string,
  approvedAt: Date
}
```

This bundle is the **only** way evidence enters the generator. If absent, generators run brief-only and mark output accordingly.

---

## Signal Citation Format

Every generated entity can carry `supportingSignalIds: string[]`. The UI renders these as pills showing evidence source and quote.

```json
{
  "label": "Post-purchase relationship",
  "jobToBeDone": "...",
  "supportingSignalIds": ["S-001", "S-018"],
  "evidence": "signal-backed"
}
```

`evidence: "signal-backed" | "brief-only"` is a flag on every entity to make the provenance visible in the UI.

---

## What Lives Where — Quick Reference

| Need to change… | Edit… |
|-----------------|-------|
| Rules for what counts as a demand space | `skills/demand-space-framework/SKILL.md` |
| The 10 departments or interview structure | `skills/discovery-framework/SKILL.md` |
| Signal types or confidence rules | `skills/signal-mapping-framework/SKILL.md` |
| The actual prompt OpenAI gets for demand spaces | `agents/demand-space-generator.md` |
| How the Discovery Plan is built | `agents/discovery-question-generator.md` |
| How evidence is summarized | `agents/evidence-summarizer.md` |
| How signals are extracted from evidence | `agents/signal-extractor.md` |
| How signals map to landscape | `agents/mapper-agent.md` |

---

## Next (not yet built)

1. **UI for steps 1-7** — the workspace currently only exposes step 8 (generation). Building the discovery and signal-mapping UI is the next phase.
2. **API routes** for the new agents:
   - `app/api/generate-discovery-plan/route.ts`
   - `app/api/summarize-evidence/route.ts`
   - `app/api/extract-signals/route.ts`
   - `app/api/map-signals/route.ts`
3. **Store extensions** — add `evidenceRecords`, `signals`, `approvals` slices to `lib/store.ts` and corresponding types to `lib/types.ts`
4. **DiscoveryBundle plumbing** — route the approved bundle from the signals stage into every generation route
5. **Signal-pill rendering** — UI component showing cited signals with source evidence on hover

The skills and agents are now designed to make that UI work straightforward: the contracts are defined, the inputs and outputs are typed, and the 8-step flow is explicit.
