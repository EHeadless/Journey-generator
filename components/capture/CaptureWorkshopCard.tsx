'use client';

/**
 * CaptureWorkshopCard — one row per Discovery workshop. Drops the user
 * file into the capture pipeline (parse → chunk → embed → extract →
 * backfill), showing status chips and retry. Replaces the inline
 * `WorkshopUploadCard` on the capture page.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Upload as UploadIcon, CheckCircle2, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { useCaptureStore } from '@/lib/captureStore';
import { useStore } from '@/lib/store';
import { runCapturePipeline, type CaptureProgress, type CaptureStep } from '@/lib/extraction/pipeline';
import type { Upload, UploadKind, Workshop } from '@/lib/types';

interface Props {
  workshop: Workshop;
  modelId: string;
  apiKey: string;
}

const STEP_LABEL: Record<CaptureStep, string> = {
  parsing: 'Parsing',
  chunking: 'Chunking',
  embedding: 'Embedding',
  extracting: 'Extracting',
  backfilling: 'Backfilling Q&A',
  done: 'Done',
  failed: 'Failed',
};

export function CaptureWorkshopCard({ workshop, modelId, apiKey }: Props) {
  const uploads = useCaptureStore((s) => s.uploads);
  const addUpload = useCaptureStore((s) => s.addUpload);

  const transcriptUpload = useMemo(
    () =>
      uploads.find(
        (u) => u.workshopId === workshop.id && u.kind === 'transcript'
      ) || null,
    [uploads, workshop.id]
  );
  const notesUpload = useMemo(
    () =>
      uploads.find(
        (u) => u.workshopId === workshop.id && u.kind === 'notes'
      ) || null,
    [uploads, workshop.id]
  );

  const [progressByUpload, setProgressByUpload] = useState<Record<string, CaptureProgress>>({});

  const reportProgress = useCallback((p: CaptureProgress) => {
    setProgressByUpload((prev) => ({ ...prev, [p.uploadId]: p }));
  }, []);

  const handleSelect = async (kind: UploadKind, file: File) => {
    if (!apiKey) {
      alert('OpenAI API key is required. Add it in the app header.');
      return;
    }

    const { upload, duplicate } = await addUpload({
      modelId,
      workshopId: workshop.id,
      kind,
      file,
    });
    if (duplicate) {
      setProgressByUpload((prev) => ({
        ...prev,
        [upload.id]: {
          uploadId: upload.id,
          step: 'done',
          message: 'Duplicate file — skipped re-processing.',
        },
      }));
      return;
    }
    void runPipeline(upload);
  };

  const runPipeline = async (upload: Upload) => {
    const workshopQuestions = (useStore.getState().model?.workshopQuestions || []).filter(
      (q) => q.workshopId === workshop.id
    );
    try {
      await runCapturePipeline({
        apiKey,
        modelId,
        upload,
        workshopContext: `${workshop.code ? `${workshop.code}: ` : ''}${workshop.name}`,
        workshopQuestions,
        onProgress: reportProgress,
        store: useCaptureStore.getState(),
      });
    } catch {
      // Pipeline already reports failed via onProgress.
    }
  };

  return (
    <div
      className="glass-pane p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}
    >
      <div className="flex items-start gap-4 mb-6">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {workshop.code || 'W'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--fg-1)' }}>
            {workshop.name}
          </h3>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--fg-3)' }}>
            {workshop.duration && <span>{workshop.duration}</span>}
            {workshop.mode && <span>• {workshop.mode}</span>}
            {workshop.status && <span>• {workshop.status}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CaptureSlot
          label="Transcript"
          description="Upload .txt, .vtt, .srt, .docx, or .pdf"
          accept=".txt,.vtt,.srt,.docx,.doc,.pdf,.md"
          upload={transcriptUpload}
          progress={transcriptUpload ? progressByUpload[transcriptUpload.id] : undefined}
          onSelect={(file) => handleSelect('transcript', file)}
          onRetry={() => transcriptUpload && runPipeline(transcriptUpload)}
        />
        <CaptureSlot
          label="Draft Notes"
          description="Upload .txt, .md, .docx, or .pdf"
          accept=".txt,.md,.docx,.doc,.pdf"
          upload={notesUpload}
          progress={notesUpload ? progressByUpload[notesUpload.id] : undefined}
          onSelect={(file) => handleSelect('notes', file)}
          onRetry={() => notesUpload && runPipeline(notesUpload)}
        />
      </div>
    </div>
  );
}

// ---------- Slot ----------

interface SlotProps {
  label: string;
  description: string;
  accept: string;
  upload: Upload | null;
  progress: CaptureProgress | undefined;
  onSelect: (file: File) => void;
  onRetry: () => void;
}

function CaptureSlot({ label, description, accept, upload, progress, onSelect, onRetry }: SlotProps) {
  const inputId = `capture-slot-${label.replace(/\s+/g, '-').toLowerCase()}-${upload?.id || 'new'}`;
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    e.currentTarget.value = ''; // allow re-selecting the same file
  };

  const step = progress?.step ?? (upload?.status === 'failed' ? 'failed' : null);
  const isActive =
    step === 'parsing' ||
    step === 'chunking' ||
    step === 'embedding' ||
    step === 'extracting' ||
    step === 'backfilling';
  const isFailed = step === 'failed' || upload?.status === 'failed';
  const isDone = step === 'done' || (upload?.status === 'ready' && !isActive);

  const borderColor = isFailed
    ? 'var(--danger)'
    : isDone
    ? 'var(--success)'
    : upload
    ? 'var(--accent)'
    : 'var(--border-1)';

  return (
    <div
      className="relative rounded-lg border-2 border-dashed p-6 text-center transition-all cursor-pointer"
      style={{
        background: upload
          ? 'color-mix(in srgb, var(--accent) 4%, transparent)'
          : 'var(--bg-2)',
        borderColor,
        opacity: dragOver ? 0.85 : 1,
      }}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => document.getElementById(inputId)?.click()}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
      />

      {upload ? (
        <UploadRow upload={upload} progress={progress} onRetry={onRetry} />
      ) : (
        <EmptyRow label={label} description={description} />
      )}
    </div>
  );
}

function EmptyRow({ label, description }: { label: string; description: string }) {
  return (
    <>
      <UploadIcon size={32} className="mx-auto mb-3" style={{ color: 'var(--fg-3)' }} />
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--fg-1)' }}>
        {label}
      </p>
      <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
        {description}
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--fg-3)' }}>
        Click or drag to upload
      </p>
    </>
  );
}

function UploadRow({
  upload,
  progress,
  onRetry,
}: {
  upload: Upload;
  progress: CaptureProgress | undefined;
  onRetry: () => void;
}) {
  const step = progress?.step ?? (upload.status === 'failed' ? 'failed' : null);
  const isActive =
    step === 'parsing' ||
    step === 'chunking' ||
    step === 'embedding' ||
    step === 'extracting' ||
    step === 'backfilling';
  const isFailed = step === 'failed' || upload.status === 'failed';

  let Icon = CheckCircle2;
  let iconColor = 'var(--success)';
  if (isActive) {
    Icon = Loader2;
    iconColor = 'var(--accent)';
  } else if (isFailed) {
    Icon = AlertTriangle;
    iconColor = 'var(--danger)';
  }

  const statusLabel = step
    ? step === 'extracting' && progress?.extractorsTotal
      ? `${STEP_LABEL.extracting} (${progress.extractorsDone ?? 0}/${progress.extractorsTotal})`
      : STEP_LABEL[step]
    : upload.status;

  return (
    <>
      <Icon
        size={32}
        className={`mx-auto mb-3 ${isActive ? 'animate-spin' : ''}`}
        style={{ color: iconColor }}
      />
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--fg-1)' }}>
        {upload.filename}
      </p>
      <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
        {(upload.fileSize / 1024).toFixed(1)} KB · {statusLabel}
      </p>
      {progress?.message && (
        <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
          {progress.message}
        </p>
      )}
      {isFailed && (progress?.error || upload.error) && (
        <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
          {progress?.error || upload.error}
        </p>
      )}
      {isFailed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="mt-3 inline-flex items-center gap-1 text-xs underline"
          style={{ color: 'var(--fg-2)' }}
        >
          <RotateCcw size={12} /> Retry
        </button>
      )}
    </>
  );
}

// ---------- Hook: hydrate capture store when page mounts ----------

export function useHydratedCaptureStore(modelId: string) {
  const hydrate = useCaptureStore((s) => s.hydrate);
  const hydratedFor = useCaptureStore((s) => s.hydratedForModelId);
  useEffect(() => {
    if (hydratedFor !== modelId) {
      void hydrate(modelId);
    }
  }, [modelId, hydratedFor, hydrate]);
}
