'use client';

/**
 * Plan page — workshop inventory for the engagement.
 *
 * Layout:
 *   ┌────────────────┬───────────────────────────────────────────┐
 *   │  Workshop rail │  Focused editor for the selected workshop │
 *   │     ~300 px    │                  flex-1                   │
 *   └────────────────┴───────────────────────────────────────────┘
 *
 * One workshop is focused at a time. This replaces the previous pattern
 * of stacked accordions — the user asked for something much more fluid
 * and keyboard-friendly, closer to Linear/Notion than a wall of forms.
 *
 * Design notes:
 *   • Inputs are *borderless* — no visible box around each field. A thin
 *     bottom line appears on hover/focus to hint editability. Feels like
 *     writing in a doc rather than filling a form.
 *   • Every label uses --fg-2 (not --fg-3) for readability on both
 *     Editorial (white) and Dark themes.
 *   • The "Seed default plan" button drops in a full 22-workshop
 *     baseline — 13 Discovery + 9 Definition — as the agency standard
 *     starting point for a CX engagement. Per-journey and per-product
 *     workshops expand automatically from the brief, so a multi-journey
 *     model (e.g. Dubai Airport: Arrival / Transit / Departure) seeds
 *     one high-level + one deep-dive workshop per journey. Users can
 *     freely edit, delete, add, or clear the list from here.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Wand2,
  Sparkles,
  Trash2,
  Loader2,
  ChevronDown,
  Download,
  Users,
  Clock,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { StepProgress } from '@/components/StepProgress';
import { AppHeader } from '@/components/AppHeader';
import { useHydratedCaptureStore } from '@/components/capture/CaptureWorkshopCard';
import { useHasDiagnostics } from '@/lib/captureStore';
import { useApiKey } from '@/lib/hooks/useApiKey';
import {
  exportWorkshopToXlsx,
  exportAllWorkshopsToXlsx,
} from '@/lib/workshop-export';
import { downloadAllWorkshopsAsZip } from '@/lib/workshop-pdf-export';
import {
  Journey,
  JourneyPhase,
  Model,
  Workshop,
  WorkshopAgendaItem,
  WorkshopAttendee,
  WorkshopMode,
  WorkshopQuestion,
  WorkshopQuestionIntent,
  WorkshopStatus,
} from '@/lib/types';

// ======================================================================
// Constants + display helpers
// ======================================================================

// The two engagement phases this page centres on are Discovery
// (front-loaded scoping + read-outs) and Definition (solution scoping).
// The trailing three values are kept so persisted workshops created
// under the old labels still sort in a sensible place — they're not
// surfaced in the default seed.
const PHASE_ORDER = [
  'Discovery',
  'Definition',
  'Alignment',
  'Strategy',
  'Activation',
];

const STATUS_LABEL: Record<WorkshopStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  scheduled: 'Scheduled',
  done: 'Done',
  skipped: 'Skipped',
};

const STATUS_DOT: Record<WorkshopStatus, string> = {
  draft: 'var(--fg-3)',
  proposed: 'var(--warn)',
  scheduled: 'var(--accent)',
  done: 'var(--success)',
  skipped: 'var(--fg-3)',
};

const INTENT_LABELS: Record<WorkshopQuestionIntent, string> = {
  context: 'Context',
  problem: 'Problem',
  jtbd: 'JTBD',
  circumstance: 'Circumstance',
  need: 'Need',
  opportunity: 'Opportunity',
  gap: 'Gap',
  contradiction: 'Contradiction',
};

const INTENT_DESCRIPTIONS: Record<WorkshopQuestionIntent, string> = {
  context: 'Ground the room in the current state.',
  problem: 'Surface concrete pains that exist today.',
  jtbd: 'Surface the job the customer is hiring us for.',
  circumstance:
    'Surface the triggering context — what must be true for this moment to happen.',
  need: 'Elicit the explicit requirement the stakeholder already names.',
  opportunity: 'Probe unclaimed territory and moments we\u2019re not in.',
  gap: 'Name the delta between today and the brief\u2019s ambition.',
  contradiction:
    'Pressure-test stated assumptions against evidence. Ask these last.',
};

const INTENT_ORDER: WorkshopQuestionIntent[] = [
  'context',
  'problem',
  'jtbd',
  'circumstance',
  'need',
  'opportunity',
  'gap',
  'contradiction',
];

const INTENT_HUE: Record<WorkshopQuestionIntent, string> = {
  context: 'var(--fg-3)',
  problem: 'var(--danger)',
  jtbd: 'var(--accent)',
  circumstance: '#0ea5e9',
  need: 'var(--accent)',
  opportunity: 'var(--success)',
  gap: '#a855f7',
  contradiction: 'var(--warn)',
};

// Provenance — surfaced as a small chip on each question row so the
// strategist can see at a glance whether a question came from the form,
// the verbatim brief, a research artifact, or more than one source.
type SourceContext = NonNullable<WorkshopQuestion['sourceContext']>;

const SOURCE_LABEL: Record<SourceContext, string> = {
  form: 'Form',
  brief: 'Brief',
  research: 'Research',
  mixed: 'Mixed',
};

const SOURCE_HUE: Record<SourceContext, string> = {
  form: 'var(--fg-3)',
  brief: '#0ea5e9',
  research: '#a855f7',
  mixed: 'var(--accent)',
};

/**
 * Optional per-generation scope. Currently used by journey-deep-dive
 * workshops to force the question set onto a specific phase of a specific
 * journey (so every generated question carries that phase label).
 */
interface GenerationScope {
  selectedJourneyName?: string;
  selectedPhaseLabel?: string;
  profileOverride?:
    | 'kickoff'
    | 'governance'
    | 'high-level-journey'
    | 'channel'
    | 'journey-deep-dive'
    | 'tech-deep-dive'
    | 'audit-readout'
    | 'definition'
    | 'generic-discovery';
}

/**
 * True if the workshop is a journey deep-dive — i.e. it drills into one
 * journey across experience/tech/data/innovation. We look at the name
 * because workshop.phase is just "Discovery" for all of these.
 */
function isJourneyDeepDiveWorkshop(w: Workshop): boolean {
  const n = (w.name || '').toLowerCase();
  // match "Deep-dive — <journey>" or "... journey deep-dive"
  return (
    /\bdeep[- ]dive\b/.test(n) &&
    !/\btech(nical|nology)?\b/.test(n) // tech deep-dive is its own profile
  );
}

/**
 * For a journey deep-dive workshop, try to match one of the model's
 * journeys by name (substring match — "Deep-dive — Arrival" → "Arrival").
 */
function detectJourneyFromWorkshopName(
  workshop: Workshop,
  journeys: Journey[]
): Journey | null {
  const n = (workshop.name || '').toLowerCase();
  for (const j of journeys) {
    const name = (j.name || '').trim().toLowerCase();
    if (name && n.includes(name)) return j;
  }
  return null;
}

// ======================================================================
// Borderless editable primitives
// ======================================================================

/**
 * Borderless single-line input. Invisible by default; shows a thin bottom
 * line on hover/focus. Feels like writing in a document, not filling a
 * form. All CSS is inline so a page-scoped stylesheet isn't required.
 */
function PlainInput({
  value,
  onChange,
  placeholder,
  className,
  style,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`plan-input ${className || ''}`}
      style={style}
    />
  );
}

function PlainTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`plan-textarea ${className || ''}`}
      style={style}
    />
  );
}

/** Small, borderless select that blends into the text flow. */
function PlainSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  minWidth,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel?: string;
  minWidth?: number;
}) {
  return (
    <span className="plan-select">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        style={{ minWidth }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
      style={{ color: 'var(--fg-2)' }}
    >
      {children}
    </div>
  );
}

// ======================================================================
// Chip-based list editor — used for outcomes, pre-reads, dependencies
// ======================================================================

function ChipListEditor({
  items,
  onChange,
  placeholder,
  emptyLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  emptyLabel: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };
  const removeAt = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  };
  const updateAt = (idx: number, v: string) => {
    const next = items.slice();
    next[idx] = v;
    onChange(next);
  };
  return (
    <div>
      {items.length === 0 ? (
        <div
          className="text-[12px]"
          style={{ color: 'var(--fg-2)', opacity: 0.7 }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((it, i) => (
            <div
              key={i}
              className="group flex items-start gap-2 py-0.5"
              style={{ color: 'var(--fg-1)' }}
            >
              <span
                className="inline-block"
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--fg-3)',
                  marginTop: 10,
                  flexShrink: 0,
                }}
              />
              <PlainInput
                value={it}
                onChange={(v) => updateAt(i, v)}
                placeholder={placeholder}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--fg-2)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <span
          className="inline-block"
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            background: 'transparent',
            border: '1px dashed var(--border-2)',
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
          className="plan-input flex-1"
          style={{ color: 'var(--fg-2)' }}
        />
      </div>
    </div>
  );
}

// ======================================================================
// Attendee editor — role + optional named people
// ======================================================================

function AttendeeEditor({
  attendees,
  onAdd,
  onUpdate,
  onRemove,
  addLabel,
  rolePlaceholder,
}: {
  attendees: WorkshopAttendee[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<WorkshopAttendee>) => void;
  onRemove: (id: string) => void;
  addLabel: string;
  rolePlaceholder: string;
}) {
  return (
    <div>
      {attendees.length === 0 && (
        <div
          className="text-[12px]"
          style={{ color: 'var(--fg-2)', opacity: 0.7 }}
        >
          No roles yet.
        </div>
      )}
      <div className="space-y-1">
        {attendees.map((a) => (
          <div
            key={a.id}
            className="group flex items-start gap-2 py-0.5"
          >
            <Users
              size={12}
              style={{ color: 'var(--fg-3)', marginTop: 8, flexShrink: 0 }}
            />
            <div className="flex-1 grid grid-cols-[1fr_1.3fr] gap-3">
              <PlainInput
                value={a.title}
                onChange={(v) => onUpdate(a.id, { title: v })}
                placeholder={rolePlaceholder}
                aria-label="Role"
              />
              <PlainInput
                value={(a.names || []).join(', ')}
                onChange={(v) => {
                  const names = v
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean);
                  onUpdate(a.id, { names: names.length ? names : undefined });
                }}
                placeholder="Names (optional)"
                aria-label="Names"
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(a.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--fg-2)',
                cursor: 'pointer',
                padding: 4,
                marginTop: 2,
              }}
              aria-label="Remove role"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px]"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--fg-2)',
          cursor: 'pointer',
          padding: '4px 0',
        }}
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

// ======================================================================
// Questions — tabbed by intent
// ======================================================================

function QuestionsPanel({
  workshop,
  questions,
  journeyPhaseLabels,
  journeys,
  allPhases,
  researchDocsById,
  onGenerate,
  onExport,
  isGenerating,
}: {
  workshop: Workshop;
  questions: WorkshopQuestion[];
  journeyPhaseLabels: string[];
  journeys: Journey[];
  allPhases: JourneyPhase[];
  researchDocsById: Map<string, string>;
  onGenerate: (scope?: GenerationScope) => void;
  onExport: () => void;
  isGenerating: boolean;
}) {
  const [tab, setTab] = useState<WorkshopQuestionIntent>('context');

  // --- Journey deep-dive scope (phase selector) ---------------------------
  // NOTE: This component is mounted with key={workshop.id} (see
  // WorkshopEditor), so it remounts on workshop change — state derived
  // from the workshop is safe to compute as the initial-state argument
  // to useState, without needing a syncing effect.
  const isDeepDive = useMemo(
    () => isJourneyDeepDiveWorkshop(workshop),
    [workshop]
  );
  const autoJourney = useMemo(
    () =>
      isDeepDive ? detectJourneyFromWorkshopName(workshop, journeys) : null,
    [isDeepDive, workshop, journeys]
  );

  // User override. Empty string = "use detected default".
  const [ddJourneyIdOverride, setDdJourneyIdOverride] = useState<string>('');
  const effectiveJourneyId =
    ddJourneyIdOverride ||
    autoJourney?.id ||
    (journeys[0]?.id ?? '');

  const phasesForDd = useMemo(() => {
    if (!isDeepDive) return [];
    return allPhases
      .filter((p) => p.journeyId === effectiveJourneyId)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [isDeepDive, allPhases, effectiveJourneyId]);

  const [ddPhaseOverride, setDdPhaseOverride] = useState<string>('');
  // Effective phase: user override if valid for current journey, else
  // first available phase for the current journey.
  const effectivePhaseLabel =
    ddPhaseOverride && phasesForDd.some((p) => p.label === ddPhaseOverride)
      ? ddPhaseOverride
      : phasesForDd[0]?.label || '';

  const handleJourneyChange = (id: string) => {
    setDdJourneyIdOverride(id);
    // Reset phase override so the first phase of the new journey is used.
    setDdPhaseOverride('');
  };

  const deepDiveReady =
    !isDeepDive || (effectiveJourneyId && effectivePhaseLabel);
  const ddJourneyName = isDeepDive
    ? journeys.find((j) => j.id === effectiveJourneyId)?.name
    : undefined;

  const handleGenerateClick = () => {
    if (!deepDiveReady) return;
    if (isDeepDive) {
      onGenerate({
        selectedJourneyName: ddJourneyName,
        selectedPhaseLabel: effectivePhaseLabel,
        profileOverride: 'journey-deep-dive',
      });
    } else {
      onGenerate();
    }
  };

  const {
    addWorkshopQuestion,
    updateWorkshopQuestion,
    removeWorkshopQuestion,
  } = useStore();

  const roles = useMemo(
    () => [
      ...workshop.clientAttendees.map((a) => a.title).filter(Boolean),
      ...workshop.agencyAttendees
        .map((a) => a.title)
        .filter(Boolean)
        .map((t) => `${t} (agency)`),
    ],
    [workshop.clientAttendees, workshop.agencyAttendees]
  );

  const grouped = useMemo(() => {
    const map = new Map<WorkshopQuestionIntent, WorkshopQuestion[]>();
    for (const intent of INTENT_ORDER) map.set(intent, []);
    for (const q of questions) {
      const arr = map.get(q.intent) || [];
      arr.push(q);
      map.set(q.intent, arr);
    }
    return map;
  }, [questions]);

  const active = grouped.get(tab) || [];

  return (
    <div>
      {/* Intent tabs */}
      <div
        className="flex items-center gap-0.5 overflow-x-auto"
        style={{
          borderBottom: '1px solid var(--border-1)',
          marginBottom: 16,
        }}
      >
        {INTENT_ORDER.map((intent) => {
          const count = (grouped.get(intent) || []).length;
          const isActive = tab === intent;
          return (
            <button
              key={intent}
              type="button"
              onClick={() => setTab(intent)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--fg-1)' : 'var(--fg-2)',
                borderBottom: isActive
                  ? `2px solid ${INTENT_HUE[intent]}`
                  : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
              }}
            >
              {INTENT_LABELS[intent]}
              {count > 0 && (
                <span
                  className="font-mono text-[10px] px-1.5 rounded-full"
                  style={{
                    background: isActive
                      ? `color-mix(in srgb, ${INTENT_HUE[intent]} 16%, transparent)`
                      : 'var(--bg-3)',
                    color: isActive ? INTENT_HUE[intent] : 'var(--fg-2)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Deep-dive journey + phase selector (only for journey deep-dives) */}
      {isDeepDive && (
        <div
          className="mb-3 rounded-lg px-3 py-2.5 flex items-center gap-3 flex-wrap"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
          }}
        >
          <span
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--fg-2)' }}
          >
            Deep-dive scope
          </span>
          <label
            className="text-[12px] inline-flex items-center gap-1.5"
            style={{ color: 'var(--fg-2)' }}
          >
            Journey
            <select
              value={effectiveJourneyId}
              onChange={(e) => handleJourneyChange(e.target.value)}
              className="plan-inline-select"
            >
              {journeys.length === 0 && (
                <option value="">(no journeys defined)</option>
              )}
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="text-[12px] inline-flex items-center gap-1.5"
            style={{ color: 'var(--fg-2)' }}
          >
            Phase
            <select
              value={effectivePhaseLabel}
              onChange={(e) => setDdPhaseOverride(e.target.value)}
              className="plan-inline-select"
            >
              {phasesForDd.length === 0 && (
                <option value="">(no phases for this journey)</option>
              )}
              {phasesForDd.map((p, i) => (
                <option key={`${p.id}-${i}`} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <span
            className="text-[11px] ml-auto"
            style={{ color: 'var(--fg-3)' }}
          >
            Questions will be scoped to the selected phase.
          </span>
        </div>
      )}

      {/* Intent description + actions */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <p className="text-[12px]" style={{ color: 'var(--fg-2)' }}>
          {INTENT_DESCRIPTIONS[tab]}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => addWorkshopQuestion(workshop.id, { intent: tab })}
            className="btn btn--ghost btn--sm"
          >
            <Plus size={12} /> Add
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={questions.length === 0}
            className="btn btn--ghost btn--sm"
            title={
              questions.length === 0
                ? 'Generate questions first'
                : 'Export this workshop to Excel'
            }
          >
            <Download size={12} /> Export
          </button>
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerating || !deepDiveReady}
            className="btn btn--soft btn--sm"
            title={
              !deepDiveReady
                ? 'Pick a journey and phase before generating.'
                : questions.length > 0
                ? 'Regenerate the full question set'
                : 'Draft a role-targeted question set for this workshop'
            }
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {questions.length > 0 ? 'Regenerate all' : 'Generate all'}
          </button>
        </div>
      </div>

      {/* Active category's questions */}
      {active.length === 0 ? (
        <div
          className="text-[12px] text-center py-6 rounded-lg"
          style={{
            color: 'var(--fg-2)',
            background: 'var(--bg-2)',
            border: '1px dashed var(--border-1)',
          }}
        >
          No {INTENT_LABELS[tab].toLowerCase()} questions yet.
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              roles={roles}
              journeyPhaseLabels={journeyPhaseLabels}
              researchDocsById={researchDocsById}
              onChange={(updates) => updateWorkshopQuestion(q.id, updates)}
              onRemove={() => removeWorkshopQuestion(q.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionRow({
  question,
  roles,
  journeyPhaseLabels,
  researchDocsById,
  onChange,
  onRemove,
}: {
  question: WorkshopQuestion;
  roles: string[];
  journeyPhaseLabels: string[];
  researchDocsById: Map<string, string>;
  onChange: (updates: Partial<WorkshopQuestion>) => void;
  onRemove: () => void;
}) {
  const source: SourceContext = (question.sourceContext ||
    'form') as SourceContext;
  const cit = question.sourceCitations;
  const researchFilename = cit?.researchDocId
    ? researchDocsById.get(cit.researchDocId)
    : undefined;
  const tooltipParts: string[] = [`Source: ${SOURCE_LABEL[source]}`];
  if (cit?.briefExcerpt) {
    tooltipParts.push(`Brief: "${cit.briefExcerpt}"`);
  }
  if (cit?.researchDocId) {
    tooltipParts.push(
      `Research: ${researchFilename || cit.researchDocId}${
        cit.researchExcerpt ? `\n  "${cit.researchExcerpt}"` : ''
      }`
    );
  }
  const tooltip = tooltipParts.join('\n');
  return (
    <div
      className="group rounded-lg py-2.5 px-3"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <PlainTextarea
            value={question.text}
            onChange={(v) => onChange({ text: v })}
            placeholder="Question as asked in the room"
            rows={2}
            style={{ fontSize: 13, color: 'var(--fg-1)' }}
          />
          <div
            className="flex items-center gap-3 mt-2 flex-wrap text-[11px]"
            style={{ color: 'var(--fg-2)' }}
          >
            <span className="inline-flex items-center gap-1">
              <span>Ask</span>
              {roles.length > 0 ? (
                <select
                  value={question.targetRole}
                  onChange={(e) => onChange({ targetRole: e.target.value })}
                  className="plan-inline-select"
                >
                  <option value="">any attendee</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {question.targetRole &&
                    !roles.includes(question.targetRole) && (
                      <option value={question.targetRole}>
                        {question.targetRole}
                      </option>
                    )}
                </select>
              ) : (
                <PlainInput
                  value={question.targetRole}
                  onChange={(v) => onChange({ targetRole: v })}
                  placeholder="any attendee"
                  style={{ width: 160 }}
                />
              )}
            </span>
            {journeyPhaseLabels.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <span>·</span>
                <span>phase</span>
                <select
                  value={question.journeyPhase || ''}
                  onChange={(e) =>
                    onChange({ journeyPhase: e.target.value || undefined })
                  }
                  className="plan-inline-select"
                >
                  <option value="">any</option>
                  {journeyPhaseLabels.map((p, i) => (
                    <option key={`${p}-${i}`} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </span>
            )}
            {question.rationale && (
              <>
                <span>·</span>
                <span
                  className="italic flex-1 min-w-0 truncate"
                  style={{ color: 'var(--fg-2)' }}
                  title={question.rationale}
                >
                  {question.rationale}
                </span>
              </>
            )}
            {!question.rationale && (
              <span className="inline-flex items-center gap-1">
                <span>·</span>
                <PlainInput
                  value=""
                  onChange={(v) => onChange({ rationale: v })}
                  placeholder="why we ask"
                  style={{ width: 200, fontStyle: 'italic' }}
                />
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-pre-line"
              style={{
                background: 'var(--bg-3)',
                color: SOURCE_HUE[source],
                border: `1px solid ${SOURCE_HUE[source]}`,
                marginLeft: 'auto',
                cursor: tooltipParts.length > 1 ? 'help' : 'default',
              }}
              title={tooltip}
            >
              {SOURCE_LABEL[source]}
              {researchFilename && source !== 'form' && (
                <span
                  className="font-medium normal-case ml-1 truncate"
                  style={{ color: 'var(--fg-2)', maxWidth: 140 }}
                  title={researchFilename}
                >
                  · {researchFilename}
                </span>
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-2)',
            cursor: 'pointer',
            padding: 4,
          }}
          aria-label="Remove question"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ======================================================================
// Agenda panel
// ======================================================================

function AgendaPanel({
  workshop,
  onGenerate,
  isGenerating,
}: {
  workshop: Workshop;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const { addAgendaItem, updateAgendaItem, removeAgendaItem } = useStore();

  const totalMin = workshop.agenda.reduce((sum, a) => {
    const m = (a.duration || '').match(/(\d+)/);
    return sum + (m ? parseInt(m[1], 10) : 0);
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[12px]" style={{ color: 'var(--fg-2)' }}>
            {workshop.agenda.length} slot
            {workshop.agenda.length === 1 ? '' : 's'}
          </span>
          {totalMin > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[12px]"
              style={{ color: 'var(--fg-2)' }}
            >
              <Clock size={11} />
              {totalMin} min
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => addAgendaItem(workshop.id)}
            className="btn btn--ghost btn--sm"
          >
            <Plus size={12} /> Add slot
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="btn btn--soft btn--sm"
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {workshop.agenda.length > 0 ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      </div>

      {workshop.agenda.length === 0 ? (
        <div
          className="text-[12px] text-center py-6 rounded-lg"
          style={{
            color: 'var(--fg-2)',
            background: 'var(--bg-2)',
            border: '1px dashed var(--border-1)',
          }}
        >
          No agenda yet.
        </div>
      ) : (
        <ol className="agenda-timeline">
          {workshop.agenda.map((a, idx) => (
            <AgendaRow
              key={a.id}
              idx={idx + 1}
              item={a}
              onChange={(updates) => updateAgendaItem(workshop.id, a.id, updates)}
              onRemove={() => removeAgendaItem(workshop.id, a.id)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function AgendaRow({
  idx,
  item,
  onChange,
  onRemove,
}: {
  idx: number;
  item: WorkshopAgendaItem;
  onChange: (updates: Partial<WorkshopAgendaItem>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="agenda-timeline-item group" style={{ color: 'var(--fg-1)' }}>
      <div className="agenda-timeline-marker">
        <span className="agenda-timeline-number">
          {idx}
        </span>
      </div>
      <div className="agenda-timeline-content">
        <div className="flex items-center gap-3">
          <PlainInput
            value={item.label}
            onChange={(v) => onChange({ label: v })}
            placeholder="Slot label"
            className="flex-1"
            style={{ fontSize: 14, fontWeight: 600 }}
          />
          <div className="flex items-center gap-2">
            <PlainInput
              value={item.duration || ''}
              onChange={(v) => onChange({ duration: v })}
              placeholder="—"
              style={{ width: 64, textAlign: 'right' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
              min
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Remove slot"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </li>
  );
}

// ======================================================================
// Focused editor — the right pane
// ======================================================================

function WorkshopEditor({
  workshop,
  questions,
  journeyPhaseLabels,
  journeys,
  allPhases,
  researchDocsById,
  onGenerateQuestions,
  onExportQuestions,
  onGenerateAgenda,
  isGeneratingQuestions,
  isGeneratingAgenda,
  errorMessage,
}: {
  workshop: Workshop;
  questions: WorkshopQuestion[];
  journeyPhaseLabels: string[];
  journeys: Journey[];
  allPhases: JourneyPhase[];
  researchDocsById: Map<string, string>;
  onGenerateQuestions: (scope?: GenerationScope) => void;
  onExportQuestions: () => void;
  onGenerateAgenda: () => void;
  isGeneratingQuestions: boolean;
  isGeneratingAgenda: boolean;
  errorMessage?: string;
}) {
  const {
    updateWorkshop,
    removeWorkshop,
    addAttendee,
    updateAttendee,
    removeAttendee,
  } = useStore();

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {errorMessage && (
        <div
          className="text-sm px-3 py-2 rounded mb-6"
          style={{
            color: 'var(--danger)',
            background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Workshop meta card */}
      <div className="glass-pane p-8 mb-6 relative overflow-hidden sticky top-0 z-30">
        {/* Decorative accent circle */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none"
          style={{ background: 'rgba(99, 102, 241, 0.05)' }}
        />

        {/* Code + breadcrumb row */}
        <div
          className="flex items-center gap-3 text-[11px] mb-3"
          style={{ color: 'var(--fg-2)' }}
        >
          <span
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <PlainInput
              value={workshop.code || ''}
              onChange={(v) => updateWorkshop(workshop.id, { code: v })}
              placeholder="W01"
              style={{ width: 40, fontWeight: 700, background: 'transparent', color: 'var(--accent-fg)', border: 'none', textAlign: 'center' }}
              aria-label="Workshop code"
            />
          </span>
          <span style={{ color: 'var(--fg-3)' }}>→</span>
          <PlainSelect
            value={workshop.phase}
            onChange={(v) => updateWorkshop(workshop.id, { phase: v })}
            options={[
              ...PHASE_ORDER.map((p) => ({ value: p, label: p })),
              ...(PHASE_ORDER.includes(workshop.phase)
                ? []
                : [{ value: workshop.phase, label: workshop.phase }]),
            ]}
            ariaLabel="Phase"
          />
          <span>/</span>
          <PlainInput
            value={workshop.track || ''}
            onChange={(v) => updateWorkshop(workshop.id, { track: v })}
            placeholder="Track / owner"
            className="flex-1"
            aria-label="Track"
          />
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove workshop "${workshop.name}"?`)) {
                removeWorkshop(workshop.id);
              }
            }}
            className="opacity-60 hover:opacity-100 transition-opacity"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Remove workshop"
            title="Remove workshop"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Large title */}
        <input
          type="text"
          value={workshop.name}
          onChange={(e) =>
            updateWorkshop(workshop.id, { name: e.target.value })
          }
          placeholder="Workshop name"
          className="plan-title"
          style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px' }}
          aria-label="Workshop name"
        />

        {/* Duration + Mode pills */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold border"
            style={{ background: 'var(--bg-2)', color: 'var(--fg-1)', borderColor: 'var(--border-1)' }}>
            <Clock size={14} style={{ color: 'var(--fg-2)' }} />
            <PlainInput
              value={workshop.duration || ''}
              onChange={(v) => updateWorkshop(workshop.id, { duration: v })}
              placeholder="90 min"
              style={{ width: 70, background: 'transparent', border: 'none', color: 'var(--fg-1)' }}
              aria-label="Duration"
            />
          </span>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold border"
            style={{ background: 'var(--bg-2)', color: 'var(--fg-1)', borderColor: 'var(--border-1)' }}>
            <PlainSelect
              value={workshop.mode || 'hybrid'}
              onChange={(v) =>
                updateWorkshop(workshop.id, { mode: v as WorkshopMode })
              }
              options={[
                { value: 'onsite', label: 'Onsite' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'remote', label: 'Remote' },
              ]}
              ariaLabel="Mode"
            />
          </span>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold border"
            style={{ background: 'var(--bg-2)', color: 'var(--fg-1)', borderColor: 'var(--border-1)' }}>
            <span
              className="inline-block"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: STATUS_DOT[workshop.status],
              }}
            />
            <PlainSelect
              value={workshop.status}
              onChange={(v) =>
                updateWorkshop(workshop.id, { status: v as WorkshopStatus })
              }
              options={(Object.keys(STATUS_LABEL) as WorkshopStatus[]).map(
                (s) => ({ value: s, label: STATUS_LABEL[s] })
              )}
              ariaLabel="Status"
            />
          </span>
        </div>
      </div>

      {/* Summary + Outcomes grid */}
      <div className="glass-pane p-6 mb-6">
        <div className="grid grid-cols-2 gap-6">
          <section>
            <SectionLabel>Summary</SectionLabel>
            <PlainTextarea
              value={workshop.summary}
              onChange={(v) => updateWorkshop(workshop.id, { summary: v })}
              placeholder="What this workshop is for and why."
              rows={3}
              style={{ fontSize: 14 }}
            />
          </section>

          <section>
            <SectionLabel>Main outcomes</SectionLabel>
            <ChipListEditor
              items={workshop.mainOutcomes}
              onChange={(next) =>
                updateWorkshop(workshop.id, { mainOutcomes: next })
              }
              placeholder="Concrete deliverable or decision"
              emptyLabel="No outcomes yet."
            />
          </section>
        </div>
      </div>

      {/* Attendee Architecture */}
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--fg-2)' }}>
          Attendee Architecture
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-pane p-5">
            <SectionLabel>Client attendees</SectionLabel>
            <AttendeeEditor
              attendees={workshop.clientAttendees}
              onAdd={() => addAttendee(workshop.id, 'client')}
              onUpdate={(id, updates) =>
                updateAttendee(workshop.id, 'client', id, updates)
              }
              onRemove={(id) => removeAttendee(workshop.id, 'client', id)}
              addLabel="Add client role"
              rolePlaceholder="Head of CRM"
            />
          </div>
          <div className="glass-pane p-5">
            <SectionLabel>Agency attendees</SectionLabel>
            <AttendeeEditor
              attendees={workshop.agencyAttendees}
              onAdd={() => addAttendee(workshop.id, 'agency')}
              onUpdate={(id, updates) =>
                updateAttendee(workshop.id, 'agency', id, updates)
              }
              onRemove={(id) => removeAttendee(workshop.id, 'agency', id)}
              addLabel="Add agency role"
              rolePlaceholder="CX Strategist"
            />
          </div>
        </div>
      </div>

      {/* Pre-reads + Dependencies */}
      <div className="glass-pane p-6 mb-6">
        <div className="grid grid-cols-2 gap-6">
          <section>
            <SectionLabel>Required pre-reads</SectionLabel>
            <ChipListEditor
              items={workshop.preReads}
              onChange={(next) =>
                updateWorkshop(workshop.id, { preReads: next })
              }
              placeholder="Doc title"
              emptyLabel="Nothing to pre-read."
            />
          </section>
          <section>
            <SectionLabel>Cross-workstream dependencies</SectionLabel>
            <ChipListEditor
              items={workshop.dependencies}
              onChange={(next) =>
                updateWorkshop(workshop.id, { dependencies: next })
              }
              placeholder="Needs W02 complete"
              emptyLabel="No dependencies."
            />
          </section>
        </div>
      </div>

      {/* Notes */}
      <div className="glass-pane p-6 mb-6">
        <SectionLabel>Notes</SectionLabel>
        <PlainTextarea
          value={workshop.notes || ''}
          onChange={(v) => updateWorkshop(workshop.id, { notes: v })}
          placeholder="Facilitator notes, logistics, open questions…"
          rows={3}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* Questions */}
      <div className="glass-pane p-6 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--fg-2)' }}>
            Questions ({questions.length})
          </div>
        </div>
        <QuestionsPanel
          key={workshop.id}
          workshop={workshop}
          questions={questions}
          journeyPhaseLabels={journeyPhaseLabels}
          journeys={journeys}
          allPhases={allPhases}
          researchDocsById={researchDocsById}
          onGenerate={onGenerateQuestions}
          onExport={onExportQuestions}
          isGenerating={isGeneratingQuestions}
        />
      </div>

      {/* Agenda */}
      <div className="glass-pane p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--fg-2)' }}>
            Tentative agenda
          </div>
        </div>
        <AgendaPanel
          workshop={workshop}
          onGenerate={onGenerateAgenda}
          isGenerating={isGeneratingAgenda}
        />
      </div>
    </div>
  );
}

// ======================================================================
// Workshop rail — left column list of tiles, grouped by phase
// ======================================================================

function WorkshopRail({
  workshops,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  questionsByWorkshop,
}: {
  workshops: Workshop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  questionsByWorkshop: Map<string, WorkshopQuestion[]>;
}) {
  const orderedWorkshops = useMemo(
    () => workshops.slice().sort((a, b) => a.order - b.order),
    [workshops]
  );

  return (
    <aside
      className="flex flex-col"
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: '1px solid var(--border-1)',
        background: 'var(--bg-1)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-1)' }}
      >
        <div
          className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: 'var(--fg-2)' }}
        >
          Workshops · {workshops.length}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="btn btn--ghost btn--sm"
          title="Add workshop"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {orderedWorkshops.map((w) => {
          const qCount = (questionsByWorkshop.get(w.id) || []).length;
          const isActive = selectedId === w.id;
          return (
            <div
              key={w.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(w.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(w.id);
                }
              }}
              className="group relative text-left px-4 py-2.5 mb-1 mx-2 rounded-lg transition-all cursor-pointer"
              style={{
                background: isActive ? 'var(--bg-1)' : 'transparent',
                borderLeft: isActive
                  ? '3px solid var(--accent)'
                  : '3px solid transparent',
                opacity: w.status === 'skipped' ? 0.5 : 1,
                width: 'calc(100% - 16px)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    confirm(
                      `Delete workshop "${w.name || 'Untitled workshop'}"? This cannot be undone.`
                    )
                  ) {
                    onRemove(w.id);
                  }
                }}
                title="Delete workshop"
                aria-label="Delete workshop"
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  color: 'var(--fg-3)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background =
                    'color-mix(in srgb, #ef4444 12%, transparent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-3)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Trash2 size={12} />
              </button>
              <div className="flex items-center gap-2 mb-1 pr-6">
                <span
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold"
                  style={{
                    background: isActive
                      ? 'var(--accent)'
                      : 'rgba(0,0,0,0.08)',
                    color: isActive ? '#ffffff' : 'var(--fg-2)',
                  }}
                >
                  {w.code || '—'}
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                  style={{
                    background: `color-mix(in srgb, ${STATUS_DOT[w.status]} 12%, transparent)`,
                    color: STATUS_DOT[w.status],
                  }}
                >
                  {STATUS_LABEL[w.status]}
                </span>
              </div>
              <div
                className="text-[13px] font-bold line-clamp-2 mb-1.5"
                style={{
                  color: 'var(--fg-1)',
                  textDecoration:
                    w.status === 'skipped' ? 'line-through' : undefined,
                }}
              >
                {w.name || 'Untitled workshop'}
              </div>
              <div
                className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--fg-3)' }}
              >
                {w.duration && (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} />
                      {w.duration}
                    </span>
                    <span>·</span>
                  </>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users size={10} />
                  {w.clientAttendees.length + w.agencyAttendees.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ======================================================================
// Sample seeder — 2 Discovery workshops drawn from the CX reference
// engagement spreadsheet. Lets the user see a populated plan instantly,
// without having to hit the API.
// ======================================================================

/**
 * Parse a multi-line `•  Label (30m)` agenda into { label, duration }
 * pairs. Tolerates extra whitespace and both `30m` / `30 min` forms.
 */
function parseAgendaText(
  text: string
): Array<Omit<WorkshopAgendaItem, 'id'>> {
  return text
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*\((\d+)\s*(m|min|minutes)?\)\s*$/i);
      if (m) {
        return { label: m[1].trim(), duration: `${m[2]} min` };
      }
      return { label: line };
    });
}

function semiList(s: string): string[] {
  return s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Build the default agency plan for an engagement. Returns 13 Discovery
 * workshops + 9 Definition workshops, expanding the per-journey and
 * per-product workshops from whatever the model already knows about.
 *
 * The seed is intentionally generic (defaults, not a specific client's
 * final plan) — strategists tailor each card after loading. Attendees,
 * durations, and agendas are sensible Digitas defaults that hold up in
 * the room without extra editing.
 */
function buildDefaultWorkshops(
  model: Model | null
): Array<
  Omit<Workshop, 'id' | 'order' | 'agenda' | 'clientAttendees' | 'agencyAttendees'> & {
    agenda: Array<Omit<WorkshopAgendaItem, 'id'>>;
    clientAttendees: string[];
    agencyAttendees: string[];
  }
> {
  const journeys = (model?.journeys ?? []).filter((j) => j.name.trim());
  const products = (model?.input?.products ?? []).filter((p) => p.name.trim());
  const journeyList = journeys.length > 0 ? journeys : [{ name: 'Journey', jtbdBlueprint: '' }];
  const productList = products.length > 0 ? products : [{ name: 'Primary channel' }];

  const mode = 'onsite' as WorkshopMode;
  const status = 'proposed' as WorkshopStatus;

  const commonPreReads = 'Client brief; current-state deck; personas (if any); analytics snapshot';
  const commonAgency =
    'Engagement Lead; CX Strategist; CRM Strategist; UX Researcher';

  // ---- Discovery (13) ------------------------------------------------
  const discovery: ReturnType<typeof buildDefaultWorkshops> = [];

  let d = 0;
  const D = () => `D${String(++d).padStart(2, '0')}`;

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'General kick-off (and governance)',
    track: 'Program',
    duration: '2h',
    mode,
    status,
    summary:
      'Align the full extended team on objectives, scope, ways of working, and governance cadence for the engagement.',
    mainOutcomes: [
      'Shared engagement objectives',
      'Scope + out-of-scope clarity',
      'Governance cadence and decision rights',
      'Communication plan',
    ],
    agenda: parseAgendaText(
      '•  Introductions and context (15m)\n' +
        '•  Objectives and success metrics (30m)\n' +
        '•  Scope and out-of-scope (30m)\n' +
        '•  Governance, RACI, cadence (30m)\n' +
        '•  Risks and open questions (15m)'
    ),
    clientAttendees: semiList(
      'Project Sponsor; Program Manager; CX Lead; CRM Lead; Technology Lead; Data Lead'
    ),
    agencyAttendees: semiList(
      'Engagement Lead; Delivery Lead; CX Strategist; Technology Architect'
    ),
    preReads: semiList(commonPreReads),
    dependencies: [],
    notes: 'Recording recommended for async alignment with absent stakeholders.',
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Delivery and governance',
    track: 'Program',
    duration: '90 min',
    mode,
    status,
    summary:
      'Define delivery model, squads, working rhythm, tooling, and escalation paths for the program.',
    mainOutcomes: [
      'Delivery model and squads',
      'Ceremonies + calendar',
      'Tooling (Jira/Confluence/Slack)',
      'Escalation paths',
    ],
    agenda: parseAgendaText(
      '•  Delivery model options (30m)\n' +
        '•  Squad composition and ownership (30m)\n' +
        '•  Ceremonies and working rhythm (20m)\n' +
        '•  Tooling and reporting (10m)'
    ),
    clientAttendees: semiList(
      'Program Manager; PMO; Technology Lead; Procurement'
    ),
    agencyAttendees: semiList(
      'Delivery Lead; Engagement Lead; Technology Architect'
    ),
    preReads: semiList('SOW; program org chart; existing delivery standards'),
    dependencies: semiList('D01 complete'),
  });

  // One "High-level journey workshop" per journey
  for (const j of journeyList) {
    discovery.push({
      code: D(),
      phase: 'Discovery',
      name: `High-level journey workshop — ${j.name}`,
      track: 'CX / Journeys',
      duration: '3h',
      mode,
      status,
      summary:
        `Shared narrative of the end-to-end ${j.name} journey. Surface pain points, JTBD, and channel touchpoints at a high level before the deep-dives.`,
      mainOutcomes: [
        `${j.name} journey flow (happy + sad paths)`,
        'Pain points clustered',
        'JTBD articulated',
        'Channel and data touchpoints mapped',
      ],
      agenda: parseAgendaText(
        '•  Framing (15m)\n' +
          '•  Current-state walkthrough (60m)\n' +
          '•  Pain point clustering (45m)\n' +
          '•  JTBD articulation (45m)\n' +
          '•  Touchpoints + hand-offs (30m)\n' +
          '•  Wrap (15m)'
      ),
      clientAttendees: semiList(
        'CX Lead; Operations Lead; Marketing; Research; Frontline ops representative'
      ),
      agencyAttendees: semiList(commonAgency),
      preReads: semiList(commonPreReads),
      dependencies: [],
    });
  }

  // One "Channel / product workshop" per product
  for (const p of productList) {
    discovery.push({
      code: D(),
      phase: 'Discovery',
      name: `Channel / product workshop — ${p.name}`,
      track: 'Product / Channels',
      duration: '2h',
      mode,
      status,
      summary:
        `Current state of ${p.name}: role in the journey, capabilities, pain points, and opportunities.`,
      mainOutcomes: [
        `${p.name} capability map`,
        'Gaps + top opportunities',
        'Analytics + measurement gaps',
      ],
      agenda: parseAgendaText(
        '•  Current-state walkthrough (45m)\n' +
          '•  Capability gaps (30m)\n' +
          '•  Opportunity areas (30m)\n' +
          '•  Measurement + analytics (15m)'
      ),
      clientAttendees: semiList(
        'Product Owner; UX Lead; Engineering Lead; Analytics Lead'
      ),
      agencyAttendees: semiList(commonAgency),
      preReads: semiList('Current product analytics; roadmap; UX audit (if any)'),
      dependencies: [],
    });
  }

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'General workshop for technology',
    track: 'Technology',
    duration: '2h',
    mode,
    status,
    summary:
      'Current technology landscape, architecture, data flows, dependencies, and strategic direction.',
    mainOutcomes: [
      'Reference architecture sketch',
      'Key platforms and integrations',
      'Technical debt and risks',
      'Tech principles for the program',
    ],
    agenda: parseAgendaText(
      '•  Current architecture (45m)\n' +
        '•  Data platforms and CDP/CEP (30m)\n' +
        '•  Integration patterns (30m)\n' +
        '•  Risks and principles (15m)'
    ),
    clientAttendees: semiList(
      'CTO/CIO; Enterprise Architect; Platform Lead; Security Lead'
    ),
    agencyAttendees: semiList(
      'Technology Architect; Data Architect; Martech Strategist'
    ),
    preReads: semiList('Architecture diagrams; platform licenses; data flows'),
    dependencies: [],
  });

  // One "Deep-dive per journey" — XD + tech + data + innovation
  for (const j of journeyList) {
    discovery.push({
      code: D(),
      phase: 'Discovery',
      name: `Deep-dive — ${j.name} (XD, tech, data, innovation)`,
      track: 'CX + Technology + Data',
      duration: '4h',
      mode,
      status,
      summary:
        `Deep-dive on the ${j.name} journey across experience design, technology, data and AI/innovation. Produces candidate use cases for the feature backlog.`,
      mainOutcomes: [
        `${j.name} prioritized moments`,
        'Candidate use cases (incl. AI/innovation)',
        'Tech + data requirements per moment',
        'Quick wins vs strategic bets',
      ],
      agenda: parseAgendaText(
        '•  Recap high-level journey (20m)\n' +
          '•  Priority moments deep-dive (90m)\n' +
          '•  AI + innovation use case ideation (60m)\n' +
          '•  Break (15m)\n' +
          '•  Tech + data requirements (45m)\n' +
          '•  Quick wins vs strategic bets (20m)\n' +
          '•  Wrap (10m)'
      ),
      clientAttendees: semiList(
        'CX Lead; Product Owner; UX Lead; Data Lead; Technology Lead; Innovation Lead'
      ),
      agencyAttendees: semiList(
        'CX Strategist; UX Designer; Technology Architect; Data Architect; AI Strategist'
      ),
      preReads: semiList(
        `High-level ${j.name} journey output; competitive/innovation scan`
      ),
      dependencies: semiList(`High-level journey workshop — ${j.name} complete`),
    });
  }

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Technical deep-dive sessions',
    track: 'Technology',
    duration: '2h',
    mode,
    status,
    summary:
      'Working sessions with platform owners to pressure-test feasibility of candidate use cases against the current stack.',
    mainOutcomes: [
      'Feasibility view per candidate use case',
      'Integration risks and gaps',
      'Build vs buy signals',
    ],
    agenda: parseAgendaText(
      '•  Walk through shortlisted use cases (45m)\n' +
        '•  Feasibility review per platform (60m)\n' +
        '•  Risks + next steps (15m)'
    ),
    clientAttendees: semiList(
      'Enterprise Architect; Platform Owners (CDP, CEP, DXP); Security Lead'
    ),
    agencyAttendees: semiList(
      'Technology Architect; Data Architect; Solution Lead'
    ),
    preReads: semiList('Deep-dive outputs; vendor docs for key platforms'),
    dependencies: semiList('Journey deep-dives complete'),
    notes:
      'Can split across multiple sessions by platform depending on scope.',
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Customer data & personalization workshop',
    track: 'Data / Personalization',
    duration: '2h',
    mode,
    status,
    summary:
      'Current state of customer data, identity, consent, segments, and the personalization stack. Frames the target state for the program.',
    mainOutcomes: [
      'Data domains + identity stitching',
      'Consent + privacy model',
      'Segment inventory',
      'Personalization target state',
    ],
    agenda: parseAgendaText(
      '•  Data domains + model (30m)\n' +
        '•  Identity + consent (30m)\n' +
        '•  Segments and decisioning (30m)\n' +
        '•  Personalization target state (30m)'
    ),
    clientAttendees: semiList(
      'Data Lead; CDP Owner; CRM Lead; Privacy/DPO; Marketing'
    ),
    agencyAttendees: semiList(
      'Data Architect; CRM Strategist; Martech Strategist'
    ),
    preReads: semiList('Data model docs; consent framework; segment library'),
    dependencies: [],
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Reporting & analytics workshop (measurement framework)',
    track: 'Analytics / Measurement',
    duration: '90 min',
    mode,
    status,
    summary:
      'Current analytics coverage, gaps, and the shape of the measurement framework for the program.',
    mainOutcomes: [
      'Measurement framework scaffold (KPIs / CPIs)',
      'Reporting cadence + owners',
      'Instrumentation gaps',
    ],
    agenda: parseAgendaText(
      '•  Current reporting walkthrough (30m)\n' +
        '•  Target KPIs / CPIs draft (30m)\n' +
        '•  Cadence + owners (20m)\n' +
        '•  Gaps + next steps (10m)'
    ),
    clientAttendees: semiList(
      'Analytics Lead; Insights Lead; Marketing; Finance'
    ),
    agencyAttendees: semiList(
      'Measurement Strategist; Data Architect; CX Strategist'
    ),
    preReads: semiList('Current dashboards; KPI tree (if any)'),
    dependencies: [],
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Current / quick wins / future JTBD framework read-out',
    track: 'CX / Strategy',
    duration: '90 min',
    mode,
    status,
    summary:
      'Consolidated read-out of the JTBD framework across current state, quick wins, and future horizons. Anchor narrative for the program.',
    mainOutcomes: [
      'JTBD framework (current / quick wins / future)',
      'Narrative and guiding principles',
      'Alignment on priorities',
    ],
    agenda: parseAgendaText(
      '•  JTBD framework read-out (45m)\n' +
        '•  Discussion and refinements (30m)\n' +
        '•  Decisions + next steps (15m)'
    ),
    clientAttendees: semiList(
      'Project Sponsor; CX Lead; Product Owner; Marketing'
    ),
    agencyAttendees: semiList(commonAgency),
    preReads: semiList('Journey deep-dive outputs; synthesized pain points'),
    dependencies: semiList('Journey deep-dives complete'),
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Current state experience audit read-out',
    track: 'CX / UX',
    duration: '90 min',
    mode,
    status,
    summary:
      'Read-out of the experience audit across journeys and products. Pain points, heuristics violations, and highest-impact fixes.',
    mainOutcomes: [
      'Experience audit findings',
      'Severity-ranked issues',
      'Candidate quick wins',
    ],
    agenda: parseAgendaText(
      '•  Method recap (10m)\n' +
        '•  Findings walk-through (60m)\n' +
        '•  Prioritization discussion (20m)'
    ),
    clientAttendees: semiList(
      'CX Lead; UX Lead; Product Owner; Marketing'
    ),
    agencyAttendees: semiList(
      'UX Researcher; UX Designer; CX Strategist'
    ),
    preReads: semiList('Experience audit draft; analytics snapshot'),
    dependencies: [],
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Current state data audit read-out',
    track: 'Data',
    duration: '90 min',
    mode,
    status,
    summary:
      'Read-out of the data audit: domains, sources, quality, identity, consent, gaps.',
    mainOutcomes: [
      'Data audit findings',
      'Identity + consent gaps',
      'Priority remediation areas',
    ],
    agenda: parseAgendaText(
      '•  Method recap (10m)\n' +
        '•  Findings walk-through (60m)\n' +
        '•  Remediation discussion (20m)'
    ),
    clientAttendees: semiList(
      'Data Lead; CDP Owner; Privacy/DPO; Analytics Lead'
    ),
    agencyAttendees: semiList(
      'Data Architect; Measurement Strategist'
    ),
    preReads: semiList('Data audit draft'),
    dependencies: [],
  });

  discovery.push({
    code: D(),
    phase: 'Discovery',
    name: 'Current state tech audit read-out',
    track: 'Technology',
    duration: '90 min',
    mode,
    status,
    summary:
      'Read-out of the technology audit: platforms, integrations, debt, security posture, feasibility signals.',
    mainOutcomes: [
      'Tech audit findings',
      'Architecture implications for the program',
      'Risks and mitigation',
    ],
    agenda: parseAgendaText(
      '•  Method recap (10m)\n' +
        '•  Findings walk-through (60m)\n' +
        '•  Implications for program (20m)'
    ),
    clientAttendees: semiList(
      'CTO/CIO; Enterprise Architect; Platform Owners'
    ),
    agencyAttendees: semiList(
      'Technology Architect; Data Architect'
    ),
    preReads: semiList('Tech audit draft'),
    dependencies: [],
  });

  // ---- Definition (9) ------------------------------------------------
  const definition: ReturnType<typeof buildDefaultWorkshops> = [];
  let f = 0;
  const F = () => `DF${String(++f).padStart(2, '0')}`;

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'Design scoping',
    track: 'Design',
    duration: '2h',
    mode,
    status,
    summary:
      'Scope the design workstream: deliverables, fidelity, design system, cadence, and interlocks with delivery.',
    mainOutcomes: [
      'Design deliverables + fidelity',
      'Design system direction',
      'Cadence + interlocks with engineering',
    ],
    agenda: parseAgendaText(
      '•  Scope walkthrough (30m)\n' +
        '•  Design system direction (30m)\n' +
        '•  Deliverables + fidelity (30m)\n' +
        '•  Cadence + interlocks (30m)'
    ),
    clientAttendees: semiList(
      'Design Lead; UX Lead; Product Owner; Brand Lead'
    ),
    agencyAttendees: semiList(
      'Design Director; UX Lead; Design Systems Lead'
    ),
    preReads: semiList('Brand guidelines; existing design system (if any)'),
    dependencies: semiList('Discovery read-outs complete'),
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'DAM scoping',
    track: 'Content / DAM',
    duration: '90 min',
    mode,
    status,
    summary:
      'Scope the Digital Asset Management (DAM) approach: taxonomy, workflows, rights, integrations.',
    mainOutcomes: [
      'DAM taxonomy + metadata model',
      'Rights + workflow model',
      'Integration points with CMS / CEP',
    ],
    agenda: parseAgendaText(
      '•  Current asset inventory (20m)\n' +
        '•  Taxonomy + metadata (30m)\n' +
        '•  Workflow + rights (25m)\n' +
        '•  Integrations (15m)'
    ),
    clientAttendees: semiList(
      'Content Ops Lead; Brand Lead; Legal/Rights'
    ),
    agencyAttendees: semiList(
      'Content Strategist; Martech Strategist'
    ),
    preReads: semiList('Asset inventory; DAM shortlist'),
    dependencies: [],
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'CMP scoping',
    track: 'Content / CMS',
    duration: '90 min',
    mode,
    status,
    summary:
      'Scope the Content Management Platform approach: structure, reuse, personalization hooks, multi-channel delivery.',
    mainOutcomes: [
      'Content model + reuse patterns',
      'Personalization hooks',
      'Multi-channel delivery model',
    ],
    agenda: parseAgendaText(
      '•  Current content patterns (20m)\n' +
        '•  Target content model (30m)\n' +
        '•  Personalization hooks (25m)\n' +
        '•  Delivery model (15m)'
    ),
    clientAttendees: semiList(
      'Content Lead; Product Owner; Platform Lead'
    ),
    agencyAttendees: semiList(
      'Content Strategist; Technology Architect'
    ),
    preReads: semiList('Current CMS overview; content sample'),
    dependencies: [],
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'Conceptual solution architecture',
    track: 'Architecture',
    duration: '3h',
    mode,
    status,
    summary:
      'Define the conceptual target solution architecture: layers, platforms, data flows, and integration patterns.',
    mainOutcomes: [
      'Target architecture diagram',
      'Data + event flows',
      'Integration patterns',
      'Build/buy decisions at a conceptual level',
    ],
    agenda: parseAgendaText(
      '•  Principles recap (20m)\n' +
        '•  Target layers + platforms (60m)\n' +
        '•  Data + event flows (45m)\n' +
        '•  Integration patterns (30m)\n' +
        '•  Risks + open questions (25m)'
    ),
    clientAttendees: semiList(
      'Enterprise Architect; Technology Lead; Platform Owners; Security Lead'
    ),
    agencyAttendees: semiList(
      'Technology Architect; Data Architect; Solution Lead'
    ),
    preReads: semiList('Tech + data audit; principles doc'),
    dependencies: semiList('Tech audit read-out complete'),
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'Sitemap & IA',
    track: 'UX / IA',
    duration: '2h',
    mode,
    status,
    summary:
      'Define the information architecture and sitemap for the primary digital properties.',
    mainOutcomes: [
      'Primary IA + sitemap',
      'Navigation model',
      'Content-type inventory tied to IA',
    ],
    agenda: parseAgendaText(
      '•  Current IA review (30m)\n' +
        '•  Target IA + sitemap draft (60m)\n' +
        '•  Navigation model (20m)\n' +
        '•  Content-type mapping (10m)'
    ),
    clientAttendees: semiList(
      'UX Lead; Content Lead; Product Owner; SEO Lead'
    ),
    agencyAttendees: semiList(
      'UX Lead; Content Strategist; SEO Strategist'
    ),
    preReads: semiList('Current IA; analytics on navigation'),
    dependencies: [],
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'KPIs and CPIs measurement framework',
    track: 'Measurement',
    duration: '2h',
    mode,
    status,
    summary:
      'Finalize the KPI / CPI measurement framework, instrumentation plan, and reporting model.',
    mainOutcomes: [
      'KPI / CPI tree',
      'Instrumentation plan',
      'Reporting model',
    ],
    agenda: parseAgendaText(
      '•  Framework draft review (30m)\n' +
        '•  KPI / CPI tree finalization (45m)\n' +
        '•  Instrumentation plan (30m)\n' +
        '•  Reporting model (15m)'
    ),
    clientAttendees: semiList(
      'Analytics Lead; CX Lead; Product Owner; Finance'
    ),
    agencyAttendees: semiList(
      'Measurement Strategist; Data Architect; CX Strategist'
    ),
    preReads: semiList('Measurement read-out; KPI draft'),
    dependencies: semiList('Measurement read-out complete'),
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'Feature backlog prioritization',
    track: 'Product / Delivery',
    duration: '3h',
    mode,
    status,
    summary:
      'Prioritize the feature backlog across journeys using a consistent prioritization model (frequency × impact × feasibility).',
    mainOutcomes: [
      'Prioritized backlog',
      'Release candidates (quick wins / MVP / later)',
      'Dependencies and sequencing',
    ],
    agenda: parseAgendaText(
      '•  Method recap (15m)\n' +
        '•  Backlog walkthrough (60m)\n' +
        '•  Scoring (60m)\n' +
        '•  Break (15m)\n' +
        '•  Sequencing + release candidates (30m)'
    ),
    clientAttendees: semiList(
      'Product Owner; CX Lead; Technology Lead; Delivery Lead'
    ),
    agencyAttendees: semiList(
      'Product Strategist; CX Strategist; Technology Architect; Delivery Lead'
    ),
    preReads: semiList('Deep-dive outputs; feasibility notes'),
    dependencies: semiList('Journey deep-dives + technical deep-dive complete'),
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'Governance model & RACI finalization',
    track: 'Program',
    duration: '90 min',
    mode,
    status,
    summary:
      'Finalize the governance model and RACI across client + agency for the build phase.',
    mainOutcomes: [
      'RACI finalized',
      'Decision rights',
      'Governance cadence for build phase',
    ],
    agenda: parseAgendaText(
      '•  RACI draft walkthrough (30m)\n' +
        '•  Decision rights (30m)\n' +
        '•  Governance cadence (30m)'
    ),
    clientAttendees: semiList(
      'Program Manager; PMO; CX Lead; Technology Lead'
    ),
    agencyAttendees: semiList(
      'Engagement Lead; Delivery Lead'
    ),
    preReads: semiList('Draft RACI; governance proposal'),
    dependencies: semiList('D02 complete'),
  });

  definition.push({
    code: F(),
    phase: 'Definition',
    name: 'Define read-out',
    track: 'Program',
    duration: '2h',
    mode,
    status,
    summary:
      'Consolidated read-out of the Define phase: solution shape, prioritized backlog, architecture, governance, and plan for build.',
    mainOutcomes: [
      'Define deliverable sign-off',
      'Agreed plan for build',
      'Open risks + mitigations',
    ],
    agenda: parseAgendaText(
      '•  Recap of Define outputs (45m)\n' +
        '•  Plan for build (45m)\n' +
        '•  Open risks (20m)\n' +
        '•  Decisions + sign-off (10m)'
    ),
    clientAttendees: semiList(
      'Project Sponsor; CX Lead; Technology Lead; Marketing; Finance'
    ),
    agencyAttendees: semiList(commonAgency),
    preReads: semiList('All Define workshop outputs'),
    dependencies: semiList('All Definition workshops complete'),
  });

  return [...discovery, ...definition];
}

// ======================================================================
// Page
// ======================================================================

export default function PlanPage() {
  const params = useParams();
  const [apiKey] = useApiKey();
  const model = useStore((s) => s.model);
  const setWorkshops = useStore((s) => s.setWorkshops);
  const addWorkshop = useStore((s) => s.addWorkshop);
  const removeWorkshop = useStore((s) => s.removeWorkshop);
  const setWorkshopQuestions = useStore((s) => s.setWorkshopQuestions);
  const setWorkshopAgenda = useStore((s) => s.setWorkshopAgenda);
  useHydratedCaptureStore((params.id as string) || '');
  const hasDiagnostics = useHasDiagnostics((params.id as string) || '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [engagementScope, setEngagementScope] = useState('');
  const [timeline, setTimeline] = useState('');
  const [availableStakeholders, setAvailableStakeholders] = useState('');

  const [isProposing, setIsProposing] = useState(false);
  const [isGenQuestions, setIsGenQuestions] = useState<
    Record<string, boolean>
  >({});
  const [isGenAgenda, setIsGenAgenda] = useState<Record<string, boolean>>({});
  const [isGenAllQuestions, setIsGenAllQuestions] = useState(false);
  const [genAllProgress, setGenAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDownloadingAllPdfs, setIsDownloadingAllPdfs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workshopErrors, setWorkshopErrors] = useState<
    Record<string, string>
  >({});

  const workshops = useMemo<Workshop[]>(
    () => (model?.workshops || []).filter(w => w.phase === 'Discovery'),
    [model?.workshops]
  );
  const allQuestions = useMemo<WorkshopQuestion[]>(
    () => model?.workshopQuestions || [],
    [model?.workshopQuestions]
  );
  const journeyPhaseLabels = useMemo<string[]>(
    () => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const p of (model?.journeyPhases || [])
        .slice()
        .sort((a, b) => a.order - b.order)) {
        const label = (p.label || '').trim();
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label);
      }
      return out;
    },
    [model?.journeyPhases]
  );
  const journeysList = useMemo<Journey[]>(
    () =>
      (model?.journeys || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .filter((j) => j.name && j.name.trim().length > 0),
    [model?.journeys]
  );
  // Used by provenance chips on QuestionRow to resolve a researchDocId
  // citation back to a human-readable filename.
  const researchDocsById = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const d of model?.input?.researchDocuments || []) {
      if (d?.id) map.set(d.id, d.filename);
    }
    return map;
  }, [model?.input?.researchDocuments]);
  const hasWorkshops = workshops.length > 0;

  const questionsByWorkshop = useMemo(() => {
    const map = new Map<string, WorkshopQuestion[]>();
    for (const q of allQuestions) {
      const arr = map.get(q.workshopId) || [];
      arr.push(q);
      map.set(q.workshopId, arr);
    }
    for (const [id, arr] of map.entries()) {
      map.set(
        id,
        arr.slice().sort((a, b) => a.order - b.order)
      );
    }
    return map;
  }, [allQuestions]);

  const selected = useMemo(
    () => workshops.find((w) => w.id === selectedId) || null,
    [workshops, selectedId]
  );

  // Keep selection in sync with inventory. On first mount (or when the
  // current selection disappears), land on the first workshop.
  useEffect(() => {
    if (workshops.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !workshops.some((w) => w.id === selectedId)) {
      setSelectedId(workshops[0].id);
    }
  }, [workshops, selectedId]);

  if (!model || model.id !== params.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Model not found</h1>
          <Link
            href="/new"
            className="underline"
            style={{ color: 'var(--fg-2)' }}
          >
            Create a new model
          </Link>
        </div>
      </div>
    );
  }

  // ---- Propose workshops via API ------------------------------------
  const handleProposeWorkshops = async () => {
    if (!apiKey.trim()) {
      setError('Enter your OpenAI API key in the header to generate.');
      return;
    }
    if (hasWorkshops) {
      if (
        !confirm(
          'Regenerate workshops? This replaces the current inventory and drops existing questions and agendas.'
        )
      ) {
        return;
      }
    }
    setError(null);
    setIsProposing(true);
    try {
      const res = await fetch('/api/propose-workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...model.input,
          apiKey,
          engagementScope: engagementScope || undefined,
          timeline: timeline || undefined,
          availableStakeholders: availableStakeholders || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Generation failed');
      }
      setWorkshops(data.workshops);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setIsProposing(false);
    }
  };

  const handleLoadSample = () => {
    // The builder pulls journeys + products from the current model so
    // per-journey and per-channel workshops land preconfigured. Safe
    // when the brief is thin: falls back to generic placeholders.
    setWorkshops(buildDefaultWorkshops(model));
  };

  const handleClearAll = () => {
    if (!hasWorkshops) return;
    const ok =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Clear all workshops? This removes every workshop on this model. You can seed the defaults again afterwards.'
          );
    if (!ok) return;
    setWorkshops([]);
    setSelectedId(null);
  };

  const handleExportWorkshop = async (workshop: Workshop) => {
    try {
      const questions = questionsByWorkshop.get(workshop.id) || [];
      await exportWorkshopToXlsx(workshop, questions);
    } catch (e) {
      setWorkshopErrors((prev) => ({
        ...prev,
        [workshop.id]:
          e instanceof Error
            ? `Export failed: ${e.message}`
            : 'Export failed',
      }));
    }
  };

  const handleExportAllWorkshops = async () => {
    try {
      await exportAllWorkshopsToXlsx(workshops, questionsByWorkshop);
    } catch (e) {
      setError(
        e instanceof Error ? `Export failed: ${e.message}` : 'Export failed'
      );
    }
  };

  const handleDownloadAllPdfs = async () => {
    if (workshops.length === 0) return;
    setIsDownloadingAllPdfs(true);
    try {
      // Pull the freshest question map straight from the store in case
      // generation just finished and React hasn't re-memoized yet.
      const latestAll = useStore.getState().model?.workshopQuestions || [];
      const latestMap = new Map<string, WorkshopQuestion[]>();
      for (const w of workshops) latestMap.set(w.id, []);
      for (const q of latestAll) {
        const list = latestMap.get(q.workshopId);
        if (list) list.push(q);
      }
      for (const list of latestMap.values()) {
        list.sort((a, b) => a.order - b.order);
      }
      await downloadAllWorkshopsAsZip(workshops, latestMap, 'workshops.zip');
    } catch (e) {
      setError(
        e instanceof Error ? `PDF export failed: ${e.message}` : 'PDF export failed'
      );
    } finally {
      setIsDownloadingAllPdfs(false);
    }
  };

  const handleGenerateAllQuestions = async () => {
    if (workshops.length === 0) return;
    if (!apiKey.trim()) {
      setError('Enter your OpenAI API key in the header to generate.');
      return;
    }
    setError(null);
    setIsGenAllQuestions(true);
    setGenAllProgress({ done: 0, total: workshops.length });
    // Run sequentially — generation is expensive and the per-workshop
    // route hits the same OpenAI key. Sequential keeps rate limits sane.
    try {
      for (let i = 0; i < workshops.length; i++) {
        const w = workshops[i];
        await handleGenerateQuestions(w);
        setGenAllProgress({ done: i + 1, total: workshops.length });
      }
    } finally {
      setIsGenAllQuestions(false);
    }
  };

  const handleGenerateQuestions = async (
    workshop: Workshop,
    scope?: GenerationScope
  ) => {
    if (!apiKey.trim()) {
      setWorkshopErrors((prev) => ({
        ...prev,
        [workshop.id]:
          'Enter your OpenAI API key in the header to generate.',
      }));
      return;
    }
    setWorkshopErrors((prev) => {
      const n = { ...prev };
      delete n[workshop.id];
      return n;
    });
    setIsGenQuestions((prev) => ({ ...prev, [workshop.id]: true }));
    try {
      const res = await fetch('/api/generate-workshop-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...model.input,
          apiKey,
          workshop,
          journeyPhases: model.journeyPhases,
          ...(scope?.selectedJourneyName
            ? { selectedJourneyName: scope.selectedJourneyName }
            : {}),
          ...(scope?.selectedPhaseLabel
            ? { selectedPhaseLabel: scope.selectedPhaseLabel }
            : {}),
          ...(scope?.profileOverride
            ? { profileOverride: scope.profileOverride }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Generation failed');
      }
      setWorkshopQuestions(workshop.id, data.questions);
    } catch (e) {
      setWorkshopErrors((prev) => ({
        ...prev,
        [workshop.id]:
          e instanceof Error ? e.message : 'Question generation failed',
      }));
    } finally {
      setIsGenQuestions((prev) => ({ ...prev, [workshop.id]: false }));
    }
  };

  const handleGenerateAgenda = async (workshop: Workshop) => {
    if (!apiKey.trim()) {
      setWorkshopErrors((prev) => ({
        ...prev,
        [workshop.id]:
          'Enter your OpenAI API key in the header to generate.',
      }));
      return;
    }
    setWorkshopErrors((prev) => {
      const n = { ...prev };
      delete n[workshop.id];
      return n;
    });
    setIsGenAgenda((prev) => ({ ...prev, [workshop.id]: true }));
    try {
      const existingQuestions = (
        questionsByWorkshop.get(workshop.id) || []
      ).map((q) => q.text);
      const res = await fetch('/api/generate-workshop-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...model.input,
          apiKey,
          workshop,
          existingQuestions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Generation failed');
      }
      setWorkshopAgenda(workshop.id, data.agenda);
    } catch (e) {
      setWorkshopErrors((prev) => ({
        ...prev,
        [workshop.id]:
          e instanceof Error ? e.message : 'Agenda generation failed',
      }));
    } finally {
      setIsGenAgenda((prev) => ({ ...prev, [workshop.id]: false }));
    }
  };

  const versionLabel = hasWorkshops
    ? `${workshops.length} workshop${workshops.length === 1 ? '' : 's'} planned`
    : 'no plan yet';
  const versionTone = hasWorkshops ? 'evidenced' : 'hypothesis';

  const allWorkshopsHaveQuestions =
    hasWorkshops &&
    workshops.every((w) => (questionsByWorkshop.get(w.id) || []).length > 0);

  const headerRight = (
    <div className="flex items-center gap-2">
      {hasWorkshops && (
        <>
          <button
            type="button"
            className="btn btn--soft btn--sm"
            onClick={handleGenerateAllQuestions}
            disabled={isGenAllQuestions || !apiKey.trim()}
            title={
              !apiKey.trim()
                ? 'Enter your OpenAI API key in the header to generate'
                : 'Generate questions for every workshop in this plan, sequentially'
            }
          >
            {isGenAllQuestions ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            {isGenAllQuestions && genAllProgress
              ? `Generating ${genAllProgress.done}/${genAllProgress.total}`
              : 'Generate all questions'}
          </button>
          {allWorkshopsHaveQuestions && !isGenAllQuestions && (
            <button
              type="button"
              className="btn btn--soft btn--sm"
              onClick={handleDownloadAllPdfs}
              disabled={isDownloadingAllPdfs}
              title="Download every workshop as a PDF, bundled in a single zip"
            >
              {isDownloadingAllPdfs ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Download all workshops
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleExportAllWorkshops}
            title="Download all workshops as a single Excel file (one sheet per workshop)"
          >
            <Download size={13} />
            Export all
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleLoadSample}
            title="Add the 22-workshop Digitas baseline plan on top of the current list"
          >
            <Download size={13} />
            Seed defaults
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleClearAll}
            title="Remove every workshop on this model"
            style={{ color: 'var(--danger, var(--fg-2))' }}
          >
            <Trash2 size={13} />
            Clear all
          </button>
        </>
      )}
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={handleProposeWorkshops}
        disabled={isProposing}
        title={
          hasWorkshops
            ? 'Regenerate the workshop inventory from the brief'
            : 'Propose a workshop inventory from the brief'
        }
      >
        {isProposing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Wand2 size={14} />
        )}
        {hasWorkshops ? 'Regenerate plan' : 'Propose plan'}
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
    >
      {/* Page-scoped styles for the borderless inputs. Keeping them here
          keeps global CSS lean and lets this page evolve independently. */}
      <style jsx global>{`
        .plan-input {
          display: inline-block;
          background: transparent;
          border: none;
          border-bottom: 1px solid transparent;
          color: var(--fg-1);
          padding: 2px 2px;
          font-size: 13px;
          line-height: 1.5;
          outline: none;
          transition: border-color 120ms ease, background 120ms ease;
          width: 100%;
        }
        .plan-input::placeholder {
          color: var(--fg-2);
          opacity: 0.6;
        }
        .plan-input:hover {
          border-bottom-color: var(--border-1);
        }
        .plan-input:focus {
          border-bottom-color: var(--accent);
        }
        .plan-textarea {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid transparent;
          color: var(--fg-1);
          padding: 4px 2px;
          font-size: 13px;
          line-height: 1.55;
          outline: none;
          resize: vertical;
          transition: border-color 120ms ease;
        }
        .plan-textarea::placeholder {
          color: var(--fg-2);
          opacity: 0.6;
        }
        .plan-textarea:hover {
          border-bottom-color: var(--border-1);
        }
        .plan-textarea:focus {
          border-bottom-color: var(--accent);
        }
        .plan-title {
          display: block;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--fg-1);
          font-size: 28px;
          font-weight: 600;
          line-height: 1.2;
          padding: 0;
          letter-spacing: -0.01em;
        }
        .plan-title::placeholder {
          color: var(--fg-2);
          opacity: 0.5;
        }
        .plan-select {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          color: var(--fg-1);
        }
        .plan-select select {
          background: transparent;
          border: none;
          color: inherit;
          font: inherit;
          padding: 2px 0;
          appearance: none;
          -webkit-appearance: none;
          outline: none;
          cursor: pointer;
        }
        .plan-inline-select {
          background: transparent;
          border: none;
          color: var(--fg-1);
          font: inherit;
          font-weight: 500;
          padding: 0 4px;
          outline: none;
          cursor: pointer;
          border-bottom: 1px dashed var(--border-1);
        }
        .plan-inline-select:hover,
        .plan-inline-select:focus {
          border-bottom-color: var(--accent);
        }

        /* Glass pane card styling */
        .glass-pane {
          background: var(--bg-1);
          border: 1px solid var(--border-1);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        /* Agenda timeline styling */
        .agenda-timeline {
          position: relative;
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .agenda-timeline-item {
          position: relative;
          display: flex;
          gap: 16px;
          padding-bottom: 20px;
        }

        .agenda-timeline-item:last-child {
          padding-bottom: 0;
        }

        .agenda-timeline-item:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 15px;
          top: 32px;
          bottom: 0;
          width: 2px;
          background: rgba(0, 0, 0, 0.08);
        }

        .agenda-timeline-marker {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        .agenda-timeline-number {
          color: var(--accent-fg);
          font-size: 13px;
          font-weight: 700;
        }

        .agenda-timeline-content {
          flex: 1;
          min-width: 0;
          padding-top: 4px;
        }
      `}</style>

      <div className="sticky top-0 z-50">
        <AppHeader
          modelId={model.id}
          signalsCount={model.signals?.length || 0}
          hasDiscoveryBundle={!!model.discoveryBundle}
          hasJourneyPhases={model.journeyPhases.length > 0}
          hasDiagnostics={hasDiagnostics}
          currentStep="discovery"
        />
      </div>

      {/* Secondary toolbar (context fields + error banner). Only shown
          when no workshops exist or on error, so the workspace stays
          calm once the user is editing. */}
      {(!hasWorkshops || error) && (
        <div
          className="px-8 py-4"
          style={{
            borderBottom: '1px solid var(--border-1)',
            background: 'var(--bg-1)',
          }}
        >
          <div className="max-w-5xl mx-auto">
            {!hasWorkshops && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                <div>
                  <SectionLabel>Engagement scope</SectionLabel>
                  <PlainInput
                    value={engagementScope}
                    onChange={setEngagementScope}
                    placeholder="e.g., CRM modernization"
                  />
                </div>
                <div>
                  <SectionLabel>Timeline</SectionLabel>
                  <PlainInput
                    value={timeline}
                    onChange={setTimeline}
                    placeholder="e.g., 3 weeks"
                  />
                </div>
                <div>
                  <SectionLabel>Available stakeholders</SectionLabel>
                  <PlainInput
                    value={availableStakeholders}
                    onChange={setAvailableStakeholders}
                    placeholder="Head of CRM, CMO, Service VP"
                  />
                </div>
              </div>
            )}
            {error && (
              <div
                className="text-sm px-3 py-2 rounded"
                style={{
                  color: 'var(--danger)',
                  background:
                    'color-mix(in srgb, var(--danger) 10%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan action bar — bulk operations across the whole workshop list */}
      {hasWorkshops && (
        <div
          className="px-8 py-3 flex items-center justify-between gap-4"
          style={{
            borderBottom: '1px solid var(--border-1)',
            background: 'var(--bg-1)',
          }}
        >
          <div className="text-sm" style={{ color: 'var(--fg-2)' }}>
            {versionLabel}
          </div>
          {headerRight}
        </div>
      )}

      {/* Main two-pane body */}
      {hasWorkshops ? (
        <div className="flex flex-1 min-h-0">
          <WorkshopRail
            workshops={workshops}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={() => {
              const id = addWorkshop();
              if (id) setSelectedId(id);
            }}
            onRemove={(id) => {
              removeWorkshop(id);
              if (selectedId === id) {
                const remaining = workshops.filter((w) => w.id !== id);
                setSelectedId(remaining[0]?.id ?? null);
              }
            }}
            questionsByWorkshop={questionsByWorkshop}
          />
          <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-0)' }}>
            {selected ? (
              <WorkshopEditor
                workshop={selected}
                questions={questionsByWorkshop.get(selected.id) || []}
                journeyPhaseLabels={journeyPhaseLabels}
                journeys={journeysList}
                allPhases={model?.journeyPhases || []}
                researchDocsById={researchDocsById}
                onGenerateQuestions={(scope) =>
                  handleGenerateQuestions(selected, scope)
                }
                onExportQuestions={() => handleExportWorkshop(selected)}
                onGenerateAgenda={() => handleGenerateAgenda(selected)}
                isGeneratingQuestions={!!isGenQuestions[selected.id]}
                isGeneratingAgenda={!!isGenAgenda[selected.id]}
                errorMessage={workshopErrors[selected.id]}
              />
            ) : (
              <div
                className="h-full flex items-center justify-center text-sm"
                style={{ color: 'var(--fg-2)' }}
              >
                Select a workshop to edit.
              </div>
            )}
          </main>
        </div>
      ) : (
        <EmptyPlan
          isProposing={isProposing}
          onPropose={handleProposeWorkshops}
          onLoadSample={handleLoadSample}
          onAddManually={() => {
            const id = addWorkshop();
            if (id) setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function EmptyPlan({
  isProposing,
  onPropose,
  onLoadSample,
  onAddManually,
}: {
  isProposing: boolean;
  onPropose: () => void;
  onLoadSample: () => void;
  onAddManually: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-8 py-16">
      <div
        className="w-full max-w-xl text-center rounded-[14px]"
        style={{
          background: 'var(--bg-1)',
          border: '1px dashed var(--border-1)',
          padding: '40px 32px',
        }}
      >
        <Wand2
          size={28}
          className="mx-auto mb-4"
          style={{ color: 'var(--fg-2)' }}
        />
        <h2 className="text-xl font-medium mb-1">No workshops yet</h2>
        <p
          className="text-sm mb-6 max-w-sm mx-auto"
          style={{ color: 'var(--fg-2)' }}
        >
          Draft the workshop inventory for this engagement. Seed the
          Digitas 22-workshop baseline, propose a plan from the brief,
          or add one manually.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onLoadSample}
            title="Seed the 22-workshop Digitas baseline: 13 Discovery + 9 Definition. Per-journey and per-channel workshops expand from the brief."
          >
            <Download size={13} />
            Seed default plan
          </button>
          <button
            type="button"
            className="btn btn--soft btn--sm"
            onClick={onPropose}
            disabled={isProposing}
          >
            {isProposing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            Propose from brief
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onAddManually}
          >
            <Plus size={13} />
            Add manually
          </button>
        </div>
      </div>
    </div>
  );
}
