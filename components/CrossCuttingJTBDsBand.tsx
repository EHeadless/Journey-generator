'use client';

/**
 * Cross-cutting JTBDs band — sibling section under the journey canvas
 * for the Informed Landscape route only.
 *
 * Renders demand spaces (Jobs to Be Done) that address SYSTEMIC problems —
 * those with `affectedPhaseIds: []`, i.e. they don't belong to any single
 * journey phase. Examples: organisational/data/governance/brand-level JTBDs.
 *
 * Each card shows:
 *   - label + JTBD narrative
 *   - "Addresses N problem(s)" provenance chip (via ProblemProvenanceChip)
 *   - The 5 generated circumstances for this demand space
 *
 * Empty state: tells the strategist N cross-cutting problems were
 * detected and offers a Generate button.
 */

import { useState } from 'react';
import { Loader2, Sparkles, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { DemandSpace, Circumstance } from '@/lib/types';
import type { InformedProblemPayload } from '@/lib/extraction/informed-context';
import { ProblemProvenanceChip } from './ProblemProvenanceChip';

const AXIS_STYLES: Record<
  'knowledge' | 'intent' | 'composition' | 'constraint' | 'moment',
  { bg: string; fg: string; border: string; label: string }
> = {
  knowledge: { bg: '#e0f2fe', fg: '#0369a1', border: '#bae6fd', label: 'Knowledge' },
  intent: { bg: '#fef3c7', fg: '#b45309', border: '#fde68a', label: 'Intent' },
  composition: { bg: '#ede9fe', fg: '#6d28d9', border: '#ddd6fe', label: 'Composition' },
  constraint: { bg: '#ffe4e6', fg: '#be123c', border: '#fecdd3', label: 'Constraint' },
  moment: { bg: '#d1fae5', fg: '#047857', border: '#a7f3d0', label: 'Moment' },
};

export interface CrossCuttingJTBDsBandProps {
  modelId: string;
  /** Cross-cutting demand spaces (scope === 'cross-cutting'). */
  demandSpaces: DemandSpace[];
  /** All circumstances for the model — filtered per demand space here. */
  circumstances: Circumstance[];
  /** Lookup map for provenance rendering. */
  problemsById: Map<string, InformedProblemPayload>;
  /** Total count of cross-cutting problems (for header + empty state). */
  crossCuttingProblemCount: number;
  isGenerating: boolean;
  isGeneratingCircumstances: Record<string, boolean>;
  onGenerate: () => void;
}

export function CrossCuttingJTBDsBand({
  modelId,
  demandSpaces,
  circumstances,
  problemsById,
  crossCuttingProblemCount,
  isGenerating,
  isGeneratingCircumstances,
  onGenerate,
}: CrossCuttingJTBDsBandProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Don't render anything if there are no cross-cutting problems and no
  // already-generated cross-cutting demand spaces.
  if (crossCuttingProblemCount === 0 && demandSpaces.length === 0) return null;

  const hasCards = demandSpaces.length > 0;

  return (
    <section
      className="mt-6 rounded-xl border"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-1)' }}>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <div>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--fg-1)' }}>
              Cross-cutting JTBDs
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
              {crossCuttingProblemCount} systemic problem
              {crossCuttingProblemCount === 1 ? '' : 's'} · these motivations cut across the entire customer journey
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || crossCuttingProblemCount === 0}
          className="btn btn--sm"
          style={{
            background: hasCards ? 'var(--bg-2)' : 'var(--accent)',
            color: hasCards ? 'var(--fg-1)' : 'white',
            opacity: isGenerating || crossCuttingProblemCount === 0 ? 0.5 : 1,
          }}
          title={
            crossCuttingProblemCount === 0
              ? 'No cross-cutting problems detected'
              : hasCards
                ? 'Re-generate cross-cutting JTBDs'
                : 'Generate cross-cutting JTBDs'
          }
        >
          {isGenerating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Generating…
            </>
          ) : hasCards ? (
            <>
              <RotateCw size={12} />
              Re-generate
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Generate
            </>
          )}
        </button>
      </header>

      {!collapsed && (
        <div className="p-4">
          {!hasCards && crossCuttingProblemCount > 0 && (
            <div
              className="rounded-lg border-dashed border p-6 text-center text-xs"
              style={{
                borderColor: 'var(--border-1)',
                color: 'var(--fg-3)',
                background: 'var(--bg-2)',
              }}
            >
              {crossCuttingProblemCount} cross-cutting problem
              {crossCuttingProblemCount === 1 ? '' : 's'} found. These don&apos;t belong to any phase.
              Generate JTBDs to address them.
            </div>
          )}

          {hasCards && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {demandSpaces.map((ds) => {
                const dsCircumstances = circumstances
                  .filter((c) => c.demandSpaceId === ds.id)
                  .slice()
                  .sort((a, b) => a.order - b.order);
                const provenanceProblems = (ds.sourceProblemIds || [])
                  .map((id) => problemsById.get(id))
                  .filter((p): p is InformedProblemPayload => Boolean(p));
                const isLoadingCircs = isGeneratingCircumstances[ds.id];
                return (
                  <article
                    key={ds.id}
                    className="flex-shrink-0 rounded-lg border p-3 flex flex-col gap-2"
                    style={{
                      width: 320,
                      background: 'var(--bg-2)',
                      borderColor: 'var(--border-1)',
                    }}
                  >
                    <div>
                      <div className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--fg-1)' }}>
                        {ds.label || '(unnamed)'}
                      </div>
                      <div className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                        {ds.jobToBeDone}
                      </div>
                    </div>

                    <ProblemProvenanceChip problems={provenanceProblems} modelId={modelId} />

                    {isLoadingCircs ? (
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--fg-3)' }}>
                        <Loader2 size={11} className="animate-spin" />
                        Generating circumstances…
                      </div>
                    ) : dsCircumstances.length > 0 ? (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {dsCircumstances.map((c, idx) => (
                          <div
                            key={c.id}
                            className="rounded p-2 text-[10px] flex flex-col gap-1"
                            style={{
                              background: 'var(--bg-3)',
                              border: '1px solid var(--border-1)',
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase tracking-wide" style={{ color: 'var(--fg-3)' }}>
                                Circumstance {idx + 1}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(['knowledge', 'intent', 'composition', 'constraint', 'moment'] as const).map((axis) => {
                                const s = AXIS_STYLES[axis];
                                const value = c[axis];
                                return (
                                  <span
                                    key={axis}
                                    className="py-0.5 px-1.5 rounded font-medium"
                                    style={{
                                      background: s.bg,
                                      color: s.fg,
                                      border: `1px solid ${s.border}`,
                                      fontSize: 9,
                                    }}
                                    title={`${s.label}: ${value}`}
                                  >
                                    <span style={{ opacity: 0.7, marginRight: 3 }}>{s.label}:</span>
                                    {value}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
