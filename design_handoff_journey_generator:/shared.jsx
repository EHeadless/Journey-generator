// Shared primitives — used by both pages.
// Exposes to window: TopBar, TweaksPanel, VariationSwitcher, Icon, applyTheme, useTheme.

const { useState, useEffect, useRef } = React;

// ---- Icon (lucide) ------------------------------------------------------
function Icon({ name, size = 18, stroke = 1.8, style, className }) {
  return (
    <i data-lucide={name}
       className={className}
       style={{ width: size, height: size, strokeWidth: stroke, display: 'inline-block', ...style }} />
  );
}

// ---- Theme state (localStorage-backed) ----------------------------------
const DEFAULT_THEME = {
  theme: 'linear',         // 'linear' | 'editorial' | 'ei'
  density: 'comfy',        // 'compact' | 'comfy' | 'spacious'
  bg: 'dots',              // 'dots' | 'grid' | 'plain'
  accent: null,            // override or null
  typography: 'geist',     // 'geist' | 'inter' | 'serif'
};

function applyTheme(t) {
  const r = document.documentElement;
  r.setAttribute('data-theme', t.theme);
  r.setAttribute('data-density', t.density);
  r.setAttribute('data-bg', t.bg);
  if (t.accent) r.style.setProperty('--accent', t.accent);
  else r.style.removeProperty('--accent');
  // Typography family swap
  const families = {
    geist: "'Geist', 'Inter', system-ui, sans-serif",
    inter: "'Inter', system-ui, sans-serif",
    serif: "'Fraunces', Georgia, serif",
  };
  // Only swap display font — keep body readable
  r.style.setProperty('--font-display', families[t.typography] || families.geist);
  r.style.setProperty('--font-sans',
    t.typography === 'serif' ? "'Inter', system-ui, sans-serif" : families[t.typography] || families.geist);
}

function useTheme() {
  const [t, setT] = useState(() => {
    try {
      const raw = localStorage.getItem('jg.theme');
      if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) };
    } catch (e) {}
    return DEFAULT_THEME;
  });
  useEffect(() => {
    applyTheme(t);
    try { localStorage.setItem('jg.theme', JSON.stringify(t)); } catch (e) {}
  }, [t]);
  return [t, setT];
}

// ---- Top bar ------------------------------------------------------------
function TopBar({ page, left, right, variation, setVariation, variationLabels, onOpenTweaks }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'color-mix(in srgb, var(--bg-0) 80%, transparent)',
      backdropFilter: 'saturate(160%) blur(12px)',
      borderBottom: '1px solid var(--border-1)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Brand */}
      <a href="./brief.html" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        textDecoration: 'none', color: 'var(--fg-1)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'var(--accent)', color: 'var(--accent-fg)',
          display: 'grid', placeItems: 'center',
          font: '700 13px/1 var(--font-sans)',
        }}>J</div>
        <span style={{ font: '600 14px/1 var(--font-sans)', letterSpacing: '-.01em' }}>Journey Generator</span>
      </a>
      <span style={{ opacity: .3 }}>/</span>
      <span style={{ font: '400 13px/1 var(--font-sans)', color: 'var(--fg-2)' }}>{left}</span>

      {/* Variation switcher (center) */}
      {variationLabels && (
        <div style={{
          marginLeft: 'auto', marginRight: 'auto',
          display: 'inline-flex', gap: 2, padding: 3,
          background: 'var(--bg-3)', border: '1px solid var(--border-1)',
          borderRadius: 999,
        }}>
          {variationLabels.map((lbl, i) => (
            <button key={i} onClick={() => setVariation(i)} style={{
              padding: '5px 12px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: variation === i ? 'var(--bg-1)' : 'transparent',
              color: variation === i ? 'var(--fg-1)' : 'var(--fg-2)',
              font: '500 12px/1 var(--font-sans)',
              boxShadow: variation === i ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
              transition: 'all 120ms ease',
            }}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {/* Right actions */}
      <div style={{ marginLeft: variationLabels ? 0 : 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {right}
        <button className="btn btn--ghost btn--sm" onClick={onOpenTweaks} title="Tweaks">
          <Icon name="sliders-horizontal" size={14} />
          Tweaks
        </button>
      </div>
    </header>
  );
}

// ---- Tweaks panel -------------------------------------------------------
function TweaksPanel({ open, onClose, theme, setTheme }) {
  if (!open) return null;
  const Row = ({ label, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, alignItems: 'center', padding: '10px 0' }}>
      <div style={{ font: '500 11px/1 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-3)' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
  const Seg = ({ options, value, onChange }) => (
    <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 10 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
          background: value === o.value ? 'var(--bg-1)' : 'transparent',
          color: value === o.value ? 'var(--fg-1)' : 'var(--fg-2)',
          font: '500 12px/1 var(--font-sans)',
          boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
        }}>{o.label}</button>
      ))}
    </div>
  );
  const accents = [
    { value: null, color: 'var(--accent)', label: 'default' },
    { value: '#6366f1', color: '#6366f1' },
    { value: '#313FE9', color: '#313FE9' },
    { value: '#10b981', color: '#10b981' },
    { value: '#ef4444', color: '#ef4444' },
    { value: '#f59e0b', color: '#f59e0b' },
    { value: '#ec4899', color: '#ec4899' },
    { value: '#000000', color: '#000' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.2)' }} />
      <aside style={{
        position: 'fixed', right: 16, top: 64, bottom: 16, zIndex: 90,
        width: 320, background: 'var(--bg-1)',
        border: '1px solid var(--border-1)', borderRadius: 14,
        boxShadow: 'var(--shadow-lg)',
        padding: 18, overflow: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ font: '600 14px/1 var(--font-sans)' }}>Tweaks</div>
          <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <Row label="Mode">
          <Seg options={[{value:'linear',label:'Linear'},{value:'editorial',label:'Editorial'},{value:'ei',label:'EI'}]}
               value={theme.theme} onChange={v => setTheme({ ...theme, theme: v })} />
        </Row>
        <Row label="Density">
          <Seg options={[{value:'compact',label:'Compact'},{value:'comfy',label:'Comfy'},{value:'spacious',label:'Spacious'}]}
               value={theme.density} onChange={v => setTheme({ ...theme, density: v })} />
        </Row>
        <Row label="Canvas">
          <Seg options={[{value:'dots',label:'Dots'},{value:'grid',label:'Grid'},{value:'plain',label:'Plain'}]}
               value={theme.bg} onChange={v => setTheme({ ...theme, bg: v })} />
        </Row>
        <Row label="Typography">
          <Seg options={[{value:'geist',label:'Geist'},{value:'inter',label:'Inter'},{value:'serif',label:'Serif'}]}
               value={theme.typography} onChange={v => setTheme({ ...theme, typography: v })} />
        </Row>
        <Row label="Accent">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {accents.map((a, i) => (
              <button key={i} onClick={() => setTheme({ ...theme, accent: a.value })} style={{
                width: 26, height: 26, borderRadius: 8,
                background: a.color, cursor: 'pointer',
                border: theme.accent === a.value ? '2px solid var(--fg-1)' : '1px solid var(--border-1)',
                position: 'relative',
              }} title={a.label || a.value} />
            ))}
          </div>
        </Row>

        <div style={{
          marginTop: 20, padding: 12,
          background: 'var(--bg-3)', borderRadius: 10,
          font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)',
        }}>
          Tweaks persist to <span style={{ font: '500 11px/1 var(--font-mono)' }}>localStorage</span> and apply across both pages.
        </div>
      </aside>
    </>
  );
}

Object.assign(window, { Icon, TopBar, TweaksPanel, applyTheme, useTheme });
