'use client';

import { useState } from 'react';
import { DemandSpace, JourneyPhase } from '@/lib/types';
import { useStore } from '@/lib/store';

interface Props {
  demandSpace: DemandSpace;
  journeyPhase: JourneyPhase;
  onGenerateDimensions?: () => void;
  isGeneratingDimensions?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function DemandSpaceCard({ demandSpace, journeyPhase, onGenerateDimensions, isGeneratingDimensions, isExpanded = false, onToggle }: Props) {
  const {
    model,
    updateDemandSpace,
    deleteDemandSpace,
    updateDimension,
    deleteDimension,
    addDimension,
    updateDimensionValue,
    deleteDimensionValue,
    addDimensionValue,
  } = useStore();
  const [editingField, setEditingField] = useState<'label' | 'jobToBeDone' | null>(null);
  const [editingDimension, setEditingDimension] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  // Get dimensions for this demand space
  const dimensions = model?.dimensions.filter(d => d.demandSpaceId === demandSpace.id) || [];
  const totalValues = dimensions.reduce((sum, d) => sum + d.values.length, 0);

  const handleFieldChange = (
    field: 'label' | 'jobToBeDone',
    value: string
  ) => {
    updateDemandSpace(demandSpace.id, { [field]: value });
  };

  const handleDelete = () => {
    deleteDemandSpace(demandSpace.id);
  };

  return (
    <div className="border border-[#555] rounded-xl bg-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-start justify-between cursor-pointer hover:bg-[#333]"
        onClick={handleToggle}
      >
        <div className="flex-1 min-w-0">
          {/* Label */}
          {editingField === 'label' ? (
            <input
              type="text"
              value={demandSpace.label}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="font-medium bg-[#353535] border border-[#2e5bff] rounded-lg px-3 py-2 text-white w-full outline-none text-base"
            />
          ) : (
            <h4
              onClick={(e) => { e.stopPropagation(); setEditingField('label'); }}
              className="font-bold text-white cursor-pointer hover:text-[#b8c3ff] transition-colors text-base"
            >
              {demandSpace.label || (
                <span className="text-[#777] italic font-normal">Click to add label...</span>
              )}
            </h4>
          )}

          {/* Job to Be Done */}
          <p className="mt-1 text-sm text-[#9ca3af] line-clamp-2">
            {demandSpace.jobToBeDone || 'No JTBD defined'}
          </p>

          {/* Dimension count badges */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-sm px-2.5 py-1 rounded-full ${dimensions.length > 0 ? 'bg-[#2e5bff]/20 text-[#b8c3ff]' : 'bg-[#444] text-[#888]'}`}>
              {dimensions.length} dimension{dimensions.length !== 1 ? 's' : ''}
            </span>
            <span className={`text-sm px-2.5 py-1 rounded-full ${totalValues > 0 ? 'bg-[#a855f7]/20 text-[#d8b4fe]' : 'bg-[#444] text-[#888]'}`}>
              {totalValues} value{totalValues !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle(); }}
            className="p-2 text-[#999] hover:text-white transition-colors rounded-lg hover:bg-[#444]"
          >
            <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="p-2 text-[#999] hover:text-[#ffb4ab] transition-colors rounded-lg hover:bg-[#444]"
            title="Delete"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#555] pt-4">
          {/* Job to Be Done (editable) */}
          <div>
            <label className="text-sm text-[#9ca3af] uppercase tracking-wider block mb-2">Job to Be Done</label>
            {editingField === 'jobToBeDone' ? (
              <textarea
                value={demandSpace.jobToBeDone}
                onChange={(e) => handleFieldChange('jobToBeDone', e.target.value)}
                onBlur={() => setEditingField(null)}
                autoFocus
                rows={2}
                placeholder="When I [situation], I want to [action], so that [outcome]"
                className="text-sm bg-[#353535] border border-[#2e5bff] rounded-lg px-3 py-2 text-white w-full outline-none resize-none"
              />
            ) : (
              <p
                onClick={() => setEditingField('jobToBeDone')}
                className="text-sm text-[#bbb] cursor-pointer hover:text-white transition-colors leading-relaxed"
              >
                {demandSpace.jobToBeDone || (
                  <span className="italic text-[#777]">Click to add JTBD statement...</span>
                )}
              </p>
            )}
          </div>

          {/* Dimensions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#9ca3af] uppercase tracking-wider">Dimensions</label>
              <div className="flex gap-2">
                <button
                  onClick={() => addDimension(demandSpace.id)}
                  className="text-sm px-3 py-1.5 rounded bg-[#353535] hover:bg-[#444] text-white transition-colors"
                >
                  + Add
                </button>
                {onGenerateDimensions && (
                  <button
                    onClick={onGenerateDimensions}
                    disabled={isGeneratingDimensions}
                    className={`text-sm px-3 py-1.5 rounded font-medium transition-all ${
                      isGeneratingDimensions
                        ? 'bg-[#2e5bff]/30 text-[#b8c3ff] cursor-wait'
                        : 'bg-[#2e5bff] text-white hover:brightness-110'
                    }`}
                  >
                    {isGeneratingDimensions ? '...' : 'Generate'}
                  </button>
                )}
              </div>
            </div>

            {dimensions.length === 0 ? (
              <p className="text-sm text-[#888] italic">No dimensions yet. Generate or add manually.</p>
            ) : (
              <div className="space-y-3">
                {dimensions.sort((a, b) => a.order - b.order).map((dimension) => (
                  <div key={dimension.id} className="bg-[#353535] rounded-lg border border-[#555] p-3">
                    {/* Dimension Header */}
                    <div className="flex items-start justify-between mb-2">
                      {editingDimension === dimension.id ? (
                        <input
                          type="text"
                          value={dimension.label}
                          onChange={(e) => updateDimension(dimension.id, { label: e.target.value })}
                          onBlur={() => setEditingDimension(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingDimension(null)}
                          autoFocus
                          placeholder="Dimension name..."
                          className="text-sm font-medium bg-[#2a2a2a] border border-[#2e5bff] rounded px-2 py-1 text-white outline-none flex-1"
                        />
                      ) : (
                        <div
                          onClick={() => setEditingDimension(dimension.id)}
                          className="cursor-pointer hover:text-[#b8c3ff] flex-1"
                        >
                          <span className="text-sm font-medium text-[#b8c3ff]">
                            {dimension.label || <span className="italic text-[#777]">Unnamed dimension</span>}
                          </span>
                          {dimension.description && (
                            <p className="text-xs text-[#9ca3af] mt-0.5">{dimension.description}</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => addDimensionValue(dimension.id)}
                          className="text-xs px-2 py-1 rounded bg-[#2a2a2a] hover:bg-[#444] text-white transition-colors"
                        >
                          + Value
                        </button>
                        <button
                          onClick={() => deleteDimension(dimension.id)}
                          className="p-1 text-[#888] hover:text-[#ffb4ab] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Dimension Values */}
                    <div className="flex flex-wrap gap-2">
                      {dimension.values.length === 0 ? (
                        <span className="text-sm text-[#888] italic">No values</span>
                      ) : (
                        dimension.values.sort((a, b) => a.order - b.order).map((value) => (
                          <div
                            key={value.id}
                            className="group flex items-center gap-1.5 bg-[#2a2a2a] rounded px-2.5 py-1.5 border border-[#555]"
                            title={value.description || value.impact}
                          >
                            {editingValue === value.id ? (
                              <input
                                type="text"
                                value={value.label}
                                onChange={(e) => updateDimensionValue(value.id, { label: e.target.value })}
                                onBlur={() => setEditingValue(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingValue(null)}
                                autoFocus
                                className="text-sm bg-[#1b1b1b] border border-[#2e5bff] rounded px-2 py-0.5 text-white outline-none w-24"
                              />
                            ) : (
                              <>
                                <span
                                  onClick={() => setEditingValue(value.id)}
                                  className="text-sm text-[#d8b4fe] cursor-pointer hover:text-[#e9d5ff]"
                                >
                                  {value.label || <span className="italic text-[#777]">Empty</span>}
                                </span>
                                <button
                                  onClick={() => deleteDimensionValue(value.id)}
                                  className="text-[#666] hover:text-[#ffb4ab] transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
