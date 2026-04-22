'use client';

/**
 * useToolsRail — global state for the right-edge Versions & Tools rail.
 *
 *   • open: boolean          — is the rail's panel area expanded?
 *   • panel: 'journey'|'ai'  — which panel is selected (icon highlighted)
 *
 * State persists in localStorage so the rail remembers the user's choice
 * across pages and reloads. Defaults to closed with `journey` pre-selected.
 *
 * Uses useSyncExternalStore so every consumer (header toggle, rail itself,
 * page wrappers that want to reserve rail width) stays in sync without
 * triggering re-renders on unrelated state changes.
 */

import { useSyncExternalStore, useCallback, useEffect } from 'react';

export type ToolsRailPanel = 'journey' | 'ai';

interface RailState {
  open: boolean;
  panel: ToolsRailPanel;
}

const LS_KEY = 'journey-generator.toolsRail';
const DEFAULT_STATE: RailState = { open: false, panel: 'journey' };

export const RAIL_COLLAPSED_PX = 56;
export const RAIL_EXPANDED_PX = 320;

function readFromStorage(): RailState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<RailState>;
    return {
      open: !!parsed.open,
      panel: parsed.panel === 'ai' ? 'ai' : 'journey',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeToStorage(s: RailState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}

// --- module-level store ------------------------------------------------
let memo: RailState = DEFAULT_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInit() {
  if (!initialized && typeof window !== 'undefined') {
    memo = readFromStorage();
    initialized = true;
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): RailState {
  ensureInit();
  return memo;
}

function getServerSnapshot(): RailState {
  return DEFAULT_STATE;
}

function setState(next: RailState) {
  memo = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}

// --- CSS variable side-effect ------------------------------------------
// One component mounts this effect and owns writing the width variable.
// Every page can simply consume `var(--jg-rail-w, 56px)` without needing
// to subscribe to the hook. Kept separate from the main hook so it only
// runs once.
export function useSyncRailWidthToCssVar() {
  const { open } = useToolsRail();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const w = open ? RAIL_EXPANDED_PX : RAIL_COLLAPSED_PX;
    document.documentElement.style.setProperty('--jg-rail-w', `${w}px`);
  }, [open]);
}

// --- public hook -------------------------------------------------------
export function useToolsRail() {
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setOpen = useCallback((open: boolean) => {
    setState({ ...memo, open });
  }, []);

  const toggle = useCallback(() => {
    setState({ ...memo, open: !memo.open });
  }, []);

  const setPanel = useCallback((panel: ToolsRailPanel) => {
    // Selecting an icon always opens the rail, even if it was collapsed.
    setState({ panel, open: true });
  }, []);

  return {
    open: state.open,
    panel: state.panel,
    setOpen,
    toggle,
    setPanel,
  };
}
