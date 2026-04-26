/**
 * Diagnose-narrative route.
 *
 * Takes a complete set of classified ProblemDiagnostics + the journey
 * phases + the original problem texts, and produces the narrative
 * sections of the diagnostic report:
 *
 *   - executive summary
 *   - per-discipline narratives (only for disciplines with non-trivial counts)
 *   - per-phase narratives
 *   - per-quadrant narratives (Quick Wins / Major Projects / Time Sinks / Minor)
 *
 * The narrative is what makes this a diagnostic rather than a dashboard.
 * Numbers without interpretation are not a deliverable.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type {
  ProblemDiagnostic,
  ProblemDiscipline,
  DiagnoseNarrativeResponse,
  JourneyPhase,
} from '@/lib/types';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  disciplineCounts,
  quadrantOf,
} from '@/lib/problem-diagnostics-meta';

export const runtime = 'nodejs';
export const maxDuration = 90;

export const NARRATIVE_PROMPT_VERSION = '1.0.0';

interface RequestBody {
  apiKey?: string;
  model?: string;
  diagnostics?: ProblemDiagnostic[];
  journeyPhases?: JourneyPhase[];
  problemTexts?: Record<string, string>;
}

const SYSTEM_PROMPT = `You are a behavioral strategist at Digitas writing the narrative sections of a Problem Diagnostics report.

The report has four narrative parts:

1. **executiveSummary** — one paragraph (3-5 sentences). Headline numbers + the single most important pattern. Confident, no hedging.

2. **perDiscipline** — one short paragraph PER discipline that has any problems (skip empty disciplines). Each paragraph: why this cluster exists, what's driving it, what kind of fix it implies. Use the actual problems as evidence, not generic platitudes.

3. **perPhase** — one short paragraph per journey phase that has any problems. Each paragraph: what's hot in this phase, what surprises, what's missing.

4. **perQuadrant** — one paragraph per quadrant of the Frequency × Impact matrix:
   - quickWins (low freq, high impact) — which to attack first and why
   - majorProjects (high freq, high impact) — which deserve a workstream
   - timeSinks (high freq, low impact) — which to consciously deprioritise
   - minor (low freq, low impact) — noted but parked

Rules:
- Write like Digitas: confident, structured, no fluff, no hedging.
- Cite specific problems by their text where it sharpens the point.
- Don't invent data — only interpret what's in the inputs.
- Use behavioral-strategy language (forces, drive vs resistance, root cause vs symptom) where natural.
- If a quadrant or discipline has zero problems, return an empty string for it.

Return ONLY valid JSON matching this exact shape:

\`\`\`json
{
  "executiveSummary": "string",
  "perDiscipline": [
    { "discipline": "technical" | ... , "narrative": "string" }
  ],
  "perPhase": [
    { "phaseId": "string", "narrative": "string" }
  ],
  "perQuadrant": {
    "quickWins": "string",
    "majorProjects": "string",
    "timeSinks": "string",
    "minor": "string"
  }
}
\`\`\``;

function isDiscipline(v: unknown): v is ProblemDiscipline {
  return typeof v === 'string' && (DISCIPLINE_ORDER as string[]).includes(v);
}

/**
 * Strip ```json ... ``` (or plain ```) fences sometimes emitted by the
 * model even when JSON-only output is requested. Idempotent.
 */
function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const apiKey = body.apiKey;
    const modelName = body.model || 'gpt-4o';
    const diagnostics = Array.isArray(body.diagnostics) ? body.diagnostics : [];
    const journeyPhases = Array.isArray(body.journeyPhases) ? body.journeyPhases : [];
    const problemTexts = (body.problemTexts || {}) as Record<string, string>;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (diagnostics.length === 0) {
      return NextResponse.json(
        { error: 'At least one diagnostic is required' },
        { status: 400 }
      );
    }

    const phaseById = new Map(journeyPhases.map((p) => [p.id, p]));
    const counts = disciplineCounts(diagnostics);

    const quadrantBuckets = {
      quickWins: [] as ProblemDiagnostic[],
      majorProjects: [] as ProblemDiagnostic[],
      timeSinks: [] as ProblemDiagnostic[],
      minor: [] as ProblemDiagnostic[],
    };
    for (const d of diagnostics) {
      quadrantBuckets[quadrantOf(d)].push(d);
    }

    const phaseBuckets = new Map<string, ProblemDiagnostic[]>();
    for (const d of diagnostics) {
      for (const pid of d.affectedPhaseIds) {
        const arr = phaseBuckets.get(pid) || [];
        arr.push(d);
        phaseBuckets.set(pid, arr);
      }
    }

    const headlineLines: string[] = [
      `Total problems classified: ${diagnostics.length}`,
      `Discipline mix (primary 1.0 + secondary 0.5):`,
      ...DISCIPLINE_ORDER.filter((d) => counts[d] > 0).map(
        (d) => `  - ${DISCIPLINE_LABELS[d]}: ${counts[d].toFixed(1)}`
      ),
      `Quadrant counts: Quick Wins ${quadrantBuckets.quickWins.length}, Major Projects ${quadrantBuckets.majorProjects.length}, Time Sinks ${quadrantBuckets.timeSinks.length}, Minor ${quadrantBuckets.minor.length}`,
    ];

    const renderRow = (d: ProblemDiagnostic) => {
      const text = problemTexts[d.problemSignalId] || '(text missing)';
      const phases = d.affectedPhaseIds
        .map((id) => phaseById.get(id)?.label || id)
        .join(', ');
      return `  - [${DISCIPLINE_LABELS[d.discipline]}${d.secondaryDiscipline ? ` / ${DISCIPLINE_LABELS[d.secondaryDiscipline]}` : ''}] freq=${d.frequency} impact=${d.impact} phases=${phases || '—'}\n      problem: ${text}`;
    };

    const phaseSection = journeyPhases
      .map((p) => {
        const rows = phaseBuckets.get(p.id) || [];
        if (rows.length === 0) return null;
        return `### Phase: ${p.label} (id: ${p.id})\n${rows.map(renderRow).join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const quadrantSection = (
      ['quickWins', 'majorProjects', 'timeSinks', 'minor'] as const
    )
      .map((q) => {
        const rows = quadrantBuckets[q];
        if (rows.length === 0) return `### Quadrant ${q}: (empty)`;
        return `### Quadrant ${q}\n${rows.map(renderRow).join('\n')}`;
      })
      .join('\n\n');

    const userPrompt = `Write the narrative sections of the diagnostic report.

## Headline numbers

${headlineLines.join('\n')}

## Allowed phaseIds

${journeyPhases.map((p) => `- ${p.id} → ${p.label}`).join('\n')}

## Problems by phase

${phaseSection || '(no phase mappings)'}

## Problems by quadrant

${quadrantSection}`;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      // Per-discipline + per-phase + per-quadrant narratives stack up
      // fast on busy models. The default 4096 cap routinely truncates
      // here and surfaces as "invalid JSON". 16k is the gpt-4o ceiling.
      max_tokens: 16384,
    });

    const choice = resp.choices[0];
    const finishReason = choice?.finish_reason;
    const refusal = choice?.message?.refusal;
    if (refusal) {
      return NextResponse.json(
        { error: `Model refused to generate narrative: ${refusal}` },
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

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch {
      const lengthHit = finishReason === 'length';
      return NextResponse.json(
        {
          error: lengthHit
            ? 'Narrative response was truncated by the token limit before valid JSON could close. Reduce the diagnostic count or split the run.'
            : 'Model returned invalid JSON',
          finishReason,
          rawSnippet: content.slice(0, 1500),
        },
        { status: 500 }
      );
    }

    const executiveSummary =
      typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary.trim() : '';

    const perDisciplineRaw = Array.isArray(parsed.perDiscipline) ? parsed.perDiscipline : [];
    const perDiscipline: { discipline: ProblemDiscipline; narrative: string }[] = [];
    for (const raw of perDisciplineRaw) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      if (!isDiscipline(r.discipline)) continue;
      const narrative = typeof r.narrative === 'string' ? r.narrative.trim() : '';
      if (!narrative) continue;
      perDiscipline.push({ discipline: r.discipline, narrative });
    }

    const perPhaseRaw = Array.isArray(parsed.perPhase) ? parsed.perPhase : [];
    const allowedPhaseIds = new Set(journeyPhases.map((p) => p.id));
    const perPhase: { phaseId: string; narrative: string }[] = [];
    for (const raw of perPhaseRaw) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const phaseId = typeof r.phaseId === 'string' ? r.phaseId : '';
      if (!allowedPhaseIds.has(phaseId)) continue;
      const narrative = typeof r.narrative === 'string' ? r.narrative.trim() : '';
      if (!narrative) continue;
      perPhase.push({ phaseId, narrative });
    }

    const pq = (parsed.perQuadrant || {}) as Record<string, unknown>;
    const perQuadrant = {
      quickWins: typeof pq.quickWins === 'string' ? pq.quickWins.trim() : '',
      majorProjects: typeof pq.majorProjects === 'string' ? pq.majorProjects.trim() : '',
      timeSinks: typeof pq.timeSinks === 'string' ? pq.timeSinks.trim() : '',
      minor: typeof pq.minor === 'string' ? pq.minor.trim() : '',
    };

    const result: DiagnoseNarrativeResponse = {
      promptVersion: NARRATIVE_PROMPT_VERSION,
      modelName,
      narrative: {
        executiveSummary,
        perDiscipline,
        perPhase,
        perQuadrant,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating diagnostic narrative:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
