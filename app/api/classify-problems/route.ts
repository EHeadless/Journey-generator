/**
 * Classify-problems route.
 *
 * Takes a batch of curated Problem Signals (already deduped, already
 * promoted) plus the model's existing journey phases. Returns one
 * classification per problem: primary discipline (+ optional secondary),
 * impact score (1-5) with rationale, affected phase IDs with rationale.
 *
 * Frequency is NOT set here — the client computes it deterministically
 * from source/chunk/department-spread inputs. See the
 * `problem-diagnostics-framework` skill for the rubric.
 *
 * Phase mapping contract:
 *   - non-empty `affectedPhaseIds` → phase-scoped problem
 *   - empty array (`[]`) → CROSS-CUTTING / systemic problem (data,
 *     governance, brand, reporting…). Empty is meaningful — never
 *     silently filled with `journeyPhases[0]`.
 *
 * Single batched call: cross-problem context is required for consistent
 * classification, otherwise the model drifts on borderline cases.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type {
  ProblemDiscipline,
  DiagnosticScore,
  ClassifyProblemsResponse,
  ClassifyProblemsResponseItem,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 90;

export const CLASSIFY_PROMPT_VERSION = '2.0.0';

const ALLOWED_DISCIPLINES: ProblemDiscipline[] = [
  'technical',
  'cx-human',
  'governance',
  'strategy-business',
  'ux-ui',
  'reporting-dashboarding',
  'martech',
  'brand',
];

interface ProblemInput {
  signalId: string;
  text: string;
  department?: string;
  sourceQuotes?: string[];
  /** Workshop labels the evidence came from. Often carries phase signal. */
  sourceWorkshops?: string[];
}

interface PhaseInput {
  id: string;
  label: string;
  description: string;
  trigger: string;
  /** Optional: the journey this phase belongs to (multi-journey models). */
  journeyId?: string;
  journeyName?: string;
}

interface JourneyInput {
  id: string;
  name: string;
}

interface RequestBody {
  apiKey?: string;
  model?: string;
  problems?: ProblemInput[];
  journeyPhases?: PhaseInput[];
  /** Optional list of journeys for grouping. */
  journeys?: JourneyInput[];
}

const SYSTEM_PROMPT = `You are a behavioral strategist at Digitas running a Problem Diagnostics pass on curated client problems.

You classify each problem on 4 axes:

1. PRIMARY DISCIPLINE (required) — where the root cause lives.
2. SECONDARY DISCIPLINE (optional) — where the symptom shows up, if substantively different.
3. IMPACT (1-5) — operational/customer/business severity.
4. AFFECTED PHASES — which journey phases this problem lives in, OR cross-cutting.

## Discipline taxonomy (LOCKED — pick exactly one primary; optionally one secondary)

- **technical** — backend, integrations, latency, data pipelines, APIs, infrastructure, code quality
- **cx-human** — frontline service, agent workflows, customer emotional experience, journey friction caused by humans/process
- **governance** — approval bottlenecks, ownership ambiguity, RACI, compliance gates, escalation paths, data governance
- **strategy-business** — wrong segments, missing positioning, unclear value props, business-model conflicts, OKR misalignment
- **ux-ui** — interface design, navigation, IA, visual design, usability of digital products
- **reporting-dashboarding** — KPI definition, dashboards, attribution, measurement gaps, data visibility for decision-makers
- **martech** — CRM tooling, CDP, CEP, journey orchestration, segmentation infra, marketing automation tooling
- **brand** — brand identity, voice, perception, consistency across touchpoints, positioning expression

### Heuristics
- Primary = root cause. Secondary = where the symptom shows up.
- Don't default to cx-human. That's the lazy bucket. Force yourself to pick the root.
- Use a secondary ONLY when the dual nature is substantive (e.g. "Agents can't see customer history" → primary technical, secondary cx-human). Otherwise leave it out.

## Impact rubric (1-5)

1. Negligible — minor annoyance; no measurable effect
2. Low — localised friction; small group or rare scenario
3. Moderate — repeated friction; meaningful drop in CSAT / conversion / efficiency for one segment
4. High — material revenue, retention, or operational impact; multiple segments affected; visible in KPIs
5. Severe — existential, regulatory, brand-damaging, or revenue-blocking; board-level concern

Justify the impact in 1-2 specific sentences. Vague justifications are unacceptable.

## Affected phases — IMPORTANT

Decide whether the problem is phase-scoped or cross-cutting. Be honest about which.

- **PHASE-SCOPED**: the friction lives in one or more specific journey phase(s).
  Return the phaseIds it touches. May span phases within a single journey
  OR phases across multiple journeys (e.g. a checkout breakage that hits both
  the consumer and corporate journeys). Use the journey grouping below to
  disambiguate same-named phases across different journeys.

- **CROSS-CUTTING**: the problem is systemic and does NOT belong to any
  specific phase. Return \`[]\` (an empty array). Examples:
    - "Data sync issues between our CRM and CDP"
    - "Ownership of the customer record is ambiguous"
    - "Reporting gaps prevent attribution across the funnel"
    - "Brand voice drifts between channels"
    - "Martech stack lacks integration with our analytics platform"
    - "RACI for personalisation decisions is unclear"

DO NOT default to a phase when uncertain. An empty array is correct when the
problem genuinely spans the whole model. Returning a plausible-but-wrong phase
is WORSE than returning \`[]\` — the strategist can spot a cross-cutting row
and decide whether it deserves phase mapping, but a silently-wrong phase
mapping pollutes the journey canvas.

Use \`sample_quotes\`, \`department\`, and \`source_workshops\` (when provided)
as the strongest signal for the right phase mapping. A workshop titled
"Discovery — Pre-arrival CX" almost always indicates Pre-arrival phase
problems; a workshop titled "Data & Analytics Architecture" almost always
indicates cross-cutting issues.

Justify the mapping (or the cross-cutting designation) in one sentence in
\`phaseRationale\`.

## Output format

Return ONLY valid JSON matching the schema. Every problem in the input MUST
appear exactly once in the output. Never invent problemSignalIds or phaseIds
— only use the ones provided.`;

function clampDiscipline(v: unknown): ProblemDiscipline | null {
  return typeof v === 'string' && (ALLOWED_DISCIPLINES as string[]).includes(v)
    ? (v as ProblemDiscipline)
    : null;
}

function clampScore(v: unknown): DiagnosticScore {
  const n = typeof v === 'number' ? Math.round(v) : Number(v);
  if (n >= 1 && n <= 5) return n as DiagnosticScore;
  return 3;
}

/**
 * Strip ```json ... ``` (or plain ```) fences sometimes emitted by the
 * model even when JSON-only output is requested. Idempotent — returns
 * input unchanged when no fences are present.
 */
function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Build the journey-grouped phase block for the user prompt. Same-label
 * phases across journeys are disambiguated by their journey heading.
 * Falls back to a flat list when no journey grouping is supplied.
 */
function renderPhaseBlock(
  journeyPhases: PhaseInput[],
  journeys: JourneyInput[]
): string {
  if (journeys.length === 0) {
    return journeyPhases
      .map(
        (p) =>
          `- id: ${p.id}\n  label: ${p.label}\n  description: ${p.description}\n  trigger: ${p.trigger}`
      )
      .join('\n');
  }

  const byJourney = new Map<string, PhaseInput[]>();
  const orphans: PhaseInput[] = [];
  for (const p of journeyPhases) {
    if (p.journeyId && journeys.some((j) => j.id === p.journeyId)) {
      const arr = byJourney.get(p.journeyId) ?? [];
      arr.push(p);
      byJourney.set(p.journeyId, arr);
    } else {
      orphans.push(p);
    }
  }

  const sections: string[] = [];
  for (const j of journeys) {
    const phases = byJourney.get(j.id) ?? [];
    if (phases.length === 0) continue;
    const lines = phases
      .map(
        (p) =>
          `- id: ${p.id}\n  label: ${p.label}\n  description: ${p.description}\n  trigger: ${p.trigger}`
      )
      .join('\n');
    sections.push(`### Journey: ${j.name}\n${lines}`);
  }
  if (orphans.length > 0) {
    const lines = orphans
      .map(
        (p) =>
          `- id: ${p.id}\n  label: ${p.label}\n  description: ${p.description}\n  trigger: ${p.trigger}`
      )
      .join('\n');
    sections.push(`### Journey: (unassigned)\n${lines}`);
  }
  return sections.join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const apiKey = body.apiKey;
    const modelName = body.model || 'gpt-4o';
    const problems = Array.isArray(body.problems) ? body.problems : [];
    const journeyPhases = Array.isArray(body.journeyPhases) ? body.journeyPhases : [];
    const journeys = Array.isArray(body.journeys) ? body.journeys : [];

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (problems.length === 0) {
      return NextResponse.json(
        { error: 'At least one problem is required' },
        { status: 400 }
      );
    }
    if (journeyPhases.length === 0) {
      return NextResponse.json(
        { error: 'At least one journey phase is required (classify needs phase context)' },
        { status: 400 }
      );
    }

    const allowedSignalIds = new Set(problems.map((p) => p.signalId));
    const allowedPhaseIds = new Set(journeyPhases.map((p) => p.id));

    const phaseBlock = renderPhaseBlock(journeyPhases, journeys);

    const problemBlock = problems
      .map((p) => {
        const lines: string[] = [
          `- problemSignalId: ${p.signalId}`,
          `  text: ${p.text.trim()}`,
        ];
        if (p.department) lines.push(`  department: ${p.department}`);
        if (p.sourceWorkshops && p.sourceWorkshops.length > 0) {
          lines.push(`  source_workshops:`);
          for (const w of p.sourceWorkshops.slice(0, 4)) {
            lines.push(`    - ${w.replace(/\n/g, ' ').trim()}`);
          }
        }
        if (p.sourceQuotes && p.sourceQuotes.length > 0) {
          lines.push(`  sample_quotes:`);
          for (const q of p.sourceQuotes.slice(0, 3)) {
            lines.push(`    - ${q.replace(/\n/g, ' ').trim()}`);
          }
        }
        return lines.join('\n');
      })
      .join('\n\n');

    const userPrompt = `Classify all of these problems. Every problemSignalId in the input MUST appear exactly once in your output.

## Journey phases (use these IDs only)

${phaseBlock}

## Problems to classify

${problemBlock}`;

    // Strict JSON schema — empty affectedPhaseIds is meaningful (cross-cutting),
    // so no minItems constraint.
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['diagnostics'],
      properties: {
        diagnostics: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'problemSignalId',
              'discipline',
              'disciplineRationale',
              'secondaryDiscipline',
              'secondaryRationale',
              'impact',
              'impactRationale',
              'affectedPhaseIds',
              'phaseRationale',
            ],
            properties: {
              problemSignalId: { type: 'string' },
              discipline: {
                type: 'string',
                enum: ALLOWED_DISCIPLINES,
              },
              disciplineRationale: { type: 'string' },
              // Strict mode requires every property be in `required`, so use
              // a nullable union for optional secondary discipline.
              secondaryDiscipline: {
                type: ['string', 'null'],
                enum: [...ALLOWED_DISCIPLINES, null],
              },
              secondaryRationale: { type: ['string', 'null'] },
              impact: {
                type: 'integer',
                enum: [1, 2, 3, 4, 5],
              },
              impactRationale: { type: 'string' },
              affectedPhaseIds: {
                type: 'array',
                items: { type: 'string' },
              },
              phaseRationale: { type: 'string' },
            },
          },
        },
      },
    };

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'problem_diagnostics',
          strict: true,
          schema,
        },
      },
      temperature: 0.2,
      // Large batches with full rationales easily exceed the default
      // 4096 cap and silently truncate, surfacing as "invalid JSON".
      // 16k is the gpt-4o family ceiling and is the right floor here.
      max_tokens: 16384,
    });

    const choice = resp.choices[0];
    const finishReason = choice?.finish_reason;
    const refusal = choice?.message?.refusal;
    if (refusal) {
      return NextResponse.json(
        { error: `Model refused to classify: ${refusal}` },
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

    let parsed: { diagnostics?: unknown };
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch {
      const lengthHit = finishReason === 'length';
      return NextResponse.json(
        {
          error: lengthHit
            ? 'Model response was truncated by the token limit before valid JSON could close. Reduce the batch size or split the diagnostics run.'
            : 'Model returned invalid JSON',
          finishReason,
          // Cap the snippet so we don't echo a multi-megabyte body back
          // to the browser; first 1.5k is enough to diagnose 99% of
          // failures (truncation, wrong shape, prose preamble, etc.).
          rawSnippet: content.slice(0, 1500),
        },
        { status: 500 }
      );
    }

    const rawRows = Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [];
    const seen = new Set<string>();
    const diagnostics: ClassifyProblemsResponseItem[] = [];

    for (const raw of rawRows) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;

      const signalId = typeof r.problemSignalId === 'string' ? r.problemSignalId : '';
      if (!signalId || !allowedSignalIds.has(signalId) || seen.has(signalId)) continue;

      const discipline = clampDiscipline(r.discipline);
      if (!discipline) continue;

      const secondary = clampDiscipline(r.secondaryDiscipline);
      const phaseIdsRaw = Array.isArray(r.affectedPhaseIds) ? r.affectedPhaseIds : [];
      // Empty array is meaningful (cross-cutting). Filter to allowed IDs only;
      // do NOT fall back to journeyPhases[0] when empty.
      const affectedPhaseIds = Array.from(
        new Set(
          phaseIdsRaw
            .filter((v): v is string => typeof v === 'string')
            .filter((v) => allowedPhaseIds.has(v))
        )
      );

      seen.add(signalId);
      diagnostics.push({
        problemSignalId: signalId,
        discipline,
        disciplineRationale:
          typeof r.disciplineRationale === 'string'
            ? r.disciplineRationale.trim()
            : '',
        secondaryDiscipline: secondary && secondary !== discipline ? secondary : undefined,
        secondaryRationale:
          secondary && secondary !== discipline && typeof r.secondaryRationale === 'string'
            ? r.secondaryRationale.trim()
            : undefined,
        impact: clampScore(r.impact),
        impactRationale:
          typeof r.impactRationale === 'string' ? r.impactRationale.trim() : '',
        affectedPhaseIds,
        phaseRationale:
          typeof r.phaseRationale === 'string' ? r.phaseRationale.trim() : '',
      });
    }

    // Backfill any problems the model dropped. Mark as cross-cutting + flag
    // for manual review rather than dumping into journeyPhases[0]. The
    // strategist sees the rationale and can fix the row.
    for (const p of problems) {
      if (seen.has(p.signalId)) continue;
      diagnostics.push({
        problemSignalId: p.signalId,
        discipline: 'cx-human',
        disciplineRationale:
          'Auto-classified — model did not return this row. Please review and correct.',
        impact: 3,
        impactRationale:
          'Auto-classified — model did not score this row. Please review and correct.',
        // Empty = cross-cutting. Surfaces in the cross-cutting banner so the
        // strategist can re-map it manually instead of finding it buried in
        // a wrong phase column.
        affectedPhaseIds: [],
        phaseRationale:
          'Auto-classified as cross-cutting — model did not map this row. Please review and assign phases if it is phase-scoped.',
      });
    }

    const result: ClassifyProblemsResponse = {
      promptVersion: CLASSIFY_PROMPT_VERSION,
      modelName,
      diagnostics,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error classifying problems:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
