/**
 * Capture slice — parallel Zustand store for the ingestion layer.
 *
 * Why a separate store: Capture entities (uploads, chunks, extractions,
 * answers, proto-signals) live in IndexedDB, not localStorage. They're
 * too heavy and too relational to roundtrip through the main Model's
 * JSON blob. This store exposes them with normal React selector ergonomics
 * while the real data lives in IDB via `lib/storage`.
 *
 * Hydration pattern: call `hydrateCapture(modelId)` when a model page
 * mounts. It reads everything from IDB into memory. Subsequent mutations
 * go through this store's actions, which write-through to IDB and
 * update the in-memory mirror so the UI re-renders immediately.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';
import type {
  Upload,
  UploadKind,
  UploadStatus,
  TranscriptChunk,
  Extraction,
  ExtractionKind,
  ExtractionStatus,
  QuestionAnswer,
  ExtractedSignal,
  ProblemDiagnostic,
  ProblemDiagnosticNarrative,
} from './types';

// ---------- SHA-256 for duplicate detection ----------

async function sha256(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------- State ----------

interface CaptureState {
  /** The modelId this slice is currently hydrated for (prevents cross-model leaks). */
  hydratedForModelId: string | null;
  isHydrating: boolean;

  uploads: Upload[];
  chunks: TranscriptChunk[];
  extractions: Extraction[];
  questionAnswers: QuestionAnswer[];
  extractedSignals: ExtractedSignal[];
  problemDiagnostics: ProblemDiagnostic[];
  problemDiagnosticNarrative: ProblemDiagnosticNarrative | null;

  /** True while any upload/parse/chunk/extract job is in flight — drives onbeforeunload warning. */
  inFlightJobs: number;

  // --- Lifecycle ---
  hydrate: (modelId: string) => Promise<void>;
  clear: () => void;

  // --- Uploads ---
  /**
   * Add a new file upload against a workshop. Hashes the blob first; if
   * a matching contentHash already exists for this model+workshop, the
   * existing Upload is returned (no-op). Otherwise a new Upload is
   * created with status='uploaded'.
   */
  addUpload: (args: {
    modelId: string;
    workshopId: string;
    kind: UploadKind;
    file: File;
  }) => Promise<{ upload: Upload; duplicate: boolean }>;
  updateUpload: (id: string, updates: Partial<Upload>) => Promise<void>;
  removeUpload: (id: string) => Promise<void>;
  setUploadStatus: (id: string, status: UploadStatus, error?: string) => Promise<void>;
  setUploadParsedText: (id: string, parsedText: string) => Promise<void>;

  // --- Chunks ---
  saveChunks: (chunks: TranscriptChunk[]) => Promise<void>;

  // --- Extractions ---
  startExtraction: (args: {
    modelId: string;
    uploadId?: string;
    kind: ExtractionKind;
    promptVersion: string;
    modelName: string;
  }) => Promise<Extraction>;
  finishExtraction: (
    id: string,
    status: Extract<ExtractionStatus, 'done' | 'failed'>,
    opts?: { error?: string; outputCount?: number }
  ) => Promise<void>;

  // --- Outputs ---
  saveQuestionAnswers: (answers: QuestionAnswer[]) => Promise<void>;
  updateQuestionAnswer: (id: string, updates: Partial<QuestionAnswer>) => Promise<void>;
  saveExtractedSignals: (signals: ExtractedSignal[]) => Promise<void>;
  updateExtractedSignal: (id: string, updates: Partial<ExtractedSignal>) => Promise<void>;

  // --- Problem diagnostics ---
  /**
   * Replace the full diagnostics set for a model. Used after a fresh
   * classification run when there are no manual edits to preserve.
   */
  replaceProblemDiagnostics: (
    modelId: string,
    rows: ProblemDiagnostic[]
  ) => Promise<void>;
  /** Upsert a partial set of diagnostics (e.g. accepted overwrites from the diff modal). */
  upsertProblemDiagnostics: (rows: ProblemDiagnostic[]) => Promise<void>;
  updateProblemDiagnostic: (
    id: string,
    updates: Partial<ProblemDiagnostic>
  ) => Promise<void>;
  clearProblemDiagnostics: (modelId: string) => Promise<void>;
  setProblemDiagnosticNarrative: (
    narrative: ProblemDiagnosticNarrative
  ) => Promise<void>;
  clearProblemDiagnosticNarrative: (modelId: string) => Promise<void>;

  // --- Flight-counter helpers (used by the extraction pipeline) ---
  incrementInFlight: () => void;
  decrementInFlight: () => void;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  hydratedForModelId: null,
  isHydrating: false,
  uploads: [],
  chunks: [],
  extractions: [],
  questionAnswers: [],
  extractedSignals: [],
  problemDiagnostics: [],
  problemDiagnosticNarrative: null,
  inFlightJobs: 0,

  // ---------- Lifecycle ----------

  hydrate: async (modelId) => {
    if (get().hydratedForModelId === modelId && !get().isHydrating) return;
    set({ isHydrating: true });
    try {
      const [
        uploads,
        chunks,
        extractions,
        questionAnswers,
        extractedSignals,
        problemDiagnostics,
        problemDiagnosticNarrative,
      ] = await Promise.all([
        storage.listUploads(modelId),
        storage.listChunksForModel(modelId),
        storage.listExtractions(modelId),
        storage.listQuestionAnswers(modelId),
        storage.listExtractedSignals(modelId),
        storage.listProblemDiagnostics(modelId),
        storage.getProblemDiagnosticNarrative(modelId),
      ]);
      set({
        hydratedForModelId: modelId,
        uploads,
        chunks,
        extractions,
        questionAnswers,
        extractedSignals,
        problemDiagnostics,
        problemDiagnosticNarrative: problemDiagnosticNarrative || null,
        isHydrating: false,
      });
    } catch (err) {
      console.error('[captureStore] hydrate failed', err);
      set({ isHydrating: false });
    }
  },

  clear: () => {
    set({
      hydratedForModelId: null,
      uploads: [],
      chunks: [],
      extractions: [],
      questionAnswers: [],
      extractedSignals: [],
      problemDiagnostics: [],
      problemDiagnosticNarrative: null,
      inFlightJobs: 0,
    });
  },

  // ---------- Uploads ----------

  addUpload: async ({ modelId, workshopId, kind, file }) => {
    const contentHash = await sha256(file);
    const existing = get().uploads.find(
      (u) =>
        u.modelId === modelId &&
        u.workshopId === workshopId &&
        u.contentHash === contentHash
    );
    if (existing) return { upload: existing, duplicate: true };

    const id = uuidv4();
    const upload: Upload = {
      id,
      modelId,
      workshopId,
      kind,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      blobKey: id,
      contentHash,
      status: 'uploaded',
      uploadedAt: new Date(),
    };
    await storage.saveUpload(upload, file);
    set((state) => ({ uploads: [...state.uploads, upload] }));
    return { upload, duplicate: false };
  },

  updateUpload: async (id, updates) => {
    await storage.updateUpload(id, updates);
    set((state) => ({
      uploads: state.uploads.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }));
  },

  removeUpload: async (id) => {
    await storage.deleteUpload(id);
    set((state) => ({
      uploads: state.uploads.filter((u) => u.id !== id),
      chunks: state.chunks.filter((c) => c.uploadId !== id),
      extractions: state.extractions.filter((e) => e.uploadId !== id),
      questionAnswers: state.questionAnswers.filter((q) => q.uploadId !== id),
      extractedSignals: state.extractedSignals.filter((s) => s.uploadId !== id),
    }));
  },

  setUploadStatus: async (id, status, error) => {
    const updates: Partial<Upload> = { status };
    if (error !== undefined) updates.error = error;
    if (status === 'parsed') updates.parsedAt = new Date();
    if (status === 'ready') updates.chunkedAt = new Date();
    await get().updateUpload(id, updates);
  },

  setUploadParsedText: async (id, parsedText) => {
    await get().updateUpload(id, {
      parsedText,
      status: 'parsed',
      parsedAt: new Date(),
    });
  },

  // ---------- Chunks ----------

  saveChunks: async (chunks) => {
    await storage.saveChunks(chunks);
    set((state) => {
      // Replace chunks for any uploadIds present in the incoming batch so
      // re-chunking is idempotent.
      const incomingUploadIds = new Set(chunks.map((c) => c.uploadId));
      const kept = state.chunks.filter((c) => !incomingUploadIds.has(c.uploadId));
      return { chunks: [...kept, ...chunks] };
    });
  },

  // ---------- Extractions ----------

  startExtraction: async ({ modelId, uploadId, kind, promptVersion, modelName }) => {
    const extraction: Extraction = {
      id: uuidv4(),
      modelId,
      uploadId,
      kind,
      promptVersion,
      modelName,
      status: 'running',
      startedAt: new Date(),
    };
    await storage.saveExtraction(extraction);
    set((state) => ({
      extractions: [...state.extractions, extraction],
      inFlightJobs: state.inFlightJobs + 1,
    }));
    return extraction;
  },

  finishExtraction: async (id, status, opts) => {
    const updates: Partial<Extraction> = {
      status,
      completedAt: new Date(),
    };
    if (opts?.error !== undefined) updates.error = opts.error;
    if (opts?.outputCount !== undefined) updates.outputCount = opts.outputCount;
    await storage.updateExtraction(id, updates);
    set((state) => ({
      extractions: state.extractions.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
      inFlightJobs: Math.max(0, state.inFlightJobs - 1),
    }));
  },

  // ---------- Outputs ----------

  saveQuestionAnswers: async (answers) => {
    await storage.saveQuestionAnswers(answers);
    set((state) => ({
      questionAnswers: [...state.questionAnswers, ...answers],
    }));
  },

  updateQuestionAnswer: async (id, updates) => {
    await storage.updateQuestionAnswer(id, updates);
    set((state) => ({
      questionAnswers: state.questionAnswers.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    }));
  },

  saveExtractedSignals: async (signals) => {
    await storage.saveExtractedSignals(signals);
    set((state) => ({
      extractedSignals: [...state.extractedSignals, ...signals],
    }));
  },

  updateExtractedSignal: async (id, updates) => {
    await storage.updateExtractedSignal(id, updates);
    set((state) => ({
      extractedSignals: state.extractedSignals.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },

  // ---------- Problem diagnostics ----------

  replaceProblemDiagnostics: async (modelId, rows) => {
    await storage.clearProblemDiagnostics(modelId);
    if (rows.length) await storage.saveProblemDiagnostics(rows);
    set((state) => ({
      problemDiagnostics:
        state.hydratedForModelId === modelId ? rows : state.problemDiagnostics,
    }));
  },

  upsertProblemDiagnostics: async (rows) => {
    if (rows.length === 0) return;
    await storage.saveProblemDiagnostics(rows);
    set((state) => {
      const byId = new Map(state.problemDiagnostics.map((r) => [r.id, r]));
      for (const r of rows) byId.set(r.id, r);
      return { problemDiagnostics: Array.from(byId.values()) };
    });
  },

  updateProblemDiagnostic: async (id, updates) => {
    const next: Partial<ProblemDiagnostic> = { ...updates, updatedAt: new Date() };
    await storage.updateProblemDiagnostic(id, next);
    set((state) => ({
      problemDiagnostics: state.problemDiagnostics.map((r) =>
        r.id === id ? { ...r, ...next } : r
      ),
    }));
  },

  clearProblemDiagnostics: async (modelId) => {
    await storage.clearProblemDiagnostics(modelId);
    set((state) => ({
      problemDiagnostics:
        state.hydratedForModelId === modelId ? [] : state.problemDiagnostics,
    }));
  },

  setProblemDiagnosticNarrative: async (narrative) => {
    await storage.saveProblemDiagnosticNarrative(narrative);
    set((state) => ({
      problemDiagnosticNarrative:
        state.hydratedForModelId === narrative.modelId
          ? narrative
          : state.problemDiagnosticNarrative,
    }));
  },

  clearProblemDiagnosticNarrative: async (modelId) => {
    await storage.clearProblemDiagnosticNarrative(modelId);
    set((state) => ({
      problemDiagnosticNarrative:
        state.hydratedForModelId === modelId
          ? null
          : state.problemDiagnosticNarrative,
    }));
  },

  // ---------- In-flight counter ----------

  incrementInFlight: () => set((s) => ({ inFlightJobs: s.inFlightJobs + 1 })),
  decrementInFlight: () =>
    set((s) => ({ inFlightJobs: Math.max(0, s.inFlightJobs - 1) })),
}));

/**
 * Selector hook: does this model have at least one classified problem?
 * Returns `false` until hydration completes for the requested modelId
 * (avoids flicker-enabled in the header before IndexedDB has answered).
 *
 * Used to gate the Informed Landscape step in `AppHeader` /
 * `StepProgress`.
 */
export function useHasDiagnostics(modelId: string | undefined | null): boolean {
  return useCaptureStore((s) => {
    if (!modelId) return false;
    if (s.hydratedForModelId !== modelId) return false;
    return s.problemDiagnostics.length > 0;
  });
}
