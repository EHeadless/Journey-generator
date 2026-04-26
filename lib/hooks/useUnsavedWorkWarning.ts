'use client';

/**
 * Warn the user before closing the tab if any background work is
 * in flight — uploads, parsing, chunking, embedding, LLM generation.
 * All of it happens client-side, so closing the tab kills the work
 * and (for LLM calls) wastes tokens that have already been spent.
 */

import { useEffect } from 'react';
import { useStore } from '../store';
import { useCaptureStore } from '../captureStore';

export function useUnsavedWorkWarning() {
  // Subscribe to every flight-relevant flag so React re-runs the effect
  // when any of them changes and the listener closes over fresh state.
  const captureInFlight = useCaptureStore((s) => s.inFlightJobs);
  const isGeneratingPhases = useStore((s) => s.isGeneratingPhases);
  const isGeneratingPersonaMappings = useStore((s) => s.isGeneratingPersonaMappings);
  const isGeneratingDemandSpaces = useStore((s) => s.isGeneratingDemandSpaces);
  const isGeneratingCircumstances = useStore((s) => s.isGeneratingCircumstances);
  const isGeneratingActivations = useStore((s) => s.isGeneratingActivations);

  const anyGenerating =
    isGeneratingPhases ||
    isGeneratingPersonaMappings ||
    Object.values(isGeneratingDemandSpaces).some(Boolean) ||
    Object.values(isGeneratingCircumstances).some(Boolean) ||
    Object.values(isGeneratingActivations).some(Boolean);

  const shouldWarn = captureInFlight > 0 || anyGenerating;

  useEffect(() => {
    if (!shouldWarn) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Modern browsers ignore the returned string but require a truthy
      // return (or preventDefault) to show their generic prompt.
      e.returnValue = '';
      return '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldWarn]);
}
