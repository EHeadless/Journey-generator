/**
 * Hypothesis variant context blending.
 *
 * Five parallel blends produce side-by-side hypothesis landscapes so the
 * strategist can see how the addition of each evidence layer reshapes the
 * journey. Each blend feeds a different cocktail of context into the
 * journey-phase prompt:
 *
 *   form-only       → just the structured fields the user typed
 *   brief-only      → just the verbatim uploaded brief (form fields ignored)
 *   research-only   → just the research summaries (form + brief ignored)
 *   form+research   → form fields layered with research evidence
 *   everything      → form + brief + research, maximally informed
 *
 * Each blend deliberately suppresses sources to expose what each layer
 * adds — comparing them side by side surfaces where the brief drifted
 * from research findings, or where research challenges what the client
 * stated in the form.
 *
 * The brief-parser, research-summarizer, and journey-phase-generator
 * agents read these context blocks verbatim — keep their wording aligned.
 *
 * Form/brief/research block builders live in `./source-blocks.ts` and are
 * shared with `informed-context.ts` so the two contexts can never drift.
 */

import type { HypothesisBlend, Model, ModelInput } from '@/lib/types';
import {
  buildBriefBlock,
  buildFormBlock,
  buildResearchBlock,
  fingerprint,
  hasBriefSignal,
  hasFormSignal,
  hasResearchSignal,
} from './source-blocks';

export interface BlendedContext {
  /** Pre-formatted block describing the form-state fields, or empty string when suppressed by the blend. */
  formBlock: string;
  /** Pre-formatted block carrying the verbatim brief text (trimmed if huge), or empty string when suppressed. */
  briefBlock: string;
  /** Pre-formatted block carrying the structured research summaries, or empty string when suppressed. */
  researchBlock: string;
  /** Short banner the prompt opens with so the model knows which evidence layer it's working from. */
  banner: string;
  /** Stable hash-ish fingerprint of the inputs that fed into this blend; used for staleness detection. */
  sourceFingerprint: string;
  /** Display label for the variant in the UI, e.g. "Form + Research". */
  label: string;
}

const BLEND_LABELS: Record<HypothesisBlend, string> = {
  'form-only': 'Form only',
  'brief-only': 'Brief only',
  'research-only': 'Research only',
  'form+research': 'Form + Research',
  everything: 'Everything',
};

const BLEND_BANNERS: Record<HypothesisBlend, string> = {
  'form-only':
    'EVIDENCE LAYER: Structured form fields ONLY. The brief and research artifacts are intentionally withheld so this variant reflects what the form alone can support.',
  'brief-only':
    'EVIDENCE LAYER: The verbatim client brief ONLY. The form fields and research artifacts are intentionally withheld — work strictly from what the brief states.',
  'research-only':
    'EVIDENCE LAYER: The research summaries ONLY. The form fields and brief are intentionally withheld — work strictly from what the research evidence shows.',
  'form+research':
    'EVIDENCE LAYER: Form fields AND research summaries. The brief is intentionally withheld — let what the user typed and the evidence layer shape the landscape together.',
  everything:
    'EVIDENCE LAYER: Form fields, the verbatim brief, AND research summaries. Use all available signal; let evidence override stated assumptions when they conflict.',
};

/**
 * Build the blended context for a single variant. The returned blocks
 * are pre-formatted strings — drop them straight into the prompt body.
 * Blocks are EMPTY when the blend deliberately suppresses that source.
 */
export function buildBlendedContext(
  model: Model | { input: ModelInput },
  blend: HypothesisBlend
): BlendedContext {
  const input = model.input;
  const formAvailable = hasFormSignal(input);
  const briefAvailable = hasBriefSignal(input);
  const researchAvailable = hasResearchSignal(input);

  // Source toggles per blend. Keeping this explicit (rather than a
  // boolean trio inferred from the blend name) makes the matrix easy
  // to audit when adding new blends.
  const useForm =
    blend === 'form-only' || blend === 'form+research' || blend === 'everything';
  const useBrief = blend === 'brief-only' || blend === 'everything';
  const useResearch =
    blend === 'research-only' || blend === 'form+research' || blend === 'everything';

  const formBlock = useForm && formAvailable ? buildFormBlock(input) : '';
  const briefBlock = useBrief && briefAvailable ? buildBriefBlock(input) : '';
  const researchBlock =
    useResearch && researchAvailable ? buildResearchBlock(input) : '';

  return {
    formBlock,
    briefBlock,
    researchBlock,
    banner: BLEND_BANNERS[blend],
    label: BLEND_LABELS[blend],
    sourceFingerprint: fingerprint([
      blend,
      useForm ? `form:${input.industry || ''}:${(input.businessDescription || '').length}:${input.experienceTypes.join(',')}` : 'form:off',
      useBrief && briefAvailable ? `brief:${input.briefDocument!.filename}:${input.briefDocument!.charCount}` : 'brief:off',
      useResearch && researchAvailable
        ? `research:${(input.researchDocuments || [])
            .map((d) => `${d.filename}:${d.summary ? '+' : '-'}:${d.sizeBytes}`)
            .join(';')}`
        : 'research:off',
    ]),
  };
}

/**
 * Evidence availability for the model. The UI uses this to decide which
 * blends are *meaningful* to offer — e.g. "research-only" makes no sense
 * if the user uploaded zero research docs, and "brief-only" is just a
 * duplicate of "form-only" if no brief was uploaded.
 */
export function blendAvailability(model: Model | { input: ModelInput }): {
  hasForm: boolean;
  hasBrief: boolean;
  hasResearch: boolean;
  blends: HypothesisBlend[];
} {
  const input = model.input;
  const hasForm = !!(input.industry || input.businessDescription);
  const hasBrief = !!input.briefDocument?.text;
  const hasResearch = (input.researchDocuments?.length || 0) > 0;

  // Always offer form-only. Offer the others only when their primary
  // source is present.
  const blends: HypothesisBlend[] = ['form-only'];
  if (hasBrief) blends.push('brief-only');
  if (hasResearch) blends.push('research-only');
  if (hasResearch && hasForm) blends.push('form+research');
  if (hasBrief || hasResearch) blends.push('everything');

  return { hasForm, hasBrief, hasResearch, blends };
}

export const BLEND_LABEL = BLEND_LABELS;
