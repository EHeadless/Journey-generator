'use client';

/**
 * BulkZipUpload — drop a zip, auto-match each contained file to a Discovery
 * workshop + slot (transcript/notes) by filename fuzziness, then run the
 * same capture pipeline used by CaptureWorkshopCard. Sequential processing
 * to stay polite with the OpenAI API.
 */

import { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  FolderArchive,
  Loader2,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useCaptureStore } from '@/lib/captureStore';
import { useStore } from '@/lib/store';
import {
  runCapturePipeline,
  type CaptureProgress,
  type CaptureStep,
} from '@/lib/extraction/pipeline';
import type { UploadKind, Workshop, WorkshopQuestion } from '@/lib/types';

interface Props {
  modelId: string;
  workshops: Workshop[];
  apiKey: string;
}

type RowStatus =
  | { kind: 'ready' }
  | { kind: 'running'; step: CaptureStep; message?: string }
  | { kind: 'done'; message?: string }
  | { kind: 'failed'; error: string }
  | { kind: 'skipped' };

interface ZipRow {
  id: string;
  filename: string;
  sizeBytes: number;
  file: File;
  workshopId: string | '';
  slot: UploadKind;
  status: RowStatus;
  matchScore: number;
}

const SUPPORTED_EXT = /\.(txt|md|vtt|srt|pdf|docx?|rtf)$/i;

/**
 * Format priority for the zip-dedupe pass. Lower = preferred. When a zip
 * contains both `WorkshopA.txt` and `WorkshopA.pdf` (same content,
 * different export format) we keep the cleanest source — txt wins,
 * pdf loses, because the pdf re-flow / OCR layer adds noise the txt
 * already avoided.
 */
const FORMAT_PRIORITY: Record<string, number> = {
  txt: 1,
  md: 2,
  vtt: 3,
  srt: 4,
  docx: 5,
  doc: 6,
  rtf: 7,
  pdf: 8,
};

function getExt(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
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

const STOPWORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'this',
  'that',
  'workshop',
  'session',
  'meeting',
  'discovery',
  'draft',
  'notes',
  'transcript',
  'recording',
  'digitas',
  'client',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function guessSlot(filename: string): UploadKind {
  const n = filename.toLowerCase();
  if (/\b(notes?|draft|summary|recap|minutes)\b/.test(n)) return 'notes';
  if (/\b(transcript|recording)\b|\.(vtt|srt)$/.test(n)) return 'transcript';
  return 'transcript';
}

function scoreMatch(
  filename: string,
  workshop: Workshop,
  questions: WorkshopQuestion[]
): number {
  const norm = normalize(filename);
  let score = 0;

  const code = (workshop.code || '').toLowerCase().trim();
  if (code) {
    const codeRe = new RegExp(`(^|\\W)${escapeRegex(code)}(\\W|$)`);
    if (codeRe.test(norm)) score += 20;
  }

  const fileTokens = new Set(norm.split(/\s+/).filter((t) => t.length >= 4));
  const nameTokens = tokenize(workshop.name || '');
  for (const t of nameTokens) {
    if (fileTokens.has(t)) score += 3;
  }

  // Weaker signal: question text tokens that overlap
  const qTokens = new Set<string>();
  for (const q of questions) {
    for (const t of tokenize(q.text || '')) qTokens.add(t);
  }
  let qHits = 0;
  for (const t of fileTokens) {
    if (qTokens.has(t)) qHits += 1;
  }
  score += Math.min(qHits, 3); // cap so filename signal still wins

  return score;
}

function pickWorkshop(
  filename: string,
  workshops: Workshop[],
  questionsByWorkshop: Map<string, WorkshopQuestion[]>
): { id: string; score: number } {
  let best = { id: '', score: 0 };
  for (const w of workshops) {
    const s = scoreMatch(filename, w, questionsByWorkshop.get(w.id) || []);
    if (s > best.score) best = { id: w.id, score: s };
  }
  return best;
}

export function BulkZipUpload({ modelId, workshops, apiKey }: Props) {
  const addUpload = useCaptureStore((s) => s.addUpload);

  const [rows, setRows] = useState<ZipRow[]>([]);
  const [isUnzipping, setIsUnzipping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zipName, setZipName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleZip = async (zipFile: File) => {
    if (workshops.length === 0) {
      alert('No Discovery workshops to match against. Create workshops first.');
      return;
    }
    setIsUnzipping(true);
    setZipName(zipFile.name);
    try {
      const zip = await JSZip.loadAsync(zipFile);

      // Pre-build the workshop-questions index for fuzzy matching.
      const allQuestions = useStore.getState().model?.workshopQuestions || [];
      const qByWorkshop = new Map<string, WorkshopQuestion[]>();
      for (const q of allQuestions) {
        const list = qByWorkshop.get(q.workshopId) || [];
        list.push(q);
        qByWorkshop.set(q.workshopId, list);
      }

      const newRows: ZipRow[] = [];
      const entries = Object.values(zip.files);
      for (const entry of entries) {
        if (entry.dir) continue;
        const fullName = entry.name;
        // Skip macOS resource-fork junk and hidden dot files.
        if (/__MACOSX|\.DS_Store|\._/i.test(fullName)) continue;
        const base = fullName.split('/').pop() || fullName;
        if (!SUPPORTED_EXT.test(base)) continue;

        const blob = await entry.async('blob');
        const file = new File([blob], base, {
          type: blob.type || 'application/octet-stream',
        });

        const match = pickWorkshop(base, workshops, qByWorkshop);
        newRows.push({
          id: `${fullName}-${newRows.length}`,
          filename: base,
          sizeBytes: file.size,
          file,
          workshopId: match.id,
          slot: guessSlot(base),
          status: { kind: 'ready' },
          matchScore: match.score,
        });
      }

      // Dedupe: when the zip carries both `Workshop.txt` and `Workshop.pdf`
      // (same content, different export format) we'd otherwise process the
      // same workshop twice. Group by `(normalizedBaseName, slot)` and keep
      // the row whose extension scores best in FORMAT_PRIORITY. The `slot`
      // is part of the key so a transcript+notes pair on the same workshop
      // still produces two rows.
      const dedupedByKey = new Map<string, ZipRow>();
      const droppedDupes: string[] = [];
      for (const row of newRows) {
        const key = `${normalize(row.filename)}::${row.slot}`;
        const existing = dedupedByKey.get(key);
        if (!existing) {
          dedupedByKey.set(key, row);
          continue;
        }
        const existingPriority =
          FORMAT_PRIORITY[getExt(existing.filename)] ?? 99;
        const candidatePriority =
          FORMAT_PRIORITY[getExt(row.filename)] ?? 99;
        if (candidatePriority < existingPriority) {
          droppedDupes.push(existing.filename);
          dedupedByKey.set(key, row);
        } else {
          droppedDupes.push(row.filename);
        }
      }
      const dedupedRows = Array.from(dedupedByKey.values());

      if (dedupedRows.length === 0) {
        alert(
          'No supported files found in the zip. Expected .txt, .md, .vtt, .srt, .pdf, or .docx.'
        );
      } else if (droppedDupes.length > 0) {
        console.info(
          `[BulkZipUpload] Dropped ${droppedDupes.length} duplicate file(s) sharing a workshop name with a higher-priority format:`,
          droppedDupes
        );
      }
      setRows(dedupedRows);
    } catch (e) {
      alert(`Failed to read zip: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setIsUnzipping(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ZipRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const resetAll = () => {
    setRows([]);
    setZipName(null);
  };

  const processAll = async () => {
    if (!apiKey.trim()) {
      alert('OpenAI API key is required. Add it in the app header.');
      return;
    }
    const toRun = rows.filter((r) => r.workshopId && r.status.kind === 'ready');
    if (toRun.length === 0) {
      alert('Nothing to process. Assign a workshop to each row, or import a different zip.');
      return;
    }

    setIsProcessing(true);
    try {
      for (const row of toRun) {
        const workshop = workshops.find((w) => w.id === row.workshopId);
        if (!workshop) {
          updateRow(row.id, {
            status: { kind: 'failed', error: 'Workshop not found' },
          });
          continue;
        }

        updateRow(row.id, {
          status: { kind: 'running', step: 'parsing' },
        });

        try {
          const { upload, duplicate } = await addUpload({
            modelId,
            workshopId: workshop.id,
            kind: row.slot,
            file: row.file,
          });

          if (duplicate) {
            updateRow(row.id, {
              status: {
                kind: 'done',
                message: 'Duplicate — already processed',
              },
            });
            continue;
          }

          const workshopQuestions = (
            useStore.getState().model?.workshopQuestions || []
          ).filter((q) => q.workshopId === workshop.id);

          await runCapturePipeline({
            apiKey,
            modelId,
            upload,
            workshopContext: `${workshop.code ? `${workshop.code}: ` : ''}${workshop.name}`,
            workshopQuestions,
            onProgress: (p: CaptureProgress) => {
              if (p.step === 'done') {
                updateRow(row.id, {
                  status: { kind: 'done', message: p.message },
                });
              } else if (p.step === 'failed') {
                updateRow(row.id, {
                  status: { kind: 'failed', error: p.error || 'Pipeline failed' },
                });
              } else {
                updateRow(row.id, {
                  status: { kind: 'running', step: p.step, message: p.message },
                });
              }
            },
            store: useCaptureStore.getState(),
          });
        } catch (e) {
          updateRow(row.id, {
            status: {
              kind: 'failed',
              error: e instanceof Error ? e.message : 'Pipeline failed',
            },
          });
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.zip$/i.test(f.name)) void handleZip(f);
  };

  const readyCount = rows.filter(
    (r) => r.workshopId && r.status.kind === 'ready'
  ).length;

  return (
    <div
      className="rounded-lg border mb-6"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}
    >
      <div className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <FolderArchive size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--fg-1)' }}>
              Bulk upload from zip
            </h3>
            <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
              Drop a zip of transcripts and notes. Files are auto-matched to the
              right workshop by filename (code + name + question tokens). Review
              the matches, then process.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div
            className="rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all"
            style={{
              background: dragOver ? 'var(--bg-2)' : 'transparent',
              borderColor: dragOver ? 'var(--accent)' : 'var(--border-1)',
              opacity: isUnzipping ? 0.7 : 1,
            }}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleZip(f);
                e.currentTarget.value = '';
              }}
            />
            {isUnzipping ? (
              <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--fg-2)' }}>
                <Loader2 size={16} className="animate-spin" />
                Reading {zipName}…
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
                Click or drag a <strong>.zip</strong> here
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 text-xs" style={{ color: 'var(--fg-2)' }}>
              <span>
                {zipName} · {rows.length} file{rows.length === 1 ? '' : 's'} ·{' '}
                {readyCount} queued
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ color: 'var(--fg-2)' }}
                >
                  <Trash2 size={12} /> Clear
                </button>
                <button
                  type="button"
                  onClick={processAll}
                  disabled={isProcessing || readyCount === 0 || !apiKey.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    opacity:
                      isProcessing || readyCount === 0 || !apiKey.trim() ? 0.5 : 1,
                  }}
                  title={
                    !apiKey.trim()
                      ? 'Enter your OpenAI API key in the header'
                      : `Process ${readyCount} file(s)`
                  }
                >
                  {isProcessing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  Process all
                </button>
              </div>
            </div>

            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--border-1)' }}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="text-left"
                    style={{
                      background: 'var(--bg-2)',
                      color: 'var(--fg-3)',
                    }}
                  >
                    <th className="px-3 py-2 font-semibold">File</th>
                    <th className="px-3 py-2 font-semibold">Workshop</th>
                    <th className="px-3 py-2 font-semibold">Slot</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <ZipRowItem
                      key={r.id}
                      row={r}
                      workshops={workshops}
                      disabled={isProcessing}
                      onChange={(patch) => updateRow(r.id, patch)}
                      onRemove={() => removeRow(r.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ZipRowItem({
  row,
  workshops,
  disabled,
  onChange,
  onRemove,
}: {
  row: ZipRow;
  workshops: Workshop[];
  disabled: boolean;
  onChange: (patch: Partial<ZipRow>) => void;
  onRemove: () => void;
}) {
  const statusLabel = (() => {
    switch (row.status.kind) {
      case 'ready':
        return row.workshopId ? 'Ready' : 'No match';
      case 'running':
        return row.status.step === 'extracting'
          ? STEP_LABEL.extracting
          : STEP_LABEL[row.status.step];
      case 'done':
        return row.status.message || 'Done';
      case 'failed':
        return row.status.error;
      case 'skipped':
        return 'Skipped';
    }
  })();

  const statusColor = (() => {
    switch (row.status.kind) {
      case 'done':
        return 'var(--success)';
      case 'failed':
        return 'var(--danger)';
      case 'running':
        return 'var(--accent)';
      default:
        return row.workshopId ? 'var(--fg-2)' : 'var(--danger)';
    }
  })();

  const StatusIcon =
    row.status.kind === 'running'
      ? Loader2
      : row.status.kind === 'done'
      ? CheckCircle2
      : row.status.kind === 'failed'
      ? AlertTriangle
      : null;

  return (
    <tr
      style={{
        borderTop: '1px solid var(--border-1)',
        background: 'var(--bg-1)',
      }}
    >
      <td
        className="px-3 py-2 font-mono"
        style={{ color: 'var(--fg-1)', maxWidth: 240 }}
      >
        <div className="truncate" title={row.filename}>
          {row.filename}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
          {(row.sizeBytes / 1024).toFixed(1)} KB · score {row.matchScore}
        </div>
      </td>
      <td className="px-3 py-2">
        <select
          value={row.workshopId}
          disabled={disabled || row.status.kind === 'running' || row.status.kind === 'done'}
          onChange={(e) => onChange({ workshopId: e.target.value })}
          className="w-full text-xs rounded border px-2 py-1"
          style={{
            background: 'var(--bg-2)',
            borderColor: 'var(--border-1)',
            color: 'var(--fg-1)',
          }}
        >
          <option value="">— Skip —</option>
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code ? `${w.code} · ` : ''}
              {w.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={row.slot}
          disabled={disabled || row.status.kind === 'running' || row.status.kind === 'done'}
          onChange={(e) => onChange({ slot: e.target.value as UploadKind })}
          className="text-xs rounded border px-2 py-1"
          style={{
            background: 'var(--bg-2)',
            borderColor: 'var(--border-1)',
            color: 'var(--fg-1)',
          }}
        >
          <option value="transcript">Transcript</option>
          <option value="notes">Notes</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <div
          className="inline-flex items-center gap-1"
          style={{ color: statusColor }}
        >
          {StatusIcon && (
            <StatusIcon
              size={12}
              className={row.status.kind === 'running' ? 'animate-spin' : ''}
            />
          )}
          <span className="truncate" title={statusLabel}>
            {statusLabel}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || row.status.kind === 'running'}
          className="p-1 rounded"
          style={{ color: 'var(--fg-3)' }}
          title="Remove row"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}
