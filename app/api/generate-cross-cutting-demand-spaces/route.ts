/**
 * Generate cross-cutting demand spaces for the Informed Landscape.
 *
 * Cross-cutting problems are classified diagnostics with
 * `affectedPhaseIds.length === 0` — i.e. they don't belong to any single
 * journey phase. They typically express organisational, governance,
 * data, brand, or martech-level human jobs.
 *
 * This route generates 4-8 demand spaces that address those systemic
 * problems. Each demand space carries `sourceProblemIds` so the UI can
 * prove provenance back to the diagnostics tab.
 *
 * Mirrors `generate-demand-spaces/route.ts` but drops the journey-phase
 * framing and explicitly flags JTBDs as systemic.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type {
  ModelInput,
  GenerateCrossCuttingDemandSpacesResponse,
} from '@/lib/types';
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

const SYSTEM_PROMPT = `You are an expert behavioral strategist at Digitas, generating CROSS-CUTTING Jobs to Be Done for client engagements.

Cross-cutting JTBDs address problems that cut across the entire customer journey — they don't live in any single phase. They typically express organisational, governance, data, brand, martech, or operational-level human motivations.

Examples of cross-cutting JTBDs:
- "Trust the Data I See" — when the org-wide data quality is inconsistent
- "Speak One Voice to Every Customer" — when brand expression diverges across channels
- "Move Fast Without Breaking Trust" — when speed-of-execution undermines compliance
- "Know Who's Worth What Investment" — when audience valuation is fragmented across teams

Your output must be a JSON object with 4-8 demand spaces.

Each demand space must have:
- label: 2-4 evocative words (NOT "I want to...")
- jobToBeDone: "When I [situation], I want to [action], so that [outcome]"
- sourceProblemIds: string[] — the ids (verbatim, from the supplied problems list) of the problems this JTBD addresses

THE "REMOVE THE PRODUCT" TEST - CRITICAL:
Every demand space must pass this test: If you remove this company's product entirely, does the motivation still exist?

CROSS-CUTTING-SPECIFIC RULES:
1. These motivations exist OUTSIDE any single journey phase. Do not phrase them as if they belong to onboarding, purchase, etc.
2. Every supplied problem id MUST be referenced by at least one demand space (bias hard toward full coverage).
3. NEVER invent ids that aren't in the supplied list.
4. A demand space may address multiple problems when they share a motivation root.
5. Prefer organisational, data, governance, and brand-level framings over use-case framings.
6. Labels must be 2-4 evocative words, NOT "I want to..." format.

Return ONLY a JSON object of the form:
{ "demandSpaces": [ { "label": "...", "jobToBeDone": "...", "sourceProblemIds": ["..."] } ] }`;

interface RequestBody {
  input: ModelInput;
  apiKey?: string;
  /** Filtered to `affectedPhaseIds.length === 0` by the caller. */
  crossCuttingProblems?: InformedProblemPayload[];
  /** Optional retry-only subset for "cover gaps" mode. */
  prioritiseProblemIds?: string[];
  /** Optional human label for the active Informed variant — included so the
   *  prompt can frame the JTBDs in the right evidence-layer voice. */
  variantLabel?: string;
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
    const { input, apiKey, crossCuttingProblems, prioritiseProblemIds, variantLabel } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!input) {
      return NextResponse.json(
        { error: 'Missing required field: input' },
        { status: 400 }
      );
    }
    const problems = Array.isArray(crossCuttingProblems) ? crossCuttingProblems : [];
    if (problems.length === 0) {
      return NextResponse.json(
        { error: 'No cross-cutting problems supplied — nothing to generate.' },
        { status: 400 }
      );
    }
    const allowedIds = new Set(problems.map((p) => p.id));

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

    const prompt = `Generate cross-cutting demand spaces (systemic JTBDs) for this client.

These JTBDs do NOT belong to any single journey phase. They express systemic motivations that cut across the entire customer relationship.

${variantLabel ? `Active Informed variant: ${variantLabel}\n` : ''}
Business Context:
Industry: ${input.industry}
Experience Types: ${input.experienceTypes?.join(', ') || 'Not specified'}
Business Description: ${input.businessDescription}
${techStackContext}
${productsContext}
${input.painPoints ? `Known Pain Points:\n${input.painPoints}` : ''}

## Cross-cutting problems to address

These classified problems are systemic — they don't belong to any single phase. Generate JTBDs that address them at the org/governance/data/brand level, not at the per-phase use-case level.

${problems.map(renderProblem).join('\n')}

${
  prioritiseProblemIds && prioritiseProblemIds.length > 0
    ? `## Prioritise (coverage gap)\n\nThese problem ids were not addressed in a previous pass. Generate JTBDs that explicitly cover them: ${prioritiseProblemIds.join(', ')}\n`
    : ''
}

Generate 4-8 cross-cutting demand spaces. EVERY supplied problem id should appear in at least one demand space's sourceProblemIds.`;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
            ? 'Cross-cutting response was truncated by the token limit before valid JSON could close.'
            : 'Model returned invalid JSON',
          finishReason,
          rawSnippet: content.slice(0, 1500),
        },
        { status: 500 }
      );
    }

    let raw: unknown = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.demandSpaces)) raw = obj.demandSpaces;
      else if (Array.isArray(obj.spaces)) raw = obj.spaces;
      else if (Array.isArray(obj.items)) raw = obj.items;
    }
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'Model did not return a demandSpaces array', finishReason },
        { status: 500 }
      );
    }

    const demandSpaces: GenerateCrossCuttingDemandSpacesResponse['demandSpaces'] = [];
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
          .filter((id) => allowedIds.has(id));
        if (ids.length > 0) sourceProblemIds = ids;
      }
      demandSpaces.push({ label, jobToBeDone, description, sourceProblemIds });
    }

    // On a coverage-gap retry we only need to fill the prioritised
    // problem ids — accept as few as 1 demand space in that case.
    const isRetryPass = Array.isArray(prioritiseProblemIds) && prioritiseProblemIds.length > 0;
    const minCount = isRetryPass ? 1 : 3;
    const maxCount = 10;
    if (demandSpaces.length < minCount || demandSpaces.length > maxCount) {
      console.error('Invalid cross-cutting response:', demandSpaces);
      return NextResponse.json(
        { error: 'Generation produced invalid number of cross-cutting demand spaces' },
        { status: 500 }
      );
    }

    return NextResponse.json({ demandSpaces } as GenerateCrossCuttingDemandSpacesResponse);
  } catch (error) {
    console.error('Error generating cross-cutting demand spaces:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate cross-cutting demand spaces';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
