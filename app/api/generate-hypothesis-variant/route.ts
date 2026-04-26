import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { buildBlendedContext } from '@/lib/extraction/hypothesis-context';
import type {
  GenerateJourneyPhasesResponse,
  HypothesisBlend,
  Journey,
  JourneyPhase,
  ModelInput,
} from '@/lib/types';

/**
 * Hypothesis landscape variant generator.
 *
 * One call generates a *full* hypothesis landscape variant — phases for
 * every journey on the model — using the evidence cocktail prescribed by
 * the requested `blend`. The strategist may run several blends in
 * parallel (form-only / brief-only / research-only / form+research /
 * everything) and compare them side by side on the workspace.
 *
 * The blend logic lives in `lib/extraction/hypothesis-context.ts` so the
 * route stays a thin wrapper around the per-journey LLM call.
 *
 * Companion agent doc: `.claude/agents/hypothesis-variant-generator.md`.
 */

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert behavioral strategist at Digitas, generating a hypothesis landscape variant for a client engagement.

Your output for each per-journey call must be a JSON object with a "journeyPhases" array containing 4-7 journey phases.

Each phase must have:
- label: Short name for the phase
- description: What happens during this phase (1-2 sentences)
- trigger: What event marks entry into this phase

CRITICAL RULES:
1. Phases must be BUSINESS-SPECIFIC, not generic marketing funnels.
2. Phases represent the customer LIFECYCLE within the named journey — stages ALL customers move through.
3. Do NOT use generic phases like "Awareness → Consideration → Decision".
4. Stay strictly inside the requested journey scope. Do not bleed into adjacent journeys (e.g. when generating "Departure", do not describe arrival or transit).
5. Honor the EVIDENCE LAYER banner. If only the brief is in scope, do not invent details from form fields. If only research is in scope, work from what the evidence shows. When evidence is present and contradicts a stated assumption, prefer the evidence.

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
  blend?: HypothesisBlend;
  input?: ModelInput;
  journeys?: Journey[];
}

type RawJourneyPhase = Omit<JourneyPhase, 'id' | 'order' | 'journeyId'>;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { apiKey, blend, input, journeys } = body;

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

    const ctx = buildBlendedContext({ input }, blend);

    // The blend may have suppressed every available source (e.g. asking
    // for "research-only" when no research docs exist). Fail loudly so
    // the caller doesn't get a vacuous variant back.
    if (!ctx.formBlock && !ctx.briefBlock && !ctx.researchBlock) {
      return NextResponse.json(
        {
          error: `No usable evidence for blend "${blend}". Upload the corresponding source first.`,
        },
        { status: 400 }
      );
    }

    // Per-journey LLM call. Each journey is generated independently so
    // phases for one don't bleed into another.
    const allPhases: Array<RawJourneyPhase & { journeyId: string; order: number }> = [];

    for (const journey of journeys) {
      const journeyName = journey.name?.trim();
      if (!journeyName) continue;

      const prompt = [
        ctx.banner,
        '',
        ctx.formBlock,
        ctx.briefBlock,
        ctx.researchBlock,
        '',
        `JOURNEY SCOPE — generate phases ONLY for this journey:`,
        `- Name: ${journeyName}`,
        journey.jtbdBlueprint
          ? `- Customer's job-to-be-done: ${journey.jtbdBlueprint}`
          : '',
        '',
        `Generate 4-7 sequential journey phases that represent the ${journeyName} journey.`,
        `- These are stages ALL customers move through inside the ${journeyName} journey.`,
        `- Each phase needs a clear entry trigger.`,
        `- Be specific to this industry and business model.`,
        `- Stay inside the ${journeyName} journey scope; ignore activity that belongs to other journeys.`,
      ]
        .filter((line) => line !== '')
        .join('\n');

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

    return NextResponse.json({
      blend,
      label: ctx.label,
      sourceFingerprint: ctx.sourceFingerprint,
      // Phases come back without ids — the store mints ids when the
      // variant is added so each variant has its own JourneyPhase
      // identities.
      phases: allPhases,
    });
  } catch (error) {
    console.error('Error generating hypothesis variant:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown generation error';
    return NextResponse.json(
      { error: `Failed to generate variant: ${message}` },
      { status: 500 }
    );
  }
}
