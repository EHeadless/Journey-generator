'use client';

/**
 * Discipline distribution donut.
 *
 * Counting rule (per skill): primary discipline = 1.0, secondary = 0.5.
 * Footnote at the bottom of the chart documents this so the rule isn't
 * invisible to a viewer.
 */

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { ProblemDiagnostic, ProblemDiscipline } from '@/lib/types';
import {
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  disciplineCounts,
} from '@/lib/problem-diagnostics-meta';

interface DisciplineDonutProps {
  diagnostics: ProblemDiagnostic[];
  height?: number;
  /**
   * Optional subtitle shown above the chart. Used by the panel to
   * disambiguate per-journey scoping (e.g. "Arrival · phase-scoped
   * problems only") so the strategist sees clearly which slice the
   * counts represent.
   */
  subtitle?: string;
}

export function DisciplineDonut({ diagnostics, height = 320, subtitle }: DisciplineDonutProps) {
  const data = useMemo(() => {
    const counts = disciplineCounts(diagnostics);
    return DISCIPLINE_ORDER
      .filter((d) => counts[d] > 0)
      .map((d) => ({
        name: DISCIPLINE_LABELS[d],
        discipline: d as ProblemDiscipline,
        value: counts[d],
      }));
  }, [diagnostics]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border text-sm"
        style={{
          height,
          background: 'var(--bg-1)',
          borderColor: 'var(--border-1)',
          color: 'var(--fg-3)',
        }}
      >
        No diagnostics yet — run classification to populate this chart.
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
      <div className="mb-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>
          Discipline distribution
        </h3>
        {subtitle && (
          <p
            className="text-[11px] mt-0.5"
            style={{ color: 'var(--fg-2)' }}
          >
            {subtitle}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
          Primary discipline counts as 1.0; secondary discipline counts as 0.5.
        </p>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.discipline} fill={DISCIPLINE_COLORS[entry.discipline]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number' ? value.toFixed(1) : String(value),
              String(name),
            ]}
            contentStyle={{
              background: 'var(--bg-0)',
              border: '1px solid var(--border-1)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
