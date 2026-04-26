import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 90;

export const CONTRADICTION_PROMPT_VERSION = '1.0.0';

type Severity = 'hard' | 'soft';

interface StatementInput {
  id: string;
  text: string;
  source: string;
}

interface DetectRequestBody {
  apiKey?: string;
  model?: string;
  statements?: StatementInput[];
}

interface Contradiction {
  statementIds: string[];
  summary: string;
  severity: Severity;
}

interface DetectResponseBody {
  promptVersion: string;
  modelName: string;
  contradictions: Contradiction[];
}

const SYSTEM_PROMPT = `You are a behavioral strategist at Digitas scanning statements pulled from multiple workshops / interviews for contradictions.

## Your Task

Given a list of statements (each with an id, text, and source), surface contradictions that a strategist would want flagged before building a demand landscape.

## What Counts as a Contradiction

- \`hard\` — two or more statements cannot both be true as stated. e.g. "CRM scores refresh hourly" vs "CRM scores refresh overnight only".
- \`soft\` — statements are not directly contradictory but reveal a tension worth naming. e.g. "We treat every customer the same" vs "VIPs get same-day callback".

## What Does NOT Count

- Different phrasing of the same idea.
- Statements about different things that merely sit in the same topic area.
- Observations at different levels of abstraction (one strategic, one tactical) that can coexist.

## Rules

1. Only group statements that are actually in conflict. Two in a group is fine; more is fine if they all point at the same conflict.
2. Every id in \`statementIds\` MUST be an id from the input. Never invent ids.
3. The \`summary\` is a neutral one-line naming of the disagreement — not a judgment of who's right. Reference the topic, not the people.
4. Prefer \`hard\` only when the conflict is factual and direct. When in doubt, use \`soft\`.
5. If there are no contradictions, return an empty \`contradictions\` array. Do not fabricate tension.

## Output Format

Return ONLY valid JSON matching this exact shape:

\`\`\`json
{
  "contradictions": [
    {
      "statementIds": ["id-a", "id-b"],
      "summary": "Teams disagree on CRM refresh cadence",
      "severity": "hard"
    }
  ]
}
\`\`\``;

function clampSeverity(v: unknown): Severity {
  return v === 'hard' ? 'hard' : 'soft';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetectRequestBody;
    const apiKey = body.apiKey;
    const modelName = body.model || 'gpt-4o';
    const statements = Array.isArray(body.statements) ? body.statements : [];

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (statements.length < 2) {
      return NextResponse.json(
        { error: 'At least two statements are required' },
        { status: 400 }
      );
    }

    const allowedIds = new Set(statements.map((s) => s.id));

    const formattedStatements = statements
      .map((s) => `- id: ${s.id}\n  source: ${s.source}\n  text: ${s.text.trim()}`)
      .join('\n\n');

    const userPrompt = `Scan these statements for contradictions. Return an empty array if none are worth flagging.

${formattedStatements}`;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Model returned empty content' },
        { status: 500 }
      );
    }

    let parsed: { contradictions?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Model returned invalid JSON' },
        { status: 500 }
      );
    }

    const rawList = Array.isArray(parsed.contradictions) ? parsed.contradictions : [];
    const contradictions: Contradiction[] = [];

    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;

      const idsRaw = Array.isArray(r.statementIds) ? r.statementIds : [];
      const ids = idsRaw
        .filter((v): v is string => typeof v === 'string')
        .filter((v) => allowedIds.has(v));
      // De-dupe within a group and require at least 2 distinct ids.
      const uniqueIds = Array.from(new Set(ids));
      if (uniqueIds.length < 2) continue;

      const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
      if (!summary) continue;

      contradictions.push({
        statementIds: uniqueIds,
        summary,
        severity: clampSeverity(r.severity),
      });
    }

    const result: DetectResponseBody = {
      promptVersion: CONTRADICTION_PROMPT_VERSION,
      modelName,
      contradictions,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error detecting contradictions:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
