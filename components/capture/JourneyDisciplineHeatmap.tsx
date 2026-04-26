'use client';

/**
 * Journey × Discipline heatmap.
 *
 * Rows = the 8 disciplines, columns = the model's existing journey
 * phases (in order). Each cell's color encodes aggregated freq × impact
 * across all problems whose primary discipline matches the row AND that
 * affect the column's phase. Click a cell to see the underlying
 * problems.
 */

import { useMemo, useState } from 'react';
import type { JourneyPhase, ProblemDiagnostic } from '@/lib/types';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  heatColor,
} from '@/lib/problem-diagnostics-meta';

interface HeatmapProps {
  diagnostics: ProblemDiagnostic[];
  journeyPhases: JourneyPhase[];
  problemTexts: Record<string, string>;
}

interface CellData {
  count: number;
  /** Sum of freq*impact across the cell's problems — the heat. */
  heat: number;
  diagnostics: ProblemDiagnostic[];
}

export function JourneyDisciplineHeatmap({
  diagnostics,
  journeyPhases,
  problemTexts,
}: HeatmapProps) {
  const [selectedCell, setSelectedCell] = useState<{
    phaseId: string;
    discipline: string;
  } | null>(null);

  const phases = useMemo(
    () => [...journeyPhases].sort((a, b) => a.order - b.order),
    [journeyPhases]
  );

  const { cells, maxHeat } = useMemo(() => {
    const cells = new Map<string, CellData>();
    let maxHeat = 0;
    for (const d of diagnostics) {
      for (const phaseId of d.affectedPhaseIds) {
        const key = `${d.discipline}::${phaseId}`;
        const existing = cells.get(key) || {
          count: 0,
          heat: 0,
          diagnostics: [],
        };
        existing.count += 1;
        existing.heat += d.frequency * d.impact;
        existing.diagnostics.push(d);
        cells.set(key, existing);
        if (existing.heat > maxHeat) maxHeat = existing.heat;
      }
    }
    return { cells, maxHeat };
  }, [diagnostics]);

  const selectedDiagnostics = useMemo(() => {
    if (!selectedCell) return [];
    const key = `${selectedCell.discipline}::${selectedCell.phaseId}`;
    return cells.get(key)?.diagnostics || [];
  }, [selectedCell, cells]);

  if (phases.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-sm"
        style={{
          background: 'var(--bg-1)',
          borderColor: 'var(--border-1)',
          color: 'var(--fg-3)',
        }}
      >
        No journey phases on this model yet — generate phases first to build the heatmap.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>
          Journey × Discipline heatmap
        </h3>
        <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
          Cell color = sum of (frequency × impact) for problems in that
          phase × discipline. Click a cell to see the underlying problems.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th
                className="text-left p-2 font-medium sticky left-0"
                style={{ background: 'var(--bg-1)', color: 'var(--fg-2)', minWidth: 160 }}
              >
                Discipline
              </th>
              {phases.map((p) => (
                <th
                  key={p.id}
                  className="p-2 font-medium text-center"
                  style={{ color: 'var(--fg-2)', minWidth: 110 }}
                  title={p.description}
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISCIPLINE_ORDER.map((d) => (
              <tr key={d}>
                <td
                  className="p-2 font-medium sticky left-0"
                  style={{
                    background: 'var(--bg-1)',
                    color: 'var(--fg-1)',
                  }}
                >
                  {DISCIPLINE_LABELS[d]}
                </td>
                {phases.map((p) => {
                  const cell = cells.get(`${d}::${p.id}`);
                  const intensity = cell && maxHeat > 0 ? cell.heat / maxHeat : 0;
                  const color = cell ? heatColor(intensity) : 'transparent';
                  const isSelected =
                    selectedCell?.phaseId === p.id &&
                    selectedCell?.discipline === d;
                  return (
                    <td key={p.id} className="p-1">
                      <button
                        type="button"
                        onClick={() =>
                          cell
                            ? setSelectedCell(
                                isSelected
                                  ? null
                                  : { phaseId: p.id, discipline: d }
                              )
                            : null
                        }
                        disabled={!cell}
                        className="w-full h-12 rounded text-xs font-medium transition-all"
                        style={{
                          background: cell ? color : 'var(--bg-0)',
                          color: cell ? '#fff' : 'var(--fg-3)',
                          border: isSelected
                            ? '2px solid var(--accent)'
                            : '1px solid var(--border-1)',
                          cursor: cell ? 'pointer' : 'default',
                          opacity: cell ? 1 : 0.4,
                        }}
                        title={
                          cell
                            ? `${cell.count} problem${cell.count === 1 ? '' : 's'} · heat ${cell.heat}`
                            : 'no problems'
                        }
                      >
                        {cell ? cell.count : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && selectedDiagnostics.length > 0 && (
        <div
          className="mt-4 rounded p-3 text-xs"
          style={{
            background: 'var(--bg-0)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-2)',
          }}
        >
          <div className="font-semibold mb-2" style={{ color: 'var(--fg-1)' }}>
            {DISCIPLINE_LABELS[selectedCell.discipline as keyof typeof DISCIPLINE_LABELS]}
            {' · '}
            {phases.find((p) => p.id === selectedCell.phaseId)?.label}
          </div>
          <ul className="space-y-2">
            {selectedDiagnostics.map((d) => (
              <li key={d.id}>
                <div style={{ color: 'var(--fg-1)' }}>
                  {problemTexts[d.problemSignalId] || '(text missing)'}
                </div>
                <div className="opacity-70 mt-0.5">
                  freq {d.frequency} · impact {d.impact}
                  {d.secondaryDiscipline
                    ? ` · also ${DISCIPLINE_LABELS[d.secondaryDiscipline]}`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
