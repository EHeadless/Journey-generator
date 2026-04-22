'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useTheme } from '@/lib/hooks/useTheme';
import { useApiKey } from '@/lib/hooks/useApiKey';
import { useToolsRail } from '@/lib/hooks/useToolsRail';
import { TweaksPanel } from './TweaksPanel';
import { ToolsRail } from './ToolsRail';

export type AppHeaderVersionTone = 'hypothesis' | 'evidenced';

interface AppHeaderProps {
  /** Breadcrumb-style label after the "J" logo */
  left: string;
  /** Optional right-aligned slot for page-specific CTAs (AI, Refine, Export, …) */
  right?: React.ReactNode;
  /** Optional version pill (e.g., "v1 · from brief", "v2 · discovery-refined") */
  versionLabel?: string;
  versionTone?: AppHeaderVersionTone;
}

/**
 * Shared application header. Matches the Landscape workspace's visual identity
 * so every step (Plan, Capture, Signals, Review, Landscape) feels like the
 * same product:
 *   • J logo + page label
 *   • Optional version pill
 *   • Right-slot for page-specific CTAs
 *   • Shared OpenAI API-key input (synced across pages via useApiKey)
 *   • Tweaks drawer trigger
 *
 * Theme + API-key state are self-managed; host pages just drop this in.
 */
export function AppHeader({
  left,
  right,
  versionLabel,
  versionTone,
}: AppHeaderProps) {
  const [theme, setTheme] = useTheme();
  const [apiKey, setApiKey] = useApiKey();
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const { open: railOpen, toggle: toggleRail } = useToolsRail();

  return (
    <>
      <header
        className="sticky top-0 z-40 glass-header border-b border-[var(--border-1)] py-2.5 px-5 flex items-center gap-4"
      >
        <Link href="/" className="flex items-center gap-2 no-underline text-[var(--fg-1)]">
          <div className="w-6 h-6 rounded-[6px] bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center text-[13px] font-bold">
            J
          </div>
          <span className="text-sm font-semibold tracking-tight">Journey Generator</span>
        </Link>
        <span className="opacity-30">/</span>
        <span className="text-[13px] text-[var(--fg-2)]">{left}</span>

        {versionLabel && (
          <span
            className="chip"
            style={
              versionTone === 'evidenced'
                ? {
                    background:
                      'color-mix(in srgb, var(--success) 14%, transparent)',
                    color:
                      'color-mix(in srgb, var(--success) 80%, var(--fg-1))',
                    border:
                      '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
                  }
                : undefined
            }
          >
            {versionLabel}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--fg-3)] uppercase tracking-wider">
              OpenAI Key
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-36 px-2 py-1.5 text-sm bg-[var(--bg-2)] border border-[var(--border-1)] rounded-lg text-[var(--fg-1)] placeholder-[var(--fg-3)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          {right}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={toggleRail}
            title={railOpen ? 'Hide versions & tools' : 'Show versions & tools'}
            aria-label={railOpen ? 'Hide versions & tools' : 'Show versions & tools'}
            aria-pressed={railOpen}
          >
            {railOpen ? (
              <PanelRightClose size={14} />
            ) : (
              <PanelRightOpen size={14} />
            )}
            Versions
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setTweaksOpen(true)}
          >
            <SlidersHorizontal size={14} />
            Tweaks
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
