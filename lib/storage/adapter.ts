/**
 * Storage adapter interface — single boundary between the app and its
 * persistence layer. Prototype uses IndexedDB (see indexedDb.ts). A
 * future Supabase implementation drops in by implementing this interface.
 *
 * Design principle: the Model (journeys, phases, demand spaces,
 * circumstances, workshops, …) stays in Zustand + localStorage because
 * it's small tree-shaped JSON. The Capture layer (uploads, chunks,
 * extractions, answers, proto-signals) lives here because it's big,
 * queryable, and has real relational shape.
 */

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

export interface StorageAdapter {
  // ---------- Uploads + file blobs ----------

  /**
   * Persist a file Blob and its Upload metadata row. Returns the Upload.
   * The Blob is stored separately (addressable by upload.blobKey) so we
   * can stream it back out without loading parsed text at the same time.
   */
  saveUpload(upload: Upload, blob: Blob): Promise<Upload>;
  updateUpload(id: string, updates: Partial<Upload>): Promise<void>;
  getUpload(id: string): Promise<Upload | undefined>;
  getUploadBlob(id: string): Promise<Blob | undefined>;
  listUploads(modelId: string): Promise<Upload[]>;
  listUploadsByWorkshop(modelId: string, workshopId: string): Promise<Upload[]>;
  deleteUpload(id: string): Promise<void>; // cascades to chunks/extractions/answers/signals

  // ---------- Transcript chunks + embeddings ----------

  saveChunks(chunks: TranscriptChunk[]): Promise<void>;
  listChunksForUpload(uploadId: string): Promise<TranscriptChunk[]>;
  listChunksForModel(modelId: string): Promise<TranscriptChunk[]>;
  /** Vector search — cosine similarity over all chunks in a model. */
  searchChunks(
    modelId: string,
    queryEmbedding: number[],
    topK: number
  ): Promise<Array<{ chunk: TranscriptChunk; score: number }>>;

  // ---------- Extraction runs ----------

  saveExtraction(extraction: Extraction): Promise<void>;
  updateExtraction(id: string, updates: Partial<Extraction>): Promise<void>;
  listExtractions(modelId: string): Promise<Extraction[]>;
  listExtractionsByUpload(uploadId: string): Promise<Extraction[]>;
  listExtractionsByKind(modelId: string, kind: ExtractionKind): Promise<Extraction[]>;

  // ---------- Question answers (workshop Q × upload) ----------

  saveQuestionAnswers(answers: QuestionAnswer[]): Promise<void>;
  updateQuestionAnswer(id: string, updates: Partial<QuestionAnswer>): Promise<void>;
  listQuestionAnswers(modelId: string): Promise<QuestionAnswer[]>;
  listQuestionAnswersForQuestion(questionId: string): Promise<QuestionAnswer[]>;

  // ---------- Extracted signals (proto-signals, pre-curation) ----------

  saveExtractedSignals(signals: ExtractedSignal[]): Promise<void>;
  updateExtractedSignal(id: string, updates: Partial<ExtractedSignal>): Promise<void>;
  listExtractedSignals(modelId: string): Promise<ExtractedSignal[]>;
  listExtractedSignalsByUpload(uploadId: string): Promise<ExtractedSignal[]>;

  // ---------- Problem diagnostics (Capture phase, third folder) ----------

  saveProblemDiagnostics(rows: ProblemDiagnostic[]): Promise<void>;
  updateProblemDiagnostic(id: string, updates: Partial<ProblemDiagnostic>): Promise<void>;
  listProblemDiagnostics(modelId: string): Promise<ProblemDiagnostic[]>;
  /** Wipe all diagnostics for a model — used when re-running classification from scratch. */
  clearProblemDiagnostics(modelId: string): Promise<void>;

  saveProblemDiagnosticNarrative(narrative: ProblemDiagnosticNarrative): Promise<void>;
  getProblemDiagnosticNarrative(modelId: string): Promise<ProblemDiagnosticNarrative | undefined>;
  clearProblemDiagnosticNarrative(modelId: string): Promise<void>;

  // ---------- Lifecycle ----------

  /** Wipe everything for one model (useful for "Reset engagement"). */
  dropModel(modelId: string): Promise<void>;
  /** Export everything for one model as a serializable bundle. */
  exportModel(modelId: string): Promise<ExportBundle>;
  /** Import a previously exported bundle. Replaces existing data for that modelId. */
  importModel(bundle: ExportBundle): Promise<void>;
}

/**
 * Self-contained export shape for a model's capture data. The Model
 * itself (journeys/phases/etc.) travels separately via Zustand's JSON
 * export — this bundle carries only the IndexedDB-resident data.
 */
export interface ExportBundle {
  modelId: string;
  uploads: Array<Upload & { blobBase64: string }>;
  chunks: TranscriptChunk[];
  extractions: Extraction[];
  questionAnswers: QuestionAnswer[];
  extractedSignals: ExtractedSignal[];
  /** Optional for backwards compatibility with v1 bundles. */
  problemDiagnostics?: ProblemDiagnostic[];
  problemDiagnosticNarrative?: ProblemDiagnosticNarrative;
  exportedAt: string; // ISO timestamp
  schemaVersion: number;
}

export const EXPORT_SCHEMA_VERSION = 2;
