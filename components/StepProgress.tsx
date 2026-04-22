'use client';

import Link from 'next/link';
import { ConsultancyStep } from '@/lib/types';

interface StepConfig {
  key: ConsultancyStep;
  label: string;
  route: (modelId: string) => string;
}

const STEPS: StepConfig[] = [
  { key: 'brief', label: 'Brief', route: () => `/new` },
  {
    // Internal step key stays `plan` for backwards compatibility with any
    // persisted model.currentStep values; only the user-facing label
    // changes. The page under /model/[id]/plan hosts both Discovery and
    // Definition workshop sections.
    key: 'plan',
    label: 'Discovery & Definition',
    route: (id) => `/model/${id}/plan`,
  },
  { key: 'capture', label: 'Capture', route: (id) => `/model/${id}/capture` },
  { key: 'signals', label: 'Signals', route: (id) => `/model/${id}/signals` },
  { key: 'review', label: 'Review', route: (id) => `/model/${id}/review` },
  { key: 'landscape', label: 'Landscape', route: (id) => `/model/${id}` },
];

interface StepProgressProps {
  currentStep: ConsultancyStep;
  modelId: string;
  signalsCount?: number;
  hasDiscoveryBundle?: boolean;
}

export function StepProgress({
  currentStep,
  modelId,
  signalsCount = 0,
  hasDiscoveryBundle = false,
}: StepProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  const isStepDisabled = (step: ConsultancyStep) => {
    if (step === 'review' && signalsCount === 0) return true;
    if (step === 'landscape' && !hasDiscoveryBundle) return true;
    return false;
  };

  return (
    <div
      className="glass-header"
      style={{ borderBottom: '1px solid var(--border-1)' }}
    >
      <div className="max-w-7xl mx-auto px-8 py-3">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.key === currentStep;
            const isPast = index < currentIndex;
            const isDisabled = isStepDisabled(step.key);

            const dotStyle: React.CSSProperties = isActive
              ? {
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }
              : isPast
              ? {
                  background: 'var(--bg-4)',
                  color: 'var(--fg-1)',
                }
              : {
                  background: 'var(--bg-3)',
                  color: 'var(--fg-3)',
                };

            const labelStyle: React.CSSProperties = isActive
              ? { color: 'var(--fg-1)', fontWeight: 600 }
              : isPast
              ? { color: 'var(--fg-2)' }
              : { color: 'var(--fg-3)' };

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex items-center flex-1">
                  {isDisabled ? (
                    <div
                      className="flex items-center gap-2.5"
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{
                          background: 'var(--bg-3)',
                          color: 'var(--fg-3)',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {index + 1}
                      </div>
                      <span
                        className="text-sm"
                        style={{ color: 'var(--fg-3)' }}
                      >
                        {step.label}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={step.route(modelId)}
                      className="flex items-center gap-2.5 transition-all hover:opacity-80"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                          ...dotStyle,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm" style={labelStyle}>
                        {step.label}
                      </span>
                    </Link>
                  )}
                </div>

                {/* Connector */}
                {index < STEPS.length - 1 && (
                  <div
                    className="h-px flex-1 mx-3"
                    style={{
                      background: isPast
                        ? 'var(--border-2)'
                        : 'var(--border-1)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
