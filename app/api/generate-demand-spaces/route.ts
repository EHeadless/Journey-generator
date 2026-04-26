import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ModelInput, JourneyPhase, GenerateDemandSpacesResponse } from '@/lib/types';
import type { InformedProblemPayload } from '@/lib/extraction/informed-context';
import { DISCIPLINE_LABELS } from '@/lib/problem-diagnostics-meta';

export const runtime = 'nodejs';
export const maxDuration = 90;

const QUADRANT_LABEL: Record<NonNullable<InformedProblemPayload['quadrant']>, string> = {
  quickWins: 'Quick Win',
  majorProjects: 'Major Project',
  timeSinks: 'Time Sink',
  minor: 'Minor',
};

const SYSTEM_PROMPT_BASE = `You are an expert behavioral strategist at Digitas, generating demand spaces (Jobs to Be Done) for client engagements.

Your output must be a JSON array containing 8-12 demand spaces.

Each demand space must have:
- label: 2-4 evocative words (NOT "I want to...")
- jobToBeDone: "When I [situation], I want to [action], so that [outcome]"

THE "REMOVE THE PRODUCT" TEST - CRITICAL:
Every demand space must pass this test: If you remove this company's product entirely, does the motivation still exist?

✅ GOOD: "Planned Family Holiday" — exists whether or not the company has an app
✅ GOOD: "Live Without Friction" — human desire that exists without any product

❌ BAD: "I want the app to enhance my visit" — fails the test, references product
❌ BAD: "Seamless booking experience" — this is a UX requirement, not a motivation

PHASE-SPECIFIC GENERATION - CRITICAL:
Journey phases represent different moments in the customer lifecycle with DIFFERENT motivations active.
- "Discover/Search" phase → Information-gathering, exploration, possibility mapping
- "Consider/Compare" phase → Evaluation, trade-off analysis, decision criteria
- "Purchase/Book" phase → Commitment, transaction confidence, logistics
- "Experience/Use" phase → In-the-moment needs, real-time problem solving
- "Reflect/Share" phase → Memory preservation, social signaling, future planning

RULES:
1. Labels must be 2-4 evocative words, NOT "I want to..." format
2. Job to Be Done follows: "When I [situation], I want to [action], so that [outcome]"
3. Each demand space must be distinct — no overlapping motivations
4. Be HIGHLY specific to this journey phase — the phase description tells you what motivations to focus on
5. Do NOT generate generic motivations that would apply to multiple phases`;

const SYSTEM_PROMPT_INFORMED = `${SYSTEM_PROMPT_BASE}

INFORMED LANDSCAPE — PROBLEM-DRIVEN MODE:
You are operating in INFORMED LANDSCAPE mode. The user has supplied a set of CLASSIFIED PROBLEMS that touch this phase.

Each demand space MUST be motivated by one or more of those problems. Output one extra field per demand space:
- sourceProblemIds: string[] — the ids (verbatim, from the supplied list) of the problems this JTBD addresses

Coverage rules:
1. EVERY supplied problem id should appear in at least one demand space's sourceProblemIds. If a problem genuinely cannot motivate a JTBD, omit it but bias hard toward inclusion.
2. A demand space may address multiple problems when they share a motivation root.
3. NEVER invent ids that aren't in the supplied list. If you don't have an id, leave the field empty rather than fabricating.
4. The JTBD itself must remain a human life motivation that passes the "remove the product" test — problems are evidence of friction, not features to ship.

Return ONLY a JSON object of the form:
{ "demandSpaces": [ { "label": "...", "jobToBeDone": "...", "sourceProblemIds": ["..."] } ] }`;

interface RequestBody {
  input: ModelInput;
  journeyPhase: JourneyPhase;
  apiKey?: string;
  /**
   * Pre-filtered to this phase by the caller. When non-empty, the route
   * switches to Informed mode and emits `sourceProblemIds` per demand
   * space.
   */
  informedProblems?: InformedProblemPayload[];
  /**
   * Optional subset of problem ids that the caller wants prioritised
   * (e.g. coverage-gap retry). Rendered as a "must address" callout.
   */
  prioritiseProblemIds?: string[];
}

function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
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
  return `- id=${p.id} [${disc}${sec} · F${p.frequency} I${p.impact}${quad}${dept}] ${p.text.trim()}${quote}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { input, journeyPhase, apiKey, informedProblems, prioritiseProblemIds } = body;

    console.log('Generating demand spaces for phase:', {
      label: journeyPhase?.label,
      description: journeyPhase?.description,
      trigger: journeyPhase?.trigger,
      informedProblemCount: informedProblems?.length || 0,
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!input || !journeyPhase) {
      return NextResponse.json(
        { error: 'Missing required fields: input, journeyPhase' },
        { status: 400 }
      );
    }

    const informed = Array.isArray(informedProblems) ? informedProblems : [];
    const isInformedMode = informed.length > 0;
    const allowedProblemIds = new Set(informed.map((p) => p.id));

    // Helper to format tech tools
    const formatTools = (tools: Array<{ value: string; purpose?: string }> | undefined) =>
      tools?.map((t) => (t.purpose ? `${t.value} (${t.purpose})` : t.value)).join(', ') || '';

    const techStackContext = input.techStack ? `
Tech Stack:
${input.techStack.cloudWarehouse?.length ? `- Cloud Warehouse: ${formatTools(input.techStack.cloudWarehouse)}` : ''}
${input.techStack.dataStorage?.length ? `- Data Storage: ${formatTools(input.techStack.dataStorage)}` : ''}
${input.techStack.crm?.length ? `- CRM: ${formatTools(input.techStack.crm)}` : ''}
${input.techStack.cdp?.length ? `- CDP: ${formatTools(input.techStack.cdp)}` : ''}
${input.techStack.cep?.length ? `- CEP: ${formatTools(input.techStack.cep)}` : ''}
${input.techStack.dxp?.length ? `- DXP: ${formatTools(input.techStack.dxp)}` : ''}
${input.techStack.aiModels?.length ? `- AI Models: ${formatTools(input.techStack.aiModels)}` : ''}
${input.techStack.aiPlatform?.length ? `- AI Platform: ${formatTools(input.techStack.aiPlatform)}` : ''}`.trim() : '';

    const productsContext = input.products?.length ? `
Products/Channels:
${input.products.map((p) => `- ${p.name}: ${p.description}`).join('\n')}` : '';

    const personasContext = input.personas?.length ? `
Target Personas: ${input.personas.map((p) => p.label).join(', ')}` : '';

    const informedBlock = isInformedMode
      ? `

## Problems mapped to this phase

The following classified problems touch the "${journeyPhase.label}" phase. Each demand space you generate MUST address one or more of these by id.

${informed.map(renderProblem).join('\n')}

${
  prioritiseProblemIds && prioritiseProblemIds.length > 0
    ? `## Prioritise (coverage gap)\n\nThese problem ids were not addressed in a previous pass. Generate JTBDs that explicitly cover them: ${prioritiseProblemIds.join(', ')}\n`
    : ''
}`
      : '';

    const prompt = `Generate demand spaces for this specific journey phase:

JOURNEY PHASE: ${journeyPhase.label}
${journeyPhase.description ? `WHAT HAPPENS IN THIS PHASE: ${journeyPhase.description}` : ''}
${journeyPhase.trigger ? `PHASE ENTRY TRIGGER: ${journeyPhase.trigger}` : ''}

CRITICAL: The demand spaces you generate MUST be specific to what customers are doing in "${journeyPhase.label}" phase.
${journeyPhase.description ? `Focus on the motivations that are active when: ${journeyPhase.description}` : ''}

Business Context:
Industry: ${input.industry}
Experience Types: ${input.experienceTypes?.join(', ') || 'Not specified'}
Business Description: ${input.businessDescription}
${techStackContext}
${productsContext}
${personasContext}
${input.painPoints ? `Known Pain Points:\n${input.painPoints}` : ''}
${informedBlock}

Generate 8-12 demand spaces representing the HUMAN MOTIVATIONS that are SPECIFIC TO THIS PHASE.

Remember the "remove the product" test: Every motivation must exist even if this company's product doesn't exist.

DO NOT generate:
- Product features ("I want the app to...")
- UX requirements ("Seamless experience")
- Use cases ("Book a ticket", "Check my balance")
- Generic motivations that apply to ALL phases (make them phase-specific)`;

    const systemPrompt = isInformedMode ? SYSTEM_PROMPT_INFORMED : SYSTEM_PROMPT_BASE;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    });

    const choice = resp.choices[0];
    const finishReason = choice?.finish_reason;
    const refusal = choice?.message?.refusal;
    if (refusal) {
      return NextResponse.json(
        { error: `Model refused: ${refusal}` },
        { status: 502 }
      );
    }
    const content = choice?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Model returned empty content', finishReason },
        { status: 500 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch {
      const lengthHit = finishReason === 'length';
      return NextResponse.json(
        {
          error: lengthHit
            ? 'Demand-space response was truncated by the token limit before valid JSON could close.'
            : 'Model returned invalid JSON',
          finishReason,
          rawSnippet: content.slice(0, 1500),
        },
        { status: 500 }
      );
    }

    // Unwrap common wrapper keys (mirrors the legacy generateWithRetry behavior)
    let raw: unknown = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.demandSpaces)) raw = obj.demandSpaces;
      else if (Array.isArray(obj.spaces)) raw = obj.spaces;
      else if (Array.isArray(obj.items)) raw = obj.items;
      else if (Array.isArray(obj.results)) raw = obj.results;
    }

    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'Model did not return a demandSpaces array', finishReason },
        { status: 500 }
      );
    }

    const demandSpaces: GenerateDemandSpacesResponse['demandSpaces'] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const row = r as Record<string, unknown>;
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      const jobToBeDone = typeof row.jobToBeDone === 'string' ? row.jobToBeDone.trim() : '';
      if (!label || !jobToBeDone) continue;
      const description =
        typeof row.description === 'string' ? row.description.trim() : undefined;
      let sourceProblemIds: string[] | undefined;
      if (Array.isArray(row.sourceProblemIds)) {
        const ids = row.sourceProblemIds
          .filter((x): x is string => typeof x === 'string')
          .filter((id) => (isInformedMode ? allowedProblemIds.has(id) : true));
        if (ids.length > 0) sourceProblemIds = ids;
      }
      demandSpaces.push({ label, jobToBeDone, description, sourceProblemIds });
    }

    // Validation thresholds. On a coverage-gap retry the caller already
    // has a primary set of demand spaces; the retry only needs to fill
    // gaps for the prioritised problem ids, so we accept as few as 1.
    const isRetryPass = Array.isArray(prioritiseProblemIds) && prioritiseProblemIds.length > 0;
    const minCount = isRetryPass ? 1 : 6;
    const maxCount = 14;
    if (demandSpaces.length < minCount || demandSpaces.length > maxCount) {
      console.error('Invalid demand spaces response:', demandSpaces);
      return NextResponse.json(
        { error: 'Generation produced invalid number of demand spaces' },
        { status: 500 }
      );
    }

    const invalidSpaces = demandSpaces.filter((ds) =>
      ds.label?.toLowerCase().startsWith('i want')
    );
    if (invalidSpaces.length > 0) {
      console.warn('Some demand spaces have invalid labels:', invalidSpaces);
    }

    return NextResponse.json({ demandSpaces });
  } catch (error) {
    console.error('Error generating demand spaces:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate demand spaces';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
