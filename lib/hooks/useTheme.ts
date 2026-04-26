'use client';

import { useState, useEffect } from 'react';

export interface ThemeConfig {
  theme: 'dark' | 'editorial' | 'ei';
  density: 'compact' | 'comfy' | 'spacious';
  bg: 'dots' | 'grid' | 'plain';
  accent: string | null;
  typography: 'geist' | 'inter' | 'serif';
}

const DEFAULT_THEME: ThemeConfig = {
  theme: 'dark',
  density: 'comfy',
  bg: 'dots',
  accent: null,
  typography: 'inter',
};

function applyTheme(t: ThemeConfig) {
  if (typeof document === 'undefined') return;

  const r = document.documentElement;
  r.setAttribute('data-theme', t.theme);
  r.setAttribute('data-density', t.density);
  r.setAttribute('data-bg', t.bg);

  if (t.accent) {
    r.style.setProperty('--accent', t.accent);
  } else {
    r.style.removeProperty('--accent');
  }

  const families: Record<string, string> = {
    geist: "'Geist', 'Inter', system-ui, sans-serif",
    inter: "'Inter', system-ui, sans-serif",
    serif: "'Fraunces', Georgia, serif",
  };

  r.style.setProperty('--font-display', families[t.typography] || families.inter);
  r.style.setProperty(
    '--font-sans',
    t.typography === 'serif' ? "'Inter', system-ui, sans-serif" : families[t.typography] || families.inter
  );
}

export function useTheme(): [ThemeConfig, (t: ThemeConfig) => void] {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;

    try {
      const raw = localStorage.getItem('jg.theme');
      if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) };
    } catch (e) {
      // ignore
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem('jg.theme', JSON.stringify(theme));
    } catch (e) {
      // ignore
    }
  }, [theme]);

  return [theme, setTheme];
}
