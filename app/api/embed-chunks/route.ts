import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface EmbedRequest {
  apiKey: string;
  texts: string[];
  model?: string;
}

interface EmbedResponse {
  embeddings: number[][];
  model: string;
}

/**
 * Batched embeddings endpoint. The OpenAI embeddings API accepts an
 * array `input`, so a single request handles up to ~2048 chunks. The
 * client splits very large transcripts into multiple calls if needed.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmbedRequest;
    const { apiKey, texts } = body;
    const model = body.model || 'text-embedding-3-small';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'texts must be a non-empty array' },
        { status: 400 }
      );
    }
    if (texts.some((t) => typeof t !== 'string')) {
      return NextResponse.json(
        { error: 'texts must all be strings' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const resp = await openai.embeddings.create({
      model,
      input: texts,
    });

    const embeddings = resp.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    const result: EmbedResponse = { embeddings, model };
    return NextResponse.json(result);
  } catch (err) {
    console.error('[embed-chunks] error', err);
    const message = err instanceof Error ? err.message : 'Embedding failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
