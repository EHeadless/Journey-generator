'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { StepProgress } from '@/components/StepProgress';
import { Signal, SignalType, ConfidenceLevel, Evidence } from '@/lib/types';
import { useTheme } from '@/lib/hooks/useTheme';

type SignalTypeConfig = {
  key: SignalType;
  label: string;
  hue: string; // base color token or literal
};

const SIGNAL_TYPES: SignalTypeConfig[] = [
  { key: 'problem', label: 'Problems', hue: 'var(--danger)' },
  { key: 'need', label: 'Needs', hue: 'var(--accent)' },
  { key: 'opportunity', label: 'Opportunities', hue: 'var(--success)' },
  { key: 'gap', label: 'Gaps', hue: '#a855f7' },
];

function laneStyle(hue: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${hue} 8%, var(--bg-2))`,
    border: `1px solid color-mix(in srgb, ${hue} 30%, var(--border-1))`,
    borderRadius: 'var(--r-lg)',
  };
}

function laneHeaderStyle(hue: string): React.CSSProperties {
  return {
    color: `color-mix(in srgb, ${hue} 70%, var(--fg-1))`,
  };
}

function confidenceStyle(level: ConfidenceLevel): React.CSSProperties {
  if (level === 'high') {
    return {
      background: 'color-mix(in srgb, var(--success) 16%, transparent)',
      color: 'color-mix(in srgb, var(--success) 70%, var(--fg-1))',
      border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
    };
  }
  if (level === 'medium') {
    return {
      background: 'color-mix(in srgb, var(--warn) 16%, transparent)',
      color: 'color-mix(in srgb, var(--warn) 70%, var(--fg-1))',
      border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
    };
  }
  return {
    background: 'var(--bg-3)',
    color: 'var(--fg-3)',
    border: '1px solid var(--border-1)',
  };
}

function ConfidencePill({ confidence }: { confidence: ConfidenceLevel }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium rounded"
      style={confidenceStyle(confidence)}
    >
      {confidence}
    </span>
  );
}

interface Contradiction {
  signalIds: string[];
  note: string;
}

export default function SignalsPage() {
  const params = useParams();
  const model = useStore((state) => state.model);
  const setSignals = useStore((state) => state.setSignals);
  const removeSignal = useStore((state) => state.removeSignal);
  useTheme();

  const [apiKey, setApiKey] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('openai-api-key') || ''
      : ''
  );
  const [engagementScope, setEngagementScope] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');

  const evidence = useMemo<Evidence[]>(
    () => model?.evidenceRecords || [],
    [model?.evidenceRecords]
  );
  const signals = useMemo<Signal[]>(() => model?.signals || [], [model?.signals]);

  const evidenceById = useMemo(() => {
    const map = new Map<string, Evidence>();
    for (const e of evidence) map.set(e.id, e);
    return map;
  }, [evidence]);

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (filterDept !== 'all' && s.department !== filterDept) return false;
      if (filterConfidence !== 'all' && s.confidence !== filterConfidence) return false;
      return true;
    });
  }, [signals, filterDept, filterConfidence]);

  const signalsByType = useMemo(() => {
    const grouped: Record<SignalType, Signal[]> = {
      problem: [],
      need: [],
      opportunity: [],
      gap: [],
    };
    for (const s of filteredSignals) {
      if (grouped[s.type]) grouped[s.type].push(s);
    }
    return grouped;
  }, [filteredSignals]);

  const departmentsInSignals = useMemo(() => {
    const set = new Set<string>();
    for (const s of signals) set.add(s.department);
    return Array.from(set).sort();
  }, [signals]);

  if (!model || model.id !== params.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Model not found</h1>
          <Link
            href="/new"
            className="underline"
            style={{ color: 'var(--fg-2)' }}
          >
            Create a new model
          </Link>
        </div>
      </div>
    );
  }

  const hasEvidence = evidence.length > 0;
  const hasSignals = signals.length > 0;

  const handleExtract = async () => {
    if (!apiKey.trim()) {
      setError('Enter your OpenAI API key.');
      return;
    }
    if (!hasEvidence) {
      setError('No evidence to extract from. Capture evidence first.');
      return;
    }
    if (
      hasSignals &&
      !confirm('This will replace the existing signals. Continue?')
    ) {
      return;
    }
    setError(null);
    setIsExtracting(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('openai-api-key', apiKey);
      }
      const res = await fetch('/api/extract-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          evidence,
          industry: model.input.industry,
          experienceTypes: model.input.experienceTypes,
          businessDescription: model.input.businessDescription,
          engagementScope: engagementScope || undefined,
          personas: model.input.personas?.map((p) => p.label),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Extraction failed');
      }
      setSignals(data.signals as Signal[]);
      setContradictions((data.contradictions as Contradiction[]) || []);
      setRedFlags((data.redFlags as string[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClearSignals = () => {
    if (confirm('Clear all signals? This cannot be undone.')) {
      setSignals([]);
      setContradictions([]);
      setRedFlags([]);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-1)',
    border: '1px solid var(--border-1)',
    color: 'var(--fg-1)',
    borderRadius: 'var(--r-sm)',
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
    >
      <StepProgress
        currentStep="signals"
        modelId={model.id}
        signalsCount={signals.length}
        hasDiscoveryBundle={!!model.discoveryBundle}
      />

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="eyebrow mb-2">Step 04 · Signals</div>
              <h1
                className="text-3xl font-medium"
                style={{ color: 'var(--fg-1)' }}
              >
                Signal Board
              </h1>
              <p
                className="mt-2 text-sm max-w-2xl"
                style={{ color: 'var(--fg-2)' }}
              >
                Evidence becomes signals — problems, needs, opportunities, and
                gaps. Each signal cites the evidence that supports it.
              </p>
            </div>
            {hasSignals && (
              <button
                onClick={handleClearSignals}
                className="text-xs underline"
                style={{ color: 'var(--fg-3)' }}
              >
                Clear signals
              </button>
            )}
          </div>

          {/* Evidence status + extract button */}
          <div className="card mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm">
                  <span className="font-medium">{evidence.length}</span>{' '}
                  <span style={{ color: 'var(--fg-2)' }}>
                    evidence records available
                  </span>
                </div>
                {!hasEvidence && (
                  <div
                    className="text-xs mt-1"
                    style={{ color: 'var(--warn)' }}
                  >
                    Capture evidence first before extracting signals.
                  </div>
                )}
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label
                    className="block text-[10px] uppercase tracking-wide mb-1"
                    style={{ color: 'var(--fg-3)' }}
                  >
                    Scope (optional)
                  </label>
                  <input
                    type="text"
                    value={engagementScope}
                    onChange={(e) => setEngagementScope(e.target.value)}
                    placeholder="CRM modernization"
                    className="px-3 py-1.5 text-xs w-56 focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] uppercase tracking-wide mb-1"
                    style={{ color: 'var(--fg-3)' }}
                  >
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="px-3 py-1.5 text-xs w-64 focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || !hasEvidence}
                  className="btn btn--primary btn--sm"
                >
                  {isExtracting
                    ? 'Extracting…'
                    : hasSignals
                    ? 'Re-extract'
                    : 'Extract Signals'}
                </button>
              </div>
            </div>
            {error && (
              <div
                className="mt-3 text-sm px-3 py-2 rounded"
                style={{
                  color:
                    'color-mix(in srgb, var(--danger) 70%, var(--fg-1))',
                  background:
                    'color-mix(in srgb, var(--danger) 14%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Red flags */}
          {redFlags.length > 0 && (
            <div
              className="rounded-lg p-4 mb-6"
              style={{
                background:
                  'color-mix(in srgb, var(--warn) 12%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <div
                className="text-xs uppercase tracking-wide mb-2"
                style={{
                  color: 'color-mix(in srgb, var(--warn) 70%, var(--fg-1))',
                }}
              >
                Extraction Red Flags
              </div>
              <ul className="space-y-1">
                {redFlags.map((flag, i) => (
                  <li
                    key={i}
                    className="text-sm"
                    style={{ color: 'var(--fg-1)' }}
                  >
                    • {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contradictions */}
          {contradictions.length > 0 && (
            <div
              className="p-4 mb-6"
              style={{
                background: 'var(--bg-2)',
                border:
                  '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <div
                className="text-xs uppercase tracking-wide mb-2"
                style={{
                  color: 'color-mix(in srgb, var(--danger) 70%, var(--fg-1))',
                }}
              >
                Contradictions ({contradictions.length})
              </div>
              <ul className="space-y-2">
                {contradictions.map((c, i) => (
                  <li
                    key={i}
                    className="text-sm"
                    style={{ color: 'var(--fg-2)' }}
                  >
                    <span
                      className="text-xs"
                      style={{ color: 'var(--fg-3)' }}
                    >
                      {c.signalIds.join(' ⇔ ')}:{' '}
                    </span>
                    {c.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filters */}
          {hasSignals && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className="text-xs uppercase tracking-wide"
                style={{ color: 'var(--fg-3)' }}
              >
                Filter:
              </span>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-2 py-1 text-xs focus:outline-none"
                style={inputStyle}
              >
                <option value="all">All departments ({signals.length})</option>
                {departmentsInSignals.map((d) => (
                  <option key={d} value={d}>
                    {d} ({signals.filter((s) => s.department === d).length})
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
              <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
                Showing {filteredSignals.length} of {signals.length}
              </span>
            </div>
          )}

          {/* 4-lane board */}
          {!hasSignals && !isExtracting && (
            <div
              className="text-center py-16 text-sm"
              style={{
                color: 'var(--fg-3)',
                border: '1px dashed var(--border-1)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              No signals extracted yet. Click &ldquo;Extract Signals&rdquo;
              above to begin.
            </div>
          )}

          {hasSignals && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {SIGNAL_TYPES.map((t) => {
                const bucket = signalsByType[t.key];
                return (
                  <div
                    key={t.key}
                    className="p-4 min-h-[200px]"
                    style={laneStyle(t.hue)}
                  >
                    <div className="flex items-baseline justify-between mb-3">
                      <h3
                        className="text-sm font-medium uppercase tracking-wide"
                        style={laneHeaderStyle(t.hue)}
                      >
                        {t.label}
                      </h3>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--fg-3)' }}
                      >
                        {bucket.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {bucket.length === 0 && (
                        <div
                          className="text-xs italic"
                          style={{ color: 'var(--fg-3)' }}
                        >
                          None
                        </div>
                      )}
                      {bucket.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 group"
                          style={{
                            background: 'var(--bg-1)',
                            border: '1px solid var(--border-1)',
                            borderRadius: 'var(--r-md)',
                          }}
                        >
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div
                              className="flex items-center gap-2 text-[10px] uppercase tracking-wide"
                              style={{ color: 'var(--fg-3)' }}
                            >
                              <span>{s.id}</span>
                              <span>·</span>
                              <span>{s.department}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <ConfidencePill confidence={s.confidence} />
                              <button
                                onClick={() => removeSignal(s.id)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--fg-3)' }}
                                aria-label="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <p
                            className="text-sm leading-relaxed mb-2"
                            style={{ color: 'var(--fg-1)' }}
                          >
                            {s.text}
                          </p>
                          {s.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {s.sources.map((src, si) => {
                                const ev = evidenceById.get(src.evidenceId);
                                return (
                                  <span
                                    key={si}
                                    className="text-[10px] px-1.5 py-0.5 rounded cursor-help"
                                    style={{
                                      background: 'var(--bg-3)',
                                      color: 'var(--fg-2)',
                                    }}
                                    title={
                                      ev
                                        ? `${ev.source} — ${ev.summary}`
                                        : src.quote || 'Evidence reference'
                                    }
                                  >
                                    {ev ? ev.department : 'evidence'}
                                    {src.quote ? ' · quoted' : ''}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {s.proposedAction && (
                            <div
                              className="text-[11px] italic mt-1 pt-1"
                              style={{
                                color: 'var(--fg-3)',
                                borderTop: '1px solid var(--border-1)',
                              }}
                            >
                              → {s.proposedAction}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-4 mt-8">
            <Link
              href={`/model/${model.id}/capture`}
              className="btn btn--ghost btn--sm"
            >
              ← Back to Capture
            </Link>
            <Link
              href={`/model/${model.id}/review`}
              className={`btn btn--sm ${
                hasSignals ? 'btn--soft' : 'btn--ghost'
              }`}
              style={
                hasSignals
                  ? undefined
                  : { opacity: 0.5, pointerEvents: 'none' }
              }
            >
              Next: Review & Approve →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
