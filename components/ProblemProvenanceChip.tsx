'use client';

/**
 * Problem provenance chip — renders the "Addresses N problem(s)" line
 * underneath an Informed-Landscape demand-space card so the strategist
 * can prove every JTBD is grounded in a classified diagnostic.
 *
 * Pure presentational. The parent must resolve the
 * `InformedProblemPayload` rows; this component just renders them.
 *
 * Used by: app/model/[id]/page.tsx (DemandSpaceCard) on the Informed
 * Landscape route only.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import type { InformedProblemPayload } from '@/lib/extraction/informed-context';
import { DISCIPLINE_LABELS } from '@/lib/problem-diagnostics-meta';

const QUADRANT_STYLE: Record<
  NonNullable<InformedProblemPayload['quadrant']>,
  { label: string; bg: string; fg: string; border: string }
> = {
  quickWins: {
    label: 'Quick Win',
    bg: '#dcfce7',
    fg: '#15803d',
    border: '#86efac',
  },
  majorProjects: {
    label: 'Major Project',
    bg: '#fef3c7',
    fg: '#a16207',
    border: '#fde68a',
  },
  timeSinks: {
    label: 'Time Sink',
    bg: '#fee2e2',
    fg: '#b91c1c',
    border: '#fecaca',
  },
  minor: {
    label: 'Minor',
    bg: '#e5e7eb',
    fg: '#4b5563',
    border: '#d1d5db',
  },
};

export interface ProblemProvenanceChipProps {
  /** Resolved problem rows. Empty = render nothing. */
  problems: InformedProblemPayload[];
  /** Optional href base — clicking a row opens diagnostics with focus. */
  modelId?: string;
}

export function ProblemProvenanceChip({
  problems,
  modelId,
}: ProblemProvenanceChipProps) {
  const [open, setOpen] = useState(false);

  if (problems.length === 0) return null;

  return (
    <div
      className="mt-2 rounded-md border border-dashed"
      style={{
        borderColor: 'var(--border-1)',
        background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide uppercase"
        style={{ color: 'var(--accent)' }}
        title="Problems this JTBD addresses"
      >
        <span className="flex items-center gap-1.5">
          <Link2 size={11} />
          Addresses {problems.length} problem{problems.length === 1 ? '' : 's'}
        </span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <ul
          className="px-2 pb-2 flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {problems.map((p) => {
            const quad = p.quadrant ? QUADRANT_STYLE[p.quadrant] : null;
            const disc = DISCIPLINE_LABELS[p.discipline];
            const href = modelId
              ? `/model/${modelId}/diagnostics?focus=${encodeURIComponent(p.id)}`
              : undefined;
            const Inner = (
              <div
                className="flex flex-col gap-1 rounded-md p-2"
                style={{
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border-1)',
                }}
              >
                <div className="flex flex-wrap items-center gap-1">
                  {quad && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide py-0.5 px-1.5 rounded"
                      style={{
                        background: quad.bg,
                        color: quad.fg,
                        border: `1px solid ${quad.border}`,
                      }}
                      title="Frequency × Impact quadrant"
                    >
                      {quad.label}
                    </span>
                  )}
                  <span
                    className="text-[9px] font-medium py-0.5 px-1.5 rounded"
                    style={{
                      background: 'var(--bg-2)',
                      color: 'var(--fg-2)',
                      border: '1px solid var(--border-1)',
                    }}
                    title="Discipline"
                  >
                    {disc}
                  </span>
                  <span
                    className="text-[9px] font-medium py-0.5 px-1.5 rounded"
                    style={{
                      background: 'var(--bg-2)',
                      color: 'var(--fg-3)',
                      border: '1px solid var(--border-1)',
                    }}
                    title="Frequency / Impact"
                  >
                    F{p.frequency} I{p.impact}
                  </span>
                </div>
                <div
                  className="text-[11px] leading-snug line-clamp-3"
                  style={{ color: 'var(--fg-1)' }}
                >
                  {p.text}
                </div>
              </div>
            );
            return (
              <li key={p.id}>
                {href ? (
                  <a
                    href={href}
                    className="block hover:opacity-90 transition-opacity"
                    title="Open in Problem Diagnostics"
                  >
                    {Inner}
                  </a>
                ) : (
                  Inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
