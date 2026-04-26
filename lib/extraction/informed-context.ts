/**
 * Informed Landscape variant context blending.
 *
 * Four parallel blends produce side-by-side Informed landscapes anchored
 * on classified PROBLEMS (from Problem Diagnostics) instead of the
 * brief/research evidence layers used by Hypothesis Landscape.
 *
 *   problems-only      → classified problems alone
 *   problems+brief     → problems + verbatim client brief
 *   problems+research  → problems + research summaries
 *   everything         → problems + brief + research + form fields
 *
 * Each blend deliberately suppresses sources to expose how each layer
 * reshapes the journey when problems lead.
 *
 * The companion API route (`app/api/generate-informed-variant/route.ts`)
 * and the agent persona doc
 * (`.claude/agents/informed-landscape-generator.md`) read these context
 * blocks verbatim — keep their wording aligned.
 */

import type {
  InformedBlend,
  ModelInput,
  ProblemDiscipline,
} from '@/lib/types';
import { DISCIPLINE_LABELS } from '@/lib/problem-diagnostics-meta';
import {
  buildBriefBlock,
  buildFormBlock,
  buildResearchBlock,
  fingerprint,
  hasBriefSignal,
  hasFormSignal,
  hasResearchSignal,
} from './source-blocks';

/**
 * Minimum slice of a ProblemDiagnostic + its source text the prompt
 * needs. The route accepts denormalized rows (already joined with the
 * Signal text) so the LLM has everything in one pass.
 */
export interface InformedProblemPayload {
  id: string;
  text: string;
  discipline: ProblemDiscipline;
  secondaryDiscipline?: ProblemDiscipline;
  impact: 1 | 2 | 3 | 4 | 5;
  frequency: 1 | 2 | 3 | 4 | 5;
  /** Empty array `[]` means cross-cutting / systemic. */
  affectedPhaseIds: string[];
  department?: string;
  sourceQuotes?: string[];
  /**
   * Frequency × Impact quadrant — computed at the workspace boundary via
   * `quadrantOf({ frequency, impact })` so API routes never recompute.
   * Optional only for backwards compatibility with callers that don't
   * yet stamp it; when absent the prompt rendering falls back to F/I.
   */
  quadrant?: 'quickWins' | 'majorProjects' | 'timeSinks' | 'minor';
}

/** Human-readable quadrant labels for prompt rendering and chips. */
const QUADRANT_LABEL: Record<NonNullable<InformedProblemPayload['quadrant']>, string> = {
  quickWins: 'Quick Win',
  majorProjects: 'Major Project',
  timeSinks: 'Time Sink',
  minor: 'Minor',
};

/** Slim view of an existing JourneyPhase used for bucketing. */
export interface InformedPhaseRef {
  id: string;
  label: string;
  /** When present, used to filter the phase to a single journey's bucket. */
  journeyId?: string;
}

export interface InformedContext {
  /** Per-phase problem buckets (markdown) for the journey scope being generated. */
  problemsBlock: string;
  /** Cross-cutting / systemic problems (no specific phase). */
  systemicBlock: string;
  /** Form fields block — empty unless the blend uses form. */
  formBlock: string;
  /** Verbatim brief block — empty unless the blend uses brief. */
  briefBlock: string;
  /** Research summaries block — empty unless the blend uses research. */
  researchBlock: string;
  /** Banner string telling the LLM which evidence layer is in scope. */
  banner: string;
  /** Display label for the variant. */
  label: string;
  /** Stable hash for staleness detection. */
  sourceFingerprint: string;
}

/** Maximum problems rendered into a single bucket before eliding. */
const MAX_PROBLEMS_PER_BUCKET = 30;

const INFORMED_BLEND_LABELS: Record<InformedBlend, string> = {
  'problems-only': 'Problems only',
  'problems+brief': 'Problems + Brief',
  'problems+research': 'Problems + Research',
  everything: 'Everything',
};

const INFORMED_BLEND_BANNERS: Record<InformedBlend, string> = {
  'problems-only':
    'EVIDENCE LAYER: Classified problems ONLY. The brief and research summaries are intentionally withheld so the landscape reflects what discovered frictions alone imply.',
  'problems+brief':
    'EVIDENCE LAYER: Classified problems + verbatim client brief. Research summaries withheld. Reconcile the brief\'s stated journey against the problems where they conflict; prefer problems.',
  'problems+research':
    'EVIDENCE LAYER: Classified problems + research summaries. The brief is withheld. Use research to enrich problem framing.',
  everything:
    'EVIDENCE LAYER: Classified problems + verbatim brief + research summaries + form fields. Maximally informed. Problems are the spine; other sources support, never override.',
};

function severitySort(a: InformedProblemPayload, b: InformedProblemPayload): number {
  if (b.impact !== a.impact) return b.impact - a.impact;
  return b.frequency - a.frequency;
}

function renderProblem(p: InformedProblemPayload): string {
  const disc = DISCIPLINE_LABELS[p.discipline];
  const sec = p.secondaryDiscipline
    ? ` / ${DISCIPLINE_LABELS[p.secondaryDiscipline]}`
    : '';
  const dept = p.department ? ` · ${p.department}` : '';
  const quad = p.quadrant ? ` · ${QUADRANT_LABEL[p.quadrant]}` : '';
  const quote =
    p.sourceQuotes && p.sourceQuotes.length > 0
      ? `\n  Quote: "${p.sourceQuotes[0].replace(/\s+/g, ' ').trim().slice(0, 220)}"`
      : '';
  // Lead with the problem ID so the LLM can cite it back as
  // `sourceProblemIds` when generating JTBDs in the Informed pipeline.
  return `- id=${p.id} [${disc}${sec} · F${p.frequency} I${p.impact}${quad}${dept}] ${p.text.trim()}${quote}`;
}

/**
 * Bucket problems by `affectedPhaseIds` for ONE journey. A multi-phase
 * problem repeats in each affected bucket. Empty arrays go to the
 * systemic bucket. Buckets are sorted by impact desc, then frequency.
 *
 * @param problems        full set of classified problems
 * @param phasesInJourney the existing phases for the journey we're generating for
 */
function bucketProblems(
  problems: InformedProblemPayload[],
  phasesInJourney: InformedPhaseRef[]
): { perPhase: Map<string, InformedProblemPayload[]>; systemic: InformedProblemPayload[] } {
  const phaseIds = new Set(phasesInJourney.map((p) => p.id));
  const perPhase = new Map<string, InformedProblemPayload[]>();
  for (const phase of phasesInJourney) perPhase.set(phase.id, []);
  const systemic: InformedProblemPayload[] = [];

  for (const p of problems) {
    if (p.affectedPhaseIds.length === 0) {
      systemic.push(p);
      continue;
    }
    // Fan out into every affected phase that exists on this journey.
    // A problem assigned only to phases on OTHER journeys gets skipped
    // for this journey's bucketing — it surfaces when those journeys
    // are generated separately.
    let landed = false;
    for (const phaseId of p.affectedPhaseIds) {
      if (phaseIds.has(phaseId)) {
        perPhase.get(phaseId)!.push(p);
        landed = true;
      }
    }
    // Problem touches phases but none on this journey → skip silently.
    void landed;
  }

  perPhase.forEach((arr) => arr.sort(severitySort));
  systemic.sort(severitySort);

  return { perPhase, systemic };
}

function renderProblemsBlock(
  perPhase: Map<string, InformedProblemPayload[]>,
  phasesInJourney: InformedPhaseRef[]
): string {
  const sections: string[] = [];
  for (const phase of phasesInJourney) {
    const bucket = perPhase.get(phase.id) || [];
    if (bucket.length === 0) continue;
    const trimmed =
      bucket.length > MAX_PROBLEMS_PER_BUCKET
        ? [
            ...bucket.slice(0, MAX_PROBLEMS_PER_BUCKET).map(renderProblem),
            `- [+${bucket.length - MAX_PROBLEMS_PER_BUCKET} more elided]`,
          ]
        : bucket.map(renderProblem);
    sections.push(`### Phase: ${phase.label}\n${trimmed.join('\n')}`);
  }
  if (sections.length === 0) return '';
  return `PROBLEMS BY PHASE\n${sections.join('\n\n')}`;
}

function renderSystemicBlock(systemic: InformedProblemPayload[]): string {
  if (systemic.length === 0) return '';
  const trimmed =
    systemic.length > MAX_PROBLEMS_PER_BUCKET
      ? [
          ...systemic.slice(0, MAX_PROBLEMS_PER_BUCKET).map(renderProblem),
          `- [+${systemic.length - MAX_PROBLEMS_PER_BUCKET} more elided]`,
        ]
      : systemic.map(renderProblem);
  return `SYSTEMIC / CROSS-CUTTING (no specific phase — informs framing, NOT phase boundaries)\n${trimmed.join(
    '\n'
  )}`;
}

/**
 * Build the prompt context for one Informed Landscape variant on one
 * journey. The caller loops journeys and concatenates these blocks into
 * the per-journey LLM call.
 */
export function buildInformedContext(args: {
  blend: InformedBlend;
  input: ModelInput;
  problems: InformedProblemPayload[];
  phasesInJourney: InformedPhaseRef[];
}): InformedContext {
  const { blend, input, problems, phasesInJourney } = args;
  const formAvailable = hasFormSignal(input);
  const briefAvailable = hasBriefSignal(input);
  const researchAvailable = hasResearchSignal(input);

  // Source toggles per blend. Form is only included on `everything`.
  const useForm = blend === 'everything';
  const useBrief = blend === 'problems+brief' || blend === 'everything';
  const useResearch = blend === 'problems+research' || blend === 'everything';

  const formBlock = useForm && formAvailable ? buildFormBlock(input) : '';
  const briefBlock = useBrief && briefAvailable ? buildBriefBlock(input) : '';
  const researchBlock =
    useResearch && researchAvailable ? buildResearchBlock(input) : '';

  const { perPhase, systemic } = bucketProblems(problems, phasesInJourney);
  const problemsBlock = renderProblemsBlock(perPhase, phasesInJourney);
  const systemicBlock = renderSystemicBlock(systemic);

  return {
    problemsBlock,
    systemicBlock,
    formBlock,
    briefBlock,
    researchBlock,
    banner: INFORMED_BLEND_BANNERS[blend],
    label: INFORMED_BLEND_LABELS[blend],
    sourceFingerprint: fingerprint([
      blend,
      `problems:${problems
        .map(
          (p) =>
            `${p.id}:${p.discipline}:${p.frequency}:${p.impact}:${p.affectedPhaseIds.join(',')}`
        )
        .sort()
        .join(';')}`,
      useForm
        ? `form:${input.industry || ''}:${(input.businessDescription || '').length}:${input.experienceTypes.join(',')}`
        : 'form:off',
      useBrief && briefAvailable
        ? `brief:${input.briefDocument!.filename}:${input.briefDocument!.charCount}`
        : 'brief:off',
      useResearch && researchAvailable
        ? `research:${(input.researchDocuments || [])
            .map((d) => `${d.filename}:${d.summary ? '+' : '-'}:${d.sizeBytes}`)
            .join(';')}`
        : 'research:off',
    ]),
  };
}

/**
 * Which blends are actually meaningful for the current model state. The
 * UI uses this to enable/disable chips. `problems-only` is always
 * offered when at least one problem exists; otherwise no Informed
 * variant can be generated at all.
 */
export function informedBlendAvailability(args: {
  input: ModelInput;
  problemCount: number;
}): {
  hasProblems: boolean;
  hasForm: boolean;
  hasBrief: boolean;
  hasResearch: boolean;
  blends: InformedBlend[];
} {
  const { input, problemCount } = args;
  const hasProblems = problemCount > 0;
  const hasForm = hasFormSignal(input);
  const hasBrief = hasBriefSignal(input);
  const hasResearch = hasResearchSignal(input);

  const blends: InformedBlend[] = [];
  if (!hasProblems) {
    return { hasProblems, hasForm, hasBrief, hasResearch, blends };
  }
  blends.push('problems-only');
  if (hasBrief) blends.push('problems+brief');
  if (hasResearch) blends.push('problems+research');
  if (hasBrief || hasResearch || hasForm) blends.push('everything');

  return { hasProblems, hasForm, hasBrief, hasResearch, blends };
}

export const INFORMED_BLEND_LABEL = INFORMED_BLEND_LABELS;
