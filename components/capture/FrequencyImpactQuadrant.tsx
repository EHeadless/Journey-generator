'use client';

/**
 * Frequency × Impact 2×2 matrix.
 *
 * Quadrants:
 *   - top-left:    Quick Wins      (low freq, high impact)
 *   - top-right:   Major Projects  (high freq, high impact)
 *   - bottom-left: Minor           (low freq, low impact)
 *   - bottom-right: Time Sinks     (high freq, low impact)
 *
 * Layout: full-width CSS grid. Each problem renders as a card positioned
 * by its (frequency, impact) coordinates. Cards show truncated problem
 * text with a discipline-colored accent. Multiple problems at the same
 * coordinates stack vertically with a small offset; hover raises the
 * top card to the front and shows the full text plus rationales.
 *
 * Stack cycling: when a stack contains more than one card, the raised
 * card shows ‹ › chevrons that cycle through the cards at the same
 * (frequency, impact) coordinates without forcing the strategist to
 * pick out individual cards from the visual stack.
 *
 * Filterable by primary discipline via the chip strip.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProblemDiagnostic, ProblemDiscipline } from '@/lib/types';
import {
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
} from '@/lib/problem-diagnostics-meta';

interface QuadrantProps {
  diagnostics: ProblemDiagnostic[];
  problemTexts: Record<string, string>;
  /** Visual height of the matrix area. Defaults to 640. */
  height?: number;
}

export function FrequencyImpactQuadrant({
  diagnostics,
  problemTexts,
  height = 640,
}: QuadrantProps) {
  const [filter, setFilter] = useState<Set<ProblemDiscipline>>(new Set());

  const filtered = useMemo(() => {
    if (filter.size === 0) return diagnostics;
    return diagnostics.filter((d) => filter.has(d.discipline));
  }, [diagnostics, filter]);

  const toggle = (d: ProblemDiscipline) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  if (diagnostics.length === 0) {
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
        No diagnostics yet.
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
            Frequency × Impact
          </h3>
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
            One card per problem. Hover to read the full text. Stacks of overlapping cards have ‹ › chevrons to cycle through.
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

      <QuadrantGrid
        height={height}
        diagnostics={filtered}
        problemTexts={problemTexts}
      />
    </div>
  );
}

interface QuadrantGridProps {
  height: number;
  diagnostics: ProblemDiagnostic[];
  problemTexts: Record<string, string>;
}

/**
 * Vertical offset between cards in a stack. Small enough that the
 * group still reads as a single point on the matrix, large enough that
 * each card's discipline strip is individually clickable.
 */
const STACK_OFFSET_PX = 6;

/** Card visual width in px (matches the inline `width: 180`). */
const CARD_W = 180;
/** Inner padding so clamped cards never abut the matrix border. */
const PAD_PX = 12;
/**
 * Maximum cards rendered as a visible stack. Buckets with more than
 * MAX_VISIBLE problems collapse the overflow into a "+N more" chip.
 * Five keeps the stack height bounded so it can't escape the matrix
 * even on the bottom rows.
 */
const MAX_VISIBLE = 5;
/** Approximate height of a single (non-active) card body. */
const ESTIMATED_CARD_H = 84;
/** Approximate height of the "+N more" chip. */
const CHIP_H = 22;
/**
 * Total bounded stack height used to clamp the wrapper's `top` so the
 * fully-rendered stack stays inside the matrix on the bottom row.
 */
const STACK_TOTAL_H =
  ESTIMATED_CARD_H + (MAX_VISIBLE - 1) * STACK_OFFSET_PX + CHIP_H;

interface ActiveStack {
  /** "freq::impact" bucket key — identifies the (x, y) coordinate. */
  key: string;
  /** Which card in the bucket is currently raised. */
  index: number;
}

function QuadrantGrid({
  height,
  diagnostics,
  problemTexts,
}: QuadrantGridProps) {
  // Active stack tracks a bucket + index instead of a single card id.
  // This is what makes the prev/next chevrons work: cycling the index
  // simply re-raises a different card in the same bucket without ever
  // unmounting the wrapper, so the strategist can step through stacked
  // cards from a single hover.
  const [activeStack, setActiveStack] = useState<ActiveStack | null>(null);
  // Bucket whose "+N more" overflow popover is currently open. Null
  // when no popover is visible. Only one popover may be open at a time.
  const [overflowKey, setOverflowKey] = useState<string | null>(null);

  // Bucket cards by (freq, impact) so we can offset stacks deterministically
  // and so prev/next can cycle through the correct subset.
  const buckets = useMemo(() => {
    const map = new Map<string, ProblemDiagnostic[]>();
    for (const d of diagnostics) {
      const key = `${d.frequency}::${d.impact}`;
      const arr = map.get(key) || [];
      arr.push(d);
      map.set(key, arr);
    }
    // Stable order within a bucket so re-renders don't reshuffle stacks.
    map.forEach((rows) => rows.sort((a, b) => a.id.localeCompare(b.id)));
    return map;
  }, [diagnostics]);

  const cycleStack = (key: string, delta: number) => {
    const rows = buckets.get(key);
    if (!rows || rows.length <= 1) return;
    // Cap cycling to the visible slice — overflow rows are reachable
    // via the "+N more" popover, not via the inline chevrons.
    const len = Math.min(rows.length, MAX_VISIBLE);
    if (len <= 1) return;
    setActiveStack((prev) => {
      const cur = prev && prev.key === key ? prev.index : 0;
      const next = (cur + delta + len) % len;
      return { key, index: next };
    });
  };

  return (
    <div
      className="relative w-full rounded"
      style={{
        height,
        background: 'var(--bg-0)',
        border: '1px solid var(--border-1)',
        // Clip cards (and their hover shadow) so an overflowing stack
        // can never bleed past the matrix bounds. Combined with the
        // per-card clamp() below, this makes the matrix self-contained.
        overflow: 'hidden',
      }}
    >
      {/* Quadrant background tint (subtle) */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          pointerEvents: 'none',
        }}
      >
        <div style={{ background: 'rgba(16,185,129,0.04)' }} />
        {/* top-right (Major Projects) — light warning tint */}
        <div style={{ background: 'rgba(239,68,68,0.05)' }} />
        {/* bottom-left (Minor) */}
        <div style={{ background: 'transparent' }} />
        {/* bottom-right (Time Sinks) */}
        <div style={{ background: 'rgba(245,158,11,0.04)' }} />
      </div>

      {/* Mid-lines */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0,
          bottom: 0,
          left: '50%',
          width: 0,
          borderLeft: '1px dashed var(--border-1)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0,
          right: 0,
          top: '50%',
          height: 0,
          borderTop: '1px dashed var(--border-1)',
        }}
      />

      {/* Quadrant labels */}
      <QuadrantLabel position="top-left">QUICK WINS</QuadrantLabel>
      <QuadrantLabel position="top-right">MAJOR PROJECTS</QuadrantLabel>
      <QuadrantLabel position="bottom-left">MINOR</QuadrantLabel>
      <QuadrantLabel position="bottom-right">TIME SINKS</QuadrantLabel>

      {/* Axis labels */}
      <div
        className="absolute text-[11px] font-semibold"
        style={{
          left: '50%',
          bottom: 6,
          transform: 'translateX(-50%)',
          color: 'var(--fg-2)',
        }}
      >
        Frequency →
      </div>
      <div
        className="absolute text-[11px] font-semibold"
        style={{
          left: 8,
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'left center',
          color: 'var(--fg-2)',
        }}
      >
        Impact →
      </div>

      {/* Cards — rendered per-bucket so the prev/next cycling logic has
          a stable, indexed group to step through. */}
      {Array.from(buckets.entries()).map(([key, rows]) => {
        const sample = rows[0];
        // Map score 1..5 → 10%..90% so cards never sit on the edge.
        const xPct = 10 + ((sample.frequency - 1) / 4) * 80;
        const yPct = 10 + ((5 - sample.impact) / 4) * 80;
        const stackSize = rows.length;
        const activeIndex =
          activeStack && activeStack.key === key ? activeStack.index : -1;
        // Clamp the wrapper so the stack stays inside the matrix
        // regardless of viewport width or which corner the bucket sits
        // in. CSS clamp(min, preferred, max) keeps the natural
        // calc(...) preferred position when it fits, and rails it to
        // the padded edges when it doesn't.
        const leftCss = `clamp(${PAD_PX}px, calc(${xPct}% - 90px), calc(100% - ${
          CARD_W + PAD_PX
        }px))`;
        const topMaxPx = Math.max(PAD_PX, height - STACK_TOTAL_H - PAD_PX);
        const topCss = `clamp(${PAD_PX}px, calc(${yPct}% - 18px), ${topMaxPx}px)`;
        // Only render the first MAX_VISIBLE cards as a stack; the rest
        // collapse behind a "+N more" chip whose popover lists them.
        const visibleRows = rows.slice(0, MAX_VISIBLE);
        const overflowRows = rows.slice(MAX_VISIBLE);
        const isOverflowOpen = overflowKey === key;

        return (
          <div
            key={key}
            // The wrapper covers the whole stack so mouseLeave fires
            // only when the cursor exits the entire group, not when it
            // crosses between cards or onto a chevron.
            onMouseLeave={() =>
              setActiveStack((prev) => (prev && prev.key === key ? null : prev))
            }
            style={{
              position: 'absolute',
              left: leftCss,
              top: topCss,
              width: CARD_W,
              maxWidth: '22vw',
              zIndex: isOverflowOpen ? 100 : undefined,
            }}
          >
            {visibleRows.map((diagnostic, stackIndex) => {
              const isActive = activeIndex === stackIndex;
              const stackOffset = stackIndex * STACK_OFFSET_PX;
              const text =
                problemTexts[diagnostic.problemSignalId] || '(text missing)';
              const visibleCount = visibleRows.length;
              return (
                <div
                  key={diagnostic.id}
                  onMouseEnter={() =>
                    setActiveStack({ key, index: stackIndex })
                  }
                  className="absolute rounded-md shadow-sm cursor-default transition-transform"
                  style={{
                    left: 0,
                    top: stackOffset,
                    width: CARD_W,
                    maxWidth: '22vw',
                    padding: '6px 8px',
                    background: 'var(--bg-2)',
                    borderLeft: `3px solid ${DISCIPLINE_COLORS[diagnostic.discipline]}`,
                    border: '1px solid var(--border-1)',
                    color: 'var(--fg-1)',
                    zIndex: isActive ? 50 : 10 + stackIndex,
                    transform: isActive ? 'scale(1.03)' : 'none',
                    // Reduced shadow blur so the active card's hover
                    // glow doesn't visibly bleed past the matrix's
                    // overflow:hidden clip on edge buckets.
                    boxShadow: isActive
                      ? '0 4px 12px rgba(0,0,0,0.18)'
                      : '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                  title={text}
                >
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wide flex items-center justify-between gap-1"
                    style={{ color: DISCIPLINE_COLORS[diagnostic.discipline] }}
                  >
                    <span className="truncate">
                      {DISCIPLINE_LABELS[diagnostic.discipline]}
                      {visibleCount > 1
                        ? ` · ${stackIndex + 1}/${visibleCount}`
                        : ''}
                    </span>
                    {/* Prev/next chevrons appear only on the raised
                        card in a multi-card stack — clicking them
                        cycles which card is on top without making the
                        user pick from the visual pile. */}
                    {isActive && visibleCount > 1 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleStack(key, -1);
                          }}
                          className="rounded hover:opacity-80"
                          style={{
                            background: 'var(--bg-0)',
                            border: '1px solid var(--border-1)',
                            color: 'var(--fg-2)',
                            padding: '0 2px',
                            lineHeight: 0,
                          }}
                          aria-label="Previous problem in stack"
                          title="Previous in stack"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleStack(key, 1);
                          }}
                          className="rounded hover:opacity-80"
                          style={{
                            background: 'var(--bg-0)',
                            border: '1px solid var(--border-1)',
                            color: 'var(--fg-2)',
                            padding: '0 2px',
                            lineHeight: 0,
                          }}
                          aria-label="Next problem in stack"
                          title="Next in stack"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[11px] leading-snug mt-0.5"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: isActive ? 6 : 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {text}
                  </div>
                  <div
                    className="mt-1 flex items-center gap-1 text-[10px]"
                    style={{ color: 'var(--fg-3)' }}
                  >
                    <span
                      className="rounded px-1"
                      style={{
                        background: 'var(--bg-0)',
                        border: '1px solid var(--border-1)',
                      }}
                    >
                      F{diagnostic.frequency}
                    </span>
                    <span
                      className="rounded px-1"
                      style={{
                        background: 'var(--bg-0)',
                        border: '1px solid var(--border-1)',
                      }}
                    >
                      I{diagnostic.impact}
                    </span>
                    {diagnostic.secondaryDiscipline && (
                      <span className="truncate">
                        · {DISCIPLINE_LABELS[diagnostic.secondaryDiscipline]}
                      </span>
                    )}
                  </div>
                  {isActive && diagnostic.impactRationale && (
                    <div
                      className="mt-1 text-[10px] pt-1"
                      style={{
                        color: 'var(--fg-3)',
                        borderTop: '1px solid var(--border-1)',
                      }}
                    >
                      {diagnostic.impactRationale}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Overflow chip — buckets with more than MAX_VISIBLE
                problems collapse the rest behind this chip. Clicking
                it toggles a popover listing the remaining problems
                with the same discipline color bar. */}
            {overflowRows.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOverflowKey((prev) => (prev === key ? null : key));
                }}
                className="absolute rounded-full text-[10px] font-semibold transition"
                style={{
                  left: 0,
                  top:
                    (visibleRows.length - 1) * STACK_OFFSET_PX +
                    ESTIMATED_CARD_H,
                  width: CARD_W,
                  maxWidth: '22vw',
                  padding: '3px 8px',
                  background: 'var(--bg-0)',
                  border: '1px solid var(--border-1)',
                  color: 'var(--fg-2)',
                  zIndex: 60,
                }}
                aria-label={`Show ${overflowRows.length} more problems in this bucket`}
              >
                +{overflowRows.length} more
              </button>
            )}
            {isOverflowOpen && overflowRows.length > 0 && (() => {
              // Flip popover above the stack when the bucket sits in
              // the lower half of the matrix; flip to right-anchored
              // when in the right half. Keeps the popover inside the
              // overflow:hidden matrix bounds without needing a portal.
              const POP_H = 220;
              const POP_W = CARD_W * 1.4;
              const chipTop =
                (visibleRows.length - 1) * STACK_OFFSET_PX +
                ESTIMATED_CARD_H;
              const yPx = (yPct / 100) * height;
              const placeAbove =
                yPx + STACK_TOTAL_H + POP_H + PAD_PX > height;
              const placeRight = xPct > 50;
              const verticalStyle = placeAbove
                ? { bottom: chipTop + CHIP_H + 8 }
                : { top: chipTop + CHIP_H + 4 };
              const horizontalStyle = placeRight
                ? { right: 0 }
                : { left: 0 };
              return (
                <div
                  className="absolute rounded-md shadow-lg"
                  style={{
                    ...verticalStyle,
                    ...horizontalStyle,
                    width: POP_W,
                    maxWidth: '32vw',
                    maxHeight: POP_H,
                    overflowY: 'auto',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border-1)',
                    zIndex: 200,
                  }}
                  onMouseLeave={() => setOverflowKey(null)}
                >
                <div
                  className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide sticky top-0"
                  style={{
                    color: 'var(--fg-3)',
                    background: 'var(--bg-1)',
                    borderBottom: '1px solid var(--border-1)',
                  }}
                >
                  {overflowRows.length} more at F{sample.frequency} · I
                  {sample.impact}
                </div>
                {overflowRows.map((diagnostic) => {
                  const text =
                    problemTexts[diagnostic.problemSignalId] ||
                    '(text missing)';
                  return (
                    <div
                      key={diagnostic.id}
                      className="px-2 py-1.5 text-[11px] leading-snug"
                      style={{
                        borderLeft: `3px solid ${DISCIPLINE_COLORS[diagnostic.discipline]}`,
                        borderBottom: '1px solid var(--border-1)',
                        color: 'var(--fg-1)',
                      }}
                      title={text}
                    >
                      <div
                        className="text-[9px] font-semibold uppercase tracking-wide mb-0.5"
                        style={{
                          color: DISCIPLINE_COLORS[diagnostic.discipline],
                        }}
                      >
                        {DISCIPLINE_LABELS[diagnostic.discipline]}
                      </div>
                      {text}
                    </div>
                  );
                })}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Axis tick numbers (5 on each axis) */}
      {[1, 2, 3, 4, 5].map((v) => {
        const x = 10 + ((v - 1) / 4) * 80;
        const y = 10 + ((5 - v) / 4) * 80;
        return (
          <span key={`x-${v}`}>
            <span
              className="absolute text-[9px] pointer-events-none"
              style={{
                left: `calc(${x}% - 4px)`,
                bottom: 22,
                color: 'var(--fg-3)',
              }}
            >
              {v}
            </span>
            <span
              className="absolute text-[9px] pointer-events-none"
              style={{
                left: 24,
                top: `calc(${y}% - 6px)`,
                color: 'var(--fg-3)',
              }}
            >
              {v}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function QuadrantLabel({
  position,
  children,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  children: string;
}) {
  const style: React.CSSProperties = {
    color: 'var(--fg-3)',
    fontSize: 10,
    letterSpacing: '0.1em',
    pointerEvents: 'none',
    fontWeight: 700,
    position: 'absolute',
  };
  if (position === 'top-left') Object.assign(style, { top: 8, left: 12 });
  if (position === 'top-right') Object.assign(style, { top: 8, right: 12 });
  if (position === 'bottom-left') Object.assign(style, { bottom: 28, left: 12 });
  if (position === 'bottom-right')
    Object.assign(style, { bottom: 28, right: 12 });
  return <div style={style}>{children}</div>;
}
