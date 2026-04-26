import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import {
  buildInformedContext,
  type InformedPhaseRef,
  type InformedProblemPayload,
} from '@/lib/extraction/informed-context';
import type {
  GenerateJourneyPhasesResponse,
  InformedBlend,
  Journey,
  JourneyPhase,
  ModelInput,
} from '@/lib/types';

/**
 * Informed Landscape variant generator.
 *
 * One call generates a *full* Informed Landscape variant — phases for
 * every journey on the model — anchored on classified problems plus the
 * supporting evidence prescribed by the requested `blend`.
 *
 * Companion modules:
 * - `lib/extraction/informed-context.ts` (blend logic, problem bucketing)
 * - `.claude/agents/informed-landscape-generator.md` (persona / anti-patterns)
 */

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert behavioral strategist at Digitas, generating an INFORMED LANDSCAPE variant for a client engagement.

The "informed" landscape rebuilds the customer journey around CLASSIFIED PROBLEMS — the real frictions surfaced from discovery — not just stated assumptions from the brief.

Your output for each per-journey call must be a JSON object with a "journeyPhases" array containing 4-7 journey phases.

Each phase must have:
- label: Short name for the phase (lifecycle stage, NOT a problem label)
- description: What happens during this phase (1-2 sentences)
- trigger: What event marks entry into this phase

CRITICAL RULES:
1. Phases are LIFECYCLE STAGES, not problem labels. "Checkout broken" is NOT a phase.
2. Phases must be BUSINESS-SPECIFIC — not generic funnels like "Awareness → Consideration → Decision".
3. Every PHASE-SCOPED problem listed in the prompt must be plausibly hostable inside one of your generated phases for that journey. If you can't place it, your phases are wrong.
4. Honor the EVIDENCE LAYER banner — only use sources that are in scope for the blend. When evidence contradicts a stated assumption, prefer the evidence.
5. Stay strictly inside the requested journey scope. Do not bleed into adjacent journeys (e.g. when generating "Departure", do not describe arrival or transit).
6. SYSTEMIC / CROSS-CUTTING problems (no specific phase) are background context. They shape framing across the landscape but MUST NOT become their own phase. "Data sync issues" is not a phase. Do NOT create a phase named "Cross-cutting" or "Systemic".
7. Apply the "remove the product" test — phases should be describable without naming features.
8. Strict JSON only.

Example for a theme park's single-journey model:
{"journeyPhases": [
  {"label": "Inspire", "description": "Customer discovers the destination and begins imagining a visit", "trigger": "First exposure to brand content or word-of-mouth"},
  {"label": "Purchase", "description": "Customer commits to visiting by booking tickets or packages", "trigger": "Completes ticket purchase"},
  {"label": "Pre-Arrival", "description": "Period between booking and arriving at the destination", "trigger": "Purchase confirmed"},
  {"label": "On-Site", "description": "Customer is physically at the destination experiencing attractions", "trigger": "Enters the park gates"},
  {"label": "Post-Visit", "description": "Customer reflects on their experience and considers future visits", "trigger": "Leaves the destination"}
]}`;

interface RequestBody {
  apiKey?: string;
  blend?: InformedBlend;
  input?: ModelInput;
  journeys?: Journey[];
  problems?: InformedProblemPayload[];
  /**
   * Existing phases on the model — used to bucket per-phase problems
   * before we ask the LLM for new phases. Each row carries the journeyId
   * so we can scope buckets per journey when looping.
   */
  existingPhases?: InformedPhaseRef[];
  /** Optional executive summary from /api/diagnose-narrative for extra context. */
  narrativeSummary?: string;
}

type RawJourneyPhase = Omit<JourneyPhase, 'id' | 'order' | 'journeyId'>;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const {
      apiKey,
      blend,
      input,
      journeys,
      problems,
      existingPhases,
      narrativeSummary,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!blend) {
      return NextResponse.json({ error: 'blend is required' }, { status: 400 });
    }
    if (!input) {
      return NextResponse.json({ error: 'input is required' }, { status: 400 });
    }
    if (!journeys || journeys.length === 0) {
      return NextResponse.json(
        { error: 'At least one journey is required' },
        { status: 400 }
      );
    }
    if (!input.experienceTypes || input.experienceTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one experience type is required' },
        { status: 400 }
      );
    }
    if (!problems || problems.length === 0) {
      return NextResponse.json(
        {
          error:
            'No classified problems available. Run Problem Diagnostics before generating an Informed Landscape.',
        },
        { status: 400 }
      );
    }

    const phasesAll: InformedPhaseRef[] = existingPhases || [];

    // Per-journey LLM call. Each journey is generated independently so
    // phases for one don't bleed into another.
    const allPhases: Array<RawJourneyPhase & { journeyId: string; order: number }> = [];

    let firstFingerprint = '';

    for (const journey of journeys) {
      const journeyName = journey.name?.trim();
      if (!journeyName) continue;

      const phasesInJourney = phasesAll.filter(
        (p) => !p.journeyId || p.journeyId === journey.id
      );

      const ctx = buildInformedContext({
        blend,
        input,
        problems,
        phasesInJourney,
      });

      // First fingerprint becomes the variant's fingerprint. Per-journey
      // contexts only differ on their phasesInJourney filter, so a
      // single fingerprint covers staleness for the whole variant.
      if (!firstFingerprint) firstFingerprint = ctx.sourceFingerprint;

      const promptLines: string[] = [
        ctx.banner,
        '',
        ctx.problemsBlock || '(no phase-scoped problems for this journey)',
        '',
        ctx.systemicBlock,
        '',
      ];

      if (narrativeSummary?.trim()) {
        promptLines.push(`EXECUTIVE NARRATIVE\n${narrativeSummary.trim()}`, '');
      }
      if (ctx.formBlock) promptLines.push(ctx.formBlock, '');
      if (ctx.briefBlock) promptLines.push(ctx.briefBlock, '');
      if (ctx.researchBlock) promptLines.push(ctx.researchBlock, '');

      promptLines.push(
        `JOURNEY SCOPE — generate phases ONLY for this journey:`,
        `- Name: ${journeyName}`,
        journey.jtbdBlueprint
          ? `- Customer's job-to-be-done: ${journey.jtbdBlueprint}`
          : '',
        '',
        `Generate 4-7 sequential phases that:`,
        `- Could plausibly host every phase-scoped problem listed above for this journey`,
        `- Acknowledge but do NOT encode systemic problems as phases`,
        `- Are recognizable lifecycle stages within the ${journeyName} journey`,
        `- Each have a clear entry trigger`,
        `- Are specific to this industry and business model`,
        `- Stay inside the ${journeyName} journey scope; ignore activity that belongs to other journeys`
      );

      const prompt = promptLines.filter((line) => line !== '').join('\n');

      const phases = await generateWithRetry<
        GenerateJourneyPhasesResponse['journeyPhases']
      >(prompt, SYSTEM_PROMPT, apiKey);

      if (!Array.isArray(phases) || phases.length < 4 || phases.length > 7) {
        return NextResponse.json(
          {
            error: `Generation produced invalid number of phases for journey "${journeyName}"`,
          },
          { status: 500 }
        );
      }

      phases.forEach((p, i) => {
        allPhases.push({
          ...(p as RawJourneyPhase),
          journeyId: journey.id,
          order: i,
        });
      });
    }

    // Top-level fingerprint with the same blend + problems shape (the
    // per-journey ctx fingerprints already covered this). Falls back to
    // a degenerate fingerprint when somehow no journey produced one.
    const sourceFingerprint =
      firstFingerprint ||
      `informed:${blend}:${problems.length}:${journeys.length}`;

    // Use the first journey's context for the label (label is
    // blend-only, identical across journeys).
    const label = (() => {
      const labels: Record<InformedBlend, string> = {
        'problems-only': 'Problems only',
        'problems+brief': 'Problems + Brief',
        'problems+research': 'Problems + Research',
        everything: 'Everything',
      };
      return labels[blend];
    })();

    return NextResponse.json({
      blend,
      label,
      sourceFingerprint,
      // Phases come back without ids — the store mints ids when the
      // variant is added so each variant has its own JourneyPhase
      // identities.
      phases: allPhases,
    });
  } catch (error) {
    console.error('Error generating informed variant:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown generation error';
    return NextResponse.json(
      { error: `Failed to generate variant: ${message}` },
      { status: 500 }
    );
  }
}
