'use client';

/**
 * Editable diagnostic table.
 *
 * Every field except the problem text is inline-editable, including
 * frequency (which is computed deterministically from sources but can be
 * manually overridden when the strategist's domain knowledge contradicts
 * the heuristic). Edits set manuallyEdited=true and bump updatedAt; the
 * "manually edited" badge tells the strategist their work won't be
 * silently overwritten by Re-classify.
 *
 * A discipline filter strip above the table narrows rows to one or more
 * primary disciplines.
 */

import { useMemo, useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import type {
  JourneyPhase,
  ProblemDiagnostic,
  ProblemDiscipline,
  DiagnosticScore,
} from '@/lib/types';
import {
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  FREQUENCY_LABELS,
  SCORE_LABELS,
} from '@/lib/problem-diagnostics-meta';

interface ProblemTableProps {
  diagnostics: ProblemDiagnostic[];
  journeyPhases: JourneyPhase[];
  problemTexts: Record<string, string>;
  onUpdate: (id: string, updates: Partial<ProblemDiagnostic>) => void;
}

export function ProblemTable({
  diagnostics,
  journeyPhases,
  problemTexts,
  onUpdate,
}: ProblemTableProps) {
  const phasesById = useMemo(
    () => new Map(journeyPhases.map((p) => [p.id, p])),
    [journeyPhases]
  );

  const [filter, setFilter] = useState<Set<ProblemDiscipline>>(new Set());
  // Cross-cutting (empty `affectedPhaseIds`) is its own filter dimension —
  // a separate chip in the strip lets the strategist isolate systemic
  // problems without polluting the discipline filter set.
  const [crossCuttingOnly, setCrossCuttingOnly] = useState(false);

  const toggleFilter = (d: ProblemDiscipline) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return diagnostics.filter((d) => {
      if (filter.size > 0 && !filter.has(d.discipline)) return false;
      if (crossCuttingOnly && d.affectedPhaseIds.length > 0) return false;
      return true;
    });
  }, [diagnostics, filter, crossCuttingOnly]);

  if (diagnostics.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-sm"
        style={{
          background: 'var(--bg-1)',
          borderColor: 'var(--border-1)',
          color: 'var(--fg-3)',
        }}
      >
        No diagnostics yet. Run classification to populate this table.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      {/* Discipline filter strip */}
      <div
        className="flex items-center flex-wrap gap-1 px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-1)' }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wide mr-2"
          style={{ color: 'var(--fg-3)' }}
        >
          Filter discipline
        </span>
        {DISCIPLINE_ORDER.map((d) => {
          const active = filter.has(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleFilter(d)}
              className="px-2 py-0.5 text-[11px] rounded-full border transition"
              style={{
                background: active ? DISCIPLINE_COLORS[d] : 'transparent',
                color: active ? '#fff' : 'var(--fg-2)',
                borderColor: active ? DISCIPLINE_COLORS[d] : 'var(--border-1)',
              }}
            >
              {DISCIPLINE_LABELS[d]}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCrossCuttingOnly((v) => !v)}
          className="px-2 py-0.5 text-[11px] rounded-full border transition"
          style={{
            background: crossCuttingOnly ? 'var(--accent)' : 'transparent',
            color: crossCuttingOnly ? 'var(--accent-fg)' : 'var(--fg-2)',
            borderColor: crossCuttingOnly
              ? 'var(--accent)'
              : 'var(--border-1)',
          }}
          title="Show only cross-cutting (non-phase-bound) problems"
        >
          Cross-cutting
        </button>
        {(filter.size > 0 || crossCuttingOnly) && (
          <button
            type="button"
            onClick={() => {
              setFilter(new Set());
              setCrossCuttingOnly(false);
            }}
            className="px-2 py-0.5 text-[11px] rounded-full"
            style={{ color: 'var(--fg-3)' }}
          >
            clear
          </button>
        )}
        <span
          className="ml-auto text-[10px]"
          style={{ color: 'var(--fg-3)' }}
        >
          {filtered.length} / {diagnostics.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr
              className="text-left"
              style={{
                background: 'var(--bg-0)',
                color: 'var(--fg-2)',
                borderBottom: '1px solid var(--border-1)',
              }}
            >
              <th className="p-3 font-semibold" style={{ minWidth: 280 }}>Problem</th>
              <th className="p-3 font-semibold">Primary discipline</th>
              <th className="p-3 font-semibold">Secondary</th>
              <th className="p-3 font-semibold">
                Frequency
                <div
                  className="text-[9px] font-normal normal-case"
                  style={{ color: 'var(--fg-3)' }}
                >
                  auto-computed; override if needed
                </div>
              </th>
              <th className="p-3 font-semibold">Impact</th>
              <th className="p-3 font-semibold">Phases</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <ProblemRow
                key={d.id}
                diagnostic={d}
                problemText={problemTexts[d.problemSignalId] || '(text missing)'}
                journeyPhases={journeyPhases}
                phasesById={phasesById}
                onUpdate={onUpdate}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-[11px]"
                  style={{ color: 'var(--fg-3)' }}
                >
                  No problems match the active discipline filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RowProps {
  diagnostic: ProblemDiagnostic;
  problemText: string;
  journeyPhases: JourneyPhase[];
  phasesById: Map<string, JourneyPhase>;
  onUpdate: (id: string, updates: Partial<ProblemDiagnostic>) => void;
}

function ProblemRow({
  diagnostic: d,
  problemText,
  journeyPhases,
  phasesById,
  onUpdate,
}: RowProps) {
  const [editingPhases, setEditingPhases] = useState(false);
  const [draftPhaseIds, setDraftPhaseIds] = useState<string[]>(d.affectedPhaseIds);

  const handleDiscipline = (value: ProblemDiscipline) => {
    if (value === d.discipline) return;
    onUpdate(d.id, {
      discipline: value,
      manuallyEdited: true,
    });
  };

  const handleSecondary = (value: string) => {
    const next = (value as ProblemDiscipline) || undefined;
    if (next === d.secondaryDiscipline) return;
    if (next === d.discipline) return; // never let secondary == primary
    onUpdate(d.id, {
      secondaryDiscipline: next,
      manuallyEdited: true,
    });
  };

  const handleImpact = (value: number) => {
    const score = Math.max(1, Math.min(5, Math.round(value))) as DiagnosticScore;
    if (score === d.impact) return;
    onUpdate(d.id, {
      impact: score,
      manuallyEdited: true,
    });
  };

  const handleFrequency = (value: number) => {
    const score = Math.max(1, Math.min(5, Math.round(value))) as DiagnosticScore;
    if (score === d.frequency) return;
    onUpdate(d.id, {
      frequency: score,
      manuallyEdited: true,
    });
  };

  const savePhases = () => {
    if (
      draftPhaseIds.length === d.affectedPhaseIds.length &&
      draftPhaseIds.every((id) => d.affectedPhaseIds.includes(id))
    ) {
      setEditingPhases(false);
      return;
    }
    onUpdate(d.id, {
      affectedPhaseIds: draftPhaseIds.length > 0 ? draftPhaseIds : d.affectedPhaseIds,
      manuallyEdited: true,
    });
    setEditingPhases(false);
  };

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border-1)',
        color: 'var(--fg-1)',
      }}
    >
      <td className="p-3 align-top">
        <div className="font-medium">{problemText}</div>
        {d.disciplineRationale && (
          <div className="mt-1 text-[11px]" style={{ color: 'var(--fg-3)' }}>
            <span className="font-semibold">why this discipline:</span>{' '}
            {d.disciplineRationale}
          </div>
        )}
        {d.impactRationale && (
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--fg-3)' }}>
            <span className="font-semibold">why this impact:</span>{' '}
            {d.impactRationale}
          </div>
        )}
      </td>

      <td className="p-3 align-top">
        <select
          value={d.discipline}
          onChange={(e) => handleDiscipline(e.target.value as ProblemDiscipline)}
          className="text-xs rounded px-2 py-1"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
          }}
        >
          {DISCIPLINE_ORDER.map((opt) => (
            <option key={opt} value={opt}>
              {DISCIPLINE_LABELS[opt]}
            </option>
          ))}
        </select>
      </td>

      <td className="p-3 align-top">
        <select
          value={d.secondaryDiscipline || ''}
          onChange={(e) => handleSecondary(e.target.value)}
          className="text-xs rounded px-2 py-1"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
          }}
        >
          <option value="">— none —</option>
          {DISCIPLINE_ORDER.filter((o) => o !== d.discipline).map((opt) => (
            <option key={opt} value={opt}>
              {DISCIPLINE_LABELS[opt]}
            </option>
          ))}
        </select>
      </td>

      <td className="p-3 align-top">
        <select
          value={d.frequency}
          onChange={(e) => handleFrequency(Number(e.target.value))}
          className="text-xs rounded px-2 py-1"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
          }}
          title={d.frequencyRationale}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <option key={v} value={v}>
              {FREQUENCY_LABELS[v as DiagnosticScore]}
            </option>
          ))}
        </select>
      </td>

      <td className="p-3 align-top">
        <select
          value={d.impact}
          onChange={(e) => handleImpact(Number(e.target.value))}
          className="text-xs rounded px-2 py-1"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
          }}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <option key={v} value={v}>
              {SCORE_LABELS[v as DiagnosticScore]}
            </option>
          ))}
        </select>
      </td>

      <td className="p-3 align-top" style={{ minWidth: 220 }}>
        {editingPhases ? (
          <div className="space-y-1">
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {journeyPhases.map((p) => (
                <label key={p.id} className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={draftPhaseIds.includes(p.id)}
                    onChange={(e) => {
                      setDraftPhaseIds((prev) =>
                        e.target.checked
                          ? [...prev, p.id]
                          : prev.filter((id) => id !== p.id)
                      );
                    }}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={savePhases}
                className="p-1 rounded"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                aria-label="save"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftPhaseIds(d.affectedPhaseIds);
                  setEditingPhases(false);
                }}
                className="p-1 rounded"
                style={{
                  background: 'var(--bg-0)',
                  border: '1px solid var(--border-1)',
                  color: 'var(--fg-2)',
                }}
                aria-label="cancel"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <div className="flex-1 text-[11px]" style={{ color: 'var(--fg-2)' }}>
              {d.affectedPhaseIds.length === 0 ? (
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: 'var(--bg-0)',
                    color: 'var(--fg-2)',
                    border: '1px dashed var(--border-1)',
                  }}
                  title="Systemic problem — not tied to any specific journey phase. Edit to assign phases if it should be phase-scoped."
                >
                  Cross-cutting
                </span>
              ) : (
                d.affectedPhaseIds
                  .map((id) => phasesById.get(id)?.label || id)
                  .join(', ')
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftPhaseIds(d.affectedPhaseIds);
                setEditingPhases(true);
              }}
              className="p-1 rounded opacity-60 hover:opacity-100"
              style={{ color: 'var(--fg-3)' }}
              aria-label="edit phases"
            >
              <Pencil size={11} />
            </button>
          </div>
        )}
      </td>

      <td className="p-3 align-top">
        {d.manuallyEdited ? (
          <span
            className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            EDITED
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
            auto
          </span>
        )}
      </td>
    </tr>
  );
}
