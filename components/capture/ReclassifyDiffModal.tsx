'use client';

/**
 * Reclassify diff modal.
 *
 * Shown when the user clicks "Re-classify" while at least one row is
 * manuallyEdited. The model has produced new proposals; we present the
 * deltas per row with a checkbox so the strategist accepts overwrites
 * row-by-row. Manually-edited rows the strategist DOES NOT check are
 * preserved exactly as-is.
 */

import { useMemo, useState } from 'react';
import type {
  JourneyPhase,
  ProblemDiagnostic,
  ProblemDiscipline,
} from '@/lib/types';
import {
  DISCIPLINE_LABELS,
  FREQUENCY_LABELS,
} from '@/lib/problem-diagnostics-meta';

export interface ProposedDiagnostic {
  problemSignalId: string;
  discipline: ProblemDiscipline;
  disciplineRationale: string;
  secondaryDiscipline?: ProblemDiscipline;
  secondaryRationale?: string;
  impact: 1 | 2 | 3 | 4 | 5;
  impactRationale: string;
  affectedPhaseIds: string[];
  phaseRationale: string;
}

interface DiffModalProps {
  open: boolean;
  current: ProblemDiagnostic[];
  proposed: ProposedDiagnostic[];
  problemTexts: Record<string, string>;
  journeyPhases: JourneyPhase[];
  /** Called with the subset of problemSignalIds the user accepted. */
  onApply: (acceptedSignalIds: string[]) => void;
  onCancel: () => void;
}

interface RowDiff {
  signalId: string;
  text: string;
  current?: ProblemDiagnostic;
  proposed: ProposedDiagnostic;
  changes: Array<{ field: string; from: string; to: string }>;
}

export function ReclassifyDiffModal({
  open,
  current,
  proposed,
  problemTexts,
  journeyPhases,
  onApply,
  onCancel,
}: DiffModalProps) {
  const phaseLabel = useMemo(() => {
    const m = new Map(journeyPhases.map((p) => [p.id, p.label]));
    return (id: string) => m.get(id) || id;
  }, [journeyPhases]);

  const rows: RowDiff[] = useMemo(() => {
    const currentBySignal = new Map(current.map((d) => [d.problemSignalId, d]));
    return proposed.map((p) => {
      const cur = currentBySignal.get(p.problemSignalId);
      const changes: RowDiff['changes'] = [];
      if (cur) {
        if (cur.discipline !== p.discipline) {
          changes.push({
            field: 'Primary discipline',
            from: DISCIPLINE_LABELS[cur.discipline],
            to: DISCIPLINE_LABELS[p.discipline],
          });
        }
        if ((cur.secondaryDiscipline || '') !== (p.secondaryDiscipline || '')) {
          changes.push({
            field: 'Secondary discipline',
            from: cur.secondaryDiscipline ? DISCIPLINE_LABELS[cur.secondaryDiscipline] : '—',
            to: p.secondaryDiscipline ? DISCIPLINE_LABELS[p.secondaryDiscipline] : '—',
          });
        }
        if (cur.impact !== p.impact) {
          changes.push({
            field: 'Impact',
            from: String(cur.impact),
            to: String(p.impact),
          });
        }
        const curPhases = [...cur.affectedPhaseIds].sort().join(',');
        const propPhases = [...p.affectedPhaseIds].sort().join(',');
        if (curPhases !== propPhases) {
          changes.push({
            field: 'Phases',
            from: cur.affectedPhaseIds.map(phaseLabel).join(', ') || '—',
            to: p.affectedPhaseIds.map(phaseLabel).join(', ') || '—',
          });
        }
      }
      return {
        signalId: p.problemSignalId,
        text: problemTexts[p.problemSignalId] || '(text missing)',
        current: cur,
        proposed: p,
        changes,
      };
    });
  }, [current, proposed, problemTexts, phaseLabel]);

  // Default selection: NEW rows + rows that aren't manually-edited.
  const initialSelection = useMemo(() => {
    const sel = new Set<string>();
    for (const r of rows) {
      if (!r.current) sel.add(r.signalId);
      else if (!r.current.manuallyEdited && r.changes.length > 0) sel.add(r.signalId);
    }
    return sel;
  }, [rows]);

  const [selected, setSelected] = useState<Set<string>>(initialSelection);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(rows.map((r) => r.signalId)));
  const selectNone = () => setSelected(new Set());

  const changedCount = rows.filter((r) => r.changes.length > 0 || !r.current).length;
  const editedCount = rows.filter((r) => r.current?.manuallyEdited).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="rounded-lg border shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        style={{
          background: 'var(--bg-1)',
          borderColor: 'var(--border-1)',
        }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-1)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--fg-1)' }}>
            Review re-classification
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
            {changedCount} row{changedCount === 1 ? '' : 's'} would change
            {editedCount > 0
              ? ` · ${editedCount} previously edited row${editedCount === 1 ? '' : 's'} preserved unless explicitly accepted`
              : ''}
            . Check the rows you want to overwrite. Unchecked rows stay as they are.
          </p>
        </div>

        <div className="flex items-center gap-2 px-6 py-2 border-b text-xs" style={{ borderColor: 'var(--border-1)' }}>
          <button
            type="button"
            onClick={selectAll}
            className="px-2 py-1 rounded"
            style={{ background: 'var(--bg-0)', color: 'var(--fg-2)' }}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="px-2 py-1 rounded"
            style={{ background: 'var(--bg-0)', color: 'var(--fg-2)' }}
          >
            Select none
          </button>
          <span className="ml-auto" style={{ color: 'var(--fg-3)' }}>
            {selected.size} selected
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {rows.map((r) => {
            const isNew = !r.current;
            const isEdited = r.current?.manuallyEdited;
            const noChange = !isNew && r.changes.length === 0;
            return (
              <label
                key={r.signalId}
                className="flex items-start gap-3 p-3 rounded border cursor-pointer"
                style={{
                  background: 'var(--bg-0)',
                  borderColor: selected.has(r.signalId)
                    ? 'var(--accent)'
                    : 'var(--border-1)',
                }}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(r.signalId)}
                  onChange={() => toggle(r.signalId)}
                  disabled={noChange && !isNew}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>
                      {r.text}
                    </div>
                    {isNew && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: '#10B981', color: '#fff' }}
                      >
                        NEW
                      </span>
                    )}
                    {isEdited && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                      >
                        EDITED
                      </span>
                    )}
                    {noChange && !isNew && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-1)', color: 'var(--fg-3)' }}
                      >
                        no change
                      </span>
                    )}
                  </div>
                  {r.changes.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {r.changes.map((c) => (
                        <li key={c.field} style={{ color: 'var(--fg-2)' }}>
                          <span className="font-semibold">{c.field}:</span>{' '}
                          <span style={{ color: 'var(--fg-3)' }}>{c.from}</span>
                          {' → '}
                          <span style={{ color: 'var(--fg-1)' }}>{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isNew && (
                    <div className="text-xs" style={{ color: 'var(--fg-2)' }}>
                      {DISCIPLINE_LABELS[r.proposed.discipline]} · impact{' '}
                      {r.proposed.impact} · phases{' '}
                      {r.proposed.affectedPhaseIds.map(phaseLabel).join(', ')}
                    </div>
                  )}
                  <div className="text-[10px] mt-1" style={{ color: 'var(--fg-3)' }}>
                    {r.current
                      ? `current: freq ${FREQUENCY_LABELS[r.current.frequency]} · impact ${r.current.impact}`
                      : 'newly classified'}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div
          className="px-6 py-3 border-t flex justify-end gap-2"
          style={{ borderColor: 'var(--border-1)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded"
            style={{
              background: 'var(--bg-0)',
              color: 'var(--fg-2)',
              border: '1px solid var(--border-1)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(Array.from(selected))}
            className="px-3 py-2 text-sm rounded font-semibold"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            Apply {selected.size} change{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
