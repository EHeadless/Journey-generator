'use client';

/**
 * InformedVariantsBar — side-by-side Informed Landscape variants.
 *
 * Sister to `HypothesisVariantsBar`, but anchored on classified problems
 * (from the Problem Diagnostics step) instead of the brief/research
 * evidence layers. Sits above the canvas on the Informed Landscape route
 * (`/model/[id]/informed-landscape`).
 *
 * Lets the strategist:
 *   1. Generate an Informed variant from a specific evidence cocktail
 *      (problems-only / problems+brief / problems+research / everything).
 *   2. Activate a variant — mirroring its phases onto Model.journeyPhases
 *      AND wiping any downstream demand spaces / circumstances tied to
 *      the previous landscape so the auto-cascade re-runs cleanly.
 *   3. Compare which evidence layers reshape the lifecycle when problems
 *      lead.
 *
 * The blend logic and pre-formatted context blocks live in
 * `lib/extraction/informed-context.ts`. Generation goes through
 * `/api/generate-informed-variant`. The companion agent doc is
 * `.claude/agents/informed-landscape-generator.md`.
 *
 * BIDIRECTIONAL INVARIANT: activating an Informed variant clears
 * `hypothesisVariants[].isActive` (handled in the store action).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Stethoscope,
  Loader2,
  Trash2,
  Check,
  CircleAlert,
  ChevronDown,
} from 'lucide-react';
import {
  informedBlendAvailability,
  buildInformedContext,
  INFORMED_BLEND_LABEL,
  type InformedProblemPayload,
  type InformedPhaseRef,
} from '@/lib/extraction/informed-context';
import type {
  InformedBlend,
  InformedLandscapeVariant,
  JourneyPhase,
  Model,
} from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  model: Model;
  apiKey: string;
  variants: InformedLandscapeVariant[];
  problems: InformedProblemPayload[];
  existingPhases: InformedPhaseRef[];
  onAddVariant: (v: Omit<InformedLandscapeVariant, 'id'>) => string;
  onActivateVariant: (id: string) => void;
  onRemoveVariant: (id: string) => void;
  onError: (msg: string) => void;
}

interface GenerationState {
  blend: InformedBlend;
  status: 'idle' | 'running';
}

const ALL_BLENDS: InformedBlend[] = [
  'problems-only',
  'problems+brief',
  'problems+research',
  'everything',
];

export function InformedVariantsBar({
  model,
  apiKey,
  variants,
  problems,
  existingPhases,
  onAddVariant,
  onActivateVariant,
  onRemoveVariant,
  onError,
}: Props) {
  const [generation, setGeneration] = useState<GenerationState>({
    blend: 'problems-only',
    status: 'idle',
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [pickerRect, setPickerRect] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!pickerOpen) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPickerRect({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const availability = useMemo(
    () =>
      informedBlendAvailability({
        input: model.input,
        problemCount: problems.length,
      }),
    [model.input, problems.length]
  );

  const activeVariant = variants.find((v) => v.isActive) || null;

  const variantsByBlend = useMemo(() => {
    const map = new Map<InformedBlend, InformedLandscapeVariant>();
    for (const v of variants) {
      const existing = map.get(v.blend);
      if (!existing || v.generatedAt.getTime() > existing.generatedAt.getTime()) {
        map.set(v.blend, v);
      }
    }
    return map;
  }, [variants]);

  const generateVariant = async (blend: InformedBlend) => {
    if (!apiKey) {
      onError('Add your OpenAI key in the header to generate variants.');
      return;
    }
    if (problems.length === 0) {
      onError(
        'No classified problems yet. Run Problem Diagnostics before generating an Informed Landscape.'
      );
      return;
    }
    if (!availability.blends.includes(blend)) {
      onError(
        `Blend "${INFORMED_BLEND_LABEL[blend]}" isn't available — upload the corresponding source first.`
      );
      return;
    }
    if (!model.journeys || model.journeys.length === 0) {
      onError('No journeys on this model — define at least one journey first.');
      return;
    }
    setPickerOpen(false);
    setGeneration({ blend, status: 'running' });
    try {
      const res = await fetch('/api/generate-informed-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          blend,
          input: model.input,
          journeys: model.journeys,
          problems,
          existingPhases,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (${res.status})`);
      }
      const data = (await res.json()) as {
        blend: InformedBlend;
        label: string;
        sourceFingerprint: string;
        phases: Array<Omit<JourneyPhase, 'id'>>;
      };

      // Stamp ids + `source: 'ai'` on the variant's own phase objects
      // so they're independent of any other variant AND so the
      // demand-space cascade fires reliably when the variant is
      // activated.
      const stamped: JourneyPhase[] = data.phases.map((p, i) => ({
        ...p,
        id: uuidv4(),
        source: 'ai',
        order: typeof p.order === 'number' ? p.order : i,
      }));

      onAddVariant({
        blend: data.blend,
        label: data.label,
        journeyPhases: stamped,
        generatedAt: new Date(),
        sourceFingerprint: data.sourceFingerprint,
        isActive: false,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Variant generation failed');
    } finally {
      setGeneration({ blend, status: 'idle' });
    }
  };

  const activate = (variant: InformedLandscapeVariant) => {
    if (variant.isActive) return;
    const hasDownstream =
      (model.demandSpaces?.length || 0) +
        (model.circumstances?.length || 0) >
      0;
    const hasActiveHypothesis = (model.hypothesisVariants || []).some(
      (v) => v.isActive
    );
    const lines = [
      `Activating "${variant.label}" will replace the current journey phases with this Informed landscape.`,
    ];
    if (hasActiveHypothesis) {
      lines.push('The currently active Hypothesis variant will be deactivated.');
    }
    if (hasDownstream) {
      lines.push(
        'Demand spaces and circumstances tied to the previous landscape will be discarded.'
      );
    }
    lines.push('Continue?');
    const ok = confirm(lines.join('\n\n'));
    if (!ok) return;
    onActivateVariant(variant.id);
  };

  // Per-blend fingerprint for staleness detection. Compares against
  // each existing variant's stored fingerprint.
  const currentFingerprintByBlend = useMemo(() => {
    const map = new Map<InformedBlend, string>();
    for (const blend of ALL_BLENDS) {
      // Use the first journey's bucket as the canonical fingerprint
      // input — the route mirrors this (firstFingerprint becomes the
      // variant's fingerprint).
      const firstJourneyId = model.journeys?.[0]?.id;
      const phasesInJourney = existingPhases.filter(
        (p) => !p.journeyId || p.journeyId === firstJourneyId
      );
      const ctx = buildInformedContext({
        blend,
        input: model.input,
        problems,
        phasesInJourney,
      });
      map.set(blend, ctx.sourceFingerprint);
    }
    return map;
  }, [model.input, model.journeys, existingPhases, problems]);

  return (
    <div
      className="px-5 py-2 border-b flex items-center gap-3 overflow-x-auto"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      <div
        className="text-[9px] font-black uppercase tracking-widest flex-shrink-0 flex items-center gap-1.5"
        style={{ color: 'var(--fg-3)' }}
      >
        <Stethoscope size={11} />
        Informed variants
      </div>

      {variants.length === 0 ? (
        <div className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
          {problems.length === 0
            ? 'Classify problems on the Diagnostics step before generating an Informed variant.'
            : 'None yet — generate a variant to compare evidence layers.'}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {ALL_BLENDS.map((blend) => {
            const variant = variantsByBlend.get(blend);
            if (!variant) return null;
            const isActive = variant.isActive;
            const isStale =
              currentFingerprintByBlend.get(blend) !== variant.sourceFingerprint;
            const isRunning =
              generation.status === 'running' && generation.blend === blend;
            return (
              <div
                key={variant.id}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--bg-3)',
                  color: isActive ? 'var(--accent-fg)' : 'var(--fg-1)',
                  border: isActive
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border-1)',
                }}
                title={`${INFORMED_BLEND_LABEL[blend]} · ${variant.journeyPhases.length} phases · ${
                  isStale ? 'stale (problems or sources changed since generation)' : 'up to date'
                }`}
              >
                <button
                  type="button"
                  onClick={() => activate(variant)}
                  className="flex items-center gap-1.5"
                  disabled={isRunning}
                >
                  {isActive ? <Check size={11} /> : null}
                  {INFORMED_BLEND_LABEL[blend]}
                  <span className="ml-1 text-[10px] font-medium opacity-80">
                    · {variant.journeyPhases.length}
                  </span>
                  {isStale && (
                    <CircleAlert
                      size={11}
                      style={{ color: isActive ? 'var(--accent-fg)' : 'var(--warn)' }}
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => generateVariant(blend)}
                  disabled={isRunning || !apiKey}
                  title="Regenerate this variant"
                  className="p-0.5 rounded hover:opacity-100 opacity-60 disabled:opacity-30"
                >
                  {isRunning ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Stethoscope size={11} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveVariant(variant.id)}
                  disabled={isRunning}
                  title="Discard this variant"
                  className="p-0.5 rounded hover:opacity-100 opacity-50 disabled:opacity-30"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1" />

      {/* Generate picker */}
      <div className="flex-shrink-0">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          disabled={
            generation.status === 'running' || !apiKey || problems.length === 0
          }
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            opacity:
              generation.status === 'running' ||
              !apiKey ||
              problems.length === 0
                ? 0.5
                : 1,
          }}
          title={
            problems.length === 0
              ? 'Run Problem Diagnostics first — Informed Landscape needs classified problems.'
              : !apiKey
                ? 'Add an OpenAI API key in the header first'
                : ''
          }
        >
          {generation.status === 'running' ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Generating{' '}
              {INFORMED_BLEND_LABEL[generation.blend]}…
            </>
          ) : (
            <>
              <Stethoscope size={11} /> Generate variant <ChevronDown size={11} />
            </>
          )}
        </button>
        {pickerOpen && pickerRect && typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={pickerRef}
              className="fixed rounded-lg shadow-lg overflow-hidden min-w-[240px]"
              style={{
                top: pickerRect.top,
                right: pickerRect.right,
                zIndex: 60,
                background: 'var(--bg-2)',
                border: '1px solid var(--border-1)',
              }}
            >
              {ALL_BLENDS.map((blend) => {
                const enabled = availability.blends.includes(blend);
                return (
                  <button
                    key={blend}
                    type="button"
                    onClick={() => generateVariant(blend)}
                    disabled={!enabled}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold text-left transition-colors disabled:opacity-40"
                    style={{
                      color: 'var(--fg-1)',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) =>
                      enabled && (e.currentTarget.style.background = 'var(--bg-3)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                    title={
                      enabled
                        ? ''
                        : blend === 'problems-only'
                        ? 'No classified problems yet. Run Problem Diagnostics first.'
                        : blend === 'problems+brief'
                        ? 'Upload a brief on the home page to enable.'
                        : blend === 'problems+research'
                        ? 'Add research documents on the Research step to enable.'
                        : 'Needs at least one supporting source (form / brief / research).'
                    }
                  >
                    <span>{INFORMED_BLEND_LABEL[blend]}</span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: 'var(--fg-3)' }}
                    >
                      {enabled ? blendSourcesHint(blend) : 'unavailable'}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body
          )}
      </div>

      {activeVariant && (
        <div
          className="text-[10px] font-medium flex-shrink-0"
          style={{ color: 'var(--fg-3)' }}
        >
          Active: <strong style={{ color: 'var(--fg-1)' }}>{activeVariant.label}</strong>
        </div>
      )}
    </div>
  );
}

function blendSourcesHint(blend: InformedBlend): string {
  switch (blend) {
    case 'problems-only':
      return 'problems';
    case 'problems+brief':
      return 'problems + brief';
    case 'problems+research':
      return 'problems + research';
    case 'everything':
      return 'problems + brief + research';
  }
}
