// Workspace canvas — hybrid pan & zoom
// - Horizontal phase rail locked at the top (always visible)
// - Demand space cards sit in vertical columns beneath each phase (free pan + zoom)
// - Right-side AI co-pilot panel
// - Bottom-right zoom controls + minimap + fit button

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ======== Variation registry ============================================
// Each variation is a distinct design system for the canvas.
// Key differences: card style, rail style, grouping, visual rhythm.
const VARIATIONS = [
  { id: 'v1', label: 'Linear rail',  desc: 'Columnar, calm, hierarchy via subtle bg' },
  { id: 'v2', label: 'Stacked',      desc: 'Compact cards, dense overview' },
  { id: 'v3', label: 'Editorial',    desc: 'Typographic, letter-numbered phases' },
];

// Tunables per variation
const VARIATION_STYLE = {
  v1: { colW: 360, cardW: 320, gap: 18, stackGap: 14, phasePad: 18 },
  v2: { colW: 280, cardW: 256, gap: 14, stackGap: 10, phasePad: 14 },
  v3: { colW: 420, cardW: 380, gap: 24, stackGap: 18, phasePad: 24 },
};

// ======== Canvas controller ============================================
// A <Canvas> wraps its children in a transform: translate(px,py) scale(s)
// and handles wheel-zoom (cmd/ctrl + wheel), pan-drag (space or middle mouse),
// trackpad two-finger pan, and pinch.
function useCanvasController(initial = { x: 60, y: 0, s: 1 }) {
  const [view, setView] = useState(initial);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const containerRef = useRef(null);
  const spaceDown = useRef(false);
  const dragging = useRef(false);
  const drag0 = useRef(null);

  // keyboard: space = pan mode
  useEffect(() => {
    const onDown = e => {
      if (e.code === 'Space' && !spaceDown.current && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        spaceDown.current = true;
        document.body.style.cursor = 'grab';
        e.preventDefault();
      }
      // cmd/ctrl + 0 = fit, + = zoom in, - = zoom out
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { setView(v => ({ ...v, s: 1 })); e.preventDefault(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { setView(v => ({ ...v, s: Math.min(2, v.s * 1.15) })); e.preventDefault(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { setView(v => ({ ...v, s: Math.max(0.2, v.s / 1.15) })); e.preventDefault(); }
    };
    const onUp = e => {
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
  }, []);

  // wheel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = e => {
      // Zoom on cmd/ctrl + wheel or pinch (deltaY w/ ctrlKey set by trackpad pinch)
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
        setView({ x: nx, y: ny, s: next });
      } else {
        // two-finger scroll = pan
        e.preventDefault();
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // drag (space-held or middle mouse)
  const onMouseDown = e => {
    if (e.button === 1 || spaceDown.current) {
      dragging.current = true;
      drag0.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    }
  };
  const onMouseMove = e => {
    if (!dragging.current) return;
    const d = drag0.current;
    setView(v => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  };
  const onMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = spaceDown.current ? 'grab' : '';
  };

  const zoomBy = (factor) => {
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    const cur = viewRef.current;
    const next = Math.max(0.2, Math.min(2.5, cur.s * factor));
    const scale = next / cur.s;
    setView({ x: mx - (mx - cur.x) * scale, y: my - (my - cur.y) * scale, s: next });
  };
  const zoomIn = () => zoomBy(1.2);
  const zoomOut = () => zoomBy(1 / 1.2);
  const zoomTo = (s) => {
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    const cur = viewRef.current;
    const scale = s / cur.s;
    setView({ x: mx - (mx - cur.x) * scale, y: my - (my - cur.y) * scale, s });
  };
  const fit = (worldW, worldH) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const padX = 80, padY = 120;
    const sx = (rect.width - padX * 2) / worldW;
    const sy = (rect.height - padY * 2) / worldH;
    const s = Math.min(sx, sy, 1);
    setView({ x: (rect.width - worldW * s) / 2, y: padY, s });
  };

  return {
    view, setView, containerRef,
    onMouseDown, onMouseMove, onMouseUp,
    zoomIn, zoomOut, zoomTo, fit,
  };
}

// ======== Demand Space Card ============================================
function DemandSpaceCard({ space, phase, variation, onOpenAI, selected, onSelect }) {
  const style = VARIATION_STYLE[variation];
  const cardW = style.cardW;
  const totalDims = space.dims.length;
  const totalVals = space.dims.reduce((s, d) => s + d.values.length, 0);

  // Variation-specific card
  if (variation === 'v2') {
    // COMPACT stacked
    return (
      <div
        onClick={onSelect}
        style={{
          width: cardW,
          background: 'var(--bg-2)',
          border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border-1)',
          borderRadius: 10,
          padding: 12,
          cursor: 'pointer',
          transition: 'border-color 120ms ease, transform 120ms ease',
          boxShadow: selected ? '0 8px 24px rgba(0,0,0,.18)' : 'none',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ font: '600 13px/1.2 var(--font-sans)', color: 'var(--fg-1)' }}>{space.label}</div>
          <button className="btn btn--icon btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); onOpenAI(space); }}><Icon name="sparkles" size={12} /></button>
        </div>
        <div style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--fg-2)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {space.jtbd}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {space.dims.slice(0, 3).map((d, i) => (
            <span key={i} className="chip" style={{ fontSize: 10, padding: '2px 7px' }}>{d.label}</span>
          ))}
          {space.dims.length > 3 && (
            <span className="chip chip--accent" style={{ fontSize: 10, padding: '2px 7px' }}>+{space.dims.length - 3}</span>
          )}
        </div>
      </div>
    );
  }

  if (variation === 'v3') {
    // EDITORIAL
    return (
      <div
        onClick={onSelect}
        style={{
          width: cardW,
          background: 'var(--bg-2)',
          border: selected ? '2px solid var(--accent)' : '1px solid var(--border-1)',
          borderRadius: 4,
          padding: 22,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ font: '500 10px/1 var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '.1em' }}>
            {phase.label.split(' ')[0].slice(0, 3).toUpperCase()}·{String(space.id.split('-')[1] || '1').padStart(2,'0')}
          </div>
          <button className="btn btn--icon btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); onOpenAI(space); }}><Icon name="sparkles" size={13} /></button>
        </div>
        <div style={{ font: '600 22px/1.15 var(--font-display)', letterSpacing: '-.015em', marginBottom: 10 }}>
          {space.label}
        </div>
        <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-2)', marginBottom: 16 }}>
          <span className="ital" style={{ color: 'var(--fg-1)' }}>"</span>{space.jtbd}<span className="ital" style={{ color: 'var(--fg-1)' }}>"</span>
        </div>
        <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 12 }}>
          <div style={{ font: '600 10px/1 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--fg-3)', marginBottom: 8 }}>
            {totalDims} dimensions · {totalVals} values
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {space.dims.map((d, i) => (
              <span key={i} style={{
                font: '500 11px/1.4 var(--font-sans)',
                color: 'var(--fg-2)', background: 'var(--bg-3)',
                padding: '3px 8px', borderRadius: 3,
              }}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // v1 — default LINEAR card
  return (
    <div
      onClick={onSelect}
      style={{
        width: cardW,
        background: 'var(--bg-2)',
        border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border-1)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow: selected ? '0 12px 28px rgba(0,0,0,.22)' : 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ font: '600 15px/1.25 var(--font-sans)', letterSpacing: '-.005em' }}>{space.label}</div>
        <button className="btn btn--icon btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); onOpenAI(space); }} title="Ask AI">
          <Icon name="sparkles" size={13} />
        </button>
      </div>
      <div style={{ font: '400 12px/1.45 var(--font-sans)', color: 'var(--fg-2)', marginBottom: 12 }}>
        {space.jtbd}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="chip chip--accent" style={{ fontSize: 11 }}>
          <Icon name="layers" size={11} /> {totalDims} dim
        </span>
        <span className="chip" style={{ fontSize: 11 }}>
          <Icon name="circle-dot" size={11} /> {totalVals} values
        </span>
      </div>
      <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {space.dims.slice(0, 4).map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 8, alignItems: 'start' }}>
            <div style={{ font: '500 10px/1.3 var(--font-sans)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', paddingTop: 3 }}>{d.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
              {d.values.slice(0, 3).map((v, j) => (
                <span key={j} style={{
                  font: '500 10px/1.4 var(--font-sans)',
                  padding: '3px 7px', borderRadius: 6,
                  background: 'var(--bg-3)', color: 'var(--fg-2)',
                  border: '1px solid var(--border-1)',
                  whiteSpace: 'nowrap',
                }}>{v}</span>
              ))}
              {d.values.length > 3 && (
                <span style={{ font: '500 10px/1.4 var(--font-sans)', color: 'var(--fg-3)', padding: '3px 4px' }}>+{d.values.length - 3}</span>
              )}
            </div>
          </div>
        ))}
        {space.dims.length > 4 && (
          <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--accent)', paddingLeft: 94 }}>
            + {space.dims.length - 4} more dimensions
          </div>
        )}
      </div>
    </div>
  );
}

// ======== Phase column (rail-tagged header + stack of spaces) ===========
function PhaseColumn({ phase, spaces, variation, onOpenAI, selected, setSelected, isActive, onActivate }) {
  const style = VARIATION_STYLE[variation];

  // Header treatment differs by variation
  const header = (() => {
    if (variation === 'v3') {
      return (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 14,
            borderBottom: `2px solid ${isActive ? 'var(--fg-1)' : 'var(--border-1)'}`,
            paddingBottom: 12, marginBottom: 4,
          }}>
            <div style={{
              font: '500 11px/1 var(--font-mono)',
              letterSpacing: '.16em', color: 'var(--fg-3)',
            }}>{String(phase.order).padStart(2, '0')}</div>
            <div style={{ font: '700 26px/1.1 var(--font-display)', letterSpacing: '-.02em', flex: 1 }}>
              {phase.label}
            </div>
          </div>
          <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)', marginTop: 8 }}>
            {phase.trigger}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ font: '600 11px/1 var(--font-mono)', color: 'var(--fg-3)' }}>
              <span style={{ color: 'var(--fg-1)' }}>{phase.counts.spaces}</span> spaces
            </span>
            <span style={{ font: '600 11px/1 var(--font-mono)', color: 'var(--fg-3)' }}>
              <span style={{ color: 'var(--fg-1)' }}>{phase.counts.dims}</span> dims
            </span>
            <span style={{ font: '600 11px/1 var(--font-mono)', color: 'var(--fg-3)' }}>
              <span style={{ color: 'var(--fg-1)' }}>{phase.counts.values}</span> vals
            </span>
          </div>
        </div>
      );
    }
    if (variation === 'v2') {
      return (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: phase.accent, color: '#fff',
              display: 'grid', placeItems: 'center',
              font: '700 11px/1 var(--font-sans)',
            }}>{phase.order}</div>
            <div style={{ font: '600 14px/1.2 var(--font-sans)', letterSpacing: '-.005em', flex: 1 }}>{phase.label}</div>
            <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--fg-3)' }}>{phase.counts.spaces}</span>
          </div>
        </div>
      );
    }
    // v1
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 6, height: 28, borderRadius: 3,
            background: phase.accent,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 15px/1.2 var(--font-sans)', letterSpacing: '-.005em' }}>{phase.label}</div>
            <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--fg-3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Phase {phase.order}
            </div>
          </div>
          <button className="btn btn--icon btn--ghost btn--sm"><Icon name="more-horizontal" size={14} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="chip" style={{ fontSize: 10 }}>{phase.counts.spaces} spaces</span>
          <span className="chip" style={{ fontSize: 10 }}>{phase.counts.dims} dims</span>
          <span className="chip" style={{ fontSize: 10 }}>{phase.counts.values} vals</span>
        </div>
      </div>
    );
  })();

  return (
    <div onClick={onActivate} style={{
      width: style.colW,
      flex: `0 0 ${style.colW}px`,
      padding: style.phasePad,
      borderRight: variation === 'v3' ? 'none' : '1px dashed var(--border-1)',
      position: 'relative',
    }}>
      {header}
      <div style={{ display: 'flex', flexDirection: 'column', gap: style.stackGap }}>
        {spaces.map(space => (
          <DemandSpaceCard
            key={space.id}
            space={space}
            phase={phase}
            variation={variation}
            onOpenAI={onOpenAI}
            selected={selected === space.id}
            onSelect={() => setSelected(space.id)}
          />
        ))}
        <button className="btn btn--ghost btn--sm" style={{
          border: '1px dashed var(--border-2)',
          color: 'var(--fg-3)',
          padding: '10px 12px',
          justifyContent: 'center',
          borderRadius: variation === 'v3' ? 4 : 10,
        }}>
          <Icon name="plus" size={14} />
          Add demand space
        </button>
      </div>
    </div>
  );
}

// ======== Top phase rail (sticky, outside canvas transform) ============
function PhaseRail({ phases, variation, activePhase, setActivePhase, onZoomToPhase, onRegenerate }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
      background: 'color-mix(in srgb, var(--bg-0) 92%, transparent)',
      backdropFilter: 'saturate(180%) blur(10px)',
      borderBottom: '1px solid var(--border-1)',
      padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Title block */}
        <div style={{ flex: '0 0 auto', minWidth: 200 }}>
          <div className="eyebrow eyebrow--accent">Workspace</div>
          <div style={{ font: '700 18px/1.2 var(--font-display)', letterSpacing: '-.01em', marginTop: 2 }}>
            Demand Landscape
          </div>
        </div>

        {/* Summary counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 20 }}>
          {[
            { label: 'Phases', value: phases.length, color: 'var(--fg-1)' },
            { label: 'Spaces', value: phases.reduce((s, p) => s + p.counts.spaces, 0), color: '#4ade80' },
            { label: 'Dimensions', value: phases.reduce((s, p) => s + p.counts.dims, 0), color: '#06b6d4' },
            { label: 'Values', value: phases.reduce((s, p) => s + p.counts.values, 0), color: '#a855f7' },
          ].map(x => (
            <div key={x.label}>
              <div style={{ font: '600 20px/1 var(--font-mono)', color: x.color }}>{x.value}</div>
              <div style={{ font: '500 10px/1 var(--font-sans)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>
                {x.label}
              </div>
            </div>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm"><Icon name="plus" size={13} /> Add phase</button>
          <button className="btn btn--primary btn--sm" onClick={onRegenerate}>
            <Icon name="sparkles" size={13} /> Regenerate
          </button>
        </div>
      </div>

      {/* Phase tabs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto' }}>
        {phases.map(p => {
          const active = activePhase === p.id;
          return (
            <button key={p.id} onClick={() => { setActivePhase(p.id); onZoomToPhase(p.id); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 12px',
              background: active ? 'var(--bg-2)' : 'transparent',
              border: active ? '1px solid var(--border-2)' : '1px solid var(--border-1)',
              borderRadius: 8, cursor: 'pointer',
              font: '500 12px/1 var(--font-sans)',
              color: 'var(--fg-1)',
              whiteSpace: 'nowrap',
              transition: 'background 120ms',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 5,
                background: p.accent, color: '#fff',
                display: 'grid', placeItems: 'center',
                font: '700 10px/1 var(--font-sans)',
              }}>{p.order}</span>
              {p.label}
              <span style={{ color: 'var(--fg-3)', font: '500 10px/1 var(--font-mono)' }}>{p.counts.spaces}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ======== Zoom / minimap controls (bottom-right floating) ==============
function ZoomControls({ view, zoomIn, zoomOut, zoomTo, fit, onFit }) {
  const pct = Math.round(view.s * 100);
  return (
    <div style={{
      position: 'absolute', right: 16, bottom: 16, zIndex: 30,
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-2)', border: '1px solid var(--border-1)',
      borderRadius: 10, padding: 4,
      boxShadow: 'var(--shadow-lg)',
    }}>
      <button className="btn btn--icon btn--ghost btn--sm" onClick={zoomOut} title="Zoom out (⌘−)"><Icon name="minus" size={14} /></button>
      <button className="btn btn--ghost btn--sm" onClick={() => zoomTo(1)} style={{ minWidth: 56, justifyContent: 'center' }}>
        {pct}%
      </button>
      <button className="btn btn--icon btn--ghost btn--sm" onClick={zoomIn} title="Zoom in (⌘+)"><Icon name="plus" size={14} /></button>
      <div style={{ width: 1, height: 20, background: 'var(--border-1)', margin: '0 2px' }} />
      <button className="btn btn--icon btn--ghost btn--sm" onClick={onFit} title="Fit to screen (⌘0)"><Icon name="maximize" size={14} /></button>
    </div>
  );
}

// Minimap — shows phase columns as rectangles, highlights visible viewport
function Minimap({ phases, variation, view, containerSize, worldSize, onNavigate }) {
  const W = 180, H = 56;
  if (!worldSize.w) return null;
  const scale = Math.min(W / worldSize.w, H / worldSize.h);
  const style = VARIATION_STYLE[variation];
  // Visible rect in world coords
  const visW = (containerSize.w / view.s);
  const visH = (containerSize.h / view.s);
  const visX = -view.x / view.s;
  const visY = -view.y / view.s;

  return (
    <div style={{
      position: 'absolute', left: 16, bottom: 16, zIndex: 30,
      background: 'var(--bg-2)', border: '1px solid var(--border-1)',
      borderRadius: 10, padding: 6, boxShadow: 'var(--shadow-lg)',
    }}>
      <div style={{ font: '500 10px/1 var(--font-sans)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '4px 4px 6px' }}>
        Overview
      </div>
      <svg width={W} height={H} style={{ display: 'block' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / scale;
          const y = (e.clientY - rect.top) / scale;
          onNavigate(x, y);
        }}>
        {phases.map((p, i) => (
          <rect key={p.id}
            x={i * style.colW * scale}
            y={0}
            width={style.colW * scale - 1}
            height={H}
            fill={p.accent}
            opacity={0.3}
          />
        ))}
        <rect
          x={visX * scale} y={visY * scale}
          width={visW * scale} height={Math.min(H, visH * scale)}
          fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={2}
        />
      </svg>
    </div>
  );
}

// ======== AI side panel ================================================
function AIPanel({ open, onClose, space, variation }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'I can help you refine this demand space. Ask me to regenerate dimensions, add a JTBD variant, or translate into CRM activation.' },
  ]);
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'assistant', text: 'Thinking…', loading: true }]);
    setInput('');
    setTimeout(() => {
      setMessages(m => {
        const next = [...m];
        next[next.length - 1] = {
          role: 'assistant',
          text: space
            ? `For "${space.label}", I'd add a Composition dimension ("Solo / Couple / Multi-gen") and reframe the JTBD to emphasize progress over product: "${space.jtbd.replace(/^When /, 'When ').slice(0, 160)}…" Want me to apply it?`
            : 'Select a demand space card and I\'ll tailor suggestions to it.',
          suggestions: space ? [
            'Regenerate dimensions',
            'Translate to CRM journey',
            'Draft JTBD variants',
          ] : ['Pick a space to dive in'],
        };
        return next;
      });
    }, 700);
  };

  if (!open) return null;

  return (
    <aside style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 25,
      width: 360,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border-1)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-fg)', display: 'grid', placeItems: 'center' }}>
          <Icon name="sparkles" size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '600 13px/1.2 var(--font-sans)' }}>Co-pilot</div>
          <div style={{ font: '400 11px/1 var(--font-sans)', color: 'var(--fg-3)', marginTop: 3 }}>
            {space ? space.label : 'No selection'}
          </div>
        </div>
        <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {space && (
          <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: 12, border: '1px solid var(--border-1)' }}>
            <div className="eyebrow">Context</div>
            <div style={{ font: '600 13px/1.3 var(--font-sans)', marginTop: 6 }}>{space.label}</div>
            <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)', marginTop: 6 }}>
              {space.jtbd}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {space.dims.map((d, i) => (
                <span key={i} className="chip" style={{ fontSize: 10 }}>{d.label}</span>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
            color: m.role === 'user' ? 'var(--accent-fg)' : 'var(--fg-1)',
            border: m.role === 'user' ? 'none' : '1px solid var(--border-1)',
            borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
            padding: '10px 12px',
            font: '400 13px/1.5 var(--font-sans)',
            opacity: m.loading ? 0.6 : 1,
          }}>
            {m.text}
            {m.suggestions && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {m.suggestions.map((s, j) => (
                  <button key={j} onClick={() => setInput(s)} style={{
                    font: '500 11px/1 var(--font-sans)',
                    padding: '5px 8px', borderRadius: 6,
                    background: 'var(--bg-1)', color: 'var(--fg-2)',
                    border: '1px solid var(--border-1)',
                    cursor: 'pointer',
                  }}>{s}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border-1)', padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={space ? `Ask about "${space.label}"…` : 'Pick a card, then ask…'}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--bg-3)', border: '1px solid var(--border-1)',
              borderRadius: 10, padding: '10px 12px',
              font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-1)',
              resize: 'none', outline: 'none',
            }}
          />
          <button className="btn btn--primary btn--sm" onClick={send} disabled={!input.trim()}>
            <Icon name="arrow-up" size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {['Regenerate this space', 'Add dimension', 'Find gaps'].map(s => (
            <button key={s} onClick={() => setInput(s)} className="btn btn--ghost btn--sm" style={{ fontSize: 11 }}>{s}</button>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ======== Main Workspace app ===========================================
function Workspace() {
  const [theme, setTheme] = useTheme();
  const [variation, setVariation] = useState(() => {
    try { return parseInt(localStorage.getItem('jg.workspace.var') || '0'); } catch (e) { return 0; }
  });
  useEffect(() => {
    try { localStorage.setItem('jg.workspace.var', String(variation)); } catch (e) {}
  }, [variation]);
  const variationId = VARIATIONS[variation].id;

  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSpace, setAiSpace] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activePhase, setActivePhase] = useState(MOCK_MODEL.phases[0].id);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const canvas = useCanvasController({ x: 40, y: 150, s: 0.85 });

  const style = VARIATION_STYLE[variationId];
  const worldW = MOCK_MODEL.phases.length * style.colW;
  const worldH = 2000; // plenty of vertical

  // Zoom-to-phase helper
  const zoomToPhase = (phaseId) => {
    const idx = MOCK_MODEL.phases.findIndex(p => p.id === phaseId);
    const el = canvas.containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const targetS = Math.min(1, Math.max(0.6, rect.width / (style.colW * 1.2)));
    const targetX = rect.width / 2 - (idx + 0.5) * style.colW * targetS;
    canvas.setView(v => ({ ...v, x: targetX, y: 140, s: targetS }));
  };

  // Observe container size
  useEffect(() => {
    const el = canvas.containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit once on first size
  useEffect(() => {
    if (containerSize.w && !sessionStorage.getItem('jg.ws.fitted')) {
      sessionStorage.setItem('jg.ws.fitted', '1');
      const rect = canvas.containerRef.current.getBoundingClientRect();
      const targetS = Math.min(0.9, Math.max(0.55, (rect.width - 80) / (worldW)));
      canvas.setView({ x: 40, y: 150, s: targetS });
    }
  }, [containerSize.w]);

  const openAI = (space) => { setAiSpace(space); setAiOpen(true); setSelected(space.id); };

  useEffect(() => { lucide.createIcons(); });

  const onMinimapNavigate = (wx, wy) => {
    const el = canvas.containerRef.current;
    const rect = el.getBoundingClientRect();
    canvas.setView(v => ({ ...v, x: rect.width / 2 - wx * v.s, y: 140 }));
  };

  return (
    <>
      <TopBar
        left="Demand Landscape"
        page="workspace"
        variation={variation}
        setVariation={setVariation}
        variationLabels={VARIATIONS.map(v => v.label)}
        onOpenTweaks={() => setTweaksOpen(true)}
        right={
          <>
            <a href="./brief.html" className="btn btn--ghost btn--sm">
              <Icon name="arrow-left" size={13} /> Brief
            </a>
            <button className="btn btn--soft btn--sm"><Icon name="download" size={13} /> Export</button>
            <button className="btn btn--soft btn--sm" onClick={() => { setAiOpen(true); setAiSpace(selected ? MOCK_MODEL.phases.flatMap(p => MOCK_MODEL.spaces[p.id] || []).find(s => s.id === selected) : null); }}>
              <Icon name="sparkles" size={13} /> AI
            </button>
          </>
        }
      />

      <main style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        {/* Phase rail on top (fixed, outside transform) */}
        <PhaseRail
          phases={MOCK_MODEL.phases}
          variation={variationId}
          activePhase={activePhase}
          setActivePhase={setActivePhase}
          onZoomToPhase={zoomToPhase}
          onRegenerate={() => alert('Mock: regenerate')}
        />

        {/* Canvas */}
        <div
          ref={canvas.containerRef}
          onMouseDown={canvas.onMouseDown}
          onMouseMove={canvas.onMouseMove}
          onMouseUp={canvas.onMouseUp}
          onMouseLeave={canvas.onMouseUp}
          className={`canvas-bg--${theme.bg}`}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute',
            left: canvas.view.x, top: canvas.view.y,
            transform: `scale(${canvas.view.s})`,
            transformOrigin: '0 0',
            display: 'flex',
            alignItems: 'flex-start',
            willChange: 'transform',
          }}>
            {MOCK_MODEL.phases.map(phase => (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                spaces={MOCK_MODEL.spaces[phase.id] || []}
                variation={variationId}
                onOpenAI={openAI}
                selected={selected}
                setSelected={setSelected}
                isActive={activePhase === phase.id}
                onActivate={() => setActivePhase(phase.id)}
              />
            ))}
          </div>

          {/* Floating UI */}
          <Minimap
            phases={MOCK_MODEL.phases}
            variation={variationId}
            view={canvas.view}
            containerSize={containerSize}
            worldSize={{ w: worldW, h: worldH }}
            onNavigate={onMinimapNavigate}
          />
          <ZoomControls
            view={canvas.view}
            zoomIn={canvas.zoomIn}
            zoomOut={canvas.zoomOut}
            zoomTo={canvas.zoomTo}
            onFit={() => canvas.fit(worldW, 1200)}
          />

          {/* Help hint bottom-center */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 18, zIndex: 30,
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-2)', border: '1px solid var(--border-1)',
            borderRadius: 10, padding: '6px 12px',
            boxShadow: 'var(--shadow-lg)',
            font: '500 11px/1 var(--font-sans)', color: 'var(--fg-2)',
          }}>
            <span className="kbd">space</span>+drag to pan
            <span style={{ opacity: .4 }}>·</span>
            <span className="kbd">⌘</span>+scroll to zoom
            <span style={{ opacity: .4 }}>·</span>
            <span className="kbd">⌘0</span> fit
          </div>

          {/* AI panel */}
          <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} space={aiSpace} variation={variationId} />
        </div>
      </main>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} theme={theme} setTheme={setTheme} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Workspace />);
