'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Plus,
  Minus,
  Maximize,
  X,
  ArrowLeft,
  ArrowUp,
  Download,
  SlidersHorizontal,
  Layers,
  MoreHorizontal,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Wand2,
  Zap,
  PanelRightOpen,
  PanelRightClose,
  Check,
} from 'lucide-react';
import { useTheme, type ThemeConfig } from '@/lib/hooks/useTheme';
import { useCanvasController } from '@/lib/hooks/useCanvasController';
import { useToolsRail } from '@/lib/hooks/useToolsRail';
import { useStore } from '@/lib/store';
import { DemandSpace, Circumstance, JourneyPhase } from '@/lib/types';
import { StepProgress } from '@/components/StepProgress';
import { ToolsRail } from '@/components/ToolsRail';
import { TweaksPanel } from '@/components/TweaksPanel';
import { HypothesisVariantsBar } from '@/components/HypothesisVariantsBar';
import { InformedVariantsBar } from '@/components/InformedVariantsBar';
import { useCaptureStore, useHasDiagnostics } from '@/lib/captureStore';
import { useHydratedCaptureStore } from '@/components/capture/CaptureWorkshopCard';
import { quadrantOf } from '@/lib/problem-diagnostics-meta';
import type { InformedProblemPayload } from '@/lib/extraction/informed-context';
import { ProblemProvenanceChip } from '@/components/ProblemProvenanceChip';
import { CrossCuttingJTBDsBand } from '@/components/CrossCuttingJTBDsBand';

// Phase accent colors
const PHASE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

// Persona accent colors
const PERSONA_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6'];

// Variation style tunables
const VARIATION_STYLE = {
  v1: { colW: 360, cardW: 320, gap: 18, stackGap: 14, phasePad: 18 },
};

interface DisplayPhase {
  id: string;
  order: number;
  label: string;
  accent: string;
  trigger: string;
  counts: { spaces: number; circumstances: number };
  /**
   * Where the phase came from — mirrors JourneyPhase.source on the store.
   * `'user'` phases were preloaded from the brief (e.g. the Dubai Airport
   * example or typed by the user) and get a small "from brief" chip so
   * strategists can see at a glance which phases they own vs which the
   * model generated.
   */
  source?: 'user' | 'ai' | 'discovery';
}

interface DisplayDemandSpace {
  id: string;
  label: string;
  jtbd: string;
  circumstances: Circumstance[];
  isLoading?: boolean;
  /** Provenance back to Problem Diagnostics — present on Informed cards. */
  sourceProblemIds?: string[];
}

// Colour tokens per axis — used on Circumstance cards.
const AXIS_STYLES: Record<
  'knowledge' | 'intent' | 'composition' | 'constraint' | 'moment',
  { bg: string; fg: string; border: string; label: string }
> = {
  knowledge:   { bg: '#e0f2fe', fg: '#0369a1', border: '#bae6fd', label: 'Knowledge' },
  intent:      { bg: '#fef3c7', fg: '#b45309', border: '#fde68a', label: 'Intent' },
  composition: { bg: '#ede9fe', fg: '#6d28d9', border: '#ddd6fe', label: 'Composition' },
  constraint:  { bg: '#ffe4e6', fg: '#be123c', border: '#fecdd3', label: 'Constraint' },
  moment:      { bg: '#d1fae5', fg: '#047857', border: '#a7f3d0', label: 'Moment' },
};

// Demand Space Card
function DemandSpaceCard({
  space,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
  onOpenAI,
  isLoadingCircumstances,
  highlightColor,
  dimmed,
  highlightedCircumstanceIds,
  isRelated,
  provenance,
}: {
  space: DisplayDemandSpace;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onOpenAI: () => void;
  isLoadingCircumstances?: boolean;
  highlightColor?: string;
  dimmed?: boolean;
  highlightedCircumstanceIds?: Set<string>;
  isRelated?: boolean;
  /** Problem-Diagnostics provenance UI — Informed route only. */
  provenance?: React.ReactNode;
}) {
  const style = VARIATION_STYLE.v1;
  const circumstances = [...space.circumstances].sort((a, b) => a.order - b.order);
  const totalCircumstances = circumstances.length;

  const circumstancesToShow = expanded ? circumstances : circumstances.slice(0, 1);
  const hasMoreCircumstances = circumstances.length > 1;

  // Card should be highlighted if this demand space is related to the active persona
  const shouldHighlightCard = isRelated && highlightColor;

  return (
    <div
      onClick={onSelect}
      className="cursor-pointer"
      style={{
        width: style.cardW,
        // Scoped transition — never animate transform/left/top inside a
        // panned layer (causes trailing ghosts during canvas pan).
        transition:
          'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
        background: shouldHighlightCard
          ? `color-mix(in srgb, ${highlightColor} 8%, var(--bg-2))`
          : 'var(--bg-2)',
        border: shouldHighlightCard
          ? `2px solid ${highlightColor}`
          : selected
          ? '1.5px solid var(--accent)'
          : '1px solid var(--border-1)',
        borderRadius: 12,
        padding: 16,
        boxShadow: shouldHighlightCard
          ? `0 8px 20px ${highlightColor}30`
          : selected
          ? '0 12px 28px rgba(0,0,0,.22)'
          : 'none',
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2.5 mb-1.5">
        <div className="text-[15px] font-semibold leading-tight">{space.label}</div>
        <div className="flex items-center gap-1">
          {totalCircumstances > 0 && (
            <button
              className="btn btn--icon btn--ghost btn--sm flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          <button
            className="btn btn--icon btn--ghost btn--sm flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAI();
            }}
            title="Ask AI"
          >
            <Sparkles size={13} />
          </button>
        </div>
      </div>
      <div className="text-xs text-[var(--fg-2)] mb-3 leading-relaxed">{space.jtbd}</div>

      {provenance}

      {isLoadingCircumstances ? (
        <div className="flex items-center gap-2 py-2 text-xs text-[var(--fg-3)]">
          <Loader2 size={12} className="animate-spin" />
          Generating circumstances...
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="chip chip--accent text-[11px]">
              <Layers size={11} /> {totalCircumstances} circumstance
              {totalCircumstances === 1 ? '' : 's'}
            </span>
          </div>
          {circumstances.length > 0 && (
            <div className="border-t border-[var(--border-1)] pt-2.5 flex flex-col gap-2.5">
              {circumstancesToShow.map((c, i) => {
                const isHighlighted =
                  highlightedCircumstanceIds && highlightedCircumstanceIds.has(c.id);
                return (
                  <CircumstanceCard
                    key={c.id ?? i}
                    circumstance={c}
                    index={i + 1}
                    highlighted={Boolean(isHighlighted)}
                    highlightColor={highlightColor}
                  />
                );
              })}
              {!expanded && hasMoreCircumstances && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand();
                  }}
                  className="text-[11px] font-medium text-[var(--accent)] text-left hover:underline"
                >
                  + {circumstances.length - 1} more circumstance
                  {circumstances.length - 1 === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Renders one Circumstance: axis chips row, JTBD narrative, Struggle + Progress.
function CircumstanceCard({
  circumstance,
  index,
  highlighted,
  highlightColor,
}: {
  circumstance: Circumstance;
  index: number;
  highlighted: boolean;
  highlightColor?: string;
}) {
  const chips: Array<{ key: keyof typeof AXIS_STYLES; value: string }> = [
    { key: 'knowledge', value: circumstance.knowledge },
    { key: 'intent', value: circumstance.intent },
    { key: 'composition', value: circumstance.composition },
    { key: 'constraint', value: circumstance.constraint },
    { key: 'moment', value: circumstance.moment },
  ];
  return (
    <div
      className="rounded-lg p-2.5 flex flex-col gap-2"
      style={{
        background: highlighted && highlightColor
          ? `color-mix(in srgb, ${highlightColor} 10%, var(--bg-3))`
          : 'var(--bg-3)',
        border: highlighted && highlightColor
          ? `1.5px solid ${highlightColor}`
          : '1px solid var(--border-1)',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">
          Circumstance {index}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map(({ key, value }) => {
          const s = AXIS_STYLES[key];
          return (
            <span
              key={key}
              className="text-[10px] font-medium py-0.5 px-1.5 rounded-md whitespace-nowrap"
              style={{
                background: s.bg,
                color: s.fg,
                border: `1px solid ${s.border}`,
              }}
              title={`${s.label}: ${value}`}
            >
              <span style={{ opacity: 0.7, marginRight: 4 }}>{s.label}:</span>
              {value}
            </span>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--fg-1)' }}>
        <span style={{ color: 'var(--fg-3)' }}>When I am </span>
        <span style={{ fontWeight: 600 }}>{circumstance.context}</span>
        <span style={{ color: 'var(--fg-3)' }}>, I want to </span>
        <span style={{ fontWeight: 600 }}>{circumstance.action}</span>
        <span style={{ color: 'var(--fg-3)' }}>, so that </span>
        <span style={{ fontWeight: 600 }}>{circumstance.outcome}</span>
        <span style={{ color: 'var(--fg-3)' }}>.</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <div
          className="rounded-md p-1.5"
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: '#be123c' }}
          >
            Struggle
          </div>
          <div className="text-[10px] leading-snug" style={{ color: '#881337' }}>
            {circumstance.struggle}
          </div>
        </div>
        <div
          className="rounded-md p-1.5"
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: '#047857' }}
          >
            Progress
          </div>
          <div className="text-[10px] leading-snug" style={{ color: '#064e3b' }}>
            {circumstance.progress}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline, no-AI form for adding a single demand space. Shown in place of
 * the "Add demand space" button at the bottom of a PhaseColumn. The form
 * only captures label + JTBD (+ optional description) — the 5 Circumstances
 * are generated automatically by the cascade once the new demand space
 * hits the store.
 *
 * UX notes:
 * - Label + JTBD are required; Save stays disabled until both are filled.
 * - Saving fires the auto-cascade, which calls /api/generate-circumstances
 *   for the new space and returns the 5-circumstance tuple.
 */
function AddDemandSpaceForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: {
    label: string;
    jobToBeDone: string;
    description?: string;
    circumstances: [];
  }) => void;
}) {
  const [label, setLabel] = useState('');
  const [jtbd, setJtbd] = useState('');
  const [description, setDescription] = useState('');

  const canSave = label.trim().length > 0 && jtbd.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      label: label.trim(),
      jobToBeDone: jtbd.trim(),
      description: description.trim() || undefined,
      circumstances: [],
    });
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-2)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">
          New demand space
        </div>
        <button
          type="button"
          className="btn btn--icon btn--ghost btn--sm"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X size={12} />
        </button>
      </div>

      {/* Label */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Live comfortably without friction"
          autoFocus
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            color: 'var(--fg-1)',
            outline: 'none',
          }}
        />
      </div>

      {/* JTBD */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">
          Job to be done
        </label>
        <textarea
          value={jtbd}
          onChange={(e) => setJtbd(e.target.value)}
          placeholder="When I [situation], I want to [action], so that [outcome]"
          rows={2}
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            color: 'var(--fg-1)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Description (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">
          Description <span style={{ opacity: 0.6 }}>(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short context — helps the generator shape the 5 circumstances."
          rows={2}
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            color: 'var(--fg-1)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div className="text-[10px] italic" style={{ color: 'var(--fg-3)' }}>
        5 circumstances will be generated automatically after save.
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={!canSave}
        >
          <Check size={12} />
          Save
        </button>
      </div>
    </div>
  );
}

// Phase Column
function PhaseColumn({
  phase,
  spaces,
  selected,
  setSelected,
  expandedCards,
  onToggleExpand,
  onOpenAI,
  isLoadingSpaces,
  loadingCircumstances,
  relatedDemandSpaceIds,
  personaColor,
  highlightedCircumstanceIds,
  onAddDemandSpace,
  renderProvenance,
}: {
  phase: DisplayPhase;
  spaces: DisplayDemandSpace[];
  selected: string | null;
  setSelected: (id: string) => void;
  expandedCards: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onOpenAI: (space: DisplayDemandSpace) => void;
  isLoadingSpaces?: boolean;
  loadingCircumstances: Record<string, boolean>;
  relatedDemandSpaceIds: Set<string>;
  personaColor: string | null;
  highlightedCircumstanceIds: Set<string>;
  onAddDemandSpace: (
    phaseId: string,
    input: {
      label: string;
      jobToBeDone: string;
      description?: string;
      circumstances: [];
    }
  ) => void;
  /** Optional renderer for the Informed-Landscape provenance chip. */
  renderProvenance?: (space: DisplayDemandSpace) => React.ReactNode;
}) {
  const style = VARIATION_STYLE.v1;
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div
      className="flex-shrink-0"
      style={{
        width: style.colW,
        padding: style.phasePad,
        borderRight: '1px dashed var(--border-1)',
      }}
    >
      {/* Phase header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-1.5 h-7 rounded-sm"
            style={{ background: phase.accent }}
          />
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-tight">{phase.label}</div>
            <div className="text-[11px] font-medium text-[var(--fg-3)] uppercase tracking-wider mt-0.5">
              Phase {phase.order}
            </div>
          </div>
          <button className="btn btn--icon btn--ghost btn--sm">
            <MoreHorizontal size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {phase.source === 'user' && (
            <span
              className="chip text-[10px]"
              title="This phase was preloaded from the brief and kept as-is."
              style={{
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border-1))',
                color: 'var(--accent)',
              }}
            >
              From brief
            </span>
          )}
          <span className="chip text-[10px]">{phase.counts.spaces} spaces</span>
          <span className="chip text-[10px]">{phase.counts.circumstances} circumstances</span>
        </div>
      </div>

      {/* Loading state */}
      {isLoadingSpaces && spaces.length === 0 && (
        <div className="flex items-center gap-2 p-4 text-sm text-[var(--fg-3)]">
          <Loader2 size={14} className="animate-spin" />
          Generating demand spaces...
        </div>
      )}

      {/* Demand space cards */}
      <div className="flex flex-col" style={{ gap: style.stackGap }}>
        {spaces.map((space) => {
          const isRelated = relatedDemandSpaceIds.size === 0 || relatedDemandSpaceIds.has(space.id);
          const isDimmed = relatedDemandSpaceIds.size > 0 && !isRelated;
          return (
            <DemandSpaceCard
              key={space.id}
              space={space}
              selected={selected === space.id}
              expanded={expandedCards[space.id] || false}
              onSelect={() => setSelected(space.id)}
              onToggleExpand={() => onToggleExpand(space.id)}
              onOpenAI={() => onOpenAI(space)}
              isLoadingCircumstances={loadingCircumstances[space.id]}
              highlightColor={personaColor || undefined}
              highlightedCircumstanceIds={isRelated ? highlightedCircumstanceIds : undefined}
              dimmed={isDimmed}
              isRelated={isRelated}
              provenance={renderProvenance ? renderProvenance(space) : undefined}
            />
          );
        })}
        {isAdding ? (
          <AddDemandSpaceForm
            onCancel={() => setIsAdding(false)}
            onSave={(input) => {
              onAddDemandSpace(phase.id, input);
              setIsAdding(false);
            }}
          />
        ) : (
          <button
            className="btn btn--ghost btn--sm justify-center"
            style={{
              border: '1px dashed var(--border-2)',
              color: 'var(--fg-3)',
              padding: '10px 12px',
              borderRadius: 10,
            }}
            onClick={() => setIsAdding(true)}
          >
            <Plus size={14} />
            Add demand space
          </button>
        )}
      </div>
    </div>
  );
}

// Persona Filter
function PersonaFilter({
  personas,
  activePersona,
  setActivePersona,
  enabled,
}: {
  personas: { id: string; label: string; color: string }[];
  activePersona: string | null;
  setActivePersona: (id: string | null) => void;
  enabled: boolean;
}) {
  if (personas.length === 0) return null;

  return (
    <div
      className="absolute top-[140px] left-0 right-0 z-20 py-2.5 px-4 border-b border-[var(--border-1)]"
      style={{
        background: 'color-mix(in srgb, var(--bg-0) 92%, transparent)',
        backdropFilter: 'saturate(180%) blur(10px)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="text-xs font-medium text-[var(--fg-3)] uppercase tracking-wider">
          Filter by Persona
        </div>
        <div className="flex gap-2 flex-wrap">
          {personas.map((persona) => {
            const isActive = activePersona === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => setActivePersona(isActive ? null : persona.id)}
                disabled={!enabled}
                className="flex items-center gap-2 py-1.5 px-3 rounded-lg whitespace-nowrap transition-all cursor-pointer text-[12px] font-medium"
                style={{
                  background: isActive ? persona.color : 'var(--bg-2)',
                  border: isActive ? `2px solid ${persona.color}` : '1px solid var(--border-1)',
                  color: isActive ? '#fff' : 'var(--fg-1)',
                  opacity: enabled ? 1 : 0.5,
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  boxShadow: isActive ? `0 4px 12px ${persona.color}40` : 'none',
                }}
              >
                {persona.label}
              </button>
            );
          })}
          {activePersona && (
            <button
              onClick={() => setActivePersona(null)}
              className="text-[11px] font-medium text-[var(--fg-3)] hover:text-[var(--accent)] underline"
            >
              Clear filter
            </button>
          )}
        </div>
        {!enabled && (
          <div className="ml-auto text-xs text-[var(--fg-3)] italic">
            Available when generation completes
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PANE 1: Top Header (Logo + 7-Step Progress + API Key + Tweaks)
// =============================================================================
function Pane1_TopHeader({
  industry,
  apiKey,
  onApiKeyChange,
  onOpenTweaks,
  signalsCount,
  hasDiscoveryBundle,
  modelId,
  hasJourneyPhases,
  hasDiagnostics,
  activeStep,
}: {
  industry: string;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onOpenTweaks: () => void;
  signalsCount: number;
  hasDiscoveryBundle: boolean;
  modelId: string;
  hasJourneyPhases: boolean;
  /**
   * True when at least one classified problem exists for this model.
   * Gates the Informed Landscape step. Sourced from
   * `useHasDiagnostics(modelId)` in the parent.
   */
  hasDiagnostics: boolean;
  /**
   * Which step in the strip should be highlighted as active. The
   * workspace page renders both `/model/[id]` (Hypothesis) and
   * `/model/[id]/informed-landscape` (Informed) — the parent passes
   * the right value based on the current pathname so the highlight
   * follows the route.
   */
  activeStep: 'hypothesis-landscape' | 'informed-landscape';
}) {
  const STEPS = [
    { label: 'Brief', step: 'brief', route: '/' },
    { label: 'Research', step: 'research', route: `/model/${modelId}/research` },
    { label: 'Hypothesis Landscape', step: 'hypothesis-landscape', route: `/model/${modelId}` },
    { label: 'Discovery', step: 'discovery', route: `/model/${modelId}/discovery` },
    { label: 'Capture', step: 'capture', route: `/model/${modelId}/capture` },
    { label: 'Problem Diagnostics', step: 'diagnostics', route: `/model/${modelId}/diagnostics` },
    { label: 'Informed Landscape', step: 'informed-landscape', route: `/model/${modelId}/informed-landscape` },
    { label: 'Definition', step: 'definition', route: `/model/${modelId}/definition` },
    { label: 'Signals', step: 'signals', route: `/model/${modelId}/signals` },
    { label: 'Review', step: 'review', route: `/model/${modelId}/review` },
    { label: 'Evidenced Landscape', step: 'evidenced-landscape', route: `/model/${modelId}` },
  ];

  const currentStep = hasDiscoveryBundle ? 'evidenced-landscape' : activeStep;
  const currentIndex = STEPS.findIndex(s => s.step === currentStep);

  // Determine if a step is enabled
  const isStepEnabled = (step: string) => {
    if (step === 'brief') return true;
    if (step === 'research') return true;
    if (step === 'hypothesis-landscape') return true;
    if (step === 'discovery') return hasJourneyPhases;
    if (step === 'capture') return hasJourneyPhases;
    if (step === 'diagnostics') return hasJourneyPhases;
    if (step === 'informed-landscape') return hasJourneyPhases && hasDiagnostics;
    if (step === 'definition') return hasJourneyPhases;
    if (step === 'plan') return hasJourneyPhases; // backwards compatibility
    if (step === 'signals') return hasJourneyPhases;
    if (step === 'review') return signalsCount > 0;
    if (step === 'evidenced-landscape') return hasDiscoveryBundle;
    return false;
  };

  return (
    <div
      className="h-[48px] flex items-center px-5 gap-6 border-b"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center text-[13px] font-bold shadow-lg shadow-[var(--accent)]/20">
          J
        </div>
        <span className="text-sm font-bold tracking-tight">Journey Generator</span>
      </div>

      <div className="h-4 w-px bg-[var(--border-1)]" />

      {/* 7-Step Progress */}
      <nav className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
        {STEPS.map((s, i) => {
          const isActive = i === currentIndex;
          const isPast = i < currentIndex;
          const enabled = isStepEnabled(s.step);

          const stepContent = (
            <>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: isActive ? 'var(--accent)' : isPast ? 'var(--bg-4)' : 'var(--bg-3)',
                  color: isActive ? 'var(--accent-fg)' : isPast ? 'var(--fg-1)' : 'var(--fg-3)',
                }}
              >
                {i + 1}
              </div>
              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: isActive ? 'var(--fg-1)' : 'var(--fg-2)' }}>
                {s.label}
              </span>
            </>
          );

          return (
            <div key={i} className="flex items-center gap-2">
              {enabled ? (
                <Link
                  href={s.route}
                  className={`flex items-center gap-2 transition-opacity hover:opacity-100 ${isActive ? 'opacity-100' : isPast ? 'opacity-60' : 'opacity-30'}`}
                >
                  {stepContent}
                </Link>
              ) : (
                <div
                  className={`flex items-center gap-2 cursor-not-allowed ${isActive ? 'opacity-100' : 'opacity-30'}`}
                  title={
                    s.step === 'plan' ||
                    s.step === 'discovery' ||
                    s.step === 'definition' ||
                    s.step === 'capture' ||
                    s.step === 'diagnostics' ||
                    s.step === 'signals'
                      ? 'Generate a journey first'
                      : s.step === 'informed-landscape'
                      ? hasJourneyPhases
                        ? 'Classify at least one problem on the Diagnostics step first'
                        : 'Generate a journey first'
                      : s.step === 'review'
                      ? 'Extract signals first'
                      : s.step === 'evidenced-landscape'
                      ? 'Approve discovery bundle first'
                      : ''
                  }
                >
                  {stepContent}
                </div>
              )}
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-[var(--border-1)]" />}
            </div>
          );
        })}
      </nav>

      {/* Right: API Key + Tweaks */}
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--bg-2)] rounded-lg border border-[var(--border-1)]">
          <span className="text-[9px] font-bold text-[var(--fg-3)] uppercase tracking-widest">OpenAI Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="sk-..."
            className="bg-transparent text-[11px] w-16 outline-none"
            style={{ color: 'var(--fg-1)' }}
          />
        </div>
        <button
          className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-2)] hover:text-[var(--accent)] transition-colors"
          onClick={onOpenTweaks}
        >
          <SlidersHorizontal size={12} /> TWEAKS
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// PANE 2: Journey Folder Tabs (Departure, Arrival, Transit + Add)
// =============================================================================
function Pane2_JourneyFolderTabs({
  journeys,
  activeJourneyId,
  setActiveJourneyId,
  phaseCountByJourney,
  generatingJourneyId,
  needsGenerationByJourney,
  onGenerateJourney,
  canGenerate,
}: {
  journeys: { id: string; name: string; jtbdBlueprint: string }[];
  activeJourneyId: string;
  setActiveJourneyId: (id: string) => void;
  phaseCountByJourney: Record<string, number>;
  generatingJourneyId: string | null;
  needsGenerationByJourney: Record<string, boolean>;
  onGenerateJourney: (journeyId: string) => void;
  canGenerate: boolean;
}) {
  return (
    <div
      className="flex items-end px-4 gap-1 pt-2"
      style={{
        background: 'var(--bg-0)',
      }}
    >
      {journeys.map((j) => {
        const active = j.id === activeJourneyId;
        const phaseCount = phaseCountByJourney[j.id] || 0;
        const isGenerating = generatingJourneyId === j.id;
        const needsGen = needsGenerationByJourney[j.id];

        return (
          <div key={j.id} className="relative">
            <button
              onClick={() => setActiveJourneyId(j.id)}
              className="group flex flex-col px-6 py-3 gap-0.5 transition-all relative"
              style={{
                background: active ? 'var(--bg-1)' : 'transparent',
                border: active ? '1px solid var(--border-1)' : '1px solid transparent',
                borderBottom: active ? '1px solid var(--bg-1)' : '1px solid transparent',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                marginBottom: active ? -1 : 0,
                zIndex: active ? 50 : 1,
                color: active ? 'var(--fg-1)' : 'var(--fg-3)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-black uppercase tracking-widest"
                  style={{ color: active ? 'var(--accent)' : 'var(--fg-3)' }}
                >
                  {j.name || 'Journey'}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 rounded-full flex items-center gap-1"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg-3)',
                    color: active ? 'var(--accent)' : 'var(--fg-3)',
                  }}
                >
                  {phaseCount}
                  {isGenerating && <Loader2 size={9} className="animate-spin" />}
                </span>
              </div>
              {j.jtbdBlueprint && (
                <div
                  className="text-[9px] font-medium truncate w-32 italic"
                  style={{ color: active ? 'var(--fg-3)' : 'var(--fg-3)', opacity: active ? 0.6 : 0.5 }}
                >
                  {j.jtbdBlueprint}
                </div>
              )}
            </button>

            {/* Generate chip overlay */}
            {needsGen && !isGenerating && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canGenerate) return;
                  onGenerateJourney(j.id);
                }}
                disabled={!canGenerate}
                className="absolute top-1 right-1 px-2 py-0.5 rounded-lg text-[9px] font-bold"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Zap size={10} className="inline mr-1" />
                Gen
              </button>
            )}
          </div>
        );
      })}

      {/* Add journey button */}
      <button
        className="mb-2 ml-2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--fg-3)] hover:text-[var(--accent)] border border-dashed"
        style={{ borderColor: 'var(--border-1)' }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// =============================================================================
// PANE 3 & 4: Unified Workspace Container (Inspiration Board + Phase Nav)
// =============================================================================
function Pane3and4_WorkspaceContainer({
  activeJourneyName,
  totals,
  isGenerating,
  onStopGeneration,
  onToggleFullscreen,
  fullscreen,
  onExpandAll,
  onCollapseAll,
  onRefine,
  refineEnabled,
  refineTitle,
  refineIsRunning,
  onGenerateJourney,
  canGenerate,
  phases,
  activePhase,
  setActivePhase,
  onZoomToPhase,
}: {
  activeJourneyName: string;
  totals: { phases: number; spaces: number; circumstances: number };
  isGenerating: boolean;
  onStopGeneration: () => void;
  onToggleFullscreen: () => void;
  fullscreen: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefine: () => void;
  refineEnabled: boolean;
  refineTitle: string;
  refineIsRunning: boolean;
  onGenerateJourney: () => void;
  canGenerate: boolean;
  phases: DisplayPhase[];
  activePhase: string;
  setActivePhase: (id: string) => void;
  onZoomToPhase: (id: string) => void;
}) {
  return (
    <div
      className="mx-4 mb-4"
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border-1)',
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Pane 3: Inspiration Board Header */}
      <div className="h-20 flex items-center px-8 gap-12 border-b" style={{ borderColor: 'var(--border-1)' }}>
        {/* Identity Bar + Title */}
        <div className="flex items-center gap-4">
          <div
            className="w-1.5 h-10 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
              Inspiration Board
            </span>
            <h2 className="text-xl font-extrabold tracking-tight uppercase italic" style={{ color: 'var(--fg-1)' }}>
              {activeJourneyName} Journey
            </h2>
          </div>
        </div>

        <div className="h-8 w-px" style={{ background: 'var(--border-1)' }} />

        {/* Stats with inline loader */}
        <div className="flex items-center gap-10">
          {isGenerating && (
            <div className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs font-medium">Generating...</span>
              <button
                onClick={onStopGeneration}
                className="px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                style={{
                  background: 'var(--danger)',
                  color: 'white',
                }}
              >
                Stop
              </button>
            </div>
          )}
          {!isGenerating && [
            { label: 'Phases', value: totals.phases, color: 'var(--fg-1)' },
            { label: 'Spaces', value: totals.spaces, color: '#4ade80' },
            { label: 'Circumstances', value: totals.circumstances, color: '#06b6d4' },
          ].map((x) => (
            <div key={x.label} className="flex flex-col">
              <span className="text-2xl font-bold font-mono leading-none" style={{ color: x.color }}>
                {x.value}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--fg-3)' }}>
                {x.label}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold rounded-xl border transition-colors hover:bg-[var(--bg-2)]"
            style={{ borderColor: 'var(--border-1)', background: 'var(--bg-1)', color: 'var(--fg-2)' }}
            onClick={onToggleFullscreen}
          >
            <Maximize size={12} /> FULL SCREEN
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
            style={{
              background: canGenerate ? 'var(--accent)' : 'var(--bg-3)',
              color: canGenerate ? 'var(--accent-fg)' : 'var(--fg-3)',
              boxShadow: canGenerate ? '0 4px 14px rgba(99, 102, 241, 0.2)' : 'none',
            }}
            onClick={onGenerateJourney}
            disabled={!canGenerate}
            title={canGenerate ? 'Generate phases + demand spaces for this journey' : 'Add your OpenAI key to generate'}
          >
            <Zap size={12} className={canGenerate ? 'fill-white' : ''} />
            {isGenerating ? 'GENERATING…' : 'GENERATE JOURNEY'}
          </button>
        </div>
      </div>

      {/* Pane 4: Phase Navigation Strip */}
      <div
        className="px-8 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{
          background: 'color-mix(in srgb, var(--bg-2) 50%, transparent)',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        {phases.map((p) => {
          const active = activePhase === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePhase(p.id);
                onZoomToPhase(p.id);
              }}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all"
              style={{
                background: active ? 'var(--bg-1)' : 'transparent',
                borderColor: active ? 'var(--border-2)' : 'var(--border-1)',
              }}
            >
              <div
                className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center text-[10px] font-extrabold text-white"
                style={{ background: p.accent }}
              >
                {p.order}
              </div>
              <span
                className="text-[11px] font-bold whitespace-nowrap"
                style={{ color: active ? 'var(--fg-1)' : 'var(--fg-2)' }}
              >
                {p.label}
              </span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--fg-3)' }}>
                {p.counts.spaces}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// Zoom Controls
function ZoomControls({
  view,
  zoomIn,
  zoomOut,
  zoomTo,
  onFit,
}: {
  view: { s: number };
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (s: number) => void;
  onFit: () => void;
}) {
  const pct = Math.round(view.s * 100);

  return (
    <div
      className="absolute right-4 bottom-4 z-30 flex items-center gap-1.5 p-1 rounded-[10px]"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <button className="btn btn--icon btn--ghost btn--sm" onClick={zoomOut} title="Zoom out">
        <Minus size={14} />
      </button>
      <button
        className="btn btn--ghost btn--sm min-w-14 justify-center"
        onClick={() => zoomTo(1)}
      >
        {pct}%
      </button>
      <button className="btn btn--icon btn--ghost btn--sm" onClick={zoomIn} title="Zoom in">
        <Plus size={14} />
      </button>
      <div className="w-px h-5 bg-[var(--border-1)] mx-0.5" />
      <button className="btn btn--icon btn--ghost btn--sm" onClick={onFit} title="Fit to screen">
        <Maximize size={14} />
      </button>
    </div>
  );
}

// Minimap
function Minimap({
  phases,
  view,
  containerSize,
  worldSize,
  onNavigate,
}: {
  phases: DisplayPhase[];
  view: { x: number; y: number; s: number };
  containerSize: { w: number; h: number };
  worldSize: { w: number; h: number };
  onNavigate: (wx: number, wy: number) => void;
}) {
  const W = 180;
  const H = 56;
  if (!worldSize.w || phases.length === 0) return null;

  const scale = Math.min(W / worldSize.w, H / worldSize.h);
  const style = VARIATION_STYLE.v1;

  const visW = containerSize.w / view.s;
  const visH = containerSize.h / view.s;
  const visX = -view.x / view.s;
  const visY = -view.y / view.s;

  return (
    <div
      className="absolute left-4 bottom-4 z-30 p-1.5 rounded-[10px]"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="text-[10px] font-medium text-[var(--fg-3)] uppercase tracking-wider px-1 py-0.5 mb-1.5">
        Overview
      </div>
      <svg
        width={W}
        height={H}
        className="block cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / scale;
          const y = (e.clientY - rect.top) / scale;
          onNavigate(x, y);
        }}
      >
        {phases.map((p, i) => (
          <rect
            key={p.id}
            x={i * style.colW * scale}
            y={0}
            width={style.colW * scale - 1}
            height={H}
            fill={p.accent}
            opacity={0.3}
          />
        ))}
        <rect
          x={visX * scale}
          y={visY * scale}
          width={visW * scale}
          height={Math.min(H, visH * scale)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
}

// AI Panel
function AIPanel({
  open,
  onClose,
  space,
}: {
  open: boolean;
  onClose: () => void;
  space: DisplayDemandSpace | null;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'I can help you refine this demand space. Ask me to regenerate circumstances, add a JTBD variant, or translate into CRM activation.',
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setMessages((m) => [
      ...m,
      { role: 'user', text: q },
      { role: 'assistant', text: 'Thinking…', loading: true },
    ]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: 'assistant',
          text: space
            ? `For "${space.label}", I'd suggest varying the Composition axis across the 5 circumstances and tightening the JTBD. Want me to apply it?`
            : "Select a demand space card and I'll tailor suggestions to it.",
        };
        return next;
      });
    }, 700);
  };

  if (!open) return null;

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-25 w-[360px] flex flex-col"
      style={{
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border-1)',
      }}
    >
      <div className="py-3.5 px-4 border-b border-[var(--border-1)] flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center">
          <Sparkles size={14} />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold">Co-pilot</div>
          <div className="text-[11px] text-[var(--fg-3)] mt-0.5">
            {space ? space.label : 'No selection'}
          </div>
        </div>
        <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4 flex flex-col gap-3.5">
        {space && (
          <div
            className="rounded-[10px] p-3"
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border-1)',
            }}
          >
            <div className="eyebrow mb-1.5">Context</div>
            <div className="text-[13px] font-semibold">{space.label}</div>
            <div className="text-xs text-[var(--fg-2)] mt-1.5">{space.jtbd}</div>
            <div className="flex flex-wrap gap-1 mt-2.5">
              <span className="chip text-[10px]">
                {space.circumstances.length} circumstance
                {space.circumstances.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="max-w-[85%] py-2.5 px-3 text-[13px]"
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
              color: m.role === 'user' ? 'var(--accent-fg)' : 'var(--fg-1)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border-1)',
              borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              opacity: (m as { loading?: boolean }).loading ? 0.6 : 1,
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border-1)] p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={space ? `Ask about "${space.label}"…` : 'Pick a card, then ask…'}
            rows={2}
            className="flex-1 resize-none outline-none text-[13px] py-2.5 px-3 rounded-[10px]"
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border-1)',
              color: 'var(--fg-1)',
            }}
          />
          <button className="btn btn--primary btn--sm" onClick={send} disabled={!input.trim()}>
            <ArrowUp size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {['Regenerate', 'Add circumstance', 'Find gaps'].map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="btn btn--ghost btn--sm text-[11px]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

// =============================================================================
// Main Workspace Page
// =============================================================================
export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const canvas = useCanvasController({ x: 40, y: 150, s: 0.85 });

  // Zustand store
  const {
    model,
    isGeneratingPhases,
    isGeneratingDemandSpaces,
    isGeneratingCrossCuttingDemandSpaces,
    isGeneratingCircumstances,
    isGeneratingPersonaMappings,
    setJourneyPhases,
    setDemandSpaces,
    setCrossCuttingDemandSpaces,
    setCircumstances,
    setPersonaMappings,
    setGeneratingPhases,
    setGeneratingDemandSpaces,
    setGeneratingCrossCuttingDemandSpaces,
    setGeneratingCircumstances,
    setGeneratingPersonaMappings,
    resetLandscapeForRegen,
    setCurrentStep,
    createDemandSpaceWithCircumstances,
    stopAllGeneration,
    addHypothesisVariant,
    removeHypothesisVariant,
    setActiveHypothesisVariant,
    addInformedVariant,
    removeInformedVariant,
    setActiveInformedVariant,
  } = useStore();

  // Pathname-driven landscape mode. When the route ends in
  // `/informed-landscape`, swap the variant strip to InformedVariantsBar so
  // the strategist works against classified problems instead of brief/research.
  const pathname = usePathname();
  const isInformedRoute = pathname?.endsWith('/informed-landscape') ?? false;

  // Problem diagnostics live in the capture (IndexedDB) store, not on Model.
  // Hydrate the capture store for this model so the InformedVariantsBar
  // (and downstream Informed-landscape gates) see the user's classified
  // problems when they navigate here directly from a fresh page load.
  useHydratedCaptureStore((params.id as string) || '');
  const problemDiagnostics = useCaptureStore((s) => s.problemDiagnostics);
  const hasDiagnostics = useHasDiagnostics(model?.id);

  /**
   * Denormalize ProblemDiagnostic rows into the
   * `InformedProblemPayload` shape the API route + prompt expect.
   *
   * The diagnostic only stores `problemSignalId`; the human-readable
   * problem text lives on the curated `Signal` row referenced by that
   * id (see `Signal.text`). We join here once per render so the bar
   * can pass a flat payload downstream.
   */
  const informedProblemsPayload = useMemo<InformedProblemPayload[]>(() => {
    if (!model) return [];
    const signalById = new Map((model.signals || []).map((s) => [s.id, s]));
    const out: InformedProblemPayload[] = [];
    for (const d of problemDiagnostics) {
      const signal = signalById.get(d.problemSignalId);
      if (!signal) continue;
      out.push({
        id: d.id,
        text: signal.text,
        discipline: d.discipline,
        secondaryDiscipline: d.secondaryDiscipline,
        impact: d.impact,
        frequency: d.frequency,
        affectedPhaseIds: d.affectedPhaseIds,
        department: signal.department,
        sourceQuotes: undefined,
        quadrant: quadrantOf({ frequency: d.frequency, impact: d.impact }),
      });
    }
    return out;
  }, [model, problemDiagnostics]);

  // Per-phase slice — used by `handleGenerateDemandSpaces` on the
  // Informed route so each phase's demand-space generation is grounded
  // in the diagnostics that actually touch it. Problems that are tagged
  // ONLY to phases that no longer exist in the current model (stale
  // ids) are filtered out here and recovered by the cross-cutting
  // bucket below — every problem is guaranteed to land somewhere.
  const currentPhaseIdSet = useMemo(
    () => new Set((model?.journeyPhases || []).map((p) => p.id)),
    [model?.journeyPhases]
  );

  const informedProblemsByPhase = useMemo(() => {
    const map = new Map<string, InformedProblemPayload[]>();
    for (const p of informedProblemsPayload) {
      for (const phaseId of p.affectedPhaseIds) {
        if (!currentPhaseIdSet.has(phaseId)) continue;
        const arr = map.get(phaseId) || [];
        arr.push(p);
        map.set(phaseId, arr);
      }
    }
    return map;
  }, [informedProblemsPayload, currentPhaseIdSet]);

  // Cross-cutting slice — problems with no specific phase OR problems
  // whose tagged phases no longer exist (orphans). These feed the
  // Cross-cutting JTBDs band and the systemic generation route. The
  // contract: every classified problem ends up in either a per-phase
  // bucket above or in this bucket — nothing is silently dropped.
  const informedProblemsCrossCutting = useMemo(
    () =>
      informedProblemsPayload.filter((p) => {
        if (p.affectedPhaseIds.length === 0) return true;
        return p.affectedPhaseIds.every((id) => !currentPhaseIdSet.has(id));
      }),
    [informedProblemsPayload, currentPhaseIdSet]
  );

  // Lookup map keyed by problem id for fast provenance resolution.
  const problemsById = useMemo(() => {
    const m = new Map<string, InformedProblemPayload>();
    for (const p of informedProblemsPayload) m.set(p.id, p);
    return m;
  }, [informedProblemsPayload]);

  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSpace, setAiSpace] = useState<DisplayDemandSpace | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // AbortControllers for canceling in-flight generation requests
  const abortControllersRef = useRef<{
    phases?: AbortController;
    demandSpaces: Record<string, AbortController>;
    circumstances: Record<string, AbortController>;
  }>({
    demandSpaces: {},
    circumstances: {},
  });

  // Expand/collapse handlers
  const toggleExpand = useCallback((id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expandAll = useCallback(() => {
    if (!model) return;
    const allExpanded: Record<string, boolean> = {};
    model.demandSpaces.forEach(ds => { allExpanded[ds.id] = true; });
    setExpandedCards(allExpanded);
  }, [model]);

  const collapseAll = useCallback(() => {
    setExpandedCards({});
  }, []);

  // Custom stop function that aborts all in-flight requests and keeps generated data
  const handleStopAllGeneration = useCallback(() => {
    // Abort all in-flight requests
    if (abortControllersRef.current.phases) {
      abortControllersRef.current.phases.abort();
      abortControllersRef.current.phases = undefined;
    }
    Object.values(abortControllersRef.current.demandSpaces).forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current.demandSpaces = {};

    Object.values(abortControllersRef.current.circumstances).forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current.circumstances = {};

    // Reset loading states in store
    stopAllGeneration();
  }, [stopAllGeneration]);

  // API key
  const [apiKey, setApiKey] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('openai-api-key');
    if (saved) setApiKey(saved);
  }, []);
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    if (key) localStorage.setItem('openai-api-key', key);
    else localStorage.removeItem('openai-api-key');
  };

  // Redirect if no model
  useEffect(() => {
    if (!model || model.id !== params.id) {
      router.push('/');
    }
  }, [model, params.id, router]);

  // --------------------------------------------------------------------------
  // Active journey. A model can now hold multiple journeys (e.g. Arrival /
  // Transit / Departure). The canvas only ever renders one at a time; this
  // state picks which one. Defaults to the first journey and corrects itself
  // if the active id disappears (e.g. journey removed).
  // --------------------------------------------------------------------------
  const journeys = useMemo(
    () => (model?.journeys ?? []).slice().sort((a, b) => a.order - b.order),
    [model]
  );
  const [activeJourneyId, setActiveJourneyId] = useState<string>('');
  useEffect(() => {
    if (journeys.length === 0) {
      if (activeJourneyId !== '') setActiveJourneyId('');
      return;
    }
    const stillExists = journeys.some(j => j.id === activeJourneyId);
    if (!stillExists) setActiveJourneyId(journeys[0].id);
  }, [journeys, activeJourneyId]);
  const activeJourney = useMemo(
    () => journeys.find(j => j.id === activeJourneyId) ?? null,
    [journeys, activeJourneyId]
  );

  // Phases filtered to the active journey. Legacy data without a journeyId
  // got stamped during rehydrate, but we still fall back to "phase belongs
  // to the first journey" if anything slipped through.
  const activeJourneyPhases = useMemo(() => {
    if (!model) return [];
    if (!activeJourneyId) return [];
    return model.journeyPhases
      .filter(p => (p.journeyId ?? journeys[0]?.id) === activeJourneyId)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [model, activeJourneyId, journeys]);

  // Per-journey phase counts — used by the switcher chips.
  const phaseCountByJourney = useMemo(() => {
    if (!model) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const j of journeys) counts[j.id] = 0;
    const fallback = journeys[0]?.id;
    for (const p of model.journeyPhases) {
      const jid = p.journeyId ?? fallback;
      if (jid) counts[jid] = (counts[jid] ?? 0) + 1;
    }
    return counts;
  }, [model, journeys]);

  // Does each journey need a Generate action? True when the journey has
  // no demand spaces yet (regardless of whether phases are preloaded from
  // the brief). The switcher uses this to show a "Gen" chip on tabs that
  // haven't been generated. Without this, multi-journey briefs like Dubai
  // Airport preload phases and the empty-state canvas CTA never triggers,
  // leaving users with no obvious way to kick off generation per journey.
  const needsGenerationByJourney = useMemo(() => {
    if (!model) return {} as Record<string, boolean>;
    const flags: Record<string, boolean> = {};
    const phaseJourney: Record<string, string | undefined> = {};
    for (const p of model.journeyPhases) {
      phaseJourney[p.id] = p.journeyId ?? journeys[0]?.id;
    }
    const hasSpaces: Record<string, boolean> = {};
    for (const ds of model.demandSpaces) {
      const jid = phaseJourney[ds.journeyPhaseId];
      if (jid) hasSpaces[jid] = true;
    }
    for (const j of journeys) {
      flags[j.id] = !hasSpaces[j.id];
    }
    return flags;
  }, [model, journeys]);

  // Convert model data to display format
  const displayPhases: DisplayPhase[] = useMemo(() => {
    if (!model) return [];
    return activeJourneyPhases.map((phase, i) => {
      const phaseSpaces = model.demandSpaces.filter(ds => ds.journeyPhaseId === phase.id);
      const phaseCircumstances = model.circumstances.filter(c =>
        phaseSpaces.some(ds => ds.id === c.demandSpaceId)
      );
      return {
        id: phase.id,
        order: phase.order + 1,
        label: phase.label,
        accent: PHASE_COLORS[i % PHASE_COLORS.length],
        trigger: phase.trigger || phase.description,
        counts: {
          spaces: phaseSpaces.length,
          circumstances: phaseCircumstances.length,
        },
        source: phase.source,
      };
    });
  }, [model, activeJourneyPhases]);

  const displaySpaces: Record<string, DisplayDemandSpace[]> = useMemo(() => {
    if (!model) return {};
    const result: Record<string, DisplayDemandSpace[]> = {};
    for (const phase of activeJourneyPhases) {
      const spaces = model.demandSpaces
        .filter(ds => ds.journeyPhaseId === phase.id)
        .map(ds => {
          const circumstances = model.circumstances
            .filter(c => c.demandSpaceId === ds.id)
            .slice()
            .sort((a, b) => a.order - b.order);
          return {
            id: ds.id,
            label: ds.label,
            jtbd: ds.jobToBeDone,
            circumstances,
            sourceProblemIds: ds.sourceProblemIds,
          };
        });
      result[phase.id] = spaces;
    }
    return result;
  }, [model, activeJourneyPhases]);

  // Get related demand space IDs for active persona (flatten phase-structured data)
  const relatedDemandSpaceIds = useMemo(() => {
    if (!activePersona || !model) return new Set<string>();
    const mapping = model.personaMappings.find(m => m.personaId === activePersona);
    if (!mapping || !mapping.mappingsByPhase) return new Set<string>();

    // Flatten all demand space IDs from all phases
    const allDemandSpaceIds = mapping.mappingsByPhase.flatMap(
      phaseMapping => phaseMapping.demandSpaceIds
    );
    return new Set(allDemandSpaceIds);
  }, [activePersona, model]);

  // Get related circumstance IDs for active persona (flatten phase-structured data)
  const relatedCircumstanceIds = useMemo(() => {
    if (!activePersona || !model) return new Set<string>();
    const mapping = model.personaMappings.find(m => m.personaId === activePersona);
    if (!mapping || !mapping.mappingsByPhase) return new Set<string>();

    // Flatten all circumstance IDs from all phases
    const allCircumstanceIds = mapping.mappingsByPhase.flatMap(
      phaseMapping => phaseMapping.circumstanceIds
    );
    return new Set(allCircumstanceIds);
  }, [activePersona, model]);

  const [activePhase, setActivePhase] = useState('');
  useEffect(() => {
    if (displayPhases.length > 0 && !activePhase) {
      setActivePhase(displayPhases[0].id);
    }
  }, [displayPhases, activePhase]);

  const style = VARIATION_STYLE.v1;
  const worldW = Math.max(displayPhases.length, 1) * style.colW;
  const worldH = 2000;

  // Calculate totals — scoped to the active journey. The stats bar tracks
  // what's on-screen, not everything in the model. Phase / demand-space /
  // circumstance counts filter through activeJourneyPhases so a second
  // journey with nothing in it doesn't show a misleading "12 phases" number.
  const totals = useMemo(() => {
    if (!model) return { phases: 0, spaces: 0, circumstances: 0 };
    const phaseIds = new Set(activeJourneyPhases.map(p => p.id));
    const spaces = model.demandSpaces.filter(ds => phaseIds.has(ds.journeyPhaseId));
    const spaceIds = new Set(spaces.map(s => s.id));
    const circumstances = model.circumstances.filter(c => spaceIds.has(c.demandSpaceId));
    return {
      phases: activeJourneyPhases.length,
      spaces: spaces.length,
      circumstances: circumstances.length,
    };
  }, [model, activeJourneyPhases]);

  // Display personas with colors
  const displayPersonas = useMemo(() => {
    if (!model?.input.personas) return [];
    return model.input.personas.map((persona, i) => ({
      id: persona.id,
      label: persona.label,
      color: PERSONA_COLORS[i % PERSONA_COLORS.length],
    }));
  }, [model?.input.personas]);

  // Get active persona color
  const activePersonaColor = useMemo(() => {
    if (!activePersona) return null;
    const persona = displayPersonas.find(p => p.id === activePersona);
    return persona?.color || null;
  }, [activePersona, displayPersonas]);

  // Is any generation in progress?
  const isAnyGenerating = isGeneratingPhases ||
    Object.values(isGeneratingDemandSpaces).some(Boolean) ||
    Object.values(isGeneratingCircumstances).some(Boolean) ||
    isGeneratingPersonaMappings;

  // Is the ACTIVE journey generating? (for showing loader only on active journey)
  const isActiveJourneyGenerating = useMemo(() => {
    if (isGeneratingPhases) return true;

    // Check if any phases in the active journey are generating demand spaces
    const activePhaseIds = activeJourneyPhases.map(p => p.id);
    const hasGeneratingPhases = activePhaseIds.some(phaseId => isGeneratingDemandSpaces[phaseId]);
    if (hasGeneratingPhases) return true;

    // Check if any demand spaces in the active journey are generating circumstances
    const activeSpaceIds = model?.demandSpaces
      .filter(ds => activePhaseIds.includes(ds.journeyPhaseId))
      .map(ds => ds.id) || [];
    const hasGeneratingSpaces = activeSpaceIds.some(spaceId => isGeneratingCircumstances[spaceId]);

    return hasGeneratingSpaces;
  }, [isGeneratingPhases, activeJourneyPhases, isGeneratingDemandSpaces, isGeneratingCircumstances, model]);

  // Check if ALL generation is complete (for enabling persona filter)
  const isGenerationComplete = Boolean(
    !isAnyGenerating &&
    model &&
    model.journeyPhases.length > 0 &&
    model.demandSpaces.length > 0 &&
    model.circumstances.length > 0
  );

  // Generation handlers (defined first so they can be referenced)
  const handleGenerateDemandSpaces = useCallback(async (phaseId: string, opts?: { prioritiseProblemIds?: string[] }) => {
    if (!model || !apiKey) return;
    const phase = model.journeyPhases.find(p => p.id === phaseId);
    if (!phase) return;

    setError(null);
    setGeneratingDemandSpaces(phaseId, true);

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllersRef.current.demandSpaces[phaseId] = controller;

    // On the Informed route, ground generation in the classified
    // problems that touch this phase. Hypothesis Landscape generation
    // ignores this field and behaves exactly as before.
    const informedProblems = isInformedRoute
      ? informedProblemsByPhase.get(phaseId) || []
      : undefined;

    try {
      const response = await fetch('/api/generate-demand-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: model.input,
          journeyPhase: phase,
          apiKey,
          informedProblems,
          prioritiseProblemIds: opts?.prioritiseProblemIds,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate demand spaces');
      }

      const data = await response.json();
      let combined = data.demandSpaces as Array<{
        label: string;
        jobToBeDone: string;
        description?: string;
        sourceProblemIds?: string[];
      }>;

      // Coverage enforcement (Informed route only): if the first pass
      // didn't tag every supplied problem into some demand space's
      // sourceProblemIds, fire one surgical retry with the missing ids
      // as `prioritiseProblemIds`. Merge the additional spaces back in
      // before persisting. Capped at 1 retry to bound token spend.
      if (
        isInformedRoute &&
        informedProblems &&
        informedProblems.length > 0 &&
        !controller.signal.aborted
      ) {
        const covered = new Set<string>();
        for (const ds of combined) {
          for (const pid of ds.sourceProblemIds || []) covered.add(pid);
        }
        const missing = informedProblems
          .map((p) => p.id)
          .filter((id) => !covered.has(id));
        if (missing.length > 0) {
          try {
            const retry = await fetch('/api/generate-demand-spaces', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: model.input,
                journeyPhase: phase,
                apiKey,
                informedProblems,
                prioritiseProblemIds: missing,
              }),
              signal: controller.signal,
            });
            if (retry.ok) {
              const retryData = await retry.json();
              if (Array.isArray(retryData.demandSpaces)) {
                combined = [...combined, ...retryData.demandSpaces];
              }
            } else {
              // Retry failed — log and accept partial coverage rather
              // than failing the whole generation.
              console.warn(
                `[informed] coverage retry for phase ${phaseId} failed; persisting partial coverage. Missing: ${missing.length}`
              );
            }
          } catch (retryErr) {
            if (!(retryErr instanceof Error && retryErr.name === 'AbortError')) {
              console.warn(`[informed] coverage retry threw:`, retryErr);
            }
          }
        }
      }

      setDemandSpaces(phaseId, combined);
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingDemandSpaces(phaseId, false);
      delete abortControllersRef.current.demandSpaces[phaseId];
    }
  }, [model, apiKey, isInformedRoute, informedProblemsByPhase, setDemandSpaces, setGeneratingDemandSpaces]);

  // Cross-cutting demand-space silo (Informed Landscape only). Generates
  // 4-8 systemic JTBDs that address problems with no specific phase.
  const handleGenerateCrossCuttingDemandSpaces = useCallback(
    async (opts?: { prioritiseProblemIds?: string[] }) => {
      if (!model || !apiKey) return;
      if (!isInformedRoute) return;
      if (informedProblemsCrossCutting.length === 0) return;

      setError(null);
      setGeneratingCrossCuttingDemandSpaces(true);

      const activeVariant = (model.informedVariants || []).find((v) => v.isActive);

      try {
        const response = await fetch('/api/generate-cross-cutting-demand-spaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: model.input,
            apiKey,
            crossCuttingProblems: informedProblemsCrossCutting,
            prioritiseProblemIds: opts?.prioritiseProblemIds,
            variantLabel: activeVariant?.label,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate cross-cutting demand spaces');
        }

        const data = await response.json();
        let combined = data.demandSpaces as Array<{
          label: string;
          jobToBeDone: string;
          description?: string;
          sourceProblemIds?: string[];
        }>;

        // Coverage enforcement: if any cross-cutting problem isn't
        // referenced in the first pass, fire one surgical retry with
        // the missing ids prioritised, then merge.
        const covered = new Set<string>();
        for (const ds of combined) {
          for (const pid of ds.sourceProblemIds || []) covered.add(pid);
        }
        const missing = informedProblemsCrossCutting
          .map((p) => p.id)
          .filter((id) => !covered.has(id));
        if (missing.length > 0) {
          try {
            const retry = await fetch('/api/generate-cross-cutting-demand-spaces', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: model.input,
                apiKey,
                crossCuttingProblems: informedProblemsCrossCutting,
                prioritiseProblemIds: missing,
                variantLabel: activeVariant?.label,
              }),
            });
            if (retry.ok) {
              const retryData = await retry.json();
              if (Array.isArray(retryData.demandSpaces)) {
                combined = [...combined, ...retryData.demandSpaces];
              }
            } else {
              console.warn(
                `[informed] cross-cutting coverage retry failed; persisting partial. Missing: ${missing.length}`
              );
            }
          } catch (retryErr) {
            console.warn('[informed] cross-cutting retry threw:', retryErr);
          }
        }

        setCrossCuttingDemandSpaces(combined);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setGeneratingCrossCuttingDemandSpaces(false);
      }
    },
    [
      model,
      apiKey,
      isInformedRoute,
      informedProblemsCrossCutting,
      setCrossCuttingDemandSpaces,
      setGeneratingCrossCuttingDemandSpaces,
    ]
  );

  const handleGenerateCircumstances = useCallback(async (demandSpaceId: string) => {
    if (!model || !apiKey) return;
    // Lookup in both per-phase and cross-cutting buckets. Cross-cutting
    // demand spaces don't have a real phase; we synthesise a virtual
    // "systemic" phase so the generate-circumstances route can keep its
    // existing journeyPhase contract.
    const demandSpace =
      model.demandSpaces.find((ds) => ds.id === demandSpaceId) ||
      (model.crossCuttingDemandSpaces || []).find((ds) => ds.id === demandSpaceId);
    if (!demandSpace) return;

    const isCrossCutting = demandSpace.scope === 'cross-cutting';
    const phase = isCrossCutting
      ? ({
          id: '__cross_cutting__',
          journeyId: '',
          label: 'Cross-cutting (systemic)',
          description:
            'Systemic motivation that cuts across the entire customer journey. Not bound to any single phase — frame the circumstance at an org / governance / data / brand / martech level rather than a per-phase use case.',
          trigger: '',
          order: 0,
          source: 'ai' as const,
        } as JourneyPhase)
        : model.journeyPhases.find((p) => p.id === demandSpace.journeyPhaseId);
    if (!phase) return;

    setError(null);
    setGeneratingCircumstances(demandSpaceId, true);

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllersRef.current.circumstances[demandSpaceId] = controller;

    try {
      const response = await fetch('/api/generate-circumstances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: model.input,
          journeyPhase: phase,
          demandSpace,
          apiKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate circumstances');
      }

      const data = await response.json();
      setCircumstances(demandSpaceId, data.circumstances);
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingCircumstances(demandSpaceId, false);
      delete abortControllersRef.current.circumstances[demandSpaceId];
    }
  }, [model, apiKey, setCircumstances, setGeneratingCircumstances]);

  // Manual, no-AI entry point for the "Add demand space" inline form.
  // Creates the demand space with an empty circumstances array — the
  // auto-cascade effect will then generate the 5 circumstances via API.
  const handleAddDemandSpace = useCallback(
    (
      phaseId: string,
      input: {
        label: string;
        jobToBeDone: string;
        description?: string;
        circumstances: [];
      }
    ) => {
      const id = createDemandSpaceWithCircumstances(phaseId, input);
      setExpandedCards((prev) => ({ ...prev, [id]: true }));
      setSelected(id);
    },
    [createDemandSpaceWithCircumstances]
  );

  const handleGeneratePersonaMappings = useCallback(async () => {
    if (!model || !apiKey || !model.input.personas || model.input.personas.length === 0) return;

    // Skip if already mapped or currently generating
    if (model.personaMappings.length > 0 || isGeneratingPersonaMappings) return;

    setError(null);
    setGeneratingPersonaMappings(true);

    try {
      const response = await fetch('/api/map-personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, apiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to map personas');
      }

      const data = await response.json();
      setPersonaMappings(data.personaMappings);
    } catch (err) {
      console.error('Persona mapping error:', err);
      setError(err instanceof Error ? err.message : 'Failed to map personas');
    } finally {
      setGeneratingPersonaMappings(false);
    }
  }, [model, apiKey, isGeneratingPersonaMappings, setPersonaMappings, setGeneratingPersonaMappings]);

  // Regenerate the whole landscape using the approved discovery bundle.
  // Clears demand spaces / circumstances / persona mappings, regenerates journey
  // phases with evidence + signals, then the existing auto-cascade takes over.
  const handleRefineWithDiscovery = useCallback(async () => {
    if (!model || !apiKey) return;
    if (!model.discoveryBundle) {
      setError('No approved discovery bundle — go through Capture → Signals → Review first.');
      return;
    }
    if (!activeJourney) {
      setError('Pick a journey to refine before running discovery.');
      return;
    }
    const confirmed = confirm(
      `This will regenerate the "${activeJourney.name}" journey using your approved discovery bundle. Its phases, demand spaces, circumstances, and persona mappings will be replaced. Other journeys are untouched. Proceed?`
    );
    if (!confirmed) return;

    setError(null);
    // Scope the reset to the active journey only — other journeys keep their
    // phases + demand spaces + circumstances intact.
    resetLandscapeForRegen(activeJourney.id);
    setGeneratingPhases(true);

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllersRef.current.phases = controller;

    try {
      const response = await fetch('/api/generate-journey-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...model.input,
          apiKey,
          discoveryBundle: model.discoveryBundle,
          journeyContext: {
            name: activeJourney.name,
            jtbdBlueprint: activeJourney.jtbdBlueprint,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate journey phases');
      }

      const data = await response.json();
      setJourneyPhases(activeJourney.id, data.journeyPhases);
      setCurrentStep('evidenced-landscape');
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setGeneratingPhases(false);
      abortControllersRef.current.phases = undefined;
    }
  }, [model, apiKey, activeJourney, resetLandscapeForRegen, setGeneratingPhases, setJourneyPhases, setCurrentStep]);

  // Generate phases for a single journey. This is the per-journey entry
  // point used by the empty-state CTA and the switcher's "Generate" chip.
  // Each journey is generated independently — switching journeys does not
  // cancel in-flight work; if another journey is already generating, we
  // bail early so we don't step on its state.
  const handleGeneratePhasesForJourney = useCallback(async (journeyId: string) => {
    if (!model) return;
    if (!apiKey) {
      setError('Add your OpenAI key in the top bar to generate.');
      return;
    }
    if (isGeneratingPhases) return;

    const journey = model.journeys.find(j => j.id === journeyId);
    if (!journey) return;

    setError(null);
    setGeneratingPhases(true);

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllersRef.current.phases = controller;

    try {
      const response = await fetch('/api/generate-journey-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...model.input,
          apiKey,
          journeyContext: {
            name: journey.name,
            jtbdBlueprint: journey.jtbdBlueprint,
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `API returned ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data.journeyPhases) || data.journeyPhases.length === 0) {
        throw new Error('No journey phases returned');
      }
      setJourneyPhases(journey.id, data.journeyPhases);
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to generate journey');
    } finally {
      setGeneratingPhases(false);
      abortControllersRef.current.phases = undefined;
    }
  }, [model, apiKey, isGeneratingPhases, setGeneratingPhases, setJourneyPhases]);

  // Kick off generation for a whole journey at once. Picks the right
  // action based on what's already in place:
  //   • No phases → generate phases (auto-cascade then fills in demand
  //     spaces + circumstances).
  //   • Preloaded phases (Dubai-style, source='user') → skip phase
  //     regeneration and fan out demand-space generation per phase. This
  //     preserves the phases the brief supplied instead of throwing them
  //     away the moment the user asks to "generate".
  // Called from the centered empty-state CTA and the per-journey "Gen"
  // chip on the tab strip.
  const handleGenerateJourney = useCallback((journeyId: string) => {
    if (!model) return;
    if (!apiKey) {
      setError('Add your OpenAI key in the top bar to generate.');
      return;
    }
    const phasesForJourney = model.journeyPhases.filter(
      (p) => (p.journeyId ?? model.journeys[0]?.id) === journeyId
    );
    if (phasesForJourney.length === 0) {
      void handleGeneratePhasesForJourney(journeyId);
      return;
    }
    // Fan out demand-space generation for each phase that doesn't have
    // any yet. Fires in parallel; per-phase loading state is tracked via
    // isGeneratingDemandSpaces so each column shows its own spinner.
    const spaceByPhase = new Set(
      model.demandSpaces.map((ds) => ds.journeyPhaseId)
    );
    phasesForJourney.forEach((p) => {
      if (!spaceByPhase.has(p.id) && !isGeneratingDemandSpaces[p.id]) {
        void handleGenerateDemandSpaces(p.id);
      }
    });
    // On the Informed route, "Generate" also fires the cross-cutting
    // silo so a single click produces every JTBD that addresses the
    // diagnostics — per-phase + systemic in one cascade.
    if (
      isInformedRoute &&
      informedProblemsCrossCutting.length > 0 &&
      !isGeneratingCrossCuttingDemandSpaces &&
      (model.crossCuttingDemandSpaces || []).length === 0
    ) {
      void handleGenerateCrossCuttingDemandSpaces();
    }
  }, [
    model,
    apiKey,
    isGeneratingDemandSpaces,
    handleGenerateDemandSpaces,
    handleGeneratePhasesForJourney,
    isInformedRoute,
    informedProblemsCrossCutting.length,
    isGeneratingCrossCuttingDemandSpaces,
    handleGenerateCrossCuttingDemandSpaces,
  ]);

  // Auto-cascade: Generate demand spaces when AI-generated phases are added.
  // Skips phases with source='user' (preloaded from brief) to avoid auto-triggering
  // on page load when Dubai Airport or similar examples are loaded.
  // Also skips phases that already have demand spaces (prevents re-generation
  // when clicking v1 in the sidebar after content already exists).
  const prevPhasesRef = useRef<string[]>([]);
  const isInitializedPhasesRef = useRef(false);
  useEffect(() => {
    if (!model || !apiKey) return;
    const currentPhaseIds = model.journeyPhases.map(p => p.id);

    // On first mount, initialize the ref with existing phases to prevent
    // treating them as "new" when navigating back to this page
    if (!isInitializedPhasesRef.current) {
      prevPhasesRef.current = currentPhaseIds;
      isInitializedPhasesRef.current = true;
      return;
    }

    const newPhaseIds = currentPhaseIds.filter(id => !prevPhasesRef.current.includes(id));
    prevPhasesRef.current = currentPhaseIds;

    // Only auto-generate for AI-generated phases (not user-preloaded ones)
    // AND only if demand spaces don't already exist for this phase
    newPhaseIds.forEach(phaseId => {
      const phase = model.journeyPhases.find(p => p.id === phaseId);
      const hasExistingSpaces = model.demandSpaces.some(ds => ds.journeyPhaseId === phaseId);
      if (phase && phase.source !== 'user' && !hasExistingSpaces && !isGeneratingDemandSpaces[phaseId]) {
        handleGenerateDemandSpaces(phaseId);
      }
    });
  }, [model?.journeyPhases, apiKey, isGeneratingDemandSpaces, handleGenerateDemandSpaces, model]);

  // Auto-cascade: Generate circumstances when demand spaces are added.
  // Skips demand spaces that already have circumstances (prevents re-generation
  // when clicking v1 in the sidebar after content already exists). Tracks
  // both per-phase and cross-cutting demand spaces in the same pass —
  // both shapes own their circumstances by demandSpaceId.
  const prevSpacesRef = useRef<string[]>([]);
  const isInitializedSpacesRef = useRef(false);
  useEffect(() => {
    if (!model || !apiKey) return;
    const allSpaces = [
      ...model.demandSpaces,
      ...(model.crossCuttingDemandSpaces || []),
    ];
    const currentSpaceIds = allSpaces.map((ds) => ds.id);

    // On first mount, initialize the ref with existing spaces to prevent
    // treating them as "new" when navigating back to this page
    if (!isInitializedSpacesRef.current) {
      prevSpacesRef.current = currentSpaceIds;
      isInitializedSpacesRef.current = true;
      return;
    }

    const newSpaceIds = currentSpaceIds.filter(id => !prevSpacesRef.current.includes(id));
    prevSpacesRef.current = currentSpaceIds;

    // Generate circumstances for any new demand spaces ONLY if circumstances don't already exist
    newSpaceIds.forEach(spaceId => {
      const hasExistingCircumstances = model.circumstances.some(c => c.demandSpaceId === spaceId);
      if (!hasExistingCircumstances && !isGeneratingCircumstances[spaceId]) {
        handleGenerateCircumstances(spaceId);
      }
    });
  }, [model?.demandSpaces, model?.crossCuttingDemandSpaces, apiKey, isGeneratingCircumstances, handleGenerateCircumstances, model]);

  // Auto-cascade: Generate cross-cutting demand spaces on the Informed
  // Cross-cutting silo — DOES NOT auto-cascade. The strategist must
  // click "Generate" on the Cross-cutting JTBDs band, mirroring how
  // per-journey generation is also explicit. This avoids burning tokens
  // before the user has reviewed the diagnostics.

  // Auto-expand cards when generation completes
  const prevGeneratingRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!model) return;
    // Check for any circumstances that just finished generating
    Object.keys(prevGeneratingRef.current).forEach(spaceId => {
      if (prevGeneratingRef.current[spaceId] && !isGeneratingCircumstances[spaceId]) {
        // Generation just completed for this space - expand the card
        setExpandedCards(prev => ({ ...prev, [spaceId]: true }));
      }
    });
    prevGeneratingRef.current = { ...isGeneratingCircumstances };
  }, [isGeneratingCircumstances, model]);

  // Auto-generate persona mappings when all circumstances are done
  const prevGenerationCompleteRef = useRef(isGenerationComplete);
  useEffect(() => {
    // Only trigger when generation just completed (transition from false to true)
    if (isGenerationComplete && !prevGenerationCompleteRef.current) {
      handleGeneratePersonaMappings();
    }
    prevGenerationCompleteRef.current = isGenerationComplete;
  }, [isGenerationComplete, handleGeneratePersonaMappings]);

  // Auto expand/collapse cards when persona filter changes
  useEffect(() => {
    if (!model || !activePersona) return;

    const newExpandedState: Record<string, boolean> = {};

    // Expand related demand spaces, collapse others
    model.demandSpaces.forEach(ds => {
      const isRelated = relatedDemandSpaceIds.has(ds.id);
      newExpandedState[ds.id] = isRelated;
    });

    setExpandedCards(newExpandedState);
  }, [activePersona, relatedDemandSpaceIds, model]);

  // Zoom to phase helper
  const zoomToPhase = (phaseId: string) => {
    const idx = displayPhases.findIndex(p => p.id === phaseId);
    const el = canvas.containerRef.current;
    if (!el || idx < 0) return;
    const rect = el.getBoundingClientRect();
    const targetS = Math.min(1, Math.max(0.6, rect.width / (style.colW * 1.2)));
    const targetX = rect.width / 2 - (idx + 0.5) * style.colW * targetS;
    canvas.setView(v => ({ ...v, x: targetX, y: 140, s: targetS }));
  };

  // Observe container size - runs once on mount
  useEffect(() => {
    const el = canvas.containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // containerRef is a stable ref, no deps needed

  // Fit once on first size - only depends on data, not canvas object
  useEffect(() => {
    if (containerSize.w && displayPhases.length > 0 && typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('jg.ws.fitted')) {
      sessionStorage.setItem('jg.ws.fitted', '1');
      const el = canvas.containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const targetS = Math.min(0.9, Math.max(0.55, (rect.width - 80) / worldW));
      canvas.setView({ x: 40, y: 150, s: targetS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.w, displayPhases.length, worldW]); // canvas methods are stable, excluded to prevent loops

  const openAI = (space: DisplayDemandSpace) => {
    setAiSpace(space);
    setAiOpen(true);
    setSelected(space.id);
  };

  const onMinimapNavigate = (wx: number) => {
    const el = canvas.containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    canvas.setView(v => ({ ...v, x: rect.width / 2 - wx * v.s, y: 140 }));
  };

  if (!model) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg-0)' }}>
        <div className="text-[var(--fg-3)]">Loading...</div>
      </div>
    );
  }

  // Version badge + refine-CTA state
  const hasBundle = !!model.discoveryBundle;
  const signalsCount = model.signals?.length ?? 0;
  const hasEvidence = (model.evidenceRecords?.length ?? 0) > 0;
  const versionLabel = hasBundle
    ? 'v2 · discovery-refined'
    : hasEvidence
    ? 'v1 · unrefined'
    : 'v1 · from brief';
  const versionTone: 'hypothesis' | 'evidenced' = hasBundle ? 'evidenced' : 'hypothesis';
  const refineTitle = !hasBundle
    ? 'Approve a discovery bundle first (Capture → Signals → Review)'
    : isGeneratingPhases
    ? 'Regenerating…'
    : 'Regenerate the landscape from approved evidence + signals';

  return (
    <div className="h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      {!fullscreen && (
        <div className="fixed top-0 left-0 right-0 z-50" style={{ right: 'var(--jg-rail-w, 56px)' }}>
          {/* Pane 1: Top Header (Logo + 7-Step Progress + API Key + Tweaks) */}
          <Pane1_TopHeader
            industry={model.input.industry || 'Workspace'}
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            onOpenTweaks={() => setTweaksOpen(true)}
            signalsCount={signalsCount}
            hasDiscoveryBundle={hasBundle}
            modelId={model.id}
            hasJourneyPhases={model.journeyPhases.length > 0}
            hasDiagnostics={hasDiagnostics}
            activeStep={isInformedRoute ? 'informed-landscape' : 'hypothesis-landscape'}
          />

          {/* Variant strip — sits between top header and journey tabs.
              On `/model/[id]` we show Hypothesis variants (brief/research
              blends). On `/model/[id]/informed-landscape` we swap in the
              Informed variants bar (problem-driven blends). Both write
              into `model.journeyPhases` via their respective store
              actions, with the bidirectional invariant enforced in the
              store: only one variant is "live" across both arrays. */}
          {isInformedRoute ? (
            <InformedVariantsBar
              model={model}
              apiKey={apiKey}
              variants={model.informedVariants || []}
              problems={informedProblemsPayload}
              existingPhases={model.journeyPhases}
              onAddVariant={(v) => addInformedVariant(v)}
              onActivateVariant={setActiveInformedVariant}
              onRemoveVariant={removeInformedVariant}
              onError={setError}
            />
          ) : (
            <HypothesisVariantsBar
              model={model}
              apiKey={apiKey}
              variants={model.hypothesisVariants || []}
              onAddVariant={(v) => addHypothesisVariant(v)}
              onActivateVariant={setActiveHypothesisVariant}
              onRemoveVariant={removeHypothesisVariant}
              onError={setError}
            />
          )}

          {/* Pane 2: Journey Folder Tabs */}
          <Pane2_JourneyFolderTabs
            journeys={journeys}
            activeJourneyId={activeJourneyId}
            setActiveJourneyId={setActiveJourneyId}
            phaseCountByJourney={phaseCountByJourney}
            generatingJourneyId={isActiveJourneyGenerating ? activeJourneyId : null}
            needsGenerationByJourney={needsGenerationByJourney}
            onGenerateJourney={(jid) => {
              if (jid !== activeJourneyId) setActiveJourneyId(jid);
              handleGenerateJourney(jid);
            }}
            canGenerate={Boolean(apiKey) && !isGeneratingPhases}
          />

          {/* Panes 3 & 4: Unified Workspace Container */}
          <Pane3and4_WorkspaceContainer
            activeJourneyName={activeJourney?.name || 'Journey'}
            totals={totals}
            isGenerating={isActiveJourneyGenerating}
            onStopGeneration={handleStopAllGeneration}
            onToggleFullscreen={() => setFullscreen(!fullscreen)}
            fullscreen={fullscreen}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            onRefine={handleRefineWithDiscovery}
            refineEnabled={hasBundle}
            refineTitle={refineTitle}
            refineIsRunning={isGeneratingPhases}
            onGenerateJourney={() => activeJourney && handleGenerateJourney(activeJourney.id)}
            canGenerate={Boolean(apiKey) && !isGeneratingPhases}
            phases={displayPhases}
            activePhase={activePhase}
            setActivePhase={setActivePhase}
            onZoomToPhase={zoomToPhase}
          />
        </div>
      )}

      <main
        className="fixed left-0 bottom-0 overflow-hidden"
        style={{
          // Folder tab layout heights:
          // Pane 1 (48px) + variants bar (~36px) + folder tabs (~50px) + workspace container (~145px) = ~279px
          // In fullscreen mode, set top to 0 to hide all panes.
          top: fullscreen ? 0 : 279,
          right: 'var(--jg-rail-w, 56px)',
          paddingTop: displayPersonas.length > 0 ? '50px' : '0',
        }}
      >
        {/* Full-screen close button */}
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="fixed top-4 right-[calc(var(--jg-rail-w,56px)+16px)] z-50 flex items-center gap-2 px-4 py-2 text-[11px] font-bold rounded-xl border transition-all hover:scale-105"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--border-2)',
              color: 'var(--fg-1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            title="Exit full screen"
          >
            <X size={14} /> EXIT FULL SCREEN
          </button>
        )}

        {/* Error banner */}
        {error && (
          <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-[var(--danger)]/10 border-b border-[var(--danger)]/30 text-sm text-[var(--danger)] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="btn btn--icon btn--ghost btn--sm">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Persona filter */}
        <PersonaFilter
          personas={displayPersonas}
          activePersona={activePersona}
          setActivePersona={setActivePersona}
          enabled={isGenerationComplete && model.personaMappings.length > 0}
        />

        {/* Cross-cutting JTBDs band — Informed Landscape only.
            Sits at the top of the canvas as a single collapsible panel.
            The wrapper is pointer-events transparent so the canvas can
            still be panned in the gap around the band. */}
        {isInformedRoute &&
          ((model.crossCuttingDemandSpaces || []).length > 0 ||
            informedProblemsCrossCutting.length > 0) && (
            <div className="absolute top-2 left-3 right-3 z-30 max-h-[70%] overflow-y-auto pointer-events-none">
              <div className="pointer-events-auto">
                <CrossCuttingJTBDsBand
                  modelId={model.id}
                  demandSpaces={model.crossCuttingDemandSpaces || []}
                  circumstances={model.circumstances}
                  problemsById={problemsById}
                  crossCuttingProblemCount={informedProblemsCrossCutting.length}
                  isGenerating={isGeneratingCrossCuttingDemandSpaces}
                  isGeneratingCircumstances={isGeneratingCircumstances}
                  onGenerate={() => handleGenerateCrossCuttingDemandSpaces()}
                />
              </div>
            </div>
          )}

        {/* Canvas */}
        <div
          ref={canvas.containerRef}
          onMouseDown={canvas.onMouseDown}
          onMouseMove={canvas.onMouseMove}
          onMouseUp={canvas.onMouseUp}
          onMouseLeave={canvas.onMouseUp}
          className={`canvas-bg--${theme.bg} absolute inset-0 overflow-hidden`}
        >
          <div
            ref={canvas.transformRef}
            className="absolute left-0 top-0 flex items-start will-change-transform"
            style={{
              // Single compositor transform (translate + scale). During
              // drag / wheel we update this transform imperatively via
              // canvas.transformRef — React state trails behind on idle
              // so the rest of the workspace tree doesn't re-render on
              // every pan frame. Initial value matches viewRef.current.
              transform: `translate3d(${canvas.view.x}px, ${canvas.view.y}px, 0) scale(${canvas.view.s})`,
              transformOrigin: '0 0',
              backfaceVisibility: 'hidden',
              // `contain: layout paint` isolates this subtree's paint
              // from the rest of main, so pan redraws stay within the
              // canvas layer.
              contain: 'layout paint',
            }}
          >
            {displayPhases.map((phase) => (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                spaces={displaySpaces[phase.id] || []}
                selected={selected}
                setSelected={setSelected}
                expandedCards={expandedCards}
                onToggleExpand={toggleExpand}
                onOpenAI={openAI}
                isLoadingSpaces={isGeneratingDemandSpaces[phase.id]}
                loadingCircumstances={isGeneratingCircumstances}
                relatedDemandSpaceIds={relatedDemandSpaceIds}
                personaColor={activePersonaColor}
                highlightedCircumstanceIds={relatedCircumstanceIds}
                onAddDemandSpace={handleAddDemandSpace}
                renderProvenance={
                  isInformedRoute
                    ? (space) => {
                        const ids = space.sourceProblemIds || [];
                        if (ids.length === 0) return null;
                        const provenanceProblems = ids
                          .map((id) => problemsById.get(id))
                          .filter((p): p is InformedProblemPayload => Boolean(p));
                        if (provenanceProblems.length === 0) return null;
                        return (
                          <ProblemProvenanceChip
                            problems={provenanceProblems}
                            modelId={model.id}
                          />
                        );
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* Floating UI */}
          <Minimap
            phases={displayPhases}
            view={canvas.view}
            containerSize={containerSize}
            worldSize={{ w: worldW, h: worldH }}
            onNavigate={onMinimapNavigate}
          />
          <ZoomControls
            view={canvas.view}
            zoomIn={canvas.zoomIn}
            zoomOut={canvas.zoomOut}
            zoomTo={canvas.zoomTo}
            onFit={() => canvas.fit(worldW, 1200)}
          />

          {/* Help hint */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 inline-flex items-center gap-2.5 py-1.5 px-3 rounded-[10px] text-[11px] font-medium text-[var(--fg-2)]"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border-1)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <span className="kbd">space</span>+drag to pan
            <span className="opacity-40">·</span>
            <span className="kbd">⌘</span>+scroll to zoom
            <span className="opacity-40">·</span>
            <span className="kbd">⌘0</span> fit
          </div>

          {/* AI panel */}
          <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} space={aiSpace} />
        </div>
      </main>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} theme={theme} setTheme={setTheme} />

      <ToolsRail />
    </div>
  );
}
