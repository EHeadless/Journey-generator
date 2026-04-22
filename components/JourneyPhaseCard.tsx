'use client';

import { useState } from 'react';
import { JourneyPhase, DemandSpace } from '@/lib/types';
import { useStore } from '@/lib/store';
import DemandSpaceCard from './DemandSpaceCard';

interface Props {
  phase: JourneyPhase;
  demandSpaces: DemandSpace[];
  onGenerateDemandSpaces: () => void;
  onGenerateCircumstances: (demandSpaceId: string) => void;
  isGenerating: boolean;
  isGeneratingCircumstances: Record<string, boolean>;
}

export default function JourneyPhaseCard({
  phase,
  demandSpaces,
  onGenerateDemandSpaces,
  onGenerateCircumstances,
  isGenerating,
  isGeneratingCircumstances,
}: Props) {
  const { updateJourneyPhase, deleteJourneyPhase, addDemandSpace } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingField, setEditingField] = useState<'label' | 'description' | 'trigger' | null>(null);

  const handleFieldChange = (field: 'label' | 'description' | 'trigger', value: string) => {
    updateJourneyPhase(phase.id, { [field]: value });
  };

  const handleDelete = () => {
    if (demandSpaces.length > 0) {
      if (!confirm(`This will also delete ${demandSpaces.length} demand spaces. Continue?`)) {
        return;
      }
    }
    deleteJourneyPhase(phase.id);
  };

  return (
    <div className="border border-[#434656]/20 rounded-xl bg-[#1b1b1b] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[#434656]/10 bg-[#1f1f1f]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Label */}
            {editingField === 'label' ? (
              <input
                type="text"
                value={phase.label}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                autoFocus
                className="text-lg font-bold bg-[#2a2a2a] border border-[#2e5bff] rounded-lg px-3 py-2 text-[#e2e2e2] w-full outline-none"
              />
            ) : (
              <h3
                onClick={() => setEditingField('label')}
                className="text-lg font-bold text-[#e2e2e2] cursor-pointer hover:text-[#b8c3ff] transition-colors"
              >
                {phase.label || <span className="text-[#c4c5d9]/30 italic font-normal">Click to add label...</span>}
              </h3>
            )}

            {/* Description */}
            {editingField === 'description' ? (
              <textarea
                value={phase.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                onBlur={() => setEditingField(null)}
                autoFocus
                rows={2}
                className="mt-2 text-sm bg-[#2a2a2a] border border-[#2e5bff] rounded-lg px-3 py-2 text-[#c4c5d9] w-full outline-none resize-none"
              />
            ) : (
              <p
                onClick={() => setEditingField('description')}
                className="mt-1 text-sm text-[#c4c5d9]/60 cursor-pointer hover:text-[#c4c5d9] transition-colors"
              >
                {phase.description || <span className="italic">Click to add description...</span>}
              </p>
            )}

            {/* Trigger */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-[#c4c5d9]/40 uppercase tracking-wider">Trigger:</span>
              {editingField === 'trigger' ? (
                <input
                  type="text"
                  value={phase.trigger}
                  onChange={(e) => handleFieldChange('trigger', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  autoFocus
                  className="text-xs bg-[#2a2a2a] border border-[#2e5bff] rounded px-2 py-1 text-[#c4c5d9] flex-1 outline-none"
                />
              ) : (
                <span
                  onClick={() => setEditingField('trigger')}
                  className="text-xs text-[#c4c5d9]/50 cursor-pointer hover:text-[#c4c5d9] transition-colors"
                >
                  {phase.trigger || <span className="italic">Click to add trigger...</span>}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-[#c4c5d9]/40 hover:text-[#e2e2e2] transition-colors rounded-lg hover:bg-[#2a2a2a]"
            >
              <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-[#c4c5d9]/40 hover:text-[#ffb4ab] transition-colors rounded-lg hover:bg-[#2a2a2a]"
              title="Delete phase"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Demand Spaces */}
      {isExpanded && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-[#c4c5d9]/60">
              Step 2: Demand Spaces
              <span className="ml-2 font-normal">({demandSpaces.length})</span>
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => addDemandSpace(phase.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#2a2a2a] border border-[#434656]/30 text-[#c4c5d9] hover:border-[#434656] transition-colors"
              >
                + Add
              </button>
              <button
                onClick={onGenerateDemandSpaces}
                disabled={isGenerating}
                className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all ${
                  isGenerating
                    ? 'bg-[#2e5bff]/30 text-[#b8c3ff] cursor-wait'
                    : 'bg-[#2e5bff] text-white hover:brightness-110'
                }`}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
          <p className="text-xs text-[#c4c5d9]/30 mb-4">
            Human motivations (Jobs to Be Done) — life progress they want to make, not features.
          </p>

          {demandSpaces.length === 0 ? (
            <div className="text-center py-10 text-[#c4c5d9]/30 text-sm border border-dashed border-[#434656]/20 rounded-lg">
              No demand spaces yet. Click Generate to create them.
            </div>
          ) : (
            <div className="space-y-3">
              {demandSpaces
                .sort((a, b) => a.order - b.order)
                .map((ds) => (
                  <DemandSpaceCard
                    key={ds.id}
                    demandSpace={ds}
                    journeyPhase={phase}
                    onGenerateCircumstances={() => onGenerateCircumstances(ds.id)}
                    isGeneratingCircumstances={isGeneratingCircumstances[ds.id]}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
