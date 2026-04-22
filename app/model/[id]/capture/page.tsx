'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { StepProgress } from '@/components/StepProgress';
import { Evidence, EvidenceType, ConfidenceLevel } from '@/lib/types';
import { useTheme } from '@/lib/hooks/useTheme';

const DEPARTMENTS = [
  'Marketing',
  'Digital Product',
  'CRM',
  'Sales',
  'Service',
  'Operations',
  'IT/Data',
  'Loyalty',
  'Ecommerce',
  'Retail/On-ground',
];

const SOURCE_TYPES: { value: EvidenceType; label: string }[] = [
  { value: 'interview', label: 'Interview' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'document', label: 'Document' },
  { value: 'quote', label: 'Quote' },
  { value: 'metric', label: 'Metric' },
  { value: 'observation', label: 'Observation / Ethnography' },
  { value: 'artifact', label: 'Artifact' },
];

const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'vtt', 'srt', 'json', 'log', 'rtf'];
const BINARY_EXTENSIONS = ['pdf', 'docx'];
const ALL_EXTENSIONS = [...TEXT_EXTENSIONS, ...BINARY_EXTENSIONS];
const ACCEPT_ATTR = ALL_EXTENSIONS.map((e) => `.${e}`).join(',');
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

function confidenceStyle(confidence: ConfidenceLevel): React.CSSProperties {
  switch (confidence) {
    case 'high':
      return {
        background: 'color-mix(in srgb, var(--success) 14%, transparent)',
        color: 'var(--success)',
        borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
      };
    case 'medium':
      return {
        background: 'color-mix(in srgb, var(--warn) 14%, transparent)',
        color: 'var(--warn)',
        borderColor: 'color-mix(in srgb, var(--warn) 40%, transparent)',
      };
    default:
      return {
        background: 'var(--bg-3)',
        color: 'var(--fg-3)',
        borderColor: 'var(--border-1)',
      };
  }
}

function ConfidencePill({ confidence }: { confidence: ConfidenceLevel }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide font-medium"
      style={confidenceStyle(confidence)}
    >
      {confidence}
    </span>
  );
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

function filenameToSourceName(name: string): string {
  const base = name.replace(/\.[^/.]+$/, '');
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

type FileStatus = 'pending' | 'parsing' | 'extracting' | 'done' | 'error';

interface StagedFile {
  id: string;
  file: File;
  sourceName: string;
  status: FileStatus;
  error?: string;
  recordsExtracted?: number;
}

export default function CapturePage() {
  useTheme();

  const params = useParams();
  const model = useStore((state) => state.model);
  const addEvidence = useStore((state) => state.addEvidence);
  const removeEvidence = useStore((state) => state.removeEvidence);

  const [apiKey, setApiKey] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('openai-api-key') || '' : ''
  );
  const [sourceType, setSourceType] = useState<EvidenceType>('interview');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [pasteSourceName, setPasteSourceName] = useState('');
  const [rawContent, setRawContent] = useState('');

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');

  const evidence = useMemo(() => model?.evidenceRecords || [], [model?.evidenceRecords]);

  const filteredEvidence = useMemo(() => {
    return evidence.filter((e) => {
      if (filterDept !== 'all' && e.department !== filterDept) return false;
      if (filterConfidence !== 'all' && e.confidence !== filterConfidence) return false;
      return true;
    });
  }, [evidence, filterDept, filterConfidence]);

  const stats = useMemo(() => {
    const byDept: Record<string, number> = {};
    const byConfidence: Record<ConfidenceLevel, number> = { high: 0, medium: 0, low: 0 };
    for (const e of evidence) {
      byDept[e.department] = (byDept[e.department] || 0) + 1;
      byConfidence[e.confidence]++;
    }
    return { byDept, byConfidence };
  }, [evidence]);

  const addFilesToStage = useCallback((files: FileList | File[]) => {
    const toAdd: StagedFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const ext = getExtension(file.name);
      if (!ALL_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}: unsupported type (.${ext})`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: exceeds 20MB`);
        continue;
      }
      toAdd.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        sourceName: filenameToSourceName(file.name),
        status: 'pending',
      });
    }
    if (errors.length) {
      setError(errors.join(' · '));
    } else {
      setError(null);
    }
    if (toAdd.length) {
      setStagedFiles((prev) => [...prev, ...toAdd]);
    }
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addFilesToStage(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesToStage(e.target.files);
      e.target.value = '';
    }
  };

  const updateStaged = (id: string, patch: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeStaged = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearStaged = () => {
    setStagedFiles((prev) =>
      prev.filter((f) => f.status === 'extracting' || f.status === 'parsing')
    );
  };

  const fileToText = async (file: File): Promise<string> => {
    const ext = getExtension(file.name);
    if (TEXT_EXTENSIONS.includes(ext)) {
      return await file.text();
    }
    if (BINARY_EXTENSIONS.includes(ext)) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to parse ${file.name}`);
      return data.text as string;
    }
    throw new Error(`Unsupported extension: .${ext}`);
  };

  const summarizeOne = async (params: {
    sourceName: string;
    content: string;
  }): Promise<Evidence[]> => {
    const res = await fetch('/api/summarize-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        sourceType,
        sourceName: params.sourceName,
        department,
        date,
        rawContent: params.content,
        industry: model?.input.industry,
        knownPersonas: model?.input.personas?.map((p) => p.label).join(', '),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Extraction failed');
    return (data.evidenceRecords as Evidence[]).map((rec) => ({
      ...rec,
      date: rec.date instanceof Date ? rec.date : new Date(rec.date),
    }));
  };

  if (!model || model.id !== params.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Model not found</h1>
          <Link href="/new" className="underline" style={{ color: 'var(--fg-2)' }}>
            Create a new model
          </Link>
        </div>
      </div>
    );
  }

  const handleBatchExtract = async () => {
    if (!apiKey.trim()) {
      setError('Enter your OpenAI API key.');
      return;
    }

    const hasPaste = rawContent.trim().length > 0;
    const filesToProcess = stagedFiles.filter(
      (f) => f.status === 'pending' || f.status === 'error'
    );

    if (!hasPaste && filesToProcess.length === 0) {
      setError('Drop files or paste content before extracting.');
      return;
    }

    if (hasPaste && !pasteSourceName.trim()) {
      setError('Give the pasted content a source name.');
      return;
    }

    setError(null);
    setIsBatchRunning(true);

    if (typeof window !== 'undefined') {
      localStorage.setItem('openai-api-key', apiKey);
    }

    for (const sf of filesToProcess) {
      updateStaged(sf.id, { status: 'parsing', error: undefined });
      try {
        const text = await fileToText(sf.file);
        updateStaged(sf.id, { status: 'extracting' });
        const records = await summarizeOne({ sourceName: sf.sourceName, content: text });
        for (const rec of records) {
          const { id: _ignored, ...withoutId } = rec;
          void _ignored;
          addEvidence(withoutId);
        }
        updateStaged(sf.id, { status: 'done', recordsExtracted: records.length });
      } catch (e) {
        updateStaged(sf.id, {
          status: 'error',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    if (hasPaste) {
      try {
        const records = await summarizeOne({ sourceName: pasteSourceName, content: rawContent });
        for (const rec of records) {
          const { id: _ignored, ...withoutId } = rec;
          void _ignored;
          addEvidence(withoutId);
        }
        setPasteSourceName('');
        setRawContent('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Pasted content failed to extract');
      }
    }

    setIsBatchRunning(false);
  };

  const pendingFileCount = stagedFiles.filter(
    (f) => f.status === 'pending' || f.status === 'error'
  ).length;
  const hasPaste = rawContent.trim().length > 0;
  const canExtract = !isBatchRunning && (pendingFileCount > 0 || hasPaste);

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-1)',
    color: 'var(--fg-1)',
    border: '1px solid var(--border-1)',
    borderRadius: 'var(--r-md)',
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
    >
      <StepProgress
        currentStep="capture"
        modelId={model.id}
        signalsCount={model.signals?.length || 0}
        hasDiscoveryBundle={!!model.discoveryBundle}
      />

      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-medium">Evidence Capture</h1>
            <p className="mt-2 text-sm max-w-2xl" style={{ color: 'var(--fg-2)' }}>
              Drop interview transcripts, workshop notes, research docs, or ethnography
              files. Each atomic idea becomes a cited Evidence record.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left column — capture form */}
            <div className="lg:col-span-2">
              <div className="card sticky top-4">
                <h2 className="text-lg font-medium mb-4">Extract Sources</h2>

                {/* Batch metadata */}
                <div
                  className="space-y-4 mb-5 pb-5"
                  style={{ borderBottom: '1px solid var(--border-1)' }}
                >
                  <div>
                    <span className="eyebrow mb-1 block">OpenAI API Key</span>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="eyebrow mb-1 block">Source Type</span>
                      <select
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value as EvidenceType)}
                        className="w-full px-3 py-2 text-sm focus:outline-none"
                        style={inputStyle}
                      >
                        {SOURCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="eyebrow mb-1 block">Department</span>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-sm focus:outline-none"
                        style={inputStyle}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className="eyebrow mb-1 block">Date (applies to batch)</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-3)' }}>
                    Source type and department apply to every source in this batch. To mix
                    types, run multiple extractions.
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg p-6 text-center cursor-pointer transition-colors"
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-2)'}`,
                    background: isDragging ? 'var(--accent-soft)' : 'var(--bg-1)',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPT_ATTR}
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>
                    {isDragging ? 'Drop files to stage' : 'Drop files or click to browse'}
                  </div>
                  <div className="text-[11px] mt-2" style={{ color: 'var(--fg-3)' }}>
                    PDF, DOCX, TXT, MD, CSV, VTT, SRT, JSON · up to 20MB each
                  </div>
                </div>

                {/* Staged file list */}
                {stagedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="eyebrow">Staged ({stagedFiles.length})</span>
                      <button
                        onClick={clearStaged}
                        className="text-[11px] underline"
                        style={{ color: 'var(--fg-3)' }}
                      >
                        Clear completed
                      </button>
                    </div>
                    {stagedFiles.map((sf) => (
                      <div
                        key={sf.id}
                        className="rounded p-2"
                        style={{
                          background: 'var(--bg-1)',
                          border: '1px solid var(--border-1)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              value={sf.sourceName}
                              onChange={(e) =>
                                updateStaged(sf.id, { sourceName: e.target.value })
                              }
                              disabled={sf.status === 'parsing' || sf.status === 'extracting'}
                              className="w-full px-2 py-1 bg-transparent rounded text-xs focus:outline-none"
                              style={{
                                color: 'var(--fg-1)',
                                border: '1px solid transparent',
                              }}
                            />
                            <div
                              className="text-[10px] ml-2 mt-0.5"
                              style={{ color: 'var(--fg-3)' }}
                            >
                              {sf.file.name} · {(sf.file.size / 1024).toFixed(1)}KB
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {sf.status === 'pending' && (
                              <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
                                queued
                              </span>
                            )}
                            {sf.status === 'parsing' && (
                              <span className="text-[10px]" style={{ color: 'var(--accent)' }}>
                                parsing…
                              </span>
                            )}
                            {sf.status === 'extracting' && (
                              <span className="text-[10px]" style={{ color: 'var(--accent)' }}>
                                extracting…
                              </span>
                            )}
                            {sf.status === 'done' && (
                              <span className="text-[10px]" style={{ color: 'var(--success)' }}>
                                {sf.recordsExtracted} rec
                              </span>
                            )}
                            {sf.status === 'error' && (
                              <span
                                className="text-[10px]"
                                style={{ color: 'var(--danger)' }}
                                title={sf.error}
                              >
                                error
                              </span>
                            )}
                            <button
                              onClick={() => removeStaged(sf.id)}
                              disabled={sf.status === 'parsing' || sf.status === 'extracting'}
                              className="text-xs hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                              style={{ color: 'var(--fg-3)', opacity: 0.7 }}
                              aria-label="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {sf.status === 'error' && sf.error && (
                          <div className="text-[11px] pl-2" style={{ color: 'var(--danger)' }}>
                            {sf.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Paste section */}
                <div
                  className="mt-5 pt-5"
                  style={{ borderTop: '1px solid var(--border-1)' }}
                >
                  <div className="eyebrow mb-2">Or paste a quick note</div>
                  <input
                    type="text"
                    value={pasteSourceName}
                    onChange={(e) => setPasteSourceName(e.target.value)}
                    placeholder="Source name (e.g., Jane Doe, Head of CRM)"
                    className="w-full px-3 py-2 text-sm focus:outline-none mb-2"
                    style={inputStyle}
                  />
                  <textarea
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Paste the transcript, quote, or note…"
                    rows={5}
                    className="w-full px-3 py-2 text-sm focus:outline-none resize-y leading-relaxed"
                    style={{
                      ...inputStyle,
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                {error && (
                  <div
                    className="mt-3 text-sm px-3 py-2 rounded"
                    style={{
                      color: 'var(--danger)',
                      background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  onClick={handleBatchExtract}
                  disabled={!canExtract}
                  className="btn btn--primary w-full mt-4"
                >
                  {isBatchRunning
                    ? 'Running…'
                    : `Extract${
                        pendingFileCount > 0 || hasPaste
                          ? ` (${pendingFileCount + (hasPaste ? 1 : 0)} source${
                              pendingFileCount + (hasPaste ? 1 : 0) === 1 ? '' : 's'
                            })`
                          : ''
                      }`}
                </button>
              </div>
            </div>

            {/* Right column — evidence list */}
            <div className="lg:col-span-3">
              <div className="card">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-medium">
                    Captured Evidence ({evidence.length})
                  </h2>
                  {evidence.length > 0 && (
                    <div className="text-xs" style={{ color: 'var(--fg-3)' }}>
                      <span style={{ color: 'var(--success)' }}>
                        {stats.byConfidence.high} high
                      </span>
                      {' · '}
                      <span style={{ color: 'var(--warn)' }}>
                        {stats.byConfidence.medium} medium
                      </span>
                      {' · '}
                      <span>{stats.byConfidence.low} low</span>
                    </div>
                  )}
                </div>

                {evidence.length > 0 && (
                  <div
                    className="flex flex-wrap gap-3 mb-4 pb-4"
                    style={{ borderBottom: '1px solid var(--border-1)' }}
                  >
                    <select
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      className="px-2 py-1 text-xs focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="all">All departments ({evidence.length})</option>
                      {DEPARTMENTS.filter((d) => stats.byDept[d]).map((d) => (
                        <option key={d} value={d}>
                          {d} ({stats.byDept[d]})
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterConfidence}
                      onChange={(e) => setFilterConfidence(e.target.value)}
                      className="px-2 py-1 text-xs focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="all">All confidence</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                )}

                {evidence.length === 0 && (
                  <div
                    className="text-center py-12 text-sm"
                    style={{ color: 'var(--fg-3)' }}
                  >
                    No evidence captured yet. Drop files or paste content on the left.
                  </div>
                )}

                <div className="space-y-3">
                  {filteredEvidence.map((e) => (
                    <div
                      key={e.id}
                      className="rounded p-4"
                      style={{
                        background: 'var(--bg-1)',
                        border: '1px solid var(--border-1)',
                      }}
                    >
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <div className="min-w-0">
                          <div
                            className="flex items-center gap-2 eyebrow"
                          >
                            <span>{e.type}</span>
                            <span>·</span>
                            <span>{e.department}</span>
                            <span>·</span>
                            <span>{formatDate(e.date)}</span>
                          </div>
                          <div
                            className="text-sm font-medium mt-0.5 truncate"
                            style={{ color: 'var(--fg-1)' }}
                          >
                            {e.source}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <ConfidencePill confidence={e.confidence} />
                          <button
                            onClick={() => removeEvidence(e.id)}
                            className="text-xs transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            aria-label="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-sm mb-2" style={{ color: 'var(--fg-1)' }}>
                        {e.summary}
                      </p>
                      {e.rawText && (
                        <blockquote
                          className="text-xs italic pl-3 py-0.5 mb-2"
                          style={{
                            color: 'var(--fg-2)',
                            borderLeft: '2px solid var(--border-2)',
                          }}
                        >
                          &ldquo;{e.rawText}&rdquo;
                        </blockquote>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {e.tags.map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                        <span
                          className="text-[11px] ml-auto italic"
                          style={{ color: 'var(--fg-3)' }}
                        >
                          {e.confidenceReason}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Link href={`/model/${model.id}/plan`} className="btn btn--ghost btn--sm">
              ← Back to Plan
            </Link>
            <Link href={`/model/${model.id}/signals`} className="btn btn--ghost btn--sm">
              Next: Extract Signals →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
