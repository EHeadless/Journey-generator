'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { StepProgress } from '@/components/StepProgress';
import { Signal, SignalType, ConfidenceLevel, Evidence } from '@/lib/types';
import { useTheme } from '@/lib/hooks/useTheme';

// ---------------------------------------------------------------------------
// Styling constants (mirror the Signals page for visual continuity)
// ---------------------------------------------------------------------------
const SIGNAL_TYPES: {
  key: SignalType;
  label: string;
  hue: string;
}[] = [
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

// ---------------------------------------------------------------------------
// Quality check types
// ---------------------------------------------------------------------------
type CheckStatus = 'pass' | 'warn' | 'fail';

interface QualityCheck {
  label: string;
  status: CheckStatus;
  detail: string;
}

function checkStyle(status: CheckStatus): React.CSSProperties {
  if (status === 'pass') {
    return {
      background: 'color-mix(in srgb, var(--success) 12%, transparent)',
      color: 'color-mix(in srgb, var(--success) 75%, var(--fg-1))',
      border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
    };
  }
  if (status === 'warn') {
    return {
      background: 'color-mix(in srgb, var(--warn) 12%, transparent)',
      color: 'color-mix(in srgb, var(--warn) 75%, var(--fg-1))',
      border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
    };
  }
  return {
    background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
    color: 'color-mix(in srgb, var(--danger) 75%, var(--fg-1))',
    border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
  };
}

const CHECK_ICON: Record<CheckStatus, string> = {
  pass: '✓',
  warn: '⚠',
  fail: '✗',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ReviewPage() {
  const params = useParams();
  const model = useStore((state) => state.model);
  const approveDiscoveryBundle = useStore(
    (state) => state.approveDiscoveryBundle
  );
  const setCurrentStep = useStore((state) => state.setCurrentStep);
  useTheme();

  const evidence = useMemo<Evidence[]>(
    () => model?.evidenceRecords || [],
    [model?.evidenceRecords]
  );
  const signals = useMemo<Signal[]>(() => model?.signals || [], [model?.signals]);
  const discoveryBundle = model?.discoveryBundle;

  // Selection state — by default everything is included
  const [includedEvidence, setIncludedEvidence] = useState<Set<string>>(
    () => new Set(evidence.map((e) => e.id))
  );
  const [includedSignals, setIncludedSignals] = useState<Set<string>>(
    () => new Set(signals.map((s) => s.id))
  );
  const [approverName, setApproverName] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [justApproved, setJustApproved] = useState(false);

  // ---------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------
  const filteredEvidence = useMemo(
    () => evidence.filter((e) => includedEvidence.has(e.id)),
    [evidence, includedEvidence]
  );

  const filteredSignals = useMemo(
    () => signals.filter((s) => includedSignals.has(s.id)),
    [signals, includedSignals]
  );

  // Signals indexed by type for the Kanban-style grid
  const signalsByType = useMemo(() => {
    const by: Record<SignalType, Signal[]> = {
      problem: [],
      need: [],
      opportunity: [],
      gap: [],
    };
    signals.forEach((s) => by[s.type].push(s));
    return by;
  }, [signals]);

  // Evidence indexed by ID for lookups
  const evidenceById = useMemo(() => {
    const map: Record<string, Evidence> = {};
    evidence.forEach((e) => (map[e.id] = e));
    return map;
  }, [evidence]);

  // Quality gate — based on INCLUDED evidence/signals
  const qualityChecks = useMemo<QualityCheck[]>(() => {
    const checks: QualityCheck[] = [];

    // 1. Coverage — ≥ 1 evidence per department that's present in the plan
    const planDepts = model?.discoveryPlan?.coverage?.departments
      ? Object.keys(model.discoveryPlan.coverage.departments).filter(
          (d) => model.discoveryPlan!.coverage.departments[d] !== 'skip'
        )
      : [];
    const deptsWithEvidence = new Set(
      filteredEvidence.map((e) => e.department)
    );
    if (planDepts.length > 0) {
      const missing = planDepts.filter((d) => !deptsWithEvidence.has(d));
      checks.push({
        label: 'Coverage',
        status:
          missing.length === 0 ? 'pass' : missing.length <= 1 ? 'warn' : 'fail',
        detail:
          missing.length === 0
            ? `All ${planDepts.length} planned departments covered`
            : `Missing: ${missing.join(', ')}`,
      });
    } else {
      checks.push({
        label: 'Coverage',
        status: deptsWithEvidence.size >= 3 ? 'pass' : 'warn',
        detail: `${deptsWithEvidence.size} departments represented`,
      });
    }

    // 2. Confidence balance — ≥ 50% high on evidence
    const highCount = filteredEvidence.filter(
      (e) => e.confidence === 'high'
    ).length;
    const highPct = filteredEvidence.length
      ? Math.round((highCount / filteredEvidence.length) * 100)
      : 0;
    checks.push({
      label: 'Confidence',
      status: highPct >= 50 ? 'pass' : highPct >= 30 ? 'warn' : 'fail',
      detail:
        filteredEvidence.length === 0
          ? 'No evidence'
          : `${highPct}% high-confidence (${highCount} of ${filteredEvidence.length})`,
    });

    // 3. Customer voice — ≥ 5 quote records
    const quoteCount = filteredEvidence.filter(
      (e) => e.type === 'quote'
    ).length;
    checks.push({
      label: 'Customer voice',
      status: quoteCount >= 5 ? 'pass' : quoteCount >= 2 ? 'warn' : 'fail',
      detail: `${quoteCount} direct quote${quoteCount === 1 ? '' : 's'}`,
    });

    // 4. Quant + qual — ≥ 1 metric
    const metricCount = filteredEvidence.filter(
      (e) => e.type === 'metric'
    ).length;
    checks.push({
      label: 'Metrics',
      status: metricCount >= 1 ? 'pass' : 'warn',
      detail:
        metricCount === 0
          ? 'No metric records — you only have opinions'
          : `${metricCount} metric record${metricCount === 1 ? '' : 's'}`,
    });

    // 5. Signal coverage across types
    const typesPresent = SIGNAL_TYPES.filter((t) =>
      filteredSignals.some((s) => s.type === t.key)
    ).length;
    checks.push({
      label: 'Signal mix',
      status: typesPresent >= 3 ? 'pass' : typesPresent >= 2 ? 'warn' : 'fail',
      detail: `${typesPresent} of 4 signal types represented`,
    });

    return checks;
  }, [filteredEvidence, filteredSignals, model]);

  // Red flags — hard stops from the skill
  const redFlags = useMemo<string[]>(() => {
    const flags: string[] = [];
    if (filteredEvidence.length === 0) {
      flags.push('No evidence included — nothing to generate from');
    }
    if (filteredSignals.length === 0) {
      flags.push('No signals included — nothing to map to the landscape');
    }
    const depts = new Set(filteredEvidence.map((e) => e.department));
    if (filteredEvidence.length > 0 && depts.size === 1) {
      flags.push(
        `Echo chamber: every evidence record comes from ${[...depts][0]}`
      );
    }
    if (
      filteredEvidence.length >= 5 &&
      filteredEvidence.every((e) => e.confidence === 'high')
    ) {
      flags.push(
        'All evidence is high-confidence with no friction — probably missing contradictions'
      );
    }
    return flags;
  }, [filteredEvidence, filteredSignals]);

  const hasBlockingFlags = redFlags.length > 0;
  const hasAnyFail = qualityChecks.some((c) => c.status === 'fail');

  // ---------------------------------------------------------------------
  // Early returns
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  function toggleEvidence(id: string) {
    setIncludedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSignal(id: string) {
    setIncludedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setIncludedEvidence(new Set(evidence.map((e) => e.id)));
    setIncludedSignals(new Set(signals.map((s) => s.id)));
  }

  function clearAll() {
    setIncludedEvidence(new Set());
    setIncludedSignals(new Set());
  }

  function handleApprove() {
    if (hasBlockingFlags || !approverName.trim()) return;
    setIsApproving(true);

    const candidateSignals = {
      problems: filteredSignals.filter((s) => s.type === 'problem'),
      needs: filteredSignals.filter((s) => s.type === 'need'),
      opportunities: filteredSignals.filter((s) => s.type === 'opportunity'),
      gaps: filteredSignals.filter((s) => s.type === 'gap'),
    };

    approveDiscoveryBundle({
      approvedEvidence: filteredEvidence,
      candidateSignals,
      approvedBy: approverName.trim(),
    });
    setCurrentStep('landscape');
    setJustApproved(true);
    setIsApproving(false);
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-1)',
    border: '1px solid var(--border-1)',
    color: 'var(--fg-1)',
    borderRadius: 'var(--r-sm)',
  };

  const approvedBannerStyle: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--success) 14%, transparent)',
    border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
    borderRadius: 'var(--r-lg)',
  };

  // ---------------------------------------------------------------------
  // Empty state — no signals extracted yet
  // ---------------------------------------------------------------------
  if (signals.length === 0) {
    return (
      <div
        className="min-h-screen"
        style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
      >
        <StepProgress
          currentStep="review"
          modelId={model.id}
          signalsCount={0}
          hasDiscoveryBundle={!!discoveryBundle}
        />
        <div className="max-w-3xl mx-auto p-8">
          <div className="eyebrow mb-2">Step 05 · Review</div>
          <h1 className="text-3xl font-medium mb-3">Review & Approve</h1>
          <p className="mb-8" style={{ color: 'var(--fg-2)' }}>
            Nothing to approve yet. Extract signals on the previous step, then
            come back to lock the bundle.
          </p>
          <Link
            href={`/model/${model.id}/signals`}
            className="btn btn--ghost btn--sm"
          >
            ← Go to Signals
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
    >
      <StepProgress
        currentStep="review"
        modelId={model.id}
        signalsCount={signals.length}
        hasDiscoveryBundle={!!discoveryBundle}
      />

      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="eyebrow mb-2">Step 05 · Review</div>
            <h1 className="text-3xl font-medium mb-2">Review & Approve</h1>
            <p
              className="text-sm max-w-2xl"
              style={{ color: 'var(--fg-2)' }}
            >
              Gate the discovery bundle before regeneration. Deselect anything
              you don&apos;t want the landscape to reason from, then lock it.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAll}
              className="btn btn--ghost btn--sm"
            >
              Include all
            </button>
            <button
              onClick={clearAll}
              className="btn btn--ghost btn--sm"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Already-approved banner */}
        {discoveryBundle && !justApproved && (
          <div className="mb-6 p-4" style={approvedBannerStyle}>
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-sm font-medium"
                  style={{
                    color:
                      'color-mix(in srgb, var(--success) 75%, var(--fg-1))',
                  }}
                >
                  Bundle approved
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{
                    color:
                      'color-mix(in srgb, var(--success) 55%, var(--fg-2))',
                  }}
                >
                  {discoveryBundle.approvedEvidence.length} evidence ·{' '}
                  {discoveryBundle.candidateSignals.problems.length +
                    discoveryBundle.candidateSignals.needs.length +
                    discoveryBundle.candidateSignals.opportunities.length +
                    discoveryBundle.candidateSignals.gaps.length}{' '}
                  signals · approved by {discoveryBundle.approvedBy} on{' '}
                  {new Date(
                    discoveryBundle.approvedAt
                  ).toLocaleDateString()}
                </div>
              </div>
              <Link
                href={`/model/${model.id}`}
                className="btn btn--primary btn--sm"
              >
                Open Landscape →
              </Link>
            </div>
          </div>
        )}

        {justApproved && (
          <div
            className="mb-6 p-4"
            style={{
              ...approvedBannerStyle,
              background:
                'color-mix(in srgb, var(--success) 22%, transparent)',
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="text-sm font-medium"
                style={{
                  color:
                    'color-mix(in srgb, var(--success) 85%, var(--fg-1))',
                }}
              >
                Bundle locked. Regeneration can now use this evidence and
                these signals.
              </div>
              <Link
                href={`/model/${model.id}`}
                className="btn btn--primary btn--sm"
              >
                Open Landscape →
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quality gate */}
          <div className="lg:col-span-2 card">
            <div className="eyebrow mb-3">Quality gate</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {qualityChecks.map((check) => (
                <div
                  key={check.label}
                  className="flex items-start gap-2 p-3"
                  style={{
                    ...checkStyle(check.status),
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <span className="text-base leading-none mt-0.5">
                    {CHECK_ICON[check.status]}
                  </span>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide">
                      {check.label}
                    </div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {check.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {redFlags.length > 0 && (
              <div
                className="mt-4 p-3"
                style={{
                  background:
                    'color-mix(in srgb, var(--danger) 12%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide font-medium mb-1"
                  style={{
                    color:
                      'color-mix(in srgb, var(--danger) 75%, var(--fg-1))',
                  }}
                >
                  Red flags — approval blocked
                </div>
                <ul
                  className="text-xs space-y-1 list-disc list-inside"
                  style={{
                    color:
                      'color-mix(in srgb, var(--danger) 60%, var(--fg-1))',
                  }}
                >
                  {redFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bundle composition + approval form */}
          <div className="card">
            <div className="eyebrow mb-3">Bundle composition</div>
            <div className="space-y-2 mb-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm" style={{ color: 'var(--fg-2)' }}>
                  Evidence
                </span>
                <span
                  className="text-sm tabular-nums font-medium"
                  style={{ color: 'var(--fg-1)' }}
                >
                  {includedEvidence.size} / {evidence.length}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm" style={{ color: 'var(--fg-2)' }}>
                  Signals
                </span>
                <span
                  className="text-sm tabular-nums font-medium"
                  style={{ color: 'var(--fg-1)' }}
                >
                  {includedSignals.size} / {signals.length}
                </span>
              </div>
            </div>

            <label
              className="block text-xs uppercase tracking-wide mb-1"
              style={{ color: 'var(--fg-3)' }}
            >
              Approver
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 mb-3 text-sm focus:outline-none"
              style={inputStyle}
            />

            <button
              onClick={handleApprove}
              disabled={
                hasBlockingFlags ||
                !approverName.trim() ||
                isApproving ||
                hasAnyFail
              }
              className="btn btn--primary w-full"
              title={
                hasBlockingFlags
                  ? 'Fix red flags before approving'
                  : !approverName.trim()
                  ? 'Enter an approver name'
                  : hasAnyFail
                  ? 'At least one quality check is failing'
                  : 'Lock this bundle for regeneration'
              }
            >
              {isApproving
                ? 'Approving…'
                : discoveryBundle
                ? 'Re-approve bundle'
                : 'Approve bundle →'}
            </button>

            {hasAnyFail && !hasBlockingFlags && (
              <div
                className="mt-2 text-[11px]"
                style={{
                  color:
                    'color-mix(in srgb, var(--warn) 70%, var(--fg-2))',
                }}
              >
                Approval is blocked until all checks pass or warn. Adjust
                selection or capture more evidence.
              </div>
            )}
          </div>
        </div>

        {/* Signals — toggle inclusion */}
        <div className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-medium">Signals</h2>
            <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
              Click a card to include / exclude it from the bundle.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {SIGNAL_TYPES.map((typeConfig) => {
              const items = signalsByType[typeConfig.key];
              const includedCount = items.filter((s) =>
                includedSignals.has(s.id)
              ).length;
              return (
                <div
                  key={typeConfig.key}
                  className="p-3"
                  style={laneStyle(typeConfig.hue)}
                >
                  <div
                    className="text-xs uppercase tracking-wide font-medium mb-2 flex items-baseline justify-between"
                    style={laneHeaderStyle(typeConfig.hue)}
                  >
                    <span>{typeConfig.label}</span>
                    <span className="tabular-nums text-[11px] opacity-80">
                      {includedCount}/{items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <div
                      className="text-xs italic"
                      style={{ color: 'var(--fg-3)' }}
                    >
                      None
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((signal) => {
                        const isIncluded = includedSignals.has(signal.id);
                        return (
                          <button
                            key={signal.id}
                            onClick={() => toggleSignal(signal.id)}
                            className="w-full text-left p-2 text-xs transition-colors"
                            style={{
                              background: isIncluded
                                ? 'var(--bg-1)'
                                : 'var(--bg-0)',
                              border: `1px solid ${
                                isIncluded
                                  ? 'var(--border-2)'
                                  : 'var(--border-1)'
                              }`,
                              borderRadius: 'var(--r-md)',
                              opacity: isIncluded ? 1 : 0.45,
                              textDecoration: isIncluded
                                ? 'none'
                                : 'line-through',
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className="mt-0.5 inline-block w-3 h-3 flex-shrink-0"
                                style={{
                                  background: isIncluded
                                    ? 'var(--accent)'
                                    : 'transparent',
                                  border: `1px solid ${
                                    isIncluded
                                      ? 'var(--accent)'
                                      : 'var(--border-2)'
                                  }`,
                                  borderRadius: 3,
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className="leading-snug"
                                  style={{ color: 'var(--fg-1)' }}
                                >
                                  {signal.text}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span
                                    className="text-[10px]"
                                    style={{ color: 'var(--fg-3)' }}
                                  >
                                    {signal.department}
                                  </span>
                                  <ConfidencePill
                                    confidence={signal.confidence}
                                  />
                                  <span
                                    className="text-[10px]"
                                    style={{ color: 'var(--fg-3)' }}
                                  >
                                    · {signal.sources.length} ev
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Evidence — toggle inclusion */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-medium">Evidence</h2>
            <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
              {filteredEvidence.length} of {evidence.length} included.
            </span>
          </div>
          <div
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border-1)',
              borderRadius: 'var(--r-lg)',
            }}
          >
            {evidence.length === 0 ? (
              <div
                className="p-4 text-xs italic"
                style={{ color: 'var(--fg-3)' }}
              >
                No evidence records captured.
              </div>
            ) : (
              evidence.map((e, idx) => {
                const isIncluded = includedEvidence.has(e.id);
                const backingSignals = signals.filter((s) =>
                  s.sources.some((src) => src.evidenceId === e.id)
                );
                return (
                  <button
                    key={e.id}
                    onClick={() => toggleEvidence(e.id)}
                    className="w-full text-left p-3 transition-colors"
                    style={{
                      opacity: isIncluded ? 1 : 0.45,
                      textDecoration: isIncluded ? 'none' : 'line-through',
                      borderTop:
                        idx === 0
                          ? undefined
                          : '1px solid var(--border-1)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 inline-block w-3 h-3 flex-shrink-0"
                        style={{
                          background: isIncluded
                            ? 'var(--accent)'
                            : 'transparent',
                          border: `1px solid ${
                            isIncluded ? 'var(--accent)' : 'var(--border-2)'
                          }`,
                          borderRadius: 3,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="text-[10px] uppercase tracking-wide"
                            style={{ color: 'var(--fg-3)' }}
                          >
                            {e.type}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: 'var(--fg-2)' }}
                          >
                            {e.source}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: 'var(--fg-3)' }}
                          >
                            · {e.department}
                          </span>
                          <ConfidencePill confidence={e.confidence} />
                          {backingSignals.length > 0 && (
                            <span
                              className="text-[10px]"
                              style={{ color: 'var(--fg-3)' }}
                              title={backingSignals
                                .map((s) => s.text)
                                .join('\n')}
                            >
                              · backs {backingSignals.length} signal
                              {backingSignals.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-sm leading-snug"
                          style={{ color: 'var(--fg-1)' }}
                        >
                          {e.summary}
                        </div>
                        {e.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {e.tags.slice(0, 6).map((tag) => (
                              <span
                                key={tag}
                                className="chip"
                                style={{ fontSize: 10 }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Signal → evidence traceability summary */}
        {filteredSignals.length > 0 && (
          <div className="mt-10 card">
            <div className="eyebrow mb-2">Traceability check</div>
            <div className="text-xs" style={{ color: 'var(--fg-2)' }}>
              Every approved signal must cite at least one approved evidence
              record. Orphan signals will ship with their citations silently
              dropped.
            </div>
            {(() => {
              const orphans = filteredSignals.filter((s) =>
                s.sources.every(
                  (src) => !includedEvidence.has(src.evidenceId)
                )
              );
              if (orphans.length === 0) {
                return (
                  <div
                    className="mt-2 text-xs"
                    style={{
                      color:
                        'color-mix(in srgb, var(--success) 70%, var(--fg-1))',
                    }}
                  >
                    ✓ All {filteredSignals.length} signals have at least one
                    included evidence record.
                  </div>
                );
              }
              return (
                <div className="mt-2">
                  <div
                    className="text-xs mb-1"
                    style={{
                      color:
                        'color-mix(in srgb, var(--warn) 75%, var(--fg-1))',
                    }}
                  >
                    ⚠ {orphans.length} signal
                    {orphans.length === 1 ? '' : 's'} would be orphaned:
                  </div>
                  <ul
                    className="text-xs list-disc list-inside space-y-0.5"
                    style={{ color: 'var(--fg-2)' }}
                  >
                    {orphans.map((s) => (
                      <li key={s.id}>
                        {s.text}{' '}
                        <span style={{ color: 'var(--fg-3)' }}>
                          (needs:{' '}
                          {s.sources
                            .map(
                              (src) =>
                                evidenceById[src.evidenceId]?.source ||
                                src.evidenceId
                            )
                            .filter(Boolean)
                            .join(', ')}
                          )
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-10 flex items-center justify-between">
          <Link
            href={`/model/${model.id}/signals`}
            className="btn btn--ghost btn--sm"
          >
            ← Signals
          </Link>
          <Link
            href={`/model/${model.id}`}
            className={`btn btn--sm ${
              discoveryBundle ? 'btn--primary' : 'btn--ghost'
            }`}
            style={
              discoveryBundle
                ? undefined
                : { opacity: 0.5, pointerEvents: 'none' }
            }
          >
            Landscape →
          </Link>
        </div>
      </div>
    </div>
  );
}
