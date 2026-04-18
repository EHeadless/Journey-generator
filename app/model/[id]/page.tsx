'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import DemandSpaceCard from '@/components/DemandSpaceCard';
import Toast from '@/components/Toast';

export default function Workspace() {
  const params = useParams();
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const phaseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const {
    model,
    isGeneratingPhases,
    isGeneratingDemandSpaces,
    isGeneratingDimensions,
    setJourneyPhases,
    setDemandSpaces,
    setDimensions,
    addJourneyPhase,
    addDemandSpace,
    updateJourneyPhase,
    deleteJourneyPhase,
    setGeneratingPhases,
    setGeneratingDemandSpaces,
    setGeneratingDimensions,
  } = useStore();

  const [error, setError] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('openai-api-key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('openai-api-key', key);
    } else {
      localStorage.removeItem('openai-api-key');
    }
  };

  // Expand all cards and collapse all helper functions
  const expandAll = () => {
    if (model) {
      setExpandedCards(new Set(model.demandSpaces.map(ds => ds.id)));
    }
  };

  const collapseAll = () => {
    setExpandedCards(new Set());
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Redirect if no model
  useEffect(() => {
    if (!model || model.id !== params.id) {
      router.push('/');
    }
  }, [model, params.id, router]);

  // Auto-generate demand spaces for phases that don't have them
  useEffect(() => {
    if (!model || !apiKey) return;

    model.journeyPhases.forEach((phase) => {
      const phaseDemandSpaces = model.demandSpaces.filter((ds) => ds.journeyPhaseId === phase.id);
      if (phaseDemandSpaces.length === 0 && !isGeneratingDemandSpaces[phase.id]) {
        handleGenerateDemandSpaces(phase.id);
      }
    });
  }, [model?.journeyPhases.length, apiKey]);

  // Auto-generate dimensions for demand spaces that don't have them
  useEffect(() => {
    if (!model || !apiKey) return;

    model.demandSpaces.forEach((ds) => {
      const dsDimensions = model.dimensions.filter((d) => d.demandSpaceId === ds.id);
      if (dsDimensions.length === 0 && !isGeneratingDimensions[ds.id]) {
        handleGenerateDimensions(ds.id);
      }
    });
  }, [model?.demandSpaces.length, apiKey]);

  // Check if any generation is in progress (moved up for auto-expand logic)
  const isAnyGenerating =
    isGeneratingPhases ||
    Object.values(isGeneratingDemandSpaces).some(Boolean) ||
    Object.values(isGeneratingDimensions).some(Boolean);


  if (!model) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="text-[#c4c5d9]/50">Loading...</div>
      </div>
    );
  }

  const handleGeneratePhases = async () => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key');
      return;
    }

    setError(null);
    setGeneratingPhases(true);

    try {
      const response = await fetch('/api/generate-journey-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...model.input, apiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate journey phases');
      }

      const data = await response.json();
      setJourneyPhases(data.journeyPhases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingPhases(false);
    }
  };

  const handleGenerateDemandSpaces = async (phaseId: string) => {
    const phase = model.journeyPhases.find((p) => p.id === phaseId);
    if (!phase || !apiKey) return;

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
  };

  const handleGenerateDimensions = async (demandSpaceId: string) => {
    const demandSpace = model.demandSpaces.find((ds) => ds.id === demandSpaceId);
    if (!demandSpace || !apiKey) return;

    const phase = model.journeyPhases.find((p) => p.id === demandSpace.journeyPhaseId);
    if (!phase) return;

    setError(null);
    setGeneratingDimensions(demandSpaceId, true);

    try {
      const response = await fetch('/api/generate-dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: model.input,
          journeyPhase: phase,
          demandSpace: demandSpace,
          apiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate dimensions');
      }

      const data = await response.json();
      setDimensions(demandSpaceId, data.dimensions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingDimensions(demandSpaceId, false);
    }
  };

  const scrollToPhase = (phaseId: string) => {
    const phaseEl = phaseRefs.current[phaseId];
    if (phaseEl && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: phaseEl.offsetLeft - 32,
        behavior: 'smooth',
      });
    }
  };

  const getDemandSpacesForPhase = (phaseId: string) => {
    return model.demandSpaces.filter((ds) => ds.journeyPhaseId === phaseId);
  };

  const getDimensionsForPhase = (phaseId: string) => {
    const demandSpaceIds = getDemandSpacesForPhase(phaseId).map(ds => ds.id);
    return model.dimensions.filter(d => demandSpaceIds.includes(d.demandSpaceId));
  };

  const totalDemandSpaces = model.demandSpaces.length;
  const totalDimensions = model.dimensions.length;
  const totalValues = model.dimensions.reduce((sum, d) => sum + d.values.length, 0);

  const experienceConfig = {
    marketing: { color: '#2e5bff', label: 'Marketing' },
    product: { color: '#4ade80', label: 'Product' },
    service: { color: '#a855f7', label: 'Service' },
  }[model.input.experienceType];

  return (
    <div className="min-h-screen bg-[#131313]">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-header flex justify-between items-center px-8 h-16 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-xl font-bold tracking-tighter text-[#E2E2E2] hover:text-[#b8c3ff] transition-colors"
          >
            Journey Generator
          </button>
          <span className="text-[#555]">|</span>
          <span className="text-sm font-medium text-[#a1a1aa]">
            {model.input.industry}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs uppercase tracking-[0.15em] font-bold px-3 py-1 rounded-full"
            style={{ color: experienceConfig.color, backgroundColor: `${experienceConfig.color}20` }}
          >
            {experienceConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9ca3af] uppercase tracking-wider">OpenAI Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="w-36 px-2 py-1.5 text-sm bg-[#2a2a2a] border border-[#555] rounded text-white placeholder-[#666] outline-none focus:border-[#2e5bff]"
            />
          </div>
          {isAnyGenerating && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-[#2e5bff]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[#b8c3ff] text-sm">Generating</span>
            </div>
          )}
        </div>
      </header>

      <main className="pt-20 pb-16">
        {/* Page Header */}
        <section className="px-8 py-6 border-b border-[#434656]/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Demand Landscape</h1>
              <p className="text-sm text-[#9ca3af]">
                Each phase contains demand spaces (JTBD) with dimensions and values
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addJourneyPhase}
                className="text-sm px-4 py-2 rounded-lg bg-[#1b1b1b] border border-[#555] text-white hover:border-[#777] transition-colors"
              >
                + Add Phase
              </button>
              <button
                onClick={handleGeneratePhases}
                disabled={isGeneratingPhases}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-all ${
                  isGeneratingPhases
                    ? 'bg-[#2e5bff]/30 text-[#b8c3ff] cursor-wait'
                    : 'bg-[#2e5bff] text-white hover:brightness-110'
                }`}
              >
                {isGeneratingPhases ? 'Generating...' : model.journeyPhases.length > 0 ? 'Regenerate Phases' : 'Generate Phases'}
              </button>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="px-8 py-3 border-b border-[#434656]/10 bg-[#1b1b1b]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {totalDemandSpaces > 0 && (
                <>
                  <button
                    onClick={expandAll}
                    className="text-xs px-3 py-1.5 rounded bg-[#2a2a2a] border border-[#555] text-white hover:border-[#777] transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="text-xs px-3 py-1.5 rounded bg-[#2a2a2a] border border-[#555] text-white hover:border-[#777] transition-colors"
                  >
                    Collapse All
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-8 text-base">
              {isAnyGenerating && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin text-[#2e5bff]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[#b8c3ff] text-sm">Generating...</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{model.journeyPhases.length}</span>
                <span className="text-[#9ca3af]">phases</span>
              </div>
              <div className="text-[#555]">|</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#4ade80]">{totalDemandSpaces}</span>
                <span className="text-[#9ca3af]">demand spaces</span>
              </div>
              <div className="text-[#555]">|</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#b8c3ff]">{totalDimensions}</span>
                <span className="text-[#9ca3af]">dimensions</span>
              </div>
              <div className="text-[#555]">|</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#d8b4fe]">{totalValues}</span>
                <span className="text-[#9ca3af]">values</span>
              </div>
            </div>
            <div className="w-[140px]"></div> {/* Spacer for balance */}
          </div>
        </section>

        {/* Phase Navigation Pills */}
        {model.journeyPhases.length > 0 && (
          <section className="px-8 py-3 border-b border-[#434656]/10 bg-[#1b1b1b]/50 sticky top-16 z-40">
            <div className="flex gap-2 overflow-x-auto">
              {model.journeyPhases
                .sort((a, b) => a.order - b.order)
                .map((phase, index) => {
                  const phaseDemandSpaces = getDemandSpacesForPhase(phase.id);
                  return (
                    <button
                      key={phase.id}
                      onClick={() => scrollToPhase(phase.id)}
                      className="flex-shrink-0 px-4 py-2.5 rounded-lg bg-[#2a2a2a] border border-[#555] hover:border-[#2e5bff] transition-colors text-base"
                    >
                      <span className="text-[#2e5bff] font-bold mr-2">{index + 1}</span>
                      <span className="text-white">{phase.label || 'Unnamed'}</span>
                      <span className="ml-2 text-[#4ade80] text-sm">({phaseDemandSpaces.length})</span>
                    </button>
                  );
                })}
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="px-8 pt-6">
            <div className="p-4 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded-xl text-[#ffb4ab] text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Horizontal Scrolling Phases */}
        {model.journeyPhases.length === 0 ? (
          <div className="px-8 py-16">
            <div className="text-center py-16 border-2 border-dashed border-[#555] rounded-xl bg-[#1b1b1b]/50">
              <p className="text-[#9ca3af] mb-4 text-base">No journey phases yet</p>
              <button
                onClick={handleGeneratePhases}
                disabled={isGeneratingPhases}
                className="text-base px-6 py-2.5 rounded-lg bg-[#2e5bff] text-white hover:brightness-110 transition-all font-medium"
              >
                Generate Journey Phases
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto px-8 py-6 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#434656 #1b1b1b' }}
          >
            {model.journeyPhases
              .sort((a, b) => a.order - b.order)
              .map((phase, index) => {
                const phaseDemandSpaces = getDemandSpacesForPhase(phase.id);
                const phaseDimensions = getDimensionsForPhase(phase.id);
                const phaseValues = phaseDimensions.reduce((sum, d) => sum + d.values.length, 0);
                const isGenerating = isGeneratingDemandSpaces[phase.id];

                return (
                  <div
                    key={phase.id}
                    ref={(el) => { phaseRefs.current[phase.id] = el; }}
                    className="flex-shrink-0 w-[400px] snap-start"
                  >
                    <div className="rounded-xl border border-[#434656]/30 bg-[#1b1b1b] overflow-hidden h-full">
                      {/* Phase Header */}
                      <div className="p-4 border-b border-[#434656]/20 bg-[#1f1f1f]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2e5bff] text-white flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              {editingPhase === phase.id ? (
                                <input
                                  type="text"
                                  value={phase.label}
                                  onChange={(e) => updateJourneyPhase(phase.id, { label: e.target.value })}
                                  onBlur={() => setEditingPhase(null)}
                                  onKeyDown={(e) => e.key === 'Enter' && setEditingPhase(null)}
                                  autoFocus
                                  className="text-base font-bold bg-[#2a2a2a] border border-[#2e5bff] rounded px-2 py-1 text-[#e2e2e2] outline-none w-full"
                                />
                              ) : (
                                <h3
                                  className="text-base font-bold text-[#e2e2e2] cursor-pointer hover:text-[#b8c3ff]"
                                  onClick={() => setEditingPhase(phase.id)}
                                >
                                  {phase.label || 'Unnamed Phase'}
                                </h3>
                              )}
                              {phase.trigger && (
                                <p className="text-xs text-[#9ca3af] mt-0.5">
                                  Trigger: {phase.trigger}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteJourneyPhase(phase.id)}
                            className="p-1.5 text-[#c4c5d9]/20 hover:text-[#ffb4ab] transition-colors rounded hover:bg-[#353535]"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-3 mt-3 text-sm">
                          <span className={phaseDemandSpaces.length > 0 ? 'text-[#4ade80]' : 'text-[#777]'}>
                            {phaseDemandSpaces.length} demand spaces
                          </span>
                          <span className="text-[#555]">•</span>
                          <span className={phaseDimensions.length > 0 ? 'text-[#b8c3ff]' : 'text-[#777]'}>
                            {phaseDimensions.length} dimensions
                          </span>
                          <span className="text-[#555]">•</span>
                          <span className={phaseValues > 0 ? 'text-[#d8b4fe]' : 'text-[#777]'}>
                            {phaseValues} values
                          </span>
                        </div>
                      </div>

                      {/* Demand Spaces */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-[#9ca3af] uppercase tracking-wider">
                            Demand Spaces
                          </h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => addDemandSpace(phase.id)}
                              className="text-xs px-2.5 py-1.5 rounded bg-[#2a2a2a] border border-[#555] text-white hover:border-[#777] transition-colors"
                            >
                              + Add
                            </button>
                            <button
                              onClick={() => handleGenerateDemandSpaces(phase.id)}
                              disabled={isGenerating}
                              className={`text-xs px-2.5 py-1.5 rounded font-medium transition-all ${
                                isGenerating
                                  ? 'bg-[#2e5bff]/30 text-[#b8c3ff] cursor-wait'
                                  : 'bg-[#2e5bff] text-white hover:brightness-110'
                              }`}
                            >
                              {isGenerating ? '...' : 'Regen'}
                            </button>
                          </div>
                        </div>

                        {isGenerating && phaseDemandSpaces.length === 0 ? (
                          <div className="text-center py-8 border border-dashed border-[#555] rounded-lg">
                            <p className="text-[#b8c3ff] text-base">Generating...</p>
                          </div>
                        ) : phaseDemandSpaces.length === 0 ? (
                          <div className="text-center py-8 border border-dashed border-[#555] rounded-lg">
                            <p className="text-[#9ca3af] text-sm">No demand spaces yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                            {phaseDemandSpaces
                              .sort((a, b) => a.order - b.order)
                              .map((ds) => (
                                <DemandSpaceCard
                                  key={ds.id}
                                  demandSpace={ds}
                                  journeyPhase={phase}
                                  onGenerateDimensions={() => handleGenerateDimensions(ds.id)}
                                  isGeneratingDimensions={isGeneratingDimensions[ds.id]}
                                  isExpanded={expandedCards.has(ds.id)}
                                  onToggle={() => toggleCard(ds.id)}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

      </main>

      <Toast />
    </div>
  );
}
