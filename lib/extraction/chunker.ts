/**
 * Transcript chunker — splits a parsed transcript into overlapping chunks
 * suitable for embedding + RAG retrieval. Pure function, no LLM, no IO.
 *
 * Strategy:
 *   - Split on sentence boundaries (keeps speaker turns intact where
 *     possible).
 *   - Pack sentences into chunks targeting ~500 tokens with ~50 tokens
 *     of overlap (so answers near a chunk boundary don't get clipped).
 *   - Token count is approximated as `chars / 4` — close enough for
 *     chunking heuristics, and avoids shipping a tokenizer.
 *
 * Returns shape-ready objects (no ids yet — caller stamps uuids and the
 * uploadId/modelId before writing to the store).
 */

import type { TranscriptChunk } from '../types';

export interface ChunkerInput {
  text: string;
  targetTokens?: number;   // default 500
  overlapTokens?: number;  // default 50
}

export type ChunkDraft = Omit<
  TranscriptChunk,
  'id' | 'uploadId' | 'modelId' | 'embedding' | 'createdAt'
>;

const CHARS_PER_TOKEN = 4;

/** Rough sentence splitter that keeps quoted speech together. */
function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  // Split on ., !, ? followed by whitespace, or on double newlines
  // (speaker turns in transcripts). Keep the terminator with the
  // preceding sentence.
  const parts = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z"'\[])|\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

function approxTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / CHARS_PER_TOKEN));
}

export function chunkTranscript(input: ChunkerInput): ChunkDraft[] {
  const targetTokens = input.targetTokens ?? 500;
  const overlapTokens = Math.min(input.overlapTokens ?? 50, targetTokens - 50);
  const sentences = splitSentences(input.text);
  if (sentences.length === 0) return [];

  const chunks: ChunkDraft[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(' ').trim();
    if (!text) return;
    chunks.push({
      chunkIndex: chunkIndex++,
      text,
      tokenCount: bufferTokens,
    });
  };

  for (const sentence of sentences) {
    const t = approxTokens(sentence);
    if (bufferTokens + t > targetTokens && buffer.length > 0) {
      flush();
      // Start next chunk with the last N tokens of overlap.
      const tail: string[] = [];
      let tailTokens = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        const st = approxTokens(buffer[i]);
        if (tailTokens + st > overlapTokens) break;
        tail.unshift(buffer[i]);
        tailTokens += st;
      }
      buffer = tail;
      bufferTokens = tailTokens;
    }
    buffer.push(sentence);
    bufferTokens += t;
  }
  flush();
  return chunks;
}
