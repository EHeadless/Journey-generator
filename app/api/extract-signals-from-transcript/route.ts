import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  getExtractorPrompt,
  formatChunksForPrompt,
  EXTRACTOR_PROMPT_VERSION,
  type ExtractorKind,
} from '@/lib/extraction/prompts';

export const runtime = 'nodejs';
export const maxDuration = 90;

interface ChunkInput {
  chunkIndex: number;
  text: string;
  speaker?: string;
}

interface ExtractRequest {
  apiKey: string;
  kind: ExtractorKind;
  chunks: ChunkInput[];
  /** Optional context — workshop name, journey phase, etc. */
  workshopContext?: string;
  model?: string;
}

interface ExtractedItem {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason?: string;
  citedChunkIndexes: number[];
  department?: string | null;
  persona?: string | null;
}

interface ExtractResponse {
  kind: ExtractorKind;
  promptVersion: string;
  modelName: string;
  items: ExtractedItem[];
}

const VALID_KINDS: ExtractorKind[] = [
  'problems',
  'jtbds',
  'needs',
  'opportunities',
  'gaps',
  'initiatives',
  'wishlist',
  'quotes',
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExtractRequest;
    const { apiKey, kind, chunks, workshopContext } = body;
    const modelName = body.model || 'gpt-4o';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!VALID_KINDS.includes(kind)) {
      return NextResponse.json(
        { error: `Invalid kind: ${kind}` },
        { status: 400 }
      );
    }
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        { error: 'chunks must be a non-empty array' },
        { status: 400 }
      );
    }

    const { system, label } = getExtractorPrompt(kind);
    const chunksBlock = formatChunksForPrompt(chunks);

    const userPrompt = `${workshopContext ? `Workshop context:\n${workshopContext}\n\n` : ''}Transcript chunks (cite these by index in citedChunkIndexes):

${chunksBlock}

Run as the ${label}. Return the JSON object described in the system message — no commentary.`;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: 'Empty response from model' },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'Model returned invalid JSON', raw },
        { status: 502 }
      );
    }

    const items = normalizeItems(parsed);
    const result: ExtractResponse = {
      kind,
      promptVersion: EXTRACTOR_PROMPT_VERSION,
      modelName,
      items,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error('[extract-signals-from-transcript] error', err);
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Normalize / sanity-check what the model returned. */
function normalizeItems(raw: unknown): ExtractedItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as { items?: unknown };
  const list = Array.isArray(obj.items) ? obj.items : [];
  const out: ExtractedItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const text = typeof e.text === 'string' ? e.text.trim() : '';
    if (!text) continue;
    const confidence =
      e.confidence === 'high' || e.confidence === 'medium' || e.confidence === 'low'
        ? e.confidence
        : 'medium';
    const citedChunkIndexes = Array.isArray(e.citedChunkIndexes)
      ? (e.citedChunkIndexes.filter((n) => typeof n === 'number') as number[])
      : [];
    out.push({
      text,
      confidence,
      confidenceReason:
        typeof e.confidenceReason === 'string' ? e.confidenceReason : undefined,
      citedChunkIndexes,
      department: typeof e.department === 'string' ? e.department : null,
      persona: typeof e.persona === 'string' ? e.persona : null,
    });
  }
  return out;
}
