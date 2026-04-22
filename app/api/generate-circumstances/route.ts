import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import {
  ModelInput,
  DemandSpace,
  JourneyPhase,
  GenerateCircumstancesResponse,
} from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert JTBD strategist. Your task is to deconstruct a demand space's Job to Be Done into EXACTLY 5 distinct Circumstances.

A Circumstance is a composite position across FIVE universal axes:
1. **Knowledge**   — What the customer knows (e.g. Novice ↔ Expert, First-time ↔ Familiar)
2. **Intent**      — Why they're here now, the stakes (e.g. Routine ↔ High-stakes, Browsing ↔ Buying)
3. **Composition** — Who they're with or for (e.g. Solo, Couple, Family, Group, Corporate)
4. **Constraint**  — What's limiting them (Time, Space, Budget, Accessibility, Language)
5. **Moment**      — Situational / temporal / life context (e.g. "Long-haul business travel", "Holiday rush", "First week postpartum")

For each Circumstance you output:
- Pick ONE value on each axis.
- Write a JTBD-formatted sentence in three parts:
    context : the clause that follows "When I am …"
    action  : the clause that follows "I want to …"
    outcome : the clause that follows "so that …"
  So the assembled sentence reads: "When I am [context], I want to [action], so that [outcome]."
- Write a **Struggle** — what pushes them away from their current habit / the friction in their current situation.
- Write a **Progress** — what they are actually trying to achieve / the better state they're reaching for.

## Hard rules

- Output EXACTLY 5 circumstances — no more, no fewer.
- Each circumstance is DISTINCT from the others. No two circumstances may share the same value on more than 3 axes.
- Across the 5 circumstances, every axis must show **contrast** — at least 2 different values must appear on each axis. (e.g. at least one Novice AND one Expert on Knowledge, at least one Solo AND one Group on Composition, etc.)
- Moment values are vivid real-life contexts, NOT marketing-funnel labels. ✅ "Long-haul business travel" · "Flying with a toddler" · "Connecting after a delayed flight"  ❌ "Consideration phase" · "Engaged user"
- Struggle and Progress are written in the customer's voice, short and punchy. One sentence each.
- Context + action + outcome must be concrete enough that the sentence sounds like a real person, not a persona caricature.

## Example (reference quality)

Demand space: "Engage with in-flight entertainment"
Job to Be Done: "When I am in-flight, I want to engage in entertainment options, so that I can pass the time enjoyably and distract myself from the journey."

Circumstance #1
  knowledge:   "Expert"
  intent:      "Routine"
  composition: "Solo"
  constraint:  "Time"
  moment:      "Long-haul business travel"
  context:     "flying alone on a long-haul overnight work trip and already know what kind of content helps me unwind"
  action:      "quickly access familiar entertainment options"
  outcome:     "I can relax fast and make the journey feel shorter"
  struggle:    "The system slows me down when I already know what I want."
  progress:    "Get into rest mode quickly and reduce the mental drag of travel."

## Output format

Return ONLY valid JSON matching this schema — no prose, no code fences:

{
  "circumstances": [
    {
      "knowledge":   string,
      "intent":      string,
      "composition": string,
      "constraint":  string,
      "moment":      string,
      "context":     string,
      "action":      string,
      "outcome":     string,
      "struggle":    string,
      "progress":    string
    }
    // exactly 5 items
  ]
}
`;

const REQUIRED_FIELDS: Array<
  keyof GenerateCircumstancesResponse['circumstances'][number]
> = [
  'knowledge',
  'intent',
  'composition',
  'constraint',
  'moment',
  'context',
  'action',
  'outcome',
  'struggle',
  'progress',
];

export async function POST(request: NextRequest) {
  try {
    const body: {
      input: ModelInput;
      journeyPhase: JourneyPhase;
      demandSpace: DemandSpace;
      apiKey?: string;
    } = await request.json();

    const { input, journeyPhase, demandSpace, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!input || !journeyPhase || !demandSpace) {
      return NextResponse.json(
        { error: 'Missing required fields: input, journeyPhase, demandSpace' },
        { status: 400 }
      );
    }

    const formatTools = (
      tools: Array<{ value: string; purpose?: string }> | undefined
    ) =>
      tools
        ?.map((t) => (t.purpose ? `${t.value} (${t.purpose})` : t.value))
        .join(', ') || '';

    const techStackContext = input.techStack
      ? `
Tech Stack:
${input.techStack.cloudWarehouse?.length ? `- Cloud Warehouse: ${formatTools(input.techStack.cloudWarehouse)}` : ''}
${input.techStack.dataStorage?.length ? `- Data Storage: ${formatTools(input.techStack.dataStorage)}` : ''}
${input.techStack.crm?.length ? `- CRM: ${formatTools(input.techStack.crm)}` : ''}
${input.techStack.cdp?.length ? `- CDP: ${formatTools(input.techStack.cdp)}` : ''}
${input.techStack.cep?.length ? `- CEP: ${formatTools(input.techStack.cep)}` : ''}
${input.techStack.dxp?.length ? `- DXP: ${formatTools(input.techStack.dxp)}` : ''}
${input.techStack.aiModels?.length ? `- AI Models: ${formatTools(input.techStack.aiModels)}` : ''}
${input.techStack.aiPlatform?.length ? `- AI Platform: ${formatTools(input.techStack.aiPlatform)}` : ''}`.trim()
      : '';

    const productsContext = input.products?.length
      ? `
Products/Channels:
${input.products.map((p) => `- ${p.name}: ${p.description}`).join('\n')}`
      : '';

    const personasContext = input.personas?.length
      ? `
Target Personas: ${input.personas.map((p) => p.label).join(', ')}`
      : '';

    const painPointsContext = input.painPoints
      ? `
Known Pain Points:
${input.painPoints}`
      : '';

    const prompt = `Deconstruct the following demand space into EXACTLY 5 distinct Circumstances.

Industry: ${input.industry}
Experience Types: ${input.experienceTypes?.join(', ') || 'Not specified'}
Business Description: ${input.businessDescription}
${techStackContext}
${productsContext}
${personasContext}
${painPointsContext}

Journey Phase: ${journeyPhase.label}
Phase Description: ${journeyPhase.description}

Demand Space: ${demandSpace.label}
Job to Be Done: ${demandSpace.jobToBeDone}

Vary the 5 circumstances across all five axes (Knowledge, Intent, Composition, Constraint, Moment). Make them realistic, grounded in this industry and this phase. Follow the rules in the system prompt strictly. Return ONLY valid JSON.`;

    const result = await generateWithRetry<GenerateCircumstancesResponse>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    const circumstances = (result?.circumstances ??
      (Array.isArray(result)
        ? (result as unknown as GenerateCircumstancesResponse['circumstances'])
        : [])) as GenerateCircumstancesResponse['circumstances'];

    // Validate cardinality — must be exactly 5.
    if (!Array.isArray(circumstances) || circumstances.length !== 5) {
      console.error(
        'Invalid circumstances response — expected exactly 5, got',
        Array.isArray(circumstances) ? circumstances.length : 'non-array',
        result
      );
      return NextResponse.json(
        {
          error: `Generation produced ${
            Array.isArray(circumstances) ? circumstances.length : 0
          } circumstances, expected exactly 5`,
        },
        { status: 500 }
      );
    }

    // Validate required fields are present and non-empty.
    const missingField = circumstances.find((c) =>
      REQUIRED_FIELDS.some((f) => !c?.[f] || String(c[f]).trim().length === 0)
    );
    if (missingField) {
      console.error('Circumstance missing required fields:', missingField);
      return NextResponse.json(
        { error: 'A circumstance is missing a required field' },
        { status: 500 }
      );
    }

    // Validate axis diversity — each axis must show at least 2 distinct
    // values across the 5 circumstances. This enforces the "contrast"
    // rule from the system prompt.
    const axes: Array<keyof (typeof circumstances)[number]> = [
      'knowledge',
      'intent',
      'composition',
      'constraint',
      'moment',
    ];
    const undiversifiedAxis = axes.find(
      (axis) =>
        new Set(
          circumstances.map((c) => String(c[axis] ?? '').trim().toLowerCase())
        ).size < 2
    );
    if (undiversifiedAxis) {
      console.warn(
        `Axis "${String(undiversifiedAxis)}" has no contrast across the 5 circumstances.`
      );
      // Warn only — don't 500, since the sampling is probabilistic. The
      // user can still edit or regenerate.
    }

    return NextResponse.json({ circumstances });
  } catch (error) {
    console.error('Error generating circumstances:', error);
    return NextResponse.json(
      { error: 'Failed to generate circumstances' },
      { status: 500 }
    );
  }
}
