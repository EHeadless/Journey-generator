'use client';

import { useState } from 'react';
import { DemandSpace, JourneyPhase, Circumstance } from '@/lib/types';
import { useStore } from '@/lib/store';

interface Props {
  demandSpace: DemandSpace;
  journeyPhase: JourneyPhase;
  onGenerateCircumstances?: () => void;
  isGeneratingCircumstances?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

/**
 * Standalone demand-space card used by JourneyPhaseCard. The main
 * workspace (`app/model/[id]/page.tsx`) has its own inline card; this
 * one is the library component for places that need a self-contained
 * editable view. It renders the 5 Circumstances as stacked blocks
 * with axis chips, narrative, and Struggle / Progress sub-panels.
 */
export default function DemandSpaceCard({
  demandSpace,
  onGenerateCircumstances,
  isGeneratingCircumstances,
  isExpanded = false,
  onToggle,
}: Props) {
  const {
    model,
    updateDemandSpace,
    deleteDemandSpace,
    updateCircumstance,
    deleteCircumstance,
    addCircumstance,
  } = useStore();

  const [editingField, setEditingField] =
    useState<'label' | 'jobToBeDone' | null>(null);
  const [editing, setEditing] =
    useState<{ id: string; field: keyof Circumstance } | null>(null);

  const circumstances = (model?.circumstances ?? [])
    .filter((c) => c.demandSpaceId === demandSpace.id)
    .sort((a, b) => a.order - b.order);

  const handleFieldChange = (field: 'label' | 'jobToBeDone', value: string) => {
    updateDemandSpace(demandSpace.id, { [field]: value });
  };

  const axisColor: Record<string, string> = {
    knowledge: '#60a5fa',
    intent: '#fbbf24',
    composition: '#a78bfa',
    constraint: '#fb7185',
    moment: '#34d399',
  };
  const axisKeys: Array<keyof Circumstance> = [
    'knowledge',
    'intent',
    'composition',
    'constraint',
    'moment',
  ];

  return (
    <div className="border border-[#555] rounded-xl bg-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-start justify-between cursor-pointer hover:bg-[#333]"
        onClick={() => onToggle?.()}
      >
        <div className="flex-1 min-w-0">
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
              onClick={(e) => {
                e.stopPropagation();
                setEditingField('label');
              }}
              className="font-bold text-white cursor-pointer hover:text-[#b8c3ff] transition-colors text-base"
            >
              {demandSpace.label || (
                <span className="text-[#777] italic font-normal">
                  Click to add label...
                </span>
              )}
            </h4>
          )}

          <p className="mt-1 text-sm text-[#9ca3af] line-clamp-2">
            {demandSpace.jobToBeDone || 'No JTBD defined'}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={`text-sm px-2.5 py-1 rounded-full ${
                circumstances.length > 0
                  ? 'bg-[#2e5bff]/20 text-[#b8c3ff]'
                  : 'bg-[#444] text-[#888]'
              }`}
            >
              {circumstances.length} circumstance
              {circumstances.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="p-2 text-[#999] hover:text-white transition-colors rounded-lg hover:bg-[#444]"
          >
            <svg
              className={`w-5 h-5 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteDemandSpace(demandSpace.id);
            }}
            className="p-2 text-[#999] hover:text-[#ffb4ab] transition-colors rounded-lg hover:bg-[#444]"
            title="Delete"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#555] pt-4">
          {/* JTBD */}
          <div>
            <label className="text-sm text-[#9ca3af] uppercase tracking-wider block mb-2">
              Job to Be Done
            </label>
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
                  <span className="italic text-[#777]">
                    Click to add JTBD statement...
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Circumstances */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#9ca3af] uppercase tracking-wider">
                Circumstances
              </label>
              <div className="flex gap-2">
                {circumstances.length < 5 && (
                  <button
                    onClick={() => addCircumstance(demandSpace.id)}
                    className="text-sm px-3 py-1.5 rounded bg-[#353535] hover:bg-[#444] text-white transition-colors"
                  >
                    + Add
                  </button>
                )}
                {onGenerateCircumstances && (
                  <button
                    onClick={onGenerateCircumstances}
                    disabled={isGeneratingCircumstances}
                    className={`text-sm px-3 py-1.5 rounded font-medium transition-all ${
                      isGeneratingCircumstances
                        ? 'bg-[#2e5bff]/30 text-[#b8c3ff] cursor-wait'
                        : 'bg-[#2e5bff] text-white hover:brightness-110'
                    }`}
                  >
                    {isGeneratingCircumstances ? '...' : 'Generate'}
                  </button>
                )}
              </div>
            </div>

            {circumstances.length === 0 ? (
              <p className="text-sm text-[#888] italic">
                No circumstances yet. Generate or add manually.
              </p>
            ) : (
              <div className="space-y-3">
                {circumstances.map((c, idx) => (
                  <div
                    key={c.id}
                    className="bg-[#353535] rounded-lg border border-[#555] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#888] uppercase tracking-wider">
                        Circumstance {idx + 1}
                      </span>
                      <button
                        onClick={() => deleteCircumstance(c.id)}
                        className="p-1 text-[#888] hover:text-[#ffb4ab] transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>

                    {/* Axis chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {axisKeys.map((axis) => {
                        const isEditing =
                          editing?.id === c.id && editing.field === axis;
                        const val = String(c[axis] ?? '');
                        const color = axisColor[axis as string];
                        return isEditing ? (
                          <input
                            key={axis as string}
                            type="text"
                            value={val}
                            autoFocus
                            onChange={(e) =>
                              updateCircumstance(c.id, { [axis]: e.target.value })
                            }
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) =>
                              e.key === 'Enter' && setEditing(null)
                            }
                            className="text-xs px-2 py-1 rounded bg-[#1b1b1b] border border-[#2e5bff] text-white outline-none w-32"
                          />
                        ) : (
                          <span
                            key={axis as string}
                            onClick={() => setEditing({ id: c.id, field: axis })}
                            className="text-xs px-2 py-0.5 rounded-md cursor-pointer border"
                            style={{
                              background: `${color}22`,
                              borderColor: `${color}55`,
                              color,
                            }}
                          >
                            <span className="opacity-70 mr-1 capitalize">
                              {String(axis)}:
                            </span>
                            {val || (
                              <span className="italic opacity-60">—</span>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    {/* Narrative */}
                    <p className="text-sm text-[#ddd] leading-snug">
                      <span className="text-[#888]">When I am </span>
                      <EditableInline
                        value={c.context}
                        onChange={(v) => updateCircumstance(c.id, { context: v })}
                      />
                      <span className="text-[#888]">, I want to </span>
                      <EditableInline
                        value={c.action}
                        onChange={(v) => updateCircumstance(c.id, { action: v })}
                      />
                      <span className="text-[#888]">, so that </span>
                      <EditableInline
                        value={c.outcome}
                        onChange={(v) => updateCircumstance(c.id, { outcome: v })}
                      />
                      <span className="text-[#888]">.</span>
                    </p>

                    {/* Struggle & Progress */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-md border border-[#7f1d1d] bg-[#7f1d1d]/20 p-2">
                        <div className="text-[10px] uppercase tracking-widest text-[#fca5a5] font-semibold mb-0.5">
                          Struggle
                        </div>
                        <EditableBlock
                          value={c.struggle}
                          onChange={(v) =>
                            updateCircumstance(c.id, { struggle: v })
                          }
                          className="text-xs text-[#fecaca]"
                        />
                      </div>
                      <div className="rounded-md border border-[#064e3b] bg-[#064e3b]/20 p-2">
                        <div className="text-[10px] uppercase tracking-widest text-[#6ee7b7] font-semibold mb-0.5">
                          Progress
                        </div>
                        <EditableBlock
                          value={c.progress}
                          onChange={(v) =>
                            updateCircumstance(c.id, { progress: v })
                          }
                          className="text-xs text-[#bbf7d0]"
                        />
                      </div>
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

function EditableInline({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        type="text"
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
        className="text-sm bg-[#1b1b1b] border border-[#2e5bff] rounded px-1.5 py-0.5 text-white outline-none"
        style={{ minWidth: 80 }}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className="font-semibold text-white cursor-pointer hover:underline"
    >
      {value || <span className="italic text-[#777]">click to edit</span>}
    </span>
  );
}

function EditableBlock({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <textarea
        value={value}
        autoFocus
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="text-xs bg-[#1b1b1b] border border-[#2e5bff] rounded px-1.5 py-1 text-white outline-none w-full resize-none"
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      className={`${className} cursor-pointer leading-snug`}
    >
      {value || <span className="italic opacity-60">click to edit</span>}
    </div>
  );
}
