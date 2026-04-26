'use client';

/**
 * SignalReview (Step 3 — Review Findings).
 *
 * Per-row Accept / Edit / Reject for everything extracted from
 * transcripts. Two sections:
 *   - Findings: problems / needs / opportunities / gaps. These are the
 *     four canonical SignalTypes and feed downstream tools (Problem
 *     Diagnostics, etc.) once promoted.
 *   - Evidence: jtbd / initiative / wishlist / quote. Useful context but
 *     never promoted to the curated landscape.
 *
 * Curate / Apply / Promote are NOT exposed here anymore. Step 4 (Problem
 * Diagnostics) runs the dedupe + promote pipeline silently as part of
 * Run Diagnostics, so the user only ever clicks one button to get from
 * accepted findings to a diagnostic report.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Check,
  CheckCheck,
  X,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useCaptureStore } from '@/lib/captureStore';
import { ConfidenceLegend } from './ConfidenceLegend';
import type { ExtractedSignal, ExtractedSignalType } from '@/lib/types';

const TYPE_LABELS: Record<ExtractedSignalType, string> = {
  problem: 'Problems',
  jtbd: 'Jobs-to-be-Done',
  need: 'Needs',
  opportunity: 'Opportunities',
  gap: 'Gaps',
  initiative: 'Initiatives',
  wishlist: 'Wishlist',
  quote: 'Quotes',
};

/** Promotable to model.signals (the curated landscape). */
const FINDING_TYPES: ExtractedSignalType[] = ['problem', 'need', 'opportunity', 'gap'];
/** Evidence-only — surfaced for reading, never promoted. */
const EVIDENCE_TYPES: ExtractedSignalType[] = ['jtbd', 'initiative', 'wishlist', 'quote'];

interface Contradiction {
  statementIds: string[];
  summary: string;
  severity: 'hard' | 'soft';
}

interface Props {
  modelId: string;
  apiKey: string;
}

export function SignalReview({
  modelId,
  apiKey,
}: Props) {
  const extractedSignals = useCaptureStore((s) => s.extractedSignals);
  const uploads = useCaptureStore((s) => s.uploads);
  const updateExtractedSignal = useCaptureStore((s) => s.updateExtractedSignal);

  const signalsForModel = useMemo(
    () => extractedSignals.filter((s) => s.modelId === modelId && !s.dismissedAt),
    [extractedSignals, modelId]
  );

  const uploadById = useMemo(() => {
    const m = new Map(uploads.map((u) => [u.id, u]));
    return m;
  }, [uploads]);

  const grouped = useMemo(() => {
    const by: Partial<Record<ExtractedSignalType, ExtractedSignal[]>> = {};
    for (const s of signalsForModel) {
      (by[s.type] ||= []).push(s);
    }
    return by;
  }, [signalsForModel]);

  const [openTypes, setOpenTypes] = useState<Set<ExtractedSignalType>>(
    () => new Set([...FINDING_TYPES, ...EVIDENCE_TYPES])
  );

  const acceptedSignals = useMemo(
    () => signalsForModel.filter((s) => !!s.promotedToSignalId),
    [signalsForModel]
  );

  // ---------- Contradictions ----------

  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [detectingContradictions, setDetectingContradictions] = useState(false);
  const [contradictionError, setContradictionError] = useState<string | null>(null);

  const detectContradictions = useCallback(async () => {
    if (acceptedSignals.length < 2) {
      setContradictionError('Need at least 2 accepted signals to check for contradictions.');
      return;
    }
    setContradictionError(null);
    setDetectingContradictions(true);
    try {
      const resp = await fetch('/api/detect-contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          statements: acceptedSignals.map((s) => {
            const u = uploadById.get(s.uploadId);
            return {
              id: s.id,
              text: s.text,
              source: u ? `${u.filename} · ${TYPE_LABELS[s.type]}` : TYPE_LABELS[s.type],
            };
          }),
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Detection failed' }));
        throw new Error(err.error || 'Detection failed');
      }
      const body = (await resp.json()) as { contradictions: Contradiction[] };
      setContradictions(body.contradictions);
    } catch (err) {
      setContradictionError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setDetectingContradictions(false);
    }
  }, [acceptedSignals, apiKey, uploadById]);

  // ---------- Actions ----------

  const handleAccept = async (signal: ExtractedSignal) => {
    // Stamp a provisional id so the signal is queued for the silent
    // curate-and-promote pipeline that runs from Step 4.
    await updateExtractedSignal(signal.id, {
      promotedToSignalId: signal.promotedToSignalId || `accepted-${signal.id}`,
    });
  };

  /**
   * Bulk-accept every unaccepted signal in a list. Already-accepted rows
   * are skipped so the operation is idempotent. Used by per-section
   * "Accept all" and the top-bar "Accept all findings" button.
   */
  const handleAcceptMany = async (signals: ExtractedSignal[]) => {
    const todo = signals.filter((s) => !s.promotedToSignalId);
    if (todo.length === 0) return;
    await Promise.all(
      todo.map((s) =>
        updateExtractedSignal(s.id, {
          promotedToSignalId: `accepted-${s.id}`,
        })
      )
    );
  };

  const handleReject = async (signal: ExtractedSignal) => {
    await updateExtractedSignal(signal.id, { dismissedAt: new Date() });
  };

  const handleEdit = async (signal: ExtractedSignal, nextText: string) => {
    const trimmed = nextText.trim();
    if (!trimmed || trimmed === signal.text) return;
    await updateExtractedSignal(signal.id, { text: trimmed });
  };

  const toggleType = (t: ExtractedSignalType) => {
    setOpenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  if (signalsForModel.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-lg border"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)', color: 'var(--fg-3)' }}
      >
        <p className="text-sm">No extracted signals yet. Upload workshop materials to get started.</p>
      </div>
    );
  }

  const hardContradictions = contradictions.filter((c) => c.severity === 'hard');
  const findingTypesPresent = FINDING_TYPES.filter((t) => (grouped[t]?.length || 0) > 0);
  const evidenceTypesPresent = EVIDENCE_TYPES.filter((t) => (grouped[t]?.length || 0) > 0);

  const acceptedFindings = acceptedSignals.filter((s) => FINDING_TYPES.includes(s.type));

  /** All Findings rows that haven't been accepted or rejected yet. */
  const pendingFindings = useMemo(
    () =>
      signalsForModel.filter(
        (s) => FINDING_TYPES.includes(s.type) && !s.promotedToSignalId
      ),
    [signalsForModel]
  );

  return (
    <div className="space-y-6">
      <ConfidenceLegend />

      {/* Contradictions banner */}
      {hardContradictions.length > 0 && (
        <div
          className="rounded-lg border p-4 flex items-start gap-3"
          style={{
            background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
            borderColor: 'var(--danger)',
          }}
        >
          <AlertTriangle size={20} style={{ color: 'var(--danger)' }} className="mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--fg-1)' }}>
              {hardContradictions.length} hard contradiction{hardContradictions.length > 1 ? 's' : ''} detected
            </p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--fg-2)' }}>
              {hardContradictions.map((c, i) => (
                <li key={i}>• {c.summary}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Stat bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => handleAcceptMany(pendingFindings)}
          disabled={pendingFindings.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--border-1)', color: 'var(--fg-1)', border: '1px solid var(--border-1)' }}
          title={
            pendingFindings.length === 0
              ? 'All findings already accepted or rejected'
              : `Accept all ${pendingFindings.length} pending finding${pendingFindings.length === 1 ? '' : 's'} (Problems, Needs, Opportunities, Gaps)`
          }
        >
          <CheckCheck size={14} />
          Accept all findings{pendingFindings.length > 0 ? ` (${pendingFindings.length})` : ''}
        </button>
        <button
          onClick={detectContradictions}
          disabled={detectingContradictions || acceptedSignals.length < 2}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition-opacity disabled:opacity-50"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--border-1)', color: 'var(--fg-1)' }}
        >
          {detectingContradictions ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <AlertTriangle size={14} />
          )}
          Detect contradictions across accepted
        </button>
        <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
          {acceptedSignals.length} accepted · {acceptedFindings.length} ready to diagnose · {signalsForModel.length - acceptedSignals.length} pending
        </span>
        {contradictionError && (
          <span className="text-xs" style={{ color: 'var(--danger)' }}>
            {contradictionError}
          </span>
        )}
      </div>

      {/* Hint about the silent pipeline */}
      <p className="text-xs italic" style={{ color: 'var(--fg-3)' }}>
        Tip: accepted Problems / Needs / Opportunities / Gaps are deduped
        and promoted automatically when you open the{' '}
        <strong style={{ color: 'var(--fg-2)' }}>Problem Diagnostics</strong>{' '}
        tab — diagnostics run on mount.
      </p>

      {/* Findings section */}
      {findingTypesPresent.length > 0 && (
        <SectionGroup
          title="Findings"
          subtitle="Problems, needs, opportunities, and gaps. Accepted ones flow into the curated landscape when you run diagnostics."
        >
          {findingTypesPresent.map((type) => {
            const group = grouped[type] || [];
            const open = openTypes.has(type);
            return (
              <TypeSection
                key={type}
                type={type}
                group={group}
                open={open}
                onToggle={() => toggleType(type)}
                uploadById={uploadById}
                onAccept={handleAccept}
                onAcceptAll={() => handleAcceptMany(group)}
                onReject={handleReject}
                onEdit={handleEdit}
              />
            );
          })}
        </SectionGroup>
      )}

      {/* Evidence section */}
      {evidenceTypesPresent.length > 0 && (
        <SectionGroup
          title="Evidence"
          subtitle="Useful supporting material from transcripts. Doesn't enter the curated landscape — kept here for reference."
        >
          {evidenceTypesPresent.map((type) => {
            const group = grouped[type] || [];
            const open = openTypes.has(type);
            return (
              <TypeSection
                key={type}
                type={type}
                group={group}
                open={open}
                onToggle={() => toggleType(type)}
                uploadById={uploadById}
                onAccept={handleAccept}
                onAcceptAll={() => handleAcceptMany(group)}
                onReject={handleReject}
                onEdit={handleEdit}
              />
            );
          })}
        </SectionGroup>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function SectionGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold" style={{ color: 'var(--fg-1)' }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
          {subtitle}
        </p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TypeSection({
  type,
  group,
  open,
  onToggle,
  uploadById,
  onAccept,
  onAcceptAll,
  onReject,
  onEdit,
}: {
  type: ExtractedSignalType;
  group: ExtractedSignal[];
  open: boolean;
  onToggle: () => void;
  uploadById: Map<string, { filename: string }>;
  onAccept: (s: ExtractedSignal) => void;
  onAcceptAll: () => void;
  onReject: (s: ExtractedSignal) => void;
  onEdit: (s: ExtractedSignal, next: string) => void;
}) {
  const pendingCount = group.filter((s) => !s.promotedToSignalId).length;
  return (
    <section
      className="rounded-lg border"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <h3 className="text-sm font-bold flex-1" style={{ color: 'var(--fg-1)' }}>
            {TYPE_LABELS[type]} · {group.length}
          </h3>
        </button>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAcceptAll();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--border-1)',
              color: 'var(--fg-1)',
            }}
            title={`Accept all ${pendingCount} pending ${TYPE_LABELS[type].toLowerCase()}`}
          >
            <CheckCheck size={12} />
            Accept all ({pendingCount})
          </button>
        )}
      </header>
      {open && (
        <ul className="divide-y" style={{ borderColor: 'var(--border-1)' }}>
          {group.map((s) => (
            <SignalRow
              key={s.id}
              signal={s}
              sourceLabel={uploadById.get(s.uploadId)?.filename || 'Unknown upload'}
              onAccept={() => onAccept(s)}
              onReject={() => onReject(s)}
              onEdit={(next) => onEdit(s, next)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SignalRow({
  signal,
  sourceLabel,
  onAccept,
  onReject,
  onEdit,
}: {
  signal: ExtractedSignal;
  sourceLabel: string;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (nextText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(signal.text);

  const accepted = !!signal.promotedToSignalId;
  // A real Signal.id (vs the provisional 'accepted-...' stamp) means the
  // silent promote pipeline has already turned this row into a curated
  // landscape entry.
  const inLandscape =
    accepted && !signal.promotedToSignalId?.startsWith('accepted-');

  const confidenceColor =
    signal.confidence === 'high'
      ? 'var(--success)'
      : signal.confidence === 'medium'
      ? 'var(--accent)'
      : 'var(--fg-3)';

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              onEdit(draft);
              setEditing(false);
            }}
            autoFocus
            className="w-full text-sm p-2 rounded border resize-none"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--border-1)',
              color: 'var(--fg-1)',
            }}
            rows={2}
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--fg-1)' }}>
            {signal.text}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: 'var(--fg-3)' }}>
          <span
            className="px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: 'color-mix(in srgb, ' + confidenceColor + ' 12%, transparent)',
              color: confidenceColor,
            }}
          >
            {signal.confidence}
          </span>
          <span>· {sourceLabel}</span>
          {signal.supportingChunkIds.length > 0 && (
            <span>· {signal.supportingChunkIds.length} chunk cite{signal.supportingChunkIds.length > 1 ? 's' : ''}</span>
          )}
          {signal.confidenceReason && (
            <span className="italic truncate" title={signal.confidenceReason}>
              · {signal.confidenceReason}
            </span>
          )}
          {inLandscape && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--success) 12%, transparent)',
                color: 'var(--success)',
              }}
              title="This signal is part of the curated landscape and visible to downstream tools."
            >
              <CheckCircle2 size={10} />
              in landscape
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          title={accepted ? 'Accepted' : 'Accept'}
          onClick={onAccept}
          active={accepted}
          activeColor="var(--success)"
        >
          <Check size={14} />
        </IconButton>
        <IconButton title="Edit" onClick={() => setEditing((v) => !v)}>
          <Pencil size={14} />
        </IconButton>
        <IconButton title="Reject" onClick={onReject} activeColor="var(--danger)">
          <X size={14} />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  children,
  onClick,
  title,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded border transition-colors"
      style={{
        background: active ? activeColor : 'var(--bg-2)',
        color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
        borderColor: 'var(--border-1)',
      }}
    >
      {children}
    </button>
  );
}
