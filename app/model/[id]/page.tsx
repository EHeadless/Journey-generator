'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

// Phase Rail
/**
 * Horizontal scroll-snap journey switcher. Rendered below the StepProgress
 * when a model has more than one journey. Each tab shows the journey name,
 * its JTBD blueprint (if set), and a small phase-count chip. Tabs flick-
 * scroll left/right on touchpads and phones; we skip rendering entirely
 * when there's only one journey — that case shows the JTBD as a subtitle
 * on the active journey header instead.
 */
function JourneyTabs({
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
  if (journeys.length <= 1) return null;
  return (
    <div
      className="scrollbar-hide flex items-stretch gap-2 px-4 py-2 overflow-x-auto"
      style={{
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--border-1)',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {journeys.map((j) => {
        const active = j.id === activeJourneyId;
        const count = phaseCountByJourney[j.id] ?? 0;
        const isGenerating = generatingJourneyId === j.id;
        const needsGen = needsGenerationByJourney[j.id];
        return (
          <div
            key={j.id}
            className="flex-shrink-0 rounded-xl transition-all relative"
            style={{
              scrollSnapAlign: 'start',
              background: active ? 'var(--bg-2)' : 'transparent',
              border: active ? '1px solid var(--border-1)' : '1px solid transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              minWidth: 180,
              maxWidth: 280,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveJourneyId(j.id)}
              className="w-full text-left px-4 py-2.5"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[11px] font-black uppercase tracking-widest truncate"
                  style={{ color: active ? 'var(--fg-1)' : 'var(--fg-2)' }}
                >
                  {j.name || 'Untitled journey'}
                </span>
                {isGenerating ? (
                  <Loader2 size={11} className="animate-spin" style={{ color: 'var(--accent)' }} />
                ) : (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'var(--bg-3)',
                      color: active ? 'var(--accent)' : 'var(--fg-3)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </div>
              {j.jtbdBlueprint ? (
                <div
                  className="text-[10px] leading-snug truncate pr-14"
                  style={{ color: active ? 'var(--fg-2)' : 'var(--fg-3)' }}
                  title={j.jtbdBlueprint}
                >
                  {j.jtbdBlueprint}
                </div>
              ) : (
                <div className="text-[10px] italic pr-14" style={{ color: 'var(--fg-3)' }}>
                  No JTBD blueprint yet
                </div>
              )}
            </button>

            {/* Per-journey Generate chip — shown only when this journey
                hasn't produced any demand spaces yet. Sits over the tab so
                preloaded-but-unpopulated journeys (Dubai Airport: Arrival,
                Transit, Departure) still have an obvious entry point. */}
            {needsGen && !isGenerating && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canGenerate) return;
                  onGenerateJourney(j.id);
                }}
                disabled={!canGenerate}
                title={
                  canGenerate
                    ? 'Generate phases + demand spaces for this journey'
                    : 'Add your OpenAI key to generate'
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all"
                style={{
                  background: canGenerate ? 'var(--accent)' : 'var(--bg-3)',
                  color: canGenerate ? 'var(--accent-fg)' : 'var(--fg-3)',
                  cursor: canGenerate ? 'pointer' : 'not-allowed',
                  opacity: canGenerate ? 1 : 0.6,
                }}
              >
                <Zap size={10} /> Gen
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseRail({
  phases,
  activePhase,
  setActivePhase,
  onZoomToPhase,
  onRefine,
  refineEnabled,
  refineTitle,
  refineIsRunning,
  onExpandAll,
  onCollapseAll,
  isGenerating,
  onStopGeneration,
  totals,
}: {
  phases: DisplayPhase[];
  activePhase: string;
  setActivePhase: (id: string) => void;
  onZoomToPhase: (id: string) => void;
  onRefine: () => void;
  refineEnabled: boolean;
  refineTitle: string;
  refineIsRunning: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
  totals: { phases: number; spaces: number; circumstances: number };
}) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 py-2.5 px-4 border-b border-[var(--border-1)]"
      style={{
        background: 'color-mix(in srgb, var(--bg-0) 92%, transparent)',
        backdropFilter: 'saturate(180%) blur(10px)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Title */}
        <div className="flex-shrink-0 min-w-[200px]">
          <div className="eyebrow eyebrow--accent">Workspace</div>
          <div className="text-lg font-bold tracking-tight mt-0.5">JTBD Blueprint</div>
        </div>

        {/* Summary counts */}
        <div className="flex items-center gap-6 ml-5">
          {[
            { label: 'Phases', value: totals.phases, color: 'var(--fg-1)' },
            { label: 'Spaces', value: totals.spaces, color: '#4ade80' },
            { label: 'Circumstances', value: totals.circumstances, color: '#06b6d4' },
          ].map((x) => (
            <div key={x.label}>
              <div className="text-xl font-semibold font-mono" style={{ color: x.color }}>
                {x.value}
              </div>
              <div className="text-[10px] font-medium text-[var(--fg-3)] uppercase tracking-wider mt-1">
                {x.label}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex items-center gap-3 text-[var(--accent)]">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm font-medium">Generating...</span>
              <button
                onClick={onStopGeneration}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                style={{
                  background: 'var(--danger)',
                  color: 'white',
                }}
                title="Stop all generation and keep what's been generated so far"
              >
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-auto flex gap-2">
          <button className="btn btn--ghost btn--sm" onClick={onExpandAll} title="Expand all">
            <ChevronsUpDown size={13} /> Expand
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onCollapseAll} title="Collapse all">
            <ChevronsDownUp size={13} /> Collapse
          </button>
          <button className="btn btn--ghost btn--sm">
            <Plus size={13} /> Add phase
          </button>
          <button
            className={`btn btn--sm ${refineEnabled ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onRefine}
            disabled={!refineEnabled || refineIsRunning}
            title={refineTitle}
          >
            <Wand2 size={13} />
            {refineIsRunning ? 'Regenerating…' : 'Refine with discovery'}
          </button>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="scrollbar-hide flex gap-1.5 mt-3 overflow-x-auto">
        {phases.map((p) => {
          const active = activePhase === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePhase(p.id);
                onZoomToPhase(p.id);
              }}
              className="flex items-center gap-2 py-1.5 px-3 rounded-lg whitespace-nowrap transition-all cursor-pointer text-[12px] font-medium"
              style={{
                background: active ? 'var(--bg-2)' : 'transparent',
                border: active ? '1px solid var(--border-2)' : '1px solid var(--border-1)',
                color: 'var(--fg-1)',
              }}
            >
              <span
                className="w-[18px] h-[18px] rounded-[5px] grid place-items-center text-[10px] font-bold text-white"
                style={{ background: p.accent }}
              >
                {p.order}
              </span>
              {p.label}
              <span className="text-[10px] font-mono text-[var(--fg-3)]">{p.counts.spaces}</span>
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

// Tweaks Panel
function TweaksPanel({
  open,
  onClose,
  theme,
  setTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
}) {
  if (!open) return null;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[96px_1fr] gap-3 items-center py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-widest text-[var(--fg-3)]">{label}</div>
      <div>{children}</div>
    </div>
  );

  const Seg = ({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="inline-flex gap-0.5 p-0.5 bg-[var(--bg-3)] border border-[var(--border-1)] rounded-[10px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="py-1.5 px-2.5 rounded-[7px] border-none cursor-pointer text-xs font-medium transition-all"
          style={{
            background: value === o.value ? 'var(--bg-1)' : 'transparent',
            color: value === o.value ? 'var(--fg-1)' : 'var(--fg-2)',
            boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[80] bg-black/20" />
      <aside
        className="fixed right-4 top-16 bottom-4 z-[90] w-80 bg-[var(--bg-1)] border border-[var(--border-1)] rounded-[14px] p-4 overflow-auto"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Tweaks</div>
          <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <Row label="Mode">
          <Seg
            options={[
              { value: 'linear', label: 'Linear' },
              { value: 'editorial', label: 'Editorial' },
              { value: 'ei', label: 'EI' },
            ]}
            value={theme.theme}
            onChange={(v) => setTheme({ ...theme, theme: v as ThemeConfig['theme'] })}
          />
        </Row>
        <Row label="Canvas">
          <Seg
            options={[
              { value: 'dots', label: 'Dots' },
              { value: 'grid', label: 'Grid' },
              { value: 'plain', label: 'Plain' },
            ]}
            value={theme.bg}
            onChange={(v) => setTheme({ ...theme, bg: v as ThemeConfig['bg'] })}
          />
        </Row>
      </aside>
    </>
  );
}

// Top bar
function TopBar({
  left,
  right,
  onOpenTweaks,
  apiKey,
  onApiKeyChange,
  versionLabel,
  versionTone,
}: {
  left: string;
  right?: React.ReactNode;
  onOpenTweaks: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  versionLabel?: string;
  versionTone?: 'hypothesis' | 'evidenced';
}) {
  const { open: railOpen, toggle: toggleRail } = useToolsRail();
  return (
    <header className="sticky top-0 z-40 glass-header border-b border-[var(--border-1)] py-2.5 px-5 flex items-center gap-4">
      <a href="/" className="flex items-center gap-2 no-underline text-[var(--fg-1)]">
        <div className="w-6 h-6 rounded-[6px] bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center text-[13px] font-bold">
          J
        </div>
        <span className="text-sm font-semibold tracking-tight">Journey Generator</span>
      </a>
      <span className="opacity-30">/</span>
      <span className="text-[13px] text-[var(--fg-2)]">{left}</span>
      {versionLabel && (
        <span
          className="chip"
          style={
            versionTone === 'evidenced'
              ? {
                  background:
                    'color-mix(in srgb, var(--success) 14%, transparent)',
                  color:
                    'color-mix(in srgb, var(--success) 80%, var(--fg-1))',
                  border:
                    '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
                }
              : undefined
          }
        >
          {versionLabel}
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--fg-3)] uppercase tracking-wider">OpenAI Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="sk-..."
            className="w-36 px-2 py-1.5 text-sm bg-[var(--bg-2)] border border-[var(--border-1)] rounded-lg text-[var(--fg-1)] placeholder-[var(--fg-3)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        {right}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={toggleRail}
          title={railOpen ? 'Hide versions & tools' : 'Show versions & tools'}
          aria-label={railOpen ? 'Hide versions & tools' : 'Show versions & tools'}
          aria-pressed={railOpen}
        >
          {railOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          Versions
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onOpenTweaks}>
          <SlidersHorizontal size={14} />
          Tweaks
        </button>
      </div>
    </header>
  );
}

// Main Workspace page
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
    isGeneratingCircumstances,
    isGeneratingPersonaMappings,
    setJourneyPhases,
    setDemandSpaces,
    setCircumstances,
    setPersonaMappings,
    setGeneratingPhases,
    setGeneratingDemandSpaces,
    setGeneratingCircumstances,
    setGeneratingPersonaMappings,
    resetLandscapeForRegen,
    setCurrentStep,
    createDemandSpaceWithCircumstances,
    stopAllGeneration,
  } = useStore();

  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSpace, setAiSpace] = useState<DisplayDemandSpace | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activePersona, setActivePersona] = useState<string | null>(null);

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

  // Check if ALL generation is complete (for enabling persona filter)
  const isGenerationComplete = Boolean(
    !isAnyGenerating &&
    model &&
    model.journeyPhases.length > 0 &&
    model.demandSpaces.length > 0 &&
    model.circumstances.length > 0
  );

  // Generation handlers (defined first so they can be referenced)
  const handleGenerateDemandSpaces = useCallback(async (phaseId: string) => {
    if (!model || !apiKey) return;
    const phase = model.journeyPhases.find(p => p.id === phaseId);
    if (!phase) return;

    setError(null);
    setGeneratingDemandSpaces(phaseId, true);

    try {
      const response = await fetch('/api/generate-demand-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: model.input,
          journeyPhase: phase,
          apiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate demand spaces');
      }

      const data = await response.json();
      setDemandSpaces(phaseId, data.demandSpaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingDemandSpaces(phaseId, false);
    }
  }, [model, apiKey, setDemandSpaces, setGeneratingDemandSpaces]);

  const handleGenerateCircumstances = useCallback(async (demandSpaceId: string) => {
    if (!model || !apiKey) return;
    const demandSpace = model.demandSpaces.find(ds => ds.id === demandSpaceId);
    if (!demandSpace) return;

    const phase = model.journeyPhases.find(p => p.id === demandSpace.journeyPhaseId);
    if (!phase) return;

    setError(null);
    setGeneratingCircumstances(demandSpaceId, true);

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
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate circumstances');
      }

      const data = await response.json();
      setCircumstances(demandSpaceId, data.circumstances);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingCircumstances(demandSpaceId, false);
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
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate journey phases');
      }

      const data = await response.json();
      setJourneyPhases(activeJourney.id, data.journeyPhases);
      setCurrentStep('landscape');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setGeneratingPhases(false);
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
      setError(err instanceof Error ? err.message : 'Failed to generate journey');
    } finally {
      setGeneratingPhases(false);
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
  }, [
    model,
    apiKey,
    isGeneratingDemandSpaces,
    handleGenerateDemandSpaces,
    handleGeneratePhasesForJourney,
  ]);

  // Auto-cascade: Generate demand spaces when AI-generated phases are added.
  // Skips phases with source='user' (preloaded from brief) to avoid auto-triggering
  // on page load when Dubai Airport or similar examples are loaded.
  // Also skips phases that already have demand spaces (prevents re-generation
  // when clicking v1 in the sidebar after content already exists).
  const prevPhasesRef = useRef<string[]>([]);
  useEffect(() => {
    if (!model || !apiKey) return;
    const currentPhaseIds = model.journeyPhases.map(p => p.id);
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
  // when clicking v1 in the sidebar after content already exists).
  const prevSpacesRef = useRef<string[]>([]);
  useEffect(() => {
    if (!model || !apiKey) return;
    const currentSpaceIds = model.demandSpaces.map(ds => ds.id);
    const newSpaceIds = currentSpaceIds.filter(id => !prevSpacesRef.current.includes(id));
    prevSpacesRef.current = currentSpaceIds;

    // Generate circumstances for any new demand spaces ONLY if circumstances don't already exist
    newSpaceIds.forEach(spaceId => {
      const hasExistingCircumstances = model.circumstances.some(c => c.demandSpaceId === spaceId);
      if (!hasExistingCircumstances && !isGeneratingCircumstances[spaceId]) {
        handleGenerateCircumstances(spaceId);
      }
    });
  }, [model?.demandSpaces, apiKey, isGeneratingCircumstances, handleGenerateCircumstances, model]);

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
  const prevGenerationCompleteRef = useRef(false);
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
      <div className="sticky top-0 z-50">
        <TopBar
          left={model.input.industry || 'Workspace'}
          onOpenTweaks={() => setTweaksOpen(true)}
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
          versionLabel={versionLabel}
          versionTone={versionTone}
          right={
            <>
              <a href="/" className="btn btn--ghost btn--sm">
                <ArrowLeft size={13} /> Brief
              </a>
              <button className="btn btn--soft btn--sm">
                <Download size={13} /> Export
              </button>
            </>
          }
        />
        <StepProgress
          currentStep="landscape"
          modelId={model.id}
          signalsCount={signalsCount}
          hasDiscoveryBundle={hasBundle}
        />
        <JourneyTabs
          journeys={journeys}
          activeJourneyId={activeJourneyId}
          setActiveJourneyId={setActiveJourneyId}
          phaseCountByJourney={phaseCountByJourney}
          generatingJourneyId={isGeneratingPhases ? activeJourneyId : null}
          needsGenerationByJourney={needsGenerationByJourney}
          onGenerateJourney={(jid) => {
            if (jid !== activeJourneyId) setActiveJourneyId(jid);
            handleGenerateJourney(jid);
          }}
          canGenerate={Boolean(apiKey) && !isGeneratingPhases}
        />
        {journeys.length === 1 && activeJourney?.jtbdBlueprint ? (
          <div
            className="px-4 py-2 text-[11px] leading-snug"
            style={{
              background: 'var(--bg-1)',
              borderBottom: '1px solid var(--border-1)',
              color: 'var(--fg-2)',
            }}
          >
            <span
              className="font-black uppercase tracking-widest mr-2"
              style={{ color: 'var(--fg-3)' }}
            >
              {activeJourney.name || 'Journey'} · JTBD
            </span>
            <span style={{ color: 'var(--fg-2)' }}>{activeJourney.jtbdBlueprint}</span>
          </div>
        ) : null}
      </div>

      <main
        className="fixed left-0 bottom-0 overflow-hidden"
        style={{
          // When a journey header (multi-journey tab strip OR single-journey
          // JTBD subtitle) is rendered, nudge main down so the sticky header
          // doesn't overlap the PhaseRail. Increased offset for multi-journey
          // to account for taller JourneyTabs component.
          top:
            journeys.length > 1
              ? 200
              : (journeys.length === 1 && activeJourney?.jtbdBlueprint)
              ? 166
              : 110,
          right: 'var(--jg-rail-w, 56px)',
          paddingTop: displayPersonas.length > 0 ? '50px' : '0',
        }}
      >
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

        {/* Phase rail */}
        <PhaseRail
          phases={displayPhases}
          activePhase={activePhase}
          setActivePhase={setActivePhase}
          onZoomToPhase={zoomToPhase}
          onRefine={handleRefineWithDiscovery}
          refineEnabled={hasBundle}
          refineTitle={refineTitle}
          refineIsRunning={isGeneratingPhases}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          isGenerating={isAnyGenerating}
          onStopGeneration={stopAllGeneration}
          totals={totals}
        />

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
              />
            ))}
          </div>

          {/* Empty-state CTA — shown whenever the active journey has no
              demand spaces yet, whether or not phases are preloaded from
              the brief. This matches the Disney experience (no phases →
              big centered CTA) for Dubai-style briefs where phases are
              preloaded from the input (Arrival / Transit / Departure) but
              demand spaces haven't been generated. Lives outside the
              pan/zoom transform so it stays centered on screen. */}
          {activeJourney &&
            needsGenerationByJourney[activeJourney.id] &&
            !isGeneratingPhases &&
            !activeJourneyPhases.some((p) => isGeneratingDemandSpaces[p.id]) && (
            <div
              className="absolute inset-0 z-40 grid place-items-center p-8 pointer-events-none"
              style={{ paddingTop: '120px' }}
            >
              <div
                className="max-w-md text-center p-8 rounded-2xl pointer-events-auto"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-1)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div
                  className="inline-flex w-12 h-12 rounded-xl items-center justify-center mb-4"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Sparkles size={22} />
                </div>
                <div className="text-lg font-extrabold mb-1" style={{ color: 'var(--fg-1)' }}>
                  Generate the {activeJourney.name || 'journey'}
                </div>
                {activeJourney.jtbdBlueprint ? (
                  <div className="text-sm mb-2" style={{ color: 'var(--fg-2)' }}>
                    <span className="opacity-70">JTBD · </span>
                    {activeJourney.jtbdBlueprint}
                  </div>
                ) : (
                  <div className="text-sm mb-2" style={{ color: 'var(--fg-3)' }}>
                    No JTBD blueprint set — we&apos;ll infer phases from the brief alone.
                  </div>
                )}
                {displayPhases.length > 0 && (
                  <div className="text-[11px] mb-5" style={{ color: 'var(--fg-3)' }}>
                    Phases preloaded from the brief — generating will fill each with demand spaces.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleGenerateJourney(activeJourney.id)}
                  disabled={!apiKey}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all"
                  style={{
                    background: apiKey ? 'var(--accent)' : 'var(--bg-3)',
                    color: apiKey ? 'var(--accent-fg)' : 'var(--fg-3)',
                    cursor: apiKey ? 'pointer' : 'not-allowed',
                    opacity: apiKey ? 1 : 0.6,
                  }}
                >
                  <Zap size={14} /> Generate this journey
                </button>
                {!apiKey && (
                  <div className="text-[11px] mt-3" style={{ color: 'var(--fg-3)' }}>
                    Add your OpenAI key in the top bar to enable.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* In-flight generation state — replaces the empty CTA with a
              spinner card while /api/generate-journey-phases is running. */}
          {displayPhases.length === 0 && activeJourney && isGeneratingPhases && (
            <div className="absolute inset-0 z-40 grid place-items-center p-8 pointer-events-none" style={{ paddingTop: '120px' }}>
              <div
                className="max-w-md text-center p-6 rounded-2xl"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-1)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <Loader2
                  size={22}
                  className="animate-spin mx-auto mb-3"
                  style={{ color: 'var(--accent)' }}
                />
                <div className="text-sm font-bold" style={{ color: 'var(--fg-1)' }}>
                  Generating the {activeJourney.name || 'journey'}…
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
                  Synthesizing phases, demand spaces, and circumstances.
                </div>
              </div>
            </div>
          )}

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
