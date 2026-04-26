'use client';

/**
 * HypothesisVariantsBar — side-by-side hypothesis landscape variants.
 *
 * Sits above the canvas on the workspace page. Lets the strategist:
 *   1. Generate a landscape variant from a specific evidence cocktail
 *      (form-only / brief-only / research-only / form+research /
 *      everything). Each variant is a *full* set of journey phases for
 *      every journey on the model, generated independently.
 *   2. Activate a variant — which mirrors its phases onto
 *      Model.journeyPhases so the existing demand-space / circumstance
 *      pipeline runs against that landscape.
 *   3. Compare which evidence layers shifted the lifecycle.
 *
 * The blend logic and pre-formatted context blocks live in
 * `lib/extraction/hypothesis-context.ts`. Generation goes through
 * `/api/generate-hypothesis-variant`. The companion agent doc is
 * `.claude/agents/hypothesis-variant-generator.md`.
 *
 * Generating a variant does NOT auto-activate it — the strategist
 * compares first, then chooses. Activating *does* immediately replace
 * Model.journeyPhases (and silently invalidates downstream demand
 * spaces / circumstances that were tied to the prior variant's phase
 * ids — that's documented in the activate confirm dialog).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Loader2,
  Trash2,
  Check,
  CircleAlert,
  ChevronDown,
} from 'lucide-react';
import {
  blendAvailability,
  buildBlendedContext,
  BLEND_LABEL,
} from '@/lib/extraction/hypothesis-context';
import type {
  HypothesisBlend,
  HypothesisVariant,
  JourneyPhase,
  Model,
} from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  model: Model;
  apiKey: string;
  variants: HypothesisVariant[];
  onAddVariant: (
    v: Omit<HypothesisVariant, 'id'>
  ) => string;
  onActivateVariant: (id: string) => void;
  onRemoveVariant: (id: string) => void;
  onError: (msg: string) => void;
}

interface GenerationState {
  blend: HypothesisBlend;
  status: 'idle' | 'running';
}

const ALL_BLENDS: HypothesisBlend[] = [
  'form-only',
  'brief-only',
  'research-only',
  'form+research',
  'everything',
];

export function HypothesisVariantsBar({
  model,
  apiKey,
  variants,
  onAddVariant,
  onActivateVariant,
  onRemoveVariant,
  onError,
}: Props) {
  const [generation, setGeneration] = useState<GenerationState>({
    blend: 'form-only',
    status: 'idle',
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  // Portal anchor: the picker is rendered via createPortal to escape the
  // bar's `overflow-x-auto` (which would otherwise clip it vertically and
  // hide it behind the next pane). We track the trigger button rect so the
  // portal can position itself fixed under it.
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

  // Outside-click + Escape close. The portal escapes the bar so the bar's
  // own onMouseLeave isn't reliable on its own.
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

  const availability = useMemo(() => blendAvailability(model), [model]);
  const activeVariant = variants.find((v) => v.isActive) || null;

  // Per-blend variant lookup — variants are unique on (blend +
  // sourceFingerprint). If the same blend has been generated multiple
  // times after edits, the most recent wins for the chip display.
  const variantsByBlend = useMemo(() => {
    const map = new Map<HypothesisBlend, HypothesisVariant>();
    for (const v of variants) {
      const existing = map.get(v.blend);
      if (!existing || v.generatedAt.getTime() > existing.generatedAt.getTime()) {
        map.set(v.blend, v);
      }
    }
    return map;
  }, [variants]);

  const generateVariant = async (blend: HypothesisBlend) => {
    if (!apiKey) {
      onError('Add your OpenAI key in the header to generate variants.');
      return;
    }
    if (!availability.blends.includes(blend)) {
      onError(
        `Blend "${BLEND_LABEL[blend]}" isn't available — upload the corresponding source first.`
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
      const res = await fetch('/api/generate-hypothesis-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          blend,
          input: model.input,
          journeys: model.journeys,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (${res.status})`);
      }
      const data = (await res.json()) as {
        blend: HypothesisBlend;
        label: string;
        sourceFingerprint: string;
        phases: Array<Omit<JourneyPhase, 'id'>>;
      };

      // Stamp ids on the variant's own phase objects so they're
      // independent of any other variant (and of Model.journeyPhases
      // until/unless this variant is activated).
      const stamped: JourneyPhase[] = data.phases.map((p, i) => ({
        ...p,
        id: uuidv4(),
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

  const activate = (variant: HypothesisVariant) => {
    if (variant.isActive) return;
    const hasDownstream =
      (model.demandSpaces?.length || 0) +
        (model.circumstances?.length || 0) >
      0;
    if (hasDownstream) {
      const ok = confirm(
        `Activating "${variant.label}" will replace the current journey phases. Demand spaces and circumstances tied to the previous landscape will be orphaned. Continue?`
      );
      if (!ok) return;
    }
    onActivateVariant(variant.id);
  };

  const currentFingerprintByBlend = useMemo(() => {
    const map = new Map<HypothesisBlend, string>();
    for (const blend of ALL_BLENDS) {
      map.set(blend, buildBlendedContext(model, blend).sourceFingerprint);
    }
    return map;
  }, [model]);

  return (
    <div
      className="px-5 py-2 border-b flex items-center gap-3 overflow-x-auto"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      <div
        className="text-[9px] font-black uppercase tracking-widest flex-shrink-0"
        style={{ color: 'var(--fg-3)' }}
      >
        Hypothesis variants
      </div>

      {variants.length === 0 ? (
        <div className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
          None yet — generate a variant to compare evidence layers.
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
                title={`${BLEND_LABEL[blend]} · ${variant.journeyPhases.length} phases · ${
                  isStale ? 'stale (inputs changed since generation)' : 'up to date'
                }`}
              >
                <button
                  type="button"
                  onClick={() => activate(variant)}
                  className="flex items-center gap-1.5"
                  disabled={isRunning}
                >
                  {isActive ? <Check size={11} /> : null}
                  {BLEND_LABEL[blend]}
                  <span
                    className="ml-1 text-[10px] font-medium opacity-80"
                  >
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
                    <Sparkles size={11} />
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
          disabled={generation.status === 'running' || !apiKey}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            opacity: generation.status === 'running' || !apiKey ? 0.5 : 1,
          }}
        >
          {generation.status === 'running' ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Generating{' '}
              {BLEND_LABEL[generation.blend]}…
            </>
          ) : (
            <>
              <Sparkles size={11} /> Generate variant <ChevronDown size={11} />
            </>
          )}
        </button>
        {pickerOpen && pickerRect && typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={pickerRef}
              className="fixed rounded-lg shadow-lg overflow-hidden min-w-[220px]"
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
                        : blend === 'brief-only'
                        ? 'Upload a brief on the home page to enable.'
                        : blend === 'research-only'
                        ? 'Add research documents on the Research step to enable.'
                        : blend === 'form+research'
                        ? 'Needs both form fields and research documents.'
                        : 'Needs a brief or research documents.'
                    }
                  >
                    <span>{BLEND_LABEL[blend]}</span>
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

function blendSourcesHint(blend: HypothesisBlend): string {
  switch (blend) {
    case 'form-only':
      return 'form';
    case 'brief-only':
      return 'brief';
    case 'research-only':
      return 'research';
    case 'form+research':
      return 'form + research';
    case 'everything':
      return 'form + brief + research';
  }
}
