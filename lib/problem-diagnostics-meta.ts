/**
 * Problem Diagnostics — labels, ordering, colors, and the deterministic
 * frequency-score computation. Single source of truth for any UI or
 * export that renders a discipline or score.
 *
 * The taxonomy and scoring rubrics themselves are defined in
 * `.claude/skills/problem-diagnostics-framework/SKILL.md`.
 */

import type {
  DiagnosticScore,
  ProblemDiscipline,
  ProblemDiagnostic,
} from './types';

export const DISCIPLINE_ORDER: ProblemDiscipline[] = [
  'technical',
  'cx-human',
  'governance',
  'strategy-business',
  'ux-ui',
  'reporting-dashboarding',
  'martech',
  'brand',
];

export const DISCIPLINE_LABELS: Record<ProblemDiscipline, string> = {
  'technical': 'Technical',
  'cx-human': 'CX / Human',
  'governance': 'Governance',
  'strategy-business': 'Strategy / Business',
  'ux-ui': 'UX / UI',
  'reporting-dashboarding': 'Reporting / Dashboarding',
  'martech': 'Martech',
  'brand': 'Brand',
};

export const DISCIPLINE_SHORT_LABELS: Record<ProblemDiscipline, string> = {
  'technical': 'Tech',
  'cx-human': 'CX',
  'governance': 'Gov',
  'strategy-business': 'Strategy',
  'ux-ui': 'UX/UI',
  'reporting-dashboarding': 'Reporting',
  'martech': 'Martech',
  'brand': 'Brand',
};

/**
 * Categorical palette — deliberately chosen to read well on both light
 * and dark themes. These are used for the donut, the heatmap row labels,
 * and the quadrant legend.
 */
export const DISCIPLINE_COLORS: Record<ProblemDiscipline, string> = {
  'technical': '#4F46E5',           // indigo
  'cx-human': '#EC4899',            // pink
  'governance': '#64748B',          // slate
  'strategy-business': '#0EA5E9',   // sky
  'ux-ui': '#A855F7',               // purple
  'reporting-dashboarding': '#10B981', // emerald
  'martech': '#F59E0B',             // amber
  'brand': '#EF4444',               // red
};

export const SCORE_LABELS: Record<DiagnosticScore, string> = {
  1: '1 — Negligible',
  2: '2 — Low',
  3: '3 — Moderate',
  4: '4 — High',
  5: '5 — Severe',
};

export const FREQUENCY_LABELS: Record<DiagnosticScore, string> = {
  1: '1 — Once',
  2: '2 — Rare',
  3: '3 — Recurring',
  4: '4 — Common',
  5: '5 — Pervasive',
};

/**
 * Heatmap cell color — a sequential blue→red ramp keyed off
 * (frequency × impact) / 25. Returns Tailwind-compatible hex.
 */
export function heatColor(intensity: number): string {
  // intensity ∈ [0, 1]
  const t = Math.max(0, Math.min(1, intensity));
  if (t === 0) return '#1E293B';
  // interpolate slate (cool) → orange (warm) → red (hot)
  if (t < 0.5) {
    // slate -> amber
    const k = t / 0.5;
    return lerpHex('#1E293B', '#F59E0B', k);
  }
  // amber -> red
  const k = (t - 0.5) / 0.5;
  return lerpHex('#F59E0B', '#DC2626', k);
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// ---------- Frequency rubric (deterministic) ----------

export interface FrequencyInputs {
  sourceCount: number;        // distinct uploads / evidence rows citing this problem
  chunkCount: number;         // total supportingChunkIds (de-duplicated)
  departmentSpread: number;   // distinct Evidence.department values
}

export interface FrequencyResult {
  score: DiagnosticScore;
  rationale: string;
}

/**
 * Compute frequency score from evidence weight. The LLM never sets this.
 * Mirrors the table in the skill file.
 */
export function computeFrequency(inputs: FrequencyInputs): FrequencyResult {
  const { sourceCount, chunkCount, departmentSpread } = inputs;
  let score: DiagnosticScore = 1;
  if (sourceCount >= 5 && departmentSpread >= 3) score = 5;
  else if (sourceCount >= 4 || departmentSpread >= 3) score = 4;
  else if (sourceCount >= 2 && departmentSpread >= 2) score = 3;
  else if ((sourceCount === 1 && chunkCount > 1) || sourceCount === 2) score = 2;

  const rationale = `${sourceCount} source${sourceCount === 1 ? '' : 's'}, ${chunkCount} citation${chunkCount === 1 ? '' : 's'}, across ${departmentSpread} department${departmentSpread === 1 ? '' : 's'}.`;
  return { score, rationale };
}

// ---------- Donut counting (primary 1.0, secondary 0.5) ----------

export function disciplineCounts(
  diagnostics: ProblemDiagnostic[]
): Record<ProblemDiscipline, number> {
  const out = Object.fromEntries(
    DISCIPLINE_ORDER.map((d) => [d, 0])
  ) as Record<ProblemDiscipline, number>;
  for (const d of diagnostics) {
    out[d.discipline] = (out[d.discipline] || 0) + 1;
    if (d.secondaryDiscipline) {
      out[d.secondaryDiscipline] = (out[d.secondaryDiscipline] || 0) + 0.5;
    }
  }
  return out;
}

// ---------- Quadrant assignment ----------

export type Quadrant = 'quickWins' | 'majorProjects' | 'timeSinks' | 'minor';

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  quickWins: 'Quick Wins',
  majorProjects: 'Major Projects',
  timeSinks: 'Time Sinks',
  minor: 'Minor',
};

/** Midpoint = 3 (inclusive on the high side per skill spec). */
export function quadrantOf(d: { frequency: number; impact: number }): Quadrant {
  const highFreq = d.frequency >= 3;
  const highImpact = d.impact >= 3;
  if (highFreq && highImpact) return 'majorProjects';
  if (!highFreq && highImpact) return 'quickWins';
  if (highFreq && !highImpact) return 'timeSinks';
  return 'minor';
}
