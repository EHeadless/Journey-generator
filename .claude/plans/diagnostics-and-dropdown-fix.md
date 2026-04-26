# Diagnostics UX overhaul + hypothesis dropdown fix

Four user-reported issues, addressed below.

---

## 1. Capture → Diagnostics flow: drop the redundant tab

**Problem today.** Capture has 4 tabs: `Capture → Q&A → Review → Problem Diagnostics`. The Diagnostics tab is its own step where the user clicks "Run Diagnostics" again, even though they already accepted findings in Review.

**Target.** When the user accepts findings on Review, run the diagnostics pipeline immediately and route them to a dedicated diagnostics page that just shows the graphs and the report.

**Changes.**

- **New route**: `app/model/[id]/diagnostics/page.tsx`
  - Hosts `DisciplineDonut`, `FrequencyImpactQuadrant`, `JourneyCanvas` (new — see §3), `ProblemTable`, `NarrativeReport`
  - "Re-classify" / "Regenerate narrative" buttons live here (so users can re-run if they edit signals later)
  - Diff modal stays here for re-runs that would overwrite manual edits
- **Capture page** (`app/model/[id]/capture/page.tsx`):
  - Remove the `'diagnostics'` tab from `TAB_ORDER` and `TAB_LABELS`
  - On Review tab, the existing accept flow gets a new terminal action: **"Confirm findings & run diagnostics"**
  - That handler calls the silent pipeline (already exists in `ProblemDiagnosticsPanel.handleRunDiagnostics`):
    1. `promoteAcceptedProblems()`
    2. `callClassify(nextProblems)`
    3. `replaceProblemDiagnostics(modelId, rows)` if no manual edits
  - Then `router.push('/model/{id}/diagnostics')`
- **Refactor `ProblemDiagnosticsPanel`**: split into
  - `useProblemDiagnostics(modelId, apiKey)` — hook exposing `runDiagnostics()`, state, diff modal
  - `DiagnosticsReport` — pure render (graphs + report) used by the new page
  - The Capture review tab uses just the hook; the new page uses both
- **StepProgress**: leave the steps list as-is. Diagnostics is a destination from Capture; not its own top-level step (consistent with the user's "open the folder" framing).

---

## 2. Frequency × Impact matrix: full width, inline text

**Problem today.** `FrequencyImpactQuadrant` renders as 6px dots with a hover tooltip. SVG viewBox is 600×460 with `preserveAspectRatio="none"` — text inside dots would warp. Container is bounded by the panel, not the page.

**Target.** Full-page-width matrix with problem text rendered inside the quadrants as cards. Hover still works as a focus action.

**Changes** to `components/capture/FrequencyImpactQuadrant.tsx`:

- Drop SVG-based dot rendering. Switch to a CSS-grid-positioned card layout:
  - Container: full-width (page padding only), `min-h-[600px]` (was 460)
  - Background: a 2×2 grid of quadrant cells with thin dashed midlines, drawn as 4 absolutely-positioned divs (or one SVG behind for axis ticks/labels)
  - Each problem: an absolutely-positioned `<div>` with a discipline-colored left-border accent, problem text truncated to ~80 chars, frequency/impact badges
  - Position each card by `(frequency, impact)` percentage, same as before
  - Collision packing: replace the radial jitter with vertical stacking — when ≥2 problems land at same `(freq, impact)`, stack them with a small offset (`translateY(8 * index px)`)
- Hover state: card gets ring + raises z-index + shows full text + rationale tooltip
- Discipline filter chips behavior unchanged
- Keep the `problemTexts` prop signature so the parent's data shape is untouched

---

## 3. Journey view: canvas with problem cards

**Problem today.** `JourneyDisciplineHeatmap` is an 8-row × N-column heat-cell grid. Click a cell to see problems below. User wants a canvas like the hypothesis landscape: phases as columns, problems as cards inside.

**Target.** A new `JourneyCanvas` component that mirrors the workspace canvas pattern.

**Changes.**

- **New component**: `components/capture/JourneyCanvas.tsx`
  - Layout: horizontal scroll of phase columns (one per `journeyPhase` of the active journey, sorted by `order`)
  - Each column header: phase label + count of problems mapped to it
  - Each card inside a column: one `ProblemDiagnostic` whose `affectedPhaseIds` includes that phase
    - Discipline-colored left border (using `DISCIPLINE_COLORS`)
    - Problem text (truncated)
    - Discipline label chip + freq/impact badges
    - If the problem affects multiple phases, the same card appears in each affected column (read-only mirror is fine — clarifies "this problem spans X, Y, Z")
  - Filter row above: discipline chips (reuse the chip component from FrequencyImpactQuadrant) — toggling a discipline filters cards across all columns
- **Replace** `JourneyDisciplineHeatmap` usage in the new diagnostics page with `JourneyCanvas`
- Keep `JourneyDisciplineHeatmap` for now (delete only after the new canvas is verified in the report)

Out of scope: drag-to-reassign-phase. We'll keep the card read-only; phase edits stay in the table.

---

## 4. Problem table: discipline filter + editable frequency

**Problem today.** Table has no filter; frequency is read-only text (`FREQUENCY_LABELS[d.frequency]`).

**Target.** Filter rows by discipline; frequency editable.

**Changes** to `components/capture/ProblemTable.tsx`:

- **Filter bar above the table**:
  - Discipline chips (reuse same chip set as the matrix). Toggle one or more to narrow rows. Active chip uses `DISCIPLINE_COLORS[d]` background.
  - "All" / clear-filter chip when ≥1 active
  - Filter applied as `diagnostics.filter(d => selected.size === 0 || selected.has(d.discipline))`
- **Frequency cell**:
  - Replace the read-only span with a `<select>` mirroring the Impact cell pattern
  - Options: 1–5 with `SCORE_LABELS` (or `FREQUENCY_LABELS` keyed by score)
  - On change → `onUpdate(d.id, { frequency: score, manuallyEdited: true })`
  - Keep the rationale (`d.frequencyRationale`) in a tooltip / small text below
  - **Type note**: `ProblemDiagnostic.frequency` is already `DiagnosticScore`, so no type change. The framework spec says LLM never sets frequency — it stays deterministic by default, and a manual override is exactly what `manuallyEdited` exists for. I'll add a one-line note in the column header: "*Auto-computed; override if needed*"

---

## 5. Hypothesis landscape: dropdown clipped by next pane

**Root cause.** `components/HypothesisVariantsBar.tsx:195` sets `overflow-x-auto` on the bar's root. Setting overflow on one axis forces `overflow-y` to `auto` (CSS spec), which clips the absolute-positioned `Generate variant` dropdown vertically. The dropdown's `z-40` doesn't help because clipping happens before stacking.

**Fix options considered.**

- ✗ Remove `overflow-x-auto`: kills horizontal scroll for many-variant case
- ✗ Bump z-index: doesn't fix clipping
- ✓ **Render dropdown via React portal** anchored to the button via `getBoundingClientRect()`

**Chosen change** to `components/HypothesisVariantsBar.tsx`:

- Wrap the picker `<div>` (currently lines 311–362) in a `createPortal(..., document.body)` mount
- Compute position from a `ref` on the trigger button: `top = rect.bottom + 4`, `right = window.innerWidth - rect.right`
- Recompute on `pickerOpen` toggle and on window resize
- Use `position: fixed` for the portaled dropdown; keep `z-50` to clear the fixed top header (which is also `z-50` — bump dropdown to `z-[60]` to be safe)
- Keep `onMouseLeave={() => setPickerOpen(false)}` plus an outside-click listener (since the portal escapes the bar)

This is local to one component and doesn't change the bar's external API.

---

## File-by-file summary

**New**
- `app/model/[id]/diagnostics/page.tsx`
- `components/capture/JourneyCanvas.tsx`
- `lib/hooks/useProblemDiagnostics.ts` (extracted from `ProblemDiagnosticsPanel`)
- `components/capture/DiagnosticsReport.tsx` (pure render extracted from panel)

**Edit**
- `app/model/[id]/capture/page.tsx` — drop diagnostics tab; add post-accept handler that runs pipeline + routes
- `components/capture/SignalReview.tsx` — add "Confirm findings & run diagnostics" terminal action
- `components/capture/FrequencyImpactQuadrant.tsx` — full-width grid + inline text cards
- `components/capture/ProblemTable.tsx` — discipline filter row + editable frequency cell
- `components/HypothesisVariantsBar.tsx` — portal the picker dropdown
- `components/capture/ProblemDiagnosticsPanel.tsx` — slim down to consume the new hook + report (keeps existing import sites working until Capture page no longer imports it)

**Delete (after verification)**
- `components/capture/JourneyDisciplineHeatmap.tsx` (after `JourneyCanvas` ships and is wired)

No `lib/types.ts` changes. No store schema changes. No API changes.

---

## Verification checklist

- Accepting findings on Review now navigates to `/model/{id}/diagnostics` with classified rows visible
- Diagnostics page loads with: donut, full-width quadrant with inline text, journey canvas, filterable + freq-editable table, narrative
- Editing frequency in the table sets `manuallyEdited` and persists in IndexedDB
- Discipline filter on table narrows rows; clearing filter restores all
- Hypothesis landscape: clicking "Generate variant" shows the dropdown above the journey tabs (not clipped)
- No regression: re-running diagnostics with manual edits still opens the diff modal
