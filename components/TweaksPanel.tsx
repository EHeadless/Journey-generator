'use client';

import { X } from 'lucide-react';
import type { ThemeConfig } from '@/lib/hooks/useTheme';

interface TweaksPanelProps {
  open: boolean;
  onClose: () => void;
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
}

function TweaksRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 items-center py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-widest text-[var(--fg-3)]">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TweaksSeg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 p-0.5 bg-[var(--bg-3)] border border-[var(--border-1)] rounded-[10px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="py-1.5 px-2.5 rounded-[7px] border-none cursor-pointer text-xs font-medium transition-all"
          style={{
            background: value === o.value ? 'var(--bg-1)' : 'transparent',
            color: value === o.value ? 'var(--fg-1)' : 'var(--fg-2)',
            boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Shared Tweaks drawer — theme + canvas background controls.
 * Used by the Landscape workspace and by every consultancy step page (Plan,
 * Capture, Signals, Review) so the whole product shares one look-and-feel
 * panel.
 */
export function TweaksPanel({ open, onClose, theme, setTheme }: TweaksPanelProps) {
  if (!open) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[80] bg-black/20" />
      <aside
        className="fixed right-4 top-16 bottom-4 z-[90] w-80 bg-[var(--bg-1)] border border-[var(--border-1)] rounded-[14px] p-4 overflow-auto"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Tweaks</div>
          <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <TweaksRow label="Mode">
          <TweaksSeg
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'editorial', label: 'Editorial' },
              { value: 'ei', label: 'EI' },
            ]}
            value={theme.theme}
            onChange={(v) => setTheme({ ...theme, theme: v as ThemeConfig['theme'] })}
          />
        </TweaksRow>
        <TweaksRow label="Canvas">
          <TweaksSeg
            options={[
              { value: 'dots', label: 'Dots' },
              { value: 'grid', label: 'Grid' },
              { value: 'plain', label: 'Plain' },
            ]}
            value={theme.bg}
            onChange={(v) => setTheme({ ...theme, bg: v as ThemeConfig['bg'] })}
          />
        </TweaksRow>
      </aside>
    </>
  );
}
