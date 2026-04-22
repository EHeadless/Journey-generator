'use client';

/**
 * ToolsRail — fixed-position rail pinned to the right edge of the viewport.
 * Visible on every page that renders AppHeader.
 *
 * Layout:
 *   [ panel area (expanded only) ][ icon column (always visible) ]
 *         264 px                         56 px
 *
 * Collapsed width = 56 px (icons only).
 * Expanded width  = 320 px (icons + panel content).
 *
 * Icons (one per panel):
 *   • Journey — shows version stack; selected by default.
 *   • AI      — placeholder chat surface.
 *
 * State is owned by useToolsRail (localStorage-backed) so every page shares
 * the same rail state.
 */

import { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layers, Sparkles, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  useToolsRail,
  useSyncRailWidthToCssVar,
  ToolsRailPanel,
  RAIL_COLLAPSED_PX,
  RAIL_EXPANDED_PX,
} from '@/lib/hooks/useToolsRail';

// --- Icon button -------------------------------------------------------
function RailIconButton({
  panel,
  active,
  label,
  children,
  onClick,
}: {
  panel: ToolsRailPanel;
  active: boolean;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-panel={panel}
      className="flex items-center justify-center rounded-[10px] transition-colors"
      style={{
        width: 40,
        height: 40,
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--fg-2)',
        border: active
          ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)'
          : '1px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

// --- Journey versions panel -------------------------------------------
function JourneyPanel() {
  const model = useStore((s) => s.model);
  const router = useRouter();
  const pathname = usePathname();

  // For this release we synthesize a single v1 entry from the current
  // model. Versioning proper lands later, when new snapshots are taken
  // as the engagement progresses through discovery steps. For now v1
  // *is* the current state — Zustand's persist middleware keeps it in
  // localStorage across reloads.
  const versions = useMemo(() => {
    if (!model) return [];
    const hasLandscape =
      (model.journeyPhases?.length ?? 0) > 0 ||
      (model.demandSpaces?.length ?? 0) > 0;
    return [
      {
        id: 'v1',
        label: 'v1',
        caption: hasLandscape ? 'from brief · saved' : 'no landscape yet',
        selected: true,
      },
    ];
  }, [model]);

  // Clicking a version loads the landscape at that version. Today v1 *is*
  // the current landscape so we just jump back to the workspace — giving
  // the user a visible "take me to the saved landscape" affordance even
  // from pages deep in the consultancy flow (Plan, Capture, Signals…).
  const handleVersionClick = (versionId: string) => {
    if (!model) return;
    if (versionId === 'v1') {
      const target = `/model/${model.id}`;
      if (pathname !== target) router.push(target);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--fg-2)' }}
        >
          Journey versions
        </div>
        <div
          className="text-[11px] mt-1"
          style={{ color: 'var(--fg-2)', opacity: 0.8 }}
        >
          Each version captures the landscape at a point in time. v1 is
          the live landscape — edits save straight into it.
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => handleVersionClick(v.id)}
            title={
              v.id === 'v1'
                ? 'Open the saved landscape (v1). Edits you make on the workspace stay in v1.'
                : undefined
            }
            className="w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
            style={{
              background: v.selected ? 'var(--accent-soft)' : 'var(--bg-2)',
              border: v.selected
                ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)'
                : '1px solid var(--border-1)',
              color: 'var(--fg-1)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: v.selected ? 'var(--accent)' : 'var(--fg-3)',
                  }}
                />
                <span className="text-sm font-semibold">{v.label}</span>
              </div>
              {v.selected && (
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: 'var(--accent)' }}
                >
                  current
                </span>
              )}
            </div>
            <div
              className="text-[11px] mt-1"
              style={{ color: 'var(--fg-2)' }}
            >
              {v.caption}
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 pt-1 pb-4">
        <p
          className="text-[11px] leading-snug"
          style={{ color: 'var(--fg-2)', opacity: 0.85 }}
        >
          Later versions will appear here as the engagement progresses
          through discovery steps.
        </p>
      </div>
    </div>
  );
}

// --- AI panel (stub) ---------------------------------------------------
function AIPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--fg-2)' }}
        >
          AI assistant
        </div>
        <div
          className="text-[11px] mt-1"
          style={{ color: 'var(--fg-2)', opacity: 0.8 }}
        >
          Ask questions about this model.
        </div>
      </div>

      <div className="flex-1 px-4 pt-2 pb-3 overflow-auto">
        <div
          className="rounded-lg p-4 text-[12px] leading-relaxed"
          style={{
            background: 'var(--bg-2)',
            border: '1px dashed var(--border-1)',
            color: 'var(--fg-2)',
          }}
        >
          Coming soon — this panel will let you ask questions about any
          journey phase, demand space, or workshop in the current model.
        </div>
      </div>

      <div className="px-3 pb-3">
        <div
          className="rounded-lg px-3 py-2 text-[12px] flex items-center"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-3)',
            opacity: 0.7,
          }}
        >
          Send a message…
        </div>
      </div>
    </div>
  );
}

// --- Rail --------------------------------------------------------------
export function ToolsRail() {
  useSyncRailWidthToCssVar();
  const { open, panel, setPanel, toggle } = useToolsRail();

  const widthPx = open ? RAIL_EXPANDED_PX : RAIL_COLLAPSED_PX;

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 z-40 flex"
      style={{
        width: widthPx,
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border-1)',
        boxShadow: open ? 'var(--shadow-lg)' : 'none',
        transition:
          'width 200ms ease, box-shadow 200ms ease',
      }}
      aria-label="Versions and tools"
    >
      {/* Expanded panel content */}
      <div
        className="overflow-hidden"
        style={{
          width: open ? RAIL_EXPANDED_PX - RAIL_COLLAPSED_PX : 0,
          borderRight: open ? '1px solid var(--border-1)' : 'none',
          transition: 'width 200ms ease',
        }}
      >
        <div style={{ width: RAIL_EXPANDED_PX - RAIL_COLLAPSED_PX, height: '100%' }}>
          {panel === 'journey' ? <JourneyPanel /> : <AIPanel />}
        </div>
      </div>

      {/* Icon column */}
      <div
        className="flex flex-col items-center gap-2 py-3"
        style={{ width: RAIL_COLLAPSED_PX }}
      >
        <button
          type="button"
          onClick={toggle}
          title={open ? 'Collapse' : 'Expand'}
          aria-label={open ? 'Collapse tools rail' : 'Expand tools rail'}
          className="flex items-center justify-center rounded-[10px] transition-colors"
          style={{
            width: 40,
            height: 40,
            color: 'var(--fg-2)',
          }}
        >
          {open ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>

        <div
          style={{
            height: 1,
            width: 28,
            background: 'var(--border-1)',
            margin: '4px 0',
          }}
        />

        <RailIconButton
          panel="journey"
          active={panel === 'journey'}
          label="Journey versions"
          onClick={() => setPanel('journey')}
        >
          <Layers size={18} />
        </RailIconButton>
        <RailIconButton
          panel="ai"
          active={panel === 'ai'}
          label="AI assistant"
          onClick={() => setPanel('ai')}
        >
          <Sparkles size={18} />
        </RailIconButton>
      </div>
    </aside>
  );
}
