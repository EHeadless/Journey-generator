/**
 * IndexedDB implementation of StorageAdapter, backed by Dexie.
 *
 * Object stores:
 *   - uploads           metadata rows (indexed by modelId, workshopId, contentHash)
 *   - uploadBlobs       raw file Blobs, keyed by blobKey (= upload.id)
 *   - transcriptChunks  chunks + embeddings (indexed by uploadId, modelId)
 *   - extractions       extraction runs (indexed by modelId, uploadId, kind)
 *   - questionAnswers   backfilled answers (indexed by modelId, workshopQuestionId, uploadId)
 *   - extractedSignals  proto-signals (indexed by modelId, uploadId, type)
 *
 * Vector search is in-memory cosine similarity. For a prototype with a
 * few dozen transcripts × ~80 chunks each, this is milliseconds. When
 * the corpus grows past ~10k chunks we swap this adapter for Supabase
 * + pgvector without touching the rest of the app.
 */

import Dexie, { Table } from 'dexie';
import type {
  Upload,
  TranscriptChunk,
  Extraction,
  ExtractionKind,
  QuestionAnswer,
  ExtractedSignal,
  ProblemDiagnostic,
  ProblemDiagnosticNarrative,
} from '../types';
import type { ExportBundle, StorageAdapter } from './adapter';
import { EXPORT_SCHEMA_VERSION } from './adapter';

// ---------- Database ----------

interface UploadBlobRow {
  blobKey: string; // = upload.id
  blob: Blob;
}

class JourneyGeneratorDB extends Dexie {
  uploads!: Table<Upload, string>;
  uploadBlobs!: Table<UploadBlobRow, string>;
  transcriptChunks!: Table<TranscriptChunk, string>;
  extractions!: Table<Extraction, string>;
  questionAnswers!: Table<QuestionAnswer, string>;
  extractedSignals!: Table<ExtractedSignal, string>;
  problemDiagnostics!: Table<ProblemDiagnostic, string>;
  problemDiagnosticNarratives!: Table<ProblemDiagnosticNarrative, string>;

  constructor() {
    super('journey-generator');
    this.version(1).stores({
      uploads: 'id, modelId, workshopId, contentHash, status',
      uploadBlobs: 'blobKey',
      transcriptChunks: 'id, uploadId, modelId, chunkIndex',
      extractions: 'id, modelId, uploadId, kind, status',
      questionAnswers: 'id, modelId, workshopQuestionId, uploadId, extractionId',
      extractedSignals: 'id, modelId, uploadId, type, extractionId',
    });
    // v2: add problem diagnostics + narrative stores. Existing data is
    // preserved automatically; the new stores start empty.
    this.version(2).stores({
      problemDiagnostics: 'id, modelId, problemSignalId',
      problemDiagnosticNarratives: 'id, modelId',
    });
  }
}

// Lazy singleton — Dexie must only be instantiated in the browser.
let _db: JourneyGeneratorDB | null = null;
function db(): JourneyGeneratorDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB adapter is browser-only');
  }
  if (!_db) _db = new JourneyGeneratorDB();
  return _db;
}

// ---------- Vector math ----------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------- Blob <-> base64 helpers for export/import ----------

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// ---------- Adapter ----------

export const indexedDbAdapter: StorageAdapter = {
  // --- Uploads ---

  async saveUpload(upload, blob) {
    await db().transaction('rw', db().uploads, db().uploadBlobs, async () => {
      await db().uploads.put(upload);
      await db().uploadBlobs.put({ blobKey: upload.blobKey, blob });
    });
    return upload;
  },

  async updateUpload(id, updates) {
    await db().uploads.update(id, updates);
  },

  async getUpload(id) {
    return db().uploads.get(id);
  },

  async getUploadBlob(id) {
    const row = await db().uploadBlobs.get(id);
    return row?.blob;
  },

  async listUploads(modelId) {
    return db().uploads.where('modelId').equals(modelId).toArray();
  },

  async listUploadsByWorkshop(modelId, workshopId) {
    const rows = await db()
      .uploads.where('workshopId')
      .equals(workshopId)
      .toArray();
    return rows.filter((u) => u.modelId === modelId);
  },

  async deleteUpload(id) {
    await db().transaction(
      'rw',
      [
        db().uploads,
        db().uploadBlobs,
        db().transcriptChunks,
        db().extractions,
        db().questionAnswers,
        db().extractedSignals,
      ],
      async () => {
        await db().uploads.delete(id);
        await db().uploadBlobs.delete(id);
        await db().transcriptChunks.where('uploadId').equals(id).delete();
        await db().extractions.where('uploadId').equals(id).delete();
        await db().questionAnswers.where('uploadId').equals(id).delete();
        await db().extractedSignals.where('uploadId').equals(id).delete();
      }
    );
  },

  // --- Chunks ---

  async saveChunks(chunks) {
    await db().transcriptChunks.bulkPut(chunks);
  },

  async listChunksForUpload(uploadId) {
    return db()
      .transcriptChunks.where('uploadId')
      .equals(uploadId)
      .sortBy('chunkIndex');
  },

  async listChunksForModel(modelId) {
    return db().transcriptChunks.where('modelId').equals(modelId).toArray();
  },

  async searchChunks(modelId, queryEmbedding, topK) {
    const chunks = await db()
      .transcriptChunks.where('modelId')
      .equals(modelId)
      .toArray();
    const scored = chunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
      }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  },

  // --- Extractions ---

  async saveExtraction(extraction) {
    await db().extractions.put(extraction);
  },

  async updateExtraction(id, updates) {
    await db().extractions.update(id, updates);
  },

  async listExtractions(modelId) {
    return db().extractions.where('modelId').equals(modelId).toArray();
  },

  async listExtractionsByUpload(uploadId) {
    return db().extractions.where('uploadId').equals(uploadId).toArray();
  },

  async listExtractionsByKind(modelId, kind: ExtractionKind) {
    const rows = await db().extractions.where('kind').equals(kind).toArray();
    return rows.filter((e) => e.modelId === modelId);
  },

  // --- Question answers ---

  async saveQuestionAnswers(answers) {
    await db().questionAnswers.bulkPut(answers);
  },

  async updateQuestionAnswer(id, updates) {
    await db().questionAnswers.update(id, updates);
  },

  async listQuestionAnswers(modelId) {
    return db().questionAnswers.where('modelId').equals(modelId).toArray();
  },

  async listQuestionAnswersForQuestion(questionId) {
    return db()
      .questionAnswers.where('workshopQuestionId')
      .equals(questionId)
      .toArray();
  },

  // --- Extracted signals ---

  async saveExtractedSignals(signals) {
    await db().extractedSignals.bulkPut(signals);
  },

  async updateExtractedSignal(id, updates) {
    await db().extractedSignals.update(id, updates);
  },

  async listExtractedSignals(modelId) {
    return db().extractedSignals.where('modelId').equals(modelId).toArray();
  },

  async listExtractedSignalsByUpload(uploadId) {
    return db().extractedSignals.where('uploadId').equals(uploadId).toArray();
  },

  // --- Problem diagnostics ---

  async saveProblemDiagnostics(rows) {
    await db().problemDiagnostics.bulkPut(rows);
  },

  async updateProblemDiagnostic(id, updates) {
    await db().problemDiagnostics.update(id, updates);
  },

  async listProblemDiagnostics(modelId) {
    return db().problemDiagnostics.where('modelId').equals(modelId).toArray();
  },

  async clearProblemDiagnostics(modelId) {
    await db().problemDiagnostics.where('modelId').equals(modelId).delete();
  },

  async saveProblemDiagnosticNarrative(narrative) {
    // One narrative per model — clear any existing first so getById is unique.
    await db()
      .problemDiagnosticNarratives.where('modelId')
      .equals(narrative.modelId)
      .delete();
    await db().problemDiagnosticNarratives.put(narrative);
  },

  async getProblemDiagnosticNarrative(modelId) {
    const rows = await db()
      .problemDiagnosticNarratives.where('modelId')
      .equals(modelId)
      .toArray();
    return rows[0];
  },

  async clearProblemDiagnosticNarrative(modelId) {
    await db()
      .problemDiagnosticNarratives.where('modelId')
      .equals(modelId)
      .delete();
  },

  // --- Lifecycle ---

  async dropModel(modelId) {
    const uploads = await db().uploads.where('modelId').equals(modelId).toArray();
    const blobKeys = uploads.map((u) => u.blobKey);
    await db().transaction(
      'rw',
      [
        db().uploads,
        db().uploadBlobs,
        db().transcriptChunks,
        db().extractions,
        db().questionAnswers,
        db().extractedSignals,
        db().problemDiagnostics,
        db().problemDiagnosticNarratives,
      ],
      async () => {
        await db().uploads.where('modelId').equals(modelId).delete();
        if (blobKeys.length) await db().uploadBlobs.bulkDelete(blobKeys);
        await db().transcriptChunks.where('modelId').equals(modelId).delete();
        await db().extractions.where('modelId').equals(modelId).delete();
        await db().questionAnswers.where('modelId').equals(modelId).delete();
        await db().extractedSignals.where('modelId').equals(modelId).delete();
        await db().problemDiagnostics.where('modelId').equals(modelId).delete();
        await db().problemDiagnosticNarratives.where('modelId').equals(modelId).delete();
      }
    );
  },

  async exportModel(modelId) {
    const uploads = await db().uploads.where('modelId').equals(modelId).toArray();
    const uploadsWithBlobs = await Promise.all(
      uploads.map(async (u) => {
        const blob = await indexedDbAdapter.getUploadBlob(u.id);
        const blobBase64 = blob ? await blobToBase64(blob) : '';
        return { ...u, blobBase64 };
      })
    );
    const [
      chunks,
      extractions,
      questionAnswers,
      extractedSignals,
      problemDiagnostics,
      narratives,
    ] = await Promise.all([
      db().transcriptChunks.where('modelId').equals(modelId).toArray(),
      db().extractions.where('modelId').equals(modelId).toArray(),
      db().questionAnswers.where('modelId').equals(modelId).toArray(),
      db().extractedSignals.where('modelId').equals(modelId).toArray(),
      db().problemDiagnostics.where('modelId').equals(modelId).toArray(),
      db().problemDiagnosticNarratives.where('modelId').equals(modelId).toArray(),
    ]);
    const bundle: ExportBundle = {
      modelId,
      uploads: uploadsWithBlobs,
      chunks,
      extractions,
      questionAnswers,
      extractedSignals,
      problemDiagnostics,
      problemDiagnosticNarrative: narratives[0],
      exportedAt: new Date().toISOString(),
      schemaVersion: EXPORT_SCHEMA_VERSION,
    };
    return bundle;
  },

  async importModel(bundle) {
    // Accept v1 bundles too — diagnostics fields are optional, so a v1
    // bundle imports cleanly with empty diagnostics state.
    if (bundle.schemaVersion > EXPORT_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported export schema version ${bundle.schemaVersion}; max supported ${EXPORT_SCHEMA_VERSION}`
      );
    }
    // Wipe existing data for this modelId before importing.
    await indexedDbAdapter.dropModel(bundle.modelId);

    await db().transaction(
      'rw',
      [
        db().uploads,
        db().uploadBlobs,
        db().transcriptChunks,
        db().extractions,
        db().questionAnswers,
        db().extractedSignals,
        db().problemDiagnostics,
        db().problemDiagnosticNarratives,
      ],
      async () => {
        // Uploads + blobs
        const plainUploads: Upload[] = bundle.uploads.map(
          ({ blobBase64: _ignore, ...rest }) => rest
        );
        await db().uploads.bulkPut(plainUploads);
        const blobRows: UploadBlobRow[] = bundle.uploads
          .filter((u) => !!u.blobBase64)
          .map((u) => ({
            blobKey: u.blobKey,
            blob: base64ToBlob(u.blobBase64, u.mimeType),
          }));
        if (blobRows.length) await db().uploadBlobs.bulkPut(blobRows);

        // Chunks / extractions / answers / signals
        if (bundle.chunks.length)
          await db().transcriptChunks.bulkPut(bundle.chunks);
        if (bundle.extractions.length)
          await db().extractions.bulkPut(bundle.extractions);
        if (bundle.questionAnswers.length)
          await db().questionAnswers.bulkPut(bundle.questionAnswers);
        if (bundle.extractedSignals.length)
          await db().extractedSignals.bulkPut(bundle.extractedSignals);
        if (bundle.problemDiagnostics?.length)
          await db().problemDiagnostics.bulkPut(bundle.problemDiagnostics);
        if (bundle.problemDiagnosticNarrative)
          await db().problemDiagnosticNarratives.put(bundle.problemDiagnosticNarrative);
      }
    );
  },
};

export default indexedDbAdapter;
