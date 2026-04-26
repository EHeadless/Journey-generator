'use client';

/**
 * Problem Diagnostics page.
 *
 * Hosts the diagnostic graphs (donut, frequency × impact matrix, journey
 * canvas) and the editable problem table + narrative report. Users land
 * here automatically after confirming findings on the Capture flow's
 * Review tab — the panel auto-runs the dedupe → promote → classify
 * pipeline once on mount via the `autoRun` prop, so by the time the user
 * sees this page, the report is rendering itself.
 *
 * Multi-journey support: a model can have several journeys (Arrival /
 * Transit / Departure, etc.). The switcher tabs at the top of the page
 * scope the visualization, narrative, and table to the active journey
 * — same UX pattern as the hypothesis landscape variant bar. Pipeline
 * runs (classify, narrative) operate on the underlying full data set,
 * but the on-screen view is always journey-filtered.
 *
 * Re-runs and narrative regeneration stay on this page; the diff modal
 * for re-classification still opens here when the model has manual edits.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useApiKey } from '@/lib/hooks/useApiKey';
import { useUnsavedWorkWarning } from '@/lib/hooks/useUnsavedWorkWarning';
import { useHydratedCaptureStore } from '@/components/capture/CaptureWorkshopCard';
import { useHasDiagnostics } from '@/lib/captureStore';
import { AppHeader } from '@/components/AppHeader';
import { ProblemDiagnosticsPanel } from '@/components/capture/ProblemDiagnosticsPanel';

export default function DiagnosticsPage() {
  const params = useParams();
  const router = useRouter();
  const model = useStore((s) => s.model);
  const [apiKey] = useApiKey();

  useUnsavedWorkWarning();
  useHydratedCaptureStore((params.id as string) || '');
  const hasDiagnostics = useHasDiagnostics((params.id as string) || '');

  useEffect(() => {
    if (!model || model.id !== params.id) {
      router.push('/');
    }
  }, [model, params.id, router]);

  // Sorted journeys for the switcher tabs. Falls back to a single-tab
  // synthetic "All phases" entry when the model has no `journeys` array
  // (legacy single-journey models still render correctly).
  const journeys = useMemo(() => {
    const list = [...(model?.journeys ?? [])].sort(
      (a, b) => a.order - b.order
    );
    return list;
  }, [model?.journeys]);

  // Active journey id. Initial pick: first journey by order. Stays
  // stable across renders unless the user switches tabs. If the model
  // has zero journeys, we leave this null and the panel renders every
  // phase (legacy behavior).
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(
    null
  );

  // Default to the first journey once the model hydrates. Only runs
  // when journeys load and we haven't picked yet — prevents clobbering
  // a user-selected tab on subsequent renders.
  useEffect(() => {
    if (activeJourneyId) return;
    if (journeys.length === 0) return;
    setActiveJourneyId(journeys[0].id);
  }, [journeys, activeJourneyId]);

  if (!model) return null;

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      <div className="sticky top-0 z-50">
        <AppHeader
          modelId={model.id}
          signalsCount={model.signals?.length || 0}
          hasDiscoveryBundle={!!model.discoveryBundle}
          hasJourneyPhases={model.journeyPhases.length > 0}
          hasDiagnostics={hasDiagnostics}
          currentStep="diagnostics"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--fg-1)' }}>
                Problem Diagnostics
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--fg-2)' }}>
                Classified into 8 disciplines, scored by Frequency × Impact,
                and mapped onto journey phases. Edit any row to override the
                classification — your edits are preserved across re-runs.
              </p>
            </div>
          </div>

          {/* Journey switcher — one tab per top-level journey on the
              model. Mirrors the hypothesis landscape's variant bar. */}
          {journeys.length > 1 && (
            <div
              className="mb-6 flex items-center gap-1 border-b overflow-x-auto scrollbar-hide"
              style={{ borderColor: 'var(--border-1)' }}
            >
              {journeys.map((j) => {
                const active = activeJourneyId === j.id;
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setActiveJourneyId(j.id)}
                    className="relative px-4 py-2 text-sm font-semibold transition-opacity"
                    style={{
                      background: active ? 'var(--bg-1)' : 'transparent',
                      color: 'var(--fg-1)',
                      borderBottom: active
                        ? '2px solid var(--accent)'
                        : '2px solid transparent',
                      opacity: active ? 1 : 0.6,
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                    }}
                    title={j.jtbdBlueprint || j.name}
                  >
                    {j.name}
                  </button>
                );
              })}
            </div>
          )}

          <ProblemDiagnosticsPanel
            modelId={model.id}
            apiKey={apiKey}
            activeJourneyId={activeJourneyId ?? undefined}
            onNavigateToReview={() => router.push(`/model/${model.id}/capture`)}
          />
        </div>
      </div>
    </div>
  );
}
