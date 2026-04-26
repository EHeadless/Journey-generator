'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { useTheme } from '@/lib/hooks/useTheme';
import { useApiKey } from '@/lib/hooks/useApiKey';
import { useUnsavedWorkWarning } from '@/lib/hooks/useUnsavedWorkWarning';
import { TweaksPanel } from './TweaksPanel';
import { ToolsRail } from './ToolsRail';

export type AppHeaderVersionTone = 'hypothesis' | 'evidenced';

interface AppHeaderProps {
  modelId?: string;
  signalsCount?: number;
  hasDiscoveryBundle?: boolean;
  hasJourneyPhases?: boolean;
  /**
   * True when at least one classified problem exists in the capture
   * store for this model. Gates the Informed Landscape step (#7).
   * Pages that mount this header read it via `useHasDiagnostics(modelId)`
   * from the capture store and thread it through.
   */
  hasDiagnostics?: boolean;
  currentStep?: 'brief' | 'research' | 'hypothesis-landscape' | 'discovery' | 'definition' | 'plan' | 'capture' | 'diagnostics' | 'informed-landscape' | 'signals' | 'review' | 'evidenced-landscape';
}

/**
 * Shared application header with 8-step progress. Used across all pages
 * (Brief, Workspace, Discovery, Definition, Capture, Signals, Review) for consistent navigation.
 */
export function AppHeader({
  modelId = '',
  signalsCount = 0,
  hasDiscoveryBundle = false,
  hasJourneyPhases = false,
  hasDiagnostics = false,
  currentStep,
}: AppHeaderProps) {
  const [theme, setTheme] = useTheme();
  const [apiKey, setApiKey] = useApiKey();
  const [tweaksOpen, setTweaksOpen] = useState(false);
  useUnsavedWorkWarning();

  const STEPS = [
    { label: 'Brief', step: 'brief', route: '/' },
    { label: 'Research', step: 'research', route: modelId ? `/model/${modelId}/research` : '/' },
    { label: 'Hypothesis Landscape', step: 'hypothesis-landscape', route: modelId ? `/model/${modelId}` : '/' },
    { label: 'Discovery', step: 'discovery', route: modelId ? `/model/${modelId}/discovery` : '/' },
    { label: 'Capture', step: 'capture', route: modelId ? `/model/${modelId}/capture` : '/' },
    { label: 'Problem Diagnostics', step: 'diagnostics', route: modelId ? `/model/${modelId}/diagnostics` : '/' },
    { label: 'Informed Landscape', step: 'informed-landscape', route: modelId ? `/model/${modelId}/informed-landscape` : '/' },
    { label: 'Definition', step: 'definition', route: modelId ? `/model/${modelId}/definition` : '/' },
    { label: 'Signals', step: 'signals', route: modelId ? `/model/${modelId}/signals` : '/' },
    { label: 'Review', step: 'review', route: modelId ? `/model/${modelId}/review` : '/' },
    { label: 'Evidenced Landscape', step: 'evidenced-landscape', route: modelId ? `/model/${modelId}` : '/' },
  ];

  // Use passed currentStep if provided, otherwise infer from state
  const activeStep = currentStep || (!modelId ? 'brief' : hasDiscoveryBundle ? 'evidenced-landscape' : 'hypothesis-landscape');
  const currentIndex = STEPS.findIndex(s => s.step === activeStep);

  // Determine if a step is enabled
  const isStepEnabled = (step: string) => {
    if (step === 'brief') return true;
    if (step === 'research') return !!modelId;
    if (step === 'hypothesis-landscape') return true;
    if (step === 'discovery') return hasJourneyPhases;
    if (step === 'definition') return hasJourneyPhases;
    if (step === 'plan') return hasJourneyPhases; // backwards compatibility
    if (step === 'capture') return hasJourneyPhases;
    if (step === 'diagnostics') return hasJourneyPhases;
    if (step === 'informed-landscape') return hasJourneyPhases && hasDiagnostics;
    if (step === 'signals') return hasJourneyPhases;
    if (step === 'review') return signalsCount > 0;
    if (step === 'evidenced-landscape') return hasDiscoveryBundle;
    return false;
  };

  return (
    <>
      <header
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

        {/* 8-Step Progress */}
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
                    title={s.step === 'discovery' || s.step === 'definition' || s.step === 'plan' || s.step === 'diagnostics' ? 'Generate a journey first' : s.step === 'informed-landscape' ? (hasJourneyPhases ? 'Classify at least one problem on the Diagnostics step first' : 'Generate a journey first') : s.step === 'review' ? 'Extract signals first' : s.step === 'evidenced-landscape' ? 'Approve discovery bundle first' : ''}
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
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="bg-transparent text-[11px] w-16 outline-none"
              style={{ color: 'var(--fg-1)' }}
            />
          </div>
          <button
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-2)] hover:text-[var(--accent)] transition-colors"
            onClick={() => setTweaksOpen(true)}
          >
            <SlidersHorizontal size={12} /> TWEAKS
          </button>
        </div>
      </header>

      <TweaksPanel
        open={tweaksOpen}
        onClose={() => setTweaksOpen(false)}
        theme={theme}
        setTheme={setTheme}
      />

      <ToolsRail />
    </>
  );
}
