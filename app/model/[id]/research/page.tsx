'use client';

/**
 * Research step — optional supporting evidence layer.
 *
 * Sits between Brief and Hypothesis Landscape. The strategist drops in
 * any number of supporting documents (interview transcripts, ethnography
 * notes, market scans, analyst reports, social listening, competitive
 * teardowns, internal memos). Each document is:
 *
 *   1. Parsed via /api/parse-file → plain text on
 *      Model.input.researchDocuments[i].text (verbatim, no truncation)
 *   2. Optionally summarized via /api/summarize-research-doc → structured
 *      ResearchDocSummary on .summary, used as the *injectable* form
 *      that downstream prompts blend in (the verbatim text remains
 *      reserve for citation needs).
 *
 * The hypothesis landscape generator can then run in five blends:
 * form-only, brief-only, research-only, form+research, everything —
 * each carrying a different evidence cocktail. That's wired up in Step 5.
 *
 * Companion agent doc: `.claude/agents/research-summarizer.md`.
 */

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Loader2,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { AppHeader } from '@/components/AppHeader';
import { useHydratedCaptureStore } from '@/components/capture/CaptureWorkshopCard';
import { useHasDiagnostics } from '@/lib/captureStore';
import { useApiKey } from '@/lib/hooks/useApiKey';
import type { ResearchDocSummary, ResearchDocument } from '@/lib/types';

interface ParseFileResponse {
  text: string;
  filename: string;
  sizeBytes: number;
  charCount: number;
}

export default function ResearchPage() {
  const params = useParams();
  const router = useRouter();
  const modelId = (params?.id as string) || '';

  const model = useStore((s) => s.model);
  const addResearchDocument = useStore((s) => s.addResearchDocument);
  const updateResearchDocument = useStore((s) => s.updateResearchDocument);
  const removeResearchDocument = useStore((s) => s.removeResearchDocument);
  const [apiKey] = useApiKey();
  useHydratedCaptureStore(modelId);
  const hasDiagnostics = useHasDiagnostics(modelId);

  const docs = model?.input.researchDocuments || [];
  const briefDoc = model?.input.briefDocument;
  const journeyPhases = model?.journeyPhases || [];
  const hasJourneyPhases = journeyPhases.length > 0;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [perDocError, setPerDocError] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-summarize newly uploaded docs in sequence so the user doesn't
  // have to click a button per file. Cheap to skip if no API key.
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const newIds: Array<{ id: string; text: string; filename: string }> = [];

    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/parse-file', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Parse failed for ${file.name}`);
        }
        const parsed = (await res.json()) as ParseFileResponse;
        const id = addResearchDocument({
          filename: parsed.filename || file.name,
          text: parsed.text,
          sizeBytes: parsed.sizeBytes,
          uploadedAt: new Date(),
        });
        newIds.push({ id, text: parsed.text, filename: parsed.filename || file.name });
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // Sequentially summarize each new doc — keeps token usage predictable.
    if (apiKey) {
      for (const doc of newIds) {
        await summarizeDoc(doc.id, doc.text, doc.filename);
      }
    }
  };

  const summarizeDoc = async (id: string, text: string, filename: string) => {
    if (!apiKey) {
      setPerDocError((prev) => ({
        ...prev,
        [id]: 'Add your OpenAI key in the header to summarize.',
      }));
      return;
    }
    setSummarizingId(id);
    setPerDocError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const briefContext = briefDoc?.text
        ? briefDoc.text
        : model
        ? `${model.input.businessDescription}\n\nIndustry: ${model.input.industry}`
        : '';

      const res = await fetch('/api/summarize-research-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, text, filename, briefContext }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Summarize failed (${res.status})`);
      }
      const { summary } = (await res.json()) as { summary: ResearchDocSummary };
      updateResearchDocument(id, {
        summary,
        summarizedAt: new Date(),
      });
      setExpanded((prev) => ({ ...prev, [id]: true }));
    } catch (e) {
      setPerDocError((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Summarize failed',
      }));
    } finally {
      setSummarizingId(null);
    }
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!model) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
        <AppHeader modelId={modelId} currentStep="research" />
        <main className="max-w-[860px] mx-auto px-6 py-24 text-center">
          <div className="text-sm" style={{ color: 'var(--fg-2)' }}>
            Loading model…
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <AppHeader
        modelId={modelId}
        currentStep="research"
        signalsCount={model.signals?.length || 0}
        hasDiscoveryBundle={!!model.discoveryBundle}
        hasJourneyPhases={hasJourneyPhases}
        hasDiagnostics={hasDiagnostics}
      />

      <main className="max-w-[860px] mx-auto px-6 pt-16 pb-32">
        {/* Hero */}
        <div className="mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest mb-6"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Sparkles size={12} /> Step 02 · Research (optional)
          </div>
          <h1
            className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-1)' }}
          >
            Bring the supporting <br />
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--accent)',
              }}
              className="pr-2"
            >
              evidence
            </span>
          </h1>
          <p className="text-base leading-relaxed max-w-[600px]" style={{ color: 'var(--fg-2)' }}>
            Drop in any research artifacts the engagement should listen to — interview
            transcripts, ethnography, market scans, analyst reports, social listening
            exports, competitive teardowns, internal memos. Each one is summarized so
            the hypothesis landscape can blend the evidence in. You can skip this step
            and come back any time.
          </p>
        </div>

        {/* Upload affordance */}
        <div
          className="mb-6 p-6 rounded-xl"
          style={{
            background: 'var(--bg-2)',
            border: '1px dashed var(--border-2)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-3)', color: 'var(--fg-2)' }}
            >
              <Upload size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--fg-1)' }}>
                Add research documents
              </div>
              <div className="text-[11px]" style={{ color: 'var(--fg-2)' }}>
                PDF, DOCX, TXT, or Markdown. Multiple files OK. Each is parsed and
                summarized — the verbatim text stays on file so prompts can cite back.
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              onChange={(e) => handleUpload(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all flex-shrink-0"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                opacity: uploading ? 0.6 : 1,
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload
                </>
              )}
            </button>
          </div>
          {!apiKey && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-[11px] font-medium flex items-center gap-2"
              style={{ background: 'var(--bg-3)', color: 'var(--fg-2)' }}
            >
              <AlertCircle size={12} /> Add your OpenAI key in the header to enable
              auto-summarization.
            </div>
          )}
          {uploadError && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-[11px] font-medium"
              style={{ background: 'var(--bg-3)', color: 'var(--danger)' }}
            >
              {uploadError}
            </div>
          )}
        </div>

        {/* Document list */}
        {docs.length === 0 ? (
          <div
            className="mb-10 px-6 py-12 rounded-xl text-center"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)' }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-2"
              style={{ color: 'var(--fg-3)' }}
            >
              No research yet
            </div>
            <div className="text-sm" style={{ color: 'var(--fg-2)' }}>
              Skip ahead to the hypothesis landscape, or upload evidence first to
              ground it in real signals.
            </div>
          </div>
        ) : (
          <div className="mb-10 flex flex-col gap-3">
            {docs.map((doc) => (
              <ResearchDocCard
                key={doc.id}
                doc={doc}
                expanded={!!expanded[doc.id]}
                onToggle={() =>
                  setExpanded((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))
                }
                summarizing={summarizingId === doc.id}
                error={perDocError[doc.id]}
                onSummarize={() => summarizeDoc(doc.id, doc.text, doc.filename)}
                onRemove={() => removeResearchDocument(doc.id)}
                formatBytes={formatBytes}
              />
            ))}
          </div>
        )}

        {/* Continue */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
            {docs.length === 0
              ? 'Research is optional — you can come back any time.'
              : `${docs.length} document${docs.length === 1 ? '' : 's'} on file. ${
                  docs.filter((d) => d.summary).length
                } summarized.`}
          </div>
          <button
            type="button"
            onClick={() => router.push(`/model/${modelId}`)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Continue to landscape <ArrowRight size={14} />
          </button>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Doc card
// ============================================================================

function ResearchDocCard({
  doc,
  expanded,
  onToggle,
  summarizing,
  error,
  onSummarize,
  onRemove,
  formatBytes,
}: {
  doc: ResearchDocument;
  expanded: boolean;
  onToggle: () => void;
  summarizing: boolean;
  error?: string;
  onSummarize: () => void;
  onRemove: () => void;
  formatBytes: (n: number) => string;
}) {
  const summary = doc.summary;
  const hasSummary = !!summary && !!summary.summary;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: hasSummary ? 'var(--accent-soft)' : 'var(--bg-3)',
              color: hasSummary ? 'var(--accent)' : 'var(--fg-2)',
            }}
          >
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-sm font-bold truncate"
              style={{ color: 'var(--fg-1)' }}
              title={doc.filename}
            >
              {doc.filename}
            </div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--fg-3)' }}>
              {formatBytes(doc.sizeBytes)} · {Math.round(doc.text.length / 1000)}k chars
              {summary?.evidenceType ? ` · ${summary.evidenceType}` : ''}
              {hasSummary ? ' · summarized' : ' · not yet summarized'}
            </div>
          </div>
          <div style={{ color: 'var(--fg-3)' }}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onSummarize}
            disabled={summarizing}
            className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5"
            style={{
              background: hasSummary ? 'var(--bg-3)' : 'var(--accent)',
              color: hasSummary ? 'var(--fg-1)' : 'var(--accent-fg)',
              opacity: summarizing ? 0.6 : 1,
              cursor: summarizing ? 'wait' : 'pointer',
            }}
          >
            {summarizing ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Summarizing…
              </>
            ) : hasSummary ? (
              'Re-summarize'
            ) : (
              <>
                <Sparkles size={11} /> Summarize
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--fg-3)' }}
            aria-label="Remove document"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-4 mb-3 px-3 py-2 rounded-lg text-[11px] font-medium"
          style={{ background: 'var(--bg-3)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {/* Summary body */}
      {expanded && (
        <div
          className="px-5 py-4 border-t"
          style={{ borderColor: 'var(--border-1)', background: 'var(--bg-1)' }}
        >
          {hasSummary && summary ? (
            <SummaryView summary={summary} />
          ) : (
            <div className="text-[12px]" style={{ color: 'var(--fg-3)' }}>
              No summary yet. Click <strong>Summarize</strong> above to distill the
              document into structured findings.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryView({ summary }: { summary: ResearchDocSummary }) {
  return (
    <div className="flex flex-col gap-4 text-[12px]" style={{ color: 'var(--fg-1)' }}>
      {summary.headline && (
        <div className="text-[13px] font-bold leading-snug" style={{ color: 'var(--fg-1)' }}>
          {summary.headline}
        </div>
      )}
      {summary.summary && (
        <p className="leading-relaxed" style={{ color: 'var(--fg-2)' }}>
          {summary.summary}
        </p>
      )}

      <SummaryList label="Key findings" items={summary.keyFindings} />
      <SummaryList label="Pains & frictions" items={summary.painsAndFrictions} />
      <SummaryList
        label="Opportunities & hypotheses"
        items={summary.opportunitiesOrHypotheses}
      />

      {(summary.namedSegments?.length || 0) +
        (summary.namedJourneys?.length || 0) >
        0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.namedSegments?.map((s) => (
            <Chip key={`seg-${s}`} label={s} tone="segment" />
          ))}
          {summary.namedJourneys?.map((j) => (
            <Chip key={`jrn-${j}`} label={j} tone="journey" />
          ))}
        </div>
      )}

      {summary.directQuotes && summary.directQuotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: 'var(--fg-3)' }}
          >
            Direct quotes
          </div>
          {summary.directQuotes.map((q, i) => (
            <blockquote
              key={i}
              className="border-l-2 pl-3 italic leading-relaxed"
              style={{ borderColor: 'var(--accent)', color: 'var(--fg-2)' }}
            >
              "{q}"
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="text-[10px] font-black uppercase tracking-widest"
        style={{ color: 'var(--fg-3)' }}
      >
        {label}
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="leading-relaxed pl-4 relative"
            style={{ color: 'var(--fg-2)' }}
          >
            <span
              className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--fg-3)' }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: 'segment' | 'journey' }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{
        background: tone === 'segment' ? 'var(--accent-soft)' : 'var(--bg-3)',
        color: tone === 'segment' ? 'var(--accent)' : 'var(--fg-2)',
      }}
    >
      {label}
    </span>
  );
}
