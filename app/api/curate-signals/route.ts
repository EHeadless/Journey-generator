import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ExtractorKind } from '@/lib/extraction/prompts';

export const runtime = 'nodejs';
export const maxDuration = 90;

export const CURATOR_PROMPT_VERSION = '1.0.0';

type Confidence = 'high' | 'medium' | 'low';

interface SignalInput {
  id: string;
  text: string;
  confidence: Confidence;
  citedChunkIds: string[];
}

interface CurateRequestBody {
  apiKey?: string;
  model?: string;
  kind?: ExtractorKind;
  signals?: SignalInput[];
}

interface MergedGroup {
  canonicalText: string;
  mergedIds: string[];
  confidence: Confidence;
  citedChunkIds: string[];
}

interface CurateResponseBody {
  promptVersion: string;
  modelName: string;
  groups: MergedGroup[];
}

const KIND_LABELS: Record<ExtractorKind, string> = {
  problems: 'problems',
  jtbds: 'jobs-to-be-done',
  needs: 'needs',
  opportunities: 'opportunities',
  gaps: 'gaps',
  initiatives: 'initiatives',
  wishlist: 'wishlist items',
  quotes: 'quotes',
};

const SYSTEM_PROMPT = `You are a behavioral strategist at Digitas curating extracted signals after a fan-out extraction across uploads.

## Your Task

You receive a list of extracted signals of a single kind. Group duplicates and near-duplicates into canonical groups. Leave distinct signals as single-member groups.

## Hard Rules

1. Never merge across substantive differences. Two separate signals are better than one mushy combined one.
2. The canonical text must be the sharpest phrasing — prefer a clean paraphrase over quote stitching. Keep it tight and concrete.
3. \`mergedIds\` MUST only contain ids from the input. Never invent ids.
4. Every input id MUST appear in exactly one group across the output. No dropping, no duplication.
5. Group \`confidence\` = the highest confidence of the merged members (high > medium > low).
6. Group \`citedChunkIds\` = the de-duplicated union of all members' \`citedChunkIds\`.
7. If a signal stands alone, return it as a one-member group with its own text cleaned up only if the cleanup is trivial (typos, trailing punctuation). Otherwise keep the original wording.

## What Counts as "Same Signal"

- Same underlying pain / job / opportunity expressed with different wording.
- Two speakers naming the same friction from different angles.

## What Does NOT Count

- Signals that share a topic but describe different problems.
- A general statement merged with a specific instance — keep them separate; the specific one is more actionable.
- Causes vs. effects — keep them separate.

## Output Format

Return ONLY valid JSON matching this exact shape:

\`\`\`json
{
  "groups": [
    {
      "canonicalText": "...",
      "mergedIds": ["id1", "id2"],
      "confidence": "high" | "medium" | "low",
      "citedChunkIds": ["chunk-uuid-1", "chunk-uuid-2"]
    }
  ]
}
\`\`\``;

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };

function clampConfidence(v: unknown): Confidence {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
}

function isExtractorKind(v: unknown): v is ExtractorKind {
  return typeof v === 'string' && v in KIND_LABELS;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CurateRequestBody;
    const apiKey = body.apiKey;
    const modelName = body.model || 'gpt-4o';
    const kind = body.kind;
    const signals = Array.isArray(body.signals) ? body.signals : [];

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!isExtractorKind(kind)) {
      return NextResponse.json(
        { error: 'A valid kind is required' },
        { status: 400 }
      );
    }
    if (signals.length === 0) {
      return NextResponse.json(
        { error: 'At least one signal is required' },
        { status: 400 }
      );
    }

    const inputById = new Map<string, SignalInput>();
    for (const s of signals) {
      if (s && typeof s.id === 'string') {
        inputById.set(s.id, s);
      }
    }
    const allowedIds = new Set(inputById.keys());

    const kindLabel = KIND_LABELS[kind];

    const formatted = signals
      .map(
        (s) =>
          `- id: ${s.id}\n  confidence: ${s.confidence}\n  text: ${s.text.trim()}`
      )
      .join('\n\n');

    const userPrompt = `Curate these ${kindLabel}. Merge true duplicates; leave distinct signals alone. Every input id must end up in exactly one group.

${formatted}`;

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

    let parsed: { groups?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Model returned invalid JSON' },
        { status: 500 }
      );
    }

    const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
    const usedIds = new Set<string>();
    const groups: MergedGroup[] = [];

    for (const raw of rawGroups) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;

      const canonicalText = typeof r.canonicalText === 'string' ? r.canonicalText.trim() : '';
      if (!canonicalText) continue;

      const mergedRaw = Array.isArray(r.mergedIds) ? r.mergedIds : [];
      const mergedIds = Array.from(
        new Set(
          mergedRaw
            .filter((v): v is string => typeof v === 'string')
            .filter((v) => allowedIds.has(v) && !usedIds.has(v))
        )
      );
      if (mergedIds.length === 0) continue;
      mergedIds.forEach((id) => usedIds.add(id));

      // Enforce: group confidence = highest of members.
      const memberConfidences = mergedIds
        .map((id) => inputById.get(id)?.confidence)
        .filter((c): c is Confidence => !!c);
      const confidence: Confidence = memberConfidences.reduce<Confidence>(
        (best, c) => (CONFIDENCE_RANK[c] > CONFIDENCE_RANK[best] ? c : best),
        'low'
      );

      // Enforce: union of member citedChunkIds (ignore model's version if provided).
      const citedSet = new Set<string>();
      for (const id of mergedIds) {
        const s = inputById.get(id);
        if (!s) continue;
        for (const cid of s.citedChunkIds) {
          if (typeof cid === 'string') citedSet.add(cid);
        }
      }

      groups.push({
        canonicalText,
        mergedIds,
        confidence,
        citedChunkIds: Array.from(citedSet),
      });
    }

    // Any id the model dropped becomes its own singleton group.
    for (const [id, s] of inputById) {
      if (usedIds.has(id)) continue;
      usedIds.add(id);
      groups.push({
        canonicalText: s.text.trim(),
        mergedIds: [id],
        confidence: clampConfidence(s.confidence),
        citedChunkIds: Array.from(new Set(s.citedChunkIds)),
      });
    }

    const result: CurateResponseBody = {
      promptVersion: CURATOR_PROMPT_VERSION,
      modelName,
      groups,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error curating signals:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
