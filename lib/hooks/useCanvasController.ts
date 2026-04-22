'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface CanvasView {
  x: number;
  y: number;
  s: number;
}

/**
 * Pan / zoom controller for the workspace canvas.
 *
 * **Why this is imperative-first.**
 * The naive approach — call `setView` on every mouse-move and let React
 * re-render the tree each RAF — made the workspace feel sluggish and
 * produced a visible "ghost" during pan: the old frame of phase columns,
 * demand-space cards, personas, etc. stayed painted for a frame while the
 * new React tree reconciled and repainted. Even with RAF throttling, a
 * workspace-wide re-render per pan frame is too heavy.
 *
 * We solve it by keeping pan/zoom state in a ref (`viewRef`) and writing
 * the transform directly onto a DOM node (`transformRef`) on every mouse-
 * move / wheel event. React state (`view`) is only updated on idle — the
 * transform element itself never waits for React. Consumers that need to
 * read the current view (Minimap, ZoomControls, fit-to-viewport) still
 * see a reasonably up-to-date `view`, but they don't gate the pan smooth-
 * ness anymore.
 */
export function useCanvasController(initial: CanvasView = { x: 60, y: 0, s: 1 }) {
  const [view, setView] = useState<CanvasView>(initial);
  // Live, authoritative view — always up-to-date, even mid-drag.
  const viewRef = useRef<CanvasView>(initial);

  const containerRef = useRef<HTMLDivElement>(null);
  // The DOM node whose `transform` we paint on every frame. Consumers
  // attach this ref to the element that wraps the panned content (the
  // one with translate3d + scale).
  const transformRef = useRef<HTMLDivElement>(null);

  const spaceDown = useRef(false);
  const dragging = useRef(false);
  const drag0 = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const rafId = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Write the transform directly onto the pan element. We batch with RAF
  // so multiple pointer events within a single frame collapse to one
  // style write, but we *never* go through React state for this.
  const applyTransform = useCallback(() => {
    rafId.current = null;
    const el = transformRef.current;
    if (!el) return;
    const v = viewRef.current;
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`;
  }, []);

  const scheduleApply = useCallback(() => {
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(applyTransform);
  }, [applyTransform]);

  // Debounced commit back to React state so Minimap, ZoomControls, fit-
  // to-viewport, and any persistence can read the current view. We wait
  // a tick after the last pointer event; during active dragging the
  // transform element is already up to date via applyTransform().
  const scheduleCommit = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      setView({ ...viewRef.current });
    }, 90);
  }, []);

  const setViewInternal = useCallback(
    (next: CanvasView | ((prev: CanvasView) => CanvasView), { commit = true } = {}) => {
      const resolved =
        typeof next === 'function' ? next(viewRef.current) : next;
      viewRef.current = resolved;
      scheduleApply();
      if (commit) scheduleCommit();
    },
    [scheduleApply, scheduleCommit]
  );

  // Cleanup RAF + idle timer on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Whenever external code (zoom buttons, fit, minimap navigate) commits
  // a view through setState, mirror it to the ref + DOM so the source of
  // truth stays consistent. Also covers initial mount.
  useEffect(() => {
    viewRef.current = view;
    const el = transformRef.current;
    if (el) {
      el.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`;
    }
  }, [view]);

  // Keyboard: space = pan mode, cmd+0/+/- = zoom
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && !spaceDown.current) {
        spaceDown.current = true;
        document.body.style.cursor = 'grab';
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        setViewInternal((v) => ({ ...v, s: 1 }));
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        setViewInternal((v) => ({ ...v, s: Math.min(2.5, v.s * 1.15) }));
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        setViewInternal((v) => ({ ...v, s: Math.max(0.2, v.s / 1.15) }));
        e.preventDefault();
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (!dragging.current) document.body.style.cursor = '';
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [setViewInternal]);

  // Wheel: zoom (ctrl/cmd) or pan. Passive: false so we can preventDefault.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cur = viewRef.current;
        const delta = -e.deltaY * 0.0015;
        const next = Math.max(0.2, Math.min(2.5, cur.s * (1 + delta)));
        const scale = next / cur.s;
        const nx = mx - (mx - cur.x) * scale;
        const ny = my - (my - cur.y) * scale;
        setViewInternal({ x: nx, y: ny, s: next });
      } else {
        e.preventDefault();
        const cur = viewRef.current;
        setViewInternal({ ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setViewInternal]);

  // Drag (space-held or middle mouse). Pointer-move writes to the DOM
  // imperatively; React state catches up on idle.
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || spaceDown.current) {
      dragging.current = true;
      const v = viewRef.current;
      drag0.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current || !drag0.current) return;
      const d = drag0.current;
      // During drag we skip committing to React state every frame — we
      // only commit once the drag ends. This keeps the rest of the
      // workspace tree from re-rendering 60× per second.
      setViewInternal(
        { x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y), s: viewRef.current.s },
        { commit: false }
      );
    },
    [setViewInternal]
  );

  const onMouseUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      // Commit final view so Minimap / persistence see it.
      setView({ ...viewRef.current });
    }
    document.body.style.cursor = spaceDown.current ? 'grab' : '';
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const cur = viewRef.current;
    const next = Math.max(0.2, Math.min(2.5, cur.s * factor));
    const scale = next / cur.s;
    setViewInternal({ x: mx - (mx - cur.x) * scale, y: my - (my - cur.y) * scale, s: next });
  }, [setViewInternal]);

  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy]);

  const zoomTo = useCallback((s: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const cur = viewRef.current;
    const scale = s / cur.s;
    setViewInternal({ x: mx - (mx - cur.x) * scale, y: my - (my - cur.y) * scale, s });
  }, [setViewInternal]);

  const fit = useCallback((worldW: number, worldH: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const padX = 80;
    const padY = 120;
    const sx = (rect.width - padX * 2) / worldW;
    const sy = (rect.height - padY * 2) / worldH;
    const s = Math.min(sx, sy, 1);
    setViewInternal({ x: (rect.width - worldW * s) / 2, y: padY, s });
  }, [setViewInternal]);

  return useMemo(
    () => ({
      view,
      setView,
      containerRef,
      transformRef,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      zoomIn,
      zoomOut,
      zoomTo,
      fit,
    }),
    [view, onMouseDown, onMouseMove, onMouseUp, zoomIn, zoomOut, zoomTo, fit]
  );
}
