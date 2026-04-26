/**
 * Capture pipeline — per-upload orchestration.
 *
 * Given a newly-added Upload, runs: parse → chunk → embed → extract
 * (fan-out across extractor kinds) → optional question backfill. Pushes
 * progress via the supplied `onStep` callback and persists every
 * intermediate state through captureStore so the page refresh survives.
 *
 * Pure TS — no JSX, no React hooks. Designed to be called from a
 * component that already holds the Zustand store handle.
 */

import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import { chunkTranscript } from './chunker';
import type { ExtractorKind } from './prompts';
import { EXTRACTOR_PROMPT_VERSION } from './prompts';
import { BACKFILL_PROMPT_VERSION } from '@/app/api/backfill-question-answers/route';
import type { useCaptureStore } from '@/lib/captureStore';
import type {
  Upload,
  TranscriptChunk,
  ExtractedSignal,
  ExtractedSignalType,
  ConfidenceLevel,
  QuestionAnswer,
  WorkshopQuestion,
} from '@/lib/types';

// ---------- Public types ----------

export type CaptureStep =
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'extracting'
  | 'backfilling'
  | 'done'
  | 'failed';

export interface CaptureProgress {
  uploadId: string;
  step: CaptureStep;
  extractorsTotal?: number;
  extractorsDone?: number;
  message?: string;
  error?: string;
}

export interface PipelineArgs {
  apiKey: string;
  modelId: string;
  upload: Upload;
  /** Already-parsed text. If undefined, pipeline will POST to /api/parse-file. */
  parsedText?: string;
  /** Workshop questions (optional) — drives the backfill pass. */
  workshopQuestions?: WorkshopQuestion[];
  workshopContext?: string;
  /** Extractor kinds to run. Defaults to the full set. */
  kinds?: ExtractorKind[];
  /** Max concurrent extractor fan-out calls. Default 4. */
  maxConcurrency?: number;
  onProgress?: (p: CaptureProgress) => void;
  /** Injected captureStore handle so callers can drive the pipeline from anywhere. */
  store: ReturnType<typeof useCaptureStore.getState>;
}

// ---------- Constants ----------

export const ALL_EXTRACTOR_KINDS: ExtractorKind[] = [
  'problems',
  'jtbds',
  'needs',
  'opportunities',
  'gaps',
  'initiatives',
  'wishlist',
  'quotes',
];

const KIND_TO_SIGNAL_TYPE: Record<ExtractorKind, ExtractedSignalType> = {
  problems: 'problem',
  jtbds: 'jtbd',
  needs: 'need',
  opportunities: 'opportunity',
  gaps: 'gap',
  initiatives: 'initiative',
  wishlist: 'wishlist',
  quotes: 'quote',
};

const EMBEDDING_MODEL = 'text-embedding-3-small';

// ---------- Small concurrency helper ----------

async function runWithConcurrency<T, R>(
  items: T[],
  max: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const runners = Array.from({ length: Math.min(max, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

// ---------- Pipeline ----------

export async function runCapturePipeline(args: PipelineArgs): Promise<void> {
  const {
    apiKey,
    modelId,
    upload,
    workshopQuestions = [],
    workshopContext,
    kinds = ALL_EXTRACTOR_KINDS,
    maxConcurrency = 4,
    onProgress,
    store,
  } = args;

  const uploadId = upload.id;
  const report = (p: Omit<CaptureProgress, 'uploadId'>) =>
    onProgress?.({ uploadId, ...p });

  try {
    // ---------- 1. Parse ----------

    let parsedText = args.parsedText ?? upload.parsedText;
    if (!parsedText) {
      report({ step: 'parsing' });
      await store.setUploadStatus(uploadId, 'parsing');
      const blob = await storage.getUploadBlob(uploadId);
      if (!blob) throw new Error('Upload blob not found in storage');

      const form = new FormData();
      form.append('file', new File([blob], upload.filename, { type: upload.mimeType }));
      const parseResp = await fetch('/api/parse-file', { method: 'POST', body: form });
      if (!parseResp.ok) {
        const err = await parseResp.json().catch(() => ({ error: 'Parse failed' }));
        throw new Error(err.error || 'Parse failed');
      }
      const parseBody = (await parseResp.json()) as { text: string };
      parsedText = parseBody.text;
      await store.setUploadParsedText(uploadId, parsedText);
    }

    if (!parsedText || !parsedText.trim()) {
      throw new Error('Parsed transcript is empty');
    }

    // ---------- 2. Chunk ----------

    report({ step: 'chunking' });
    await store.setUploadStatus(uploadId, 'chunking');
    const drafts = chunkTranscript({ text: parsedText });
    if (drafts.length === 0) throw new Error('Chunker produced no chunks');

    const now = new Date();
    const chunks: TranscriptChunk[] = drafts.map((d) => ({
      ...d,
      id: uuidv4(),
      uploadId,
      modelId,
      createdAt: now,
    }));
    await store.saveChunks(chunks);

    // ---------- 3. Embed ----------

    report({ step: 'embedding' });
    const embedResp = await fetch('/api/embed-chunks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model: EMBEDDING_MODEL,
        texts: chunks.map((c) => c.text),
      }),
    });
    if (!embedResp.ok) {
      const err = await embedResp.json().catch(() => ({ error: 'Embedding failed' }));
      throw new Error(err.error || 'Embedding failed');
    }
    const { embeddings } = (await embedResp.json()) as { embeddings: number[][] };
    if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
      throw new Error('Embedding count mismatch');
    }
    const chunksWithEmbeddings: TranscriptChunk[] = chunks.map((c, i) => ({
      ...c,
      embedding: embeddings[i],
    }));
    await store.saveChunks(chunksWithEmbeddings);
    await store.setUploadStatus(uploadId, 'ready');

    // ---------- 4. Fan-out extraction ----------

    report({ step: 'extracting', extractorsTotal: kinds.length, extractorsDone: 0 });

    const chunkIdByIndex = new Map<number, string>();
    for (const c of chunksWithEmbeddings) chunkIdByIndex.set(c.chunkIndex, c.id);

    let done = 0;
    await runWithConcurrency(kinds, maxConcurrency, async (kind) => {
      const extraction = await store.startExtraction({
        modelId,
        uploadId,
        kind,
        promptVersion: EXTRACTOR_PROMPT_VERSION,
        modelName: 'gpt-4o',
      });

      try {
        const resp = await fetch('/api/extract-signals-from-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            kind,
            workshopContext,
            chunks: chunksWithEmbeddings.map((c) => ({
              chunkIndex: c.chunkIndex,
              text: c.text,
              speaker: c.speaker,
            })),
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Extractor failed' }));
          throw new Error(err.error || 'Extractor failed');
        }
        const body = (await resp.json()) as {
          items: Array<{
            text: string;
            confidence: ConfidenceLevel;
            confidenceReason?: string;
            citedChunkIndexes: number[];
            department?: string | null;
            persona?: string | null;
          }>;
        };

        const signals: ExtractedSignal[] = body.items.map((item) => ({
          id: uuidv4(),
          modelId,
          extractionId: extraction.id,
          uploadId,
          type: KIND_TO_SIGNAL_TYPE[kind],
          text: item.text,
          confidence: item.confidence,
          confidenceReason: item.confidenceReason,
          supportingChunkIds: item.citedChunkIndexes
            .map((idx) => chunkIdByIndex.get(idx))
            .filter((id): id is string => !!id),
          department: item.department ?? undefined,
          persona: item.persona ?? undefined,
          createdAt: new Date(),
        }));

        if (signals.length > 0) {
          await store.saveExtractedSignals(signals);
        }
        await store.finishExtraction(extraction.id, 'done', {
          outputCount: signals.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Extractor failed';
        await store.finishExtraction(extraction.id, 'failed', { error: message });
        // Don't rethrow — one failed kind shouldn't abort the rest.
      } finally {
        done += 1;
        report({
          step: 'extracting',
          extractorsTotal: kinds.length,
          extractorsDone: done,
        });
      }
    });

    // ---------- 5. Question backfill (optional) ----------

    if (workshopQuestions.length > 0) {
      report({ step: 'backfilling' });

      // For each question: vector search for top-5 chunks across the model.
      const perQuestion = await Promise.all(
        workshopQuestions.map(async (q) => {
          // Embed the question text first.
          const qEmbedResp = await fetch('/api/embed-chunks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              model: EMBEDDING_MODEL,
              texts: [q.text],
            }),
          });
          if (!qEmbedResp.ok) {
            return { question: q, retrieved: [] as Array<{ chunk: TranscriptChunk; score: number }> };
          }
          const { embeddings: qEmbeds } = (await qEmbedResp.json()) as {
            embeddings: number[][];
          };
          const qEmbedding = qEmbeds[0];
          if (!qEmbedding) {
            return { question: q, retrieved: [] };
          }
          const retrieved = await storage.searchChunks(modelId, qEmbedding, 5);
          return { question: q, retrieved };
        })
      );

      // Filter to questions that actually have retrieved chunks from THIS upload
      // (backfilling is per-upload).
      const questionsForThisUpload = perQuestion
        .map(({ question, retrieved }) => {
          const fromThisUpload = retrieved.filter((r) => r.chunk.uploadId === uploadId);
          return { question, retrieved: fromThisUpload };
        })
        .filter((q) => q.retrieved.length > 0);

      if (questionsForThisUpload.length > 0) {
        const extraction = await store.startExtraction({
          modelId,
          uploadId,
          kind: 'question-answers',
          promptVersion: BACKFILL_PROMPT_VERSION,
          modelName: 'gpt-4o',
        });

        try {
          const resp = await fetch('/api/backfill-question-answers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              workshopContext,
              questions: questionsForThisUpload.map(({ question, retrieved }) => ({
                questionId: question.id,
                question: question.text,
                retrievedChunks: retrieved.map(({ chunk }) => ({
                  chunkIndex: chunk.chunkIndex,
                  text: chunk.text,
                  speaker: chunk.speaker,
                })),
              })),
            }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Backfill failed' }));
            throw new Error(err.error || 'Backfill failed');
          }
          const body = (await resp.json()) as {
            answers: Array<{
              questionId: string;
              answerText: string | null;
              confidence: ConfidenceLevel;
              confidenceReason?: string;
              citedChunkIndexes: number[];
            }>;
          };

          const indexToIdPerQuestion = new Map<string, Map<number, string>>();
          for (const { question, retrieved } of questionsForThisUpload) {
            const m = new Map<number, string>();
            for (const { chunk } of retrieved) m.set(chunk.chunkIndex, chunk.id);
            indexToIdPerQuestion.set(question.id, m);
          }

          const answers: QuestionAnswer[] = body.answers
            .filter((a) => a.answerText !== null)
            .map((a) => {
              const idxToId = indexToIdPerQuestion.get(a.questionId) ?? new Map();
              return {
                id: uuidv4(),
                modelId,
                workshopQuestionId: a.questionId,
                extractionId: extraction.id,
                uploadId,
                answerText: a.answerText as string,
                confidence: a.confidence,
                confidenceReason: a.confidenceReason,
                supportingChunkIds: a.citedChunkIndexes
                  .map((idx) => idxToId.get(idx))
                  .filter((id): id is string => !!id),
              };
            });

          if (answers.length > 0) {
            await store.saveQuestionAnswers(answers);
          }
          await store.finishExtraction(extraction.id, 'done', {
            outputCount: answers.length,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Backfill failed';
          await store.finishExtraction(extraction.id, 'failed', { error: message });
          // Non-fatal: extractions above may have succeeded.
        }
      }
    }

    report({ step: 'done' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline failed';
    await store.setUploadStatus(uploadId, 'failed', message).catch(() => {});
    report({ step: 'failed', error: message });
    throw err;
  }
}
