'use client';

/**
 * Journey canvas — phase columns with problem cards.
 *
 * Replaces the old `JourneyDisciplineHeatmap` for the diagnostics report.
 * Layout mirrors the workspace canvas pattern: each journey phase is a
 * column, and problems mapped to that phase render as cards inside.
 *
 * Multi-phase problems mirror — the same card appears in every column it
 * affects, so cross-phase patterns are visible at a glance. The card's
 * discipline-colored left border + freq/impact badges keep it readable.
 *
 * Cross-cutting problems (`affectedPhaseIds.length === 0`) live in a
 * dedicated full-width row beneath the phase columns. They're systemic —
 * not tied to any phase — so they don't fit in a column, but the
 * strategist still needs them adjacent to phase context. Same card
 * shape, same discipline filter, same hover-expand.
 *
 * Filterable by primary discipline via the chip strip. Hover expands a
 * card so the strategist can read the full text without clicking.
 */

import { useMemo, useState } from 'react';
import type { JourneyPhase, ProblemDiagnostic, ProblemDiscipline } from '@/lib/types';
import {
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
} from '@/lib/problem-diagnostics-meta';

interface JourneyCanvasProps {
  diagnostics: ProblemDiagnostic[];
  journeyPhases: JourneyPhase[];
  problemTexts: Record<string, string>;
}

export function JourneyCanvas({
  diagnostics,
  journeyPhases,
  problemTexts,
}: JourneyCanvasProps) {
  const [filter, setFilter] = useState<Set<ProblemDiscipline>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const phases = useMemo(
    () => [...journeyPhases].sort((a, b) => a.order - b.order),
    [journeyPhases]
  );

  const filtered = useMemo(() => {
    if (filter.size === 0) return diagnostics;
    return diagnostics.filter((d) => filter.has(d.discipline));
  }, [diagnostics, filter]);

  // For each phase, list the problems that touch it. Multi-phase problems
  // appear in every column they affect — that's the intent ("this problem
  // spans X, Y, Z").
  const cardsByPhase = useMemo(() => {
    const map = new Map<string, ProblemDiagnostic[]>();
    for (const p of phases) map.set(p.id, []);
    for (const d of filtered) {
      for (const phaseId of d.affectedPhaseIds) {
        map.get(phaseId)?.push(d);
      }
    }
    // Sort each column by impact desc, then frequency desc — strategists
    // scan top-to-bottom for severity.
    map.forEach((arr) => {
      arr.sort((a, b) => b.impact - a.impact || b.frequency - a.frequency);
    });
    return map;
  }, [filtered, phases]);

  // Cross-cutting problems: systemic, not tied to a phase. Same severity
  // sort as columns so the worst show up first.
  const crossCuttingCards = useMemo(() => {
    return filtered
      .filter((d) => d.affectedPhaseIds.length === 0)
      .sort((a, b) => b.impact - a.impact || b.frequency - a.frequency);
  }, [filtered]);

  const toggle = (d: ProblemDiscipline) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

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
        No journey phases on this model yet — generate phases first to build the canvas.
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
      <div className="mb-3 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>
            Problems by journey phase
          </h3>
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
            One column per phase. Problems that span multiple phases appear in each affected column. Cross-cutting issues sit in their own row below.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {DISCIPLINE_ORDER.map((d) => {
            const active = filter.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className="px-2 py-0.5 text-xs rounded-full border transition"
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
          {filter.size > 0 && (
            <button
              type="button"
              onClick={() => setFilter(new Set())}
              className="px-2 py-0.5 text-xs rounded-full"
              style={{ color: 'var(--fg-3)' }}
            >
              clear
            </button>
          )}
        </div>
      </div>

      <div
        className="overflow-x-auto"
        style={{ background: 'var(--bg-0)', borderRadius: 6 }}
      >
        <div
          className="flex gap-3 p-3"
          style={{ minWidth: '100%' }}
        >
          {phases.map((p) => {
            const cards = cardsByPhase.get(p.id) || [];
            return (
              <div
                key={p.id}
                className="flex-shrink-0 rounded-md flex flex-col"
                style={{
                  width: 240,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-1)',
                  minHeight: 320,
                }}
              >
                <div
                  className="px-3 py-2 border-b"
                  style={{ borderColor: 'var(--border-1)' }}
                >
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--fg-3)' }}
                  >
                    Phase {p.order + 1}
                  </div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: 'var(--fg-1)' }}
                    title={p.description}
                  >
                    {p.label}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
                    {cards.length} problem{cards.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {cards.length === 0 ? (
                    <div
                      className="text-[11px] text-center py-6"
                      style={{ color: 'var(--fg-3)' }}
                    >
                      no problems
                    </div>
                  ) : (
                    cards.map((d) => (
                      <ProblemCard
                        key={d.id + ':' + p.id}
                        diagnostic={d}
                        text={problemTexts[d.problemSignalId] || '(text missing)'}
                        spansMultiple={d.affectedPhaseIds.length > 1}
                        isHovered={hoveredId === d.id}
                        onHover={() => setHoveredId(d.id)}
                        onLeave={() =>
                          setHoveredId((h) => (h === d.id ? null : h))
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-cutting row. Systemic problems live here — they aren't
          phase-bound, so they don't fit a column. Same card shape,
          same discipline filter (already applied via `filtered`). */}
      {crossCuttingCards.length > 0 && (
        <div
          className="mt-3 rounded-md"
          style={{
            background: 'var(--bg-1)',
            border: '1px dashed var(--border-1)',
          }}
        >
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: 'var(--border-1)' }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--fg-3)' }}
            >
              Cross-cutting
            </div>
            <div
              className="text-sm font-semibold"
              style={{ color: 'var(--fg-1)' }}
            >
              Systemic — not tied to any phase
            </div>
            <div
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--fg-3)' }}
            >
              {crossCuttingCards.length} problem
              {crossCuttingCards.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="p-2 flex flex-wrap gap-2">
            {crossCuttingCards.map((d) => (
              <div key={'xc:' + d.id} style={{ width: 240 }}>
                <ProblemCard
                  diagnostic={d}
                  text={problemTexts[d.problemSignalId] || '(text missing)'}
                  spansMultiple={false}
                  isHovered={hoveredId === d.id}
                  onHover={() => setHoveredId(d.id)}
                  onLeave={() =>
                    setHoveredId((h) => (h === d.id ? null : h))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ProblemCardProps {
  diagnostic: ProblemDiagnostic;
  text: string;
  spansMultiple: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function ProblemCard({
  diagnostic: d,
  text,
  spansMultiple,
  isHovered,
  onHover,
  onLeave,
}: ProblemCardProps) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="rounded p-2 transition-all"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
        borderLeft: `3px solid ${DISCIPLINE_COLORS[d.discipline]}`,
        boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
        position: 'relative',
        zIndex: isHovered ? 5 : 1,
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wide truncate"
        style={{ color: DISCIPLINE_COLORS[d.discipline] }}
      >
        {DISCIPLINE_LABELS[d.discipline]}
        {spansMultiple && (
          <span
            className="ml-1 normal-case"
            style={{ color: 'var(--fg-3)', fontSize: 9 }}
          >
            · spans {d.affectedPhaseIds.length} phases
          </span>
        )}
      </div>
      <div
        className="text-[11px] leading-snug mt-1"
        style={{
          color: 'var(--fg-1)',
          display: '-webkit-box',
          WebkitLineClamp: isHovered ? 8 : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text}
      </div>
      <div
        className="mt-1.5 flex items-center gap-1 text-[10px]"
        style={{ color: 'var(--fg-3)' }}
      >
        <span
          className="rounded px-1"
          style={{
            background: 'var(--bg-0)',
            border: '1px solid var(--border-1)',
          }}
        >
          F{d.frequency}
        </span>
        <span
          className="rounded px-1"
          style={{
            background: 'var(--bg-0)',
            border: '1px solid var(--border-1)',
          }}
        >
          I{d.impact}
        </span>
        {d.secondaryDiscipline && (
          <span className="truncate">
            · {DISCIPLINE_LABELS[d.secondaryDiscipline]}
          </span>
        )}
      </div>
      {isHovered && d.impactRationale && (
        <div
          className="mt-1.5 pt-1.5 text-[10px]"
          style={{
            color: 'var(--fg-3)',
            borderTop: '1px solid var(--border-1)',
          }}
        >
          {d.impactRationale}
        </div>
      )}
    </div>
  );
}
