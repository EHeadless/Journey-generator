---
name: problem-diagnostics-framework
description: Taxonomy, scoring rubrics, and report structure for the Problem Diagnostics folder in the Capture phase. Defines the 8-discipline classification, frequency × impact rubric, journey × discipline mapping, and the structure of editable reports + Word/PPT exports.
---

# Problem Diagnostics Framework

This skill governs how curated Problem Signals are classified, scored, mapped onto the journey, and rendered into a diagnostic report. The runtime classification API (`/api/classify-problems`) and the narrative API (`/api/diagnose-narrative`) both reference this skill verbatim. Component code references it for labels, ordering, and color mappings.

## Sister skills

- **signal-mapping-framework** — defines what a Problem Signal is in the first place. We classify only **curated Signals** of `type='problem'`, not raw `ExtractedSignal` rows.
- **discovery-framework** — defines how evidence enters the system that eventually becomes a Problem Signal.

---

## 1. The 8-discipline taxonomy (LOCKED)

Every problem gets a **primary** discipline (required) and an **optional secondary** discipline. Two slots is enough — three becomes mush.

| ID | Label | What lives here | What does NOT belong here |
|---|---|---|---|
| `technical` | Technical | Backend systems, integrations, latency, data pipelines, APIs, infrastructure, code quality | UX problems caused by tech (those go to `ux-ui` with Tech as secondary) |
| `cx-human` | CX / Human | Frontline service interactions, agent workflows, customer emotional experience, journey friction caused by humans/process | Pure UI/UX problems (`ux-ui`); pure backend (`technical`) |
| `governance` | Governance | Approval bottlenecks, ownership ambiguity, RACI confusion, compliance gates, escalation paths, data governance | Strategy decisions themselves (`strategy-business`) |
| `strategy-business` | Strategy / Business | Wrong target segments, missing positioning, unclear value props, business-model conflicts, OKR misalignment, channel strategy | Specific brand expression problems (`brand`) |
| `ux-ui` | UX / UI | Interface design, navigation, IA, visual design, accessibility (UI side), usability of digital products | Backend usability problems (`technical`) |
| `reporting-dashboarding` | Reporting / Dashboarding | KPI definition, dashboards, attribution, measurement gaps, data visibility for decision-makers | Underlying data infra problems (`technical`) |
| `martech` | Martech (Marketing) | CRM tooling, CDP, CEP, journey orchestration, segmentation infra, marketing automation, channel execution tooling | Strategy-level marketing problems (`strategy-business`) |
| `brand` | Brand | Brand identity, voice, perception, consistency across touchpoints, positioning expression | Strategic brand decisions about who-we-are (`strategy-business`) |

**Decision heuristic when a problem straddles two disciplines:**
- Primary = where the *root cause* lives
- Secondary = where the *symptom shows up*

Example: "Agents can't see customer history" — primary `technical` (the data integration is broken), secondary `cx-human` (the symptom is a degraded human interaction).

---

## 2. Frequency score (1–5, deterministic)

Frequency is **not** an LLM judgment. It is computed from evidence weight.

Inputs:
- `sourceCount` = number of distinct uploads / transcripts that cite this problem (via `Signal.sources[].evidenceId`)
- `chunkCount` = total `supportingChunkIds` across all sources (de-duplicated)
- `departmentSpread` = number of distinct `Evidence.department` values across the problem's sources

| Score | Label | Rule |
|---|---|---|
| 1 | Once | Single source, single chunk |
| 2 | Rare | One source, multiple chunks; or two sources from same department |
| 3 | Recurring | 2-3 sources across at least 2 departments |
| 4 | Common | 4+ sources OR mentioned across 3+ departments |
| 5 | Pervasive | 5+ sources AND mentioned across 3+ departments |

The classification API computes this in code, not in the LLM call. The LLM never overrides frequency.

---

## 3. Impact score (1–5, LLM-rated)

Impact is rated by the LLM using this rubric. The rubric is part of the API prompt.

| Score | Label | Definition |
|---|---|---|
| 1 | Negligible | Minor annoyance; no measurable customer or business effect |
| 2 | Low | Localised friction; affects a small group or rare scenario |
| 3 | Moderate | Repeated friction; meaningful drop in CSAT / conversion / efficiency for one segment |
| 4 | High | Material revenue, retention, or operational impact; multiple segments affected; visible in KPIs |
| 5 | Severe | Existential, regulatory, brand-damaging, or revenue-blocking; would be a board-level concern |

The LLM must justify the score in `impactRationale` (1-2 sentences citing what makes it that severity). Vague rationales like "this is important" are unacceptable.

---

## 4. Journey-phase mapping

Each problem maps to **one or more** existing `JourneyPhase` IDs (from the Model's `journeyPhases` array). The LLM picks phase IDs based on phase `label` + `description` + `trigger`.

Rules:
- A problem MUST map to at least one phase.
- A problem MAY map to multiple phases if the friction is genuinely cross-phase (e.g. "no unified ID" affects every phase).
- The LLM MUST justify the phase mapping in `phaseRationale`.

---

## 5. Donut counting rule

The discipline distribution donut chart counts:

```
disciplineCount(d) = count(problems where primary == d) + 0.5 × count(problems where secondary == d)
```

This is a fixed convention shared by the chart, the report, and the LLM narrative. Document it on the chart as a footnote.

---

## 6. The 2×2 quadrant interpretation

The Frequency × Impact matrix splits at midpoint (3):

| Quadrant | Frequency | Impact | Strategic meaning | Action posture |
|---|---|---|---|---|
| **Quick Wins** | low (1-2) | high (4-5) | Real damage but rare — fixing them yields disproportionate ROI per problem | Patch and move on |
| **Major Projects** | high (4-5) | high (4-5) | Pervasive, severe — these are the ones that justify program-level investment | Build a workstream |
| **Time Sinks** | high (4-5) | low (1-2) | Common but not really hurting anyone — beware sunk-cost prioritisation | Deprioritise; stop fixing |
| **Minor** | low (1-2) | low (1-2) | Background noise — track but don't fund | Acknowledge; defer |

Mid-band scores (3) sit on the dividing lines and should be visually positioned exactly on the boundary — never silently pushed to one side.

---

## 7. Report structure (Word + PPT)

The diagnostic report — generated by `/api/diagnose-narrative` and rendered by `lib/problem-diagnostics-word-export.ts` and `lib/problem-diagnostics-pptx-export.ts` — has this fixed structure:

### Section 1 — Executive summary (1 paragraph + headline numbers)
- Total problems classified
- Discipline distribution headline ("Half the surface area is Tech and Martech")
- Top 1-2 quadrant findings ("3 Major Projects, 7 Quick Wins")

### Section 2 — Discipline breakdown
- Donut chart (PNG snapshot for Word; native shapes for PPT)
- Per-discipline narrative (1 short paragraph each, only for disciplines with non-trivial counts):
  - Why this cluster exists
  - What's driving it
  - What kind of fix it implies

### Section 3 — Journey × Discipline heatmap
- The matrix as PNG
- Phase-by-phase walkthrough: what's hot in each phase, what surprises, what's missing

### Section 4 — Frequency × Impact quadrants
- The 2×2 with all problems plotted
- Per-quadrant narrative:
  - **Quick Wins:** which to attack first and why
  - **Major Projects:** which deserve a workstream
  - **Time Sinks:** which to consciously deprioritise
  - **Minor:** noted but parked

### Section 5 — Problem appendix
- Every classified problem as a row: text, primary discipline, secondary, frequency, impact, affected phases, citations
- This is the defensibility layer — every claim in sections 1-4 traces back here

---

## 8. Editability invariants

When a strategist manually edits any field on a `ProblemDiagnostic`:
- `manuallyEdited: true` is set on the row
- `updatedAt` is bumped
- A "Re-classify" run MUST NOT silently overwrite manually-edited rows
- Re-classify presents a **diff modal** with per-row checkboxes; the strategist explicitly approves each overwrite
- Manual edits to discipline / scores DO NOT trigger automatic narrative regeneration — narrative is only regenerated on an explicit "Regenerate report" action

---

## 9. Anti-patterns (do not do)

- **Don't classify proto-signals** — only curated `Signal` rows of type `problem` are eligible. Proto-signals would double-count frequency.
- **Don't let the LLM set frequency** — it's deterministic from source counts.
- **Don't allow more than one secondary discipline** — three slots becomes mush.
- **Don't generate narrative without showing the underlying numbers** — the appendix is non-negotiable; charts without data lose all credibility.
- **Don't tag every problem `cx-human`** — that's the lazy default. Force the model to pick the *root* discipline.
- **Don't call this a "scorecard"** — it's a diagnostic. A scorecard implies grading the client; a diagnostic implies finding what to fix.
