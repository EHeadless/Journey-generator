// Brief intake page — 3 variations of the same form.
// - v1: "Composer"  — single scrollable canvas, Linear-style
// - v2: "Wizard"    — guided, one step at a time with progress
// - v3: "Split"     — form on left, live "what we'll build" preview on right

const { useState, useEffect, useRef } = React;

const VARIATIONS = [
  { id: 'v1', label: 'Composer' },
  { id: 'v2', label: 'Wizard' },
  { id: 'v3', label: 'Split' },
];

const EXPERIENCE_TYPES = [
  { id: 'marketing', label: 'Marketing',     desc: 'Acquire, nurture, convert.',  icon: 'megaphone' },
  { id: 'product',   label: 'Product',       desc: 'Onboarding, activation, retention.', icon: 'layout-dashboard' },
  { id: 'service',   label: 'Service',       desc: 'Support, recovery, loyalty.', icon: 'headphones' },
  { id: 'commerce',  label: 'Commerce',      desc: 'Browse, cart, checkout.',     icon: 'shopping-bag' },
  { id: 'b2b',       label: 'B2B journey',   desc: 'Prospect, close, renew.',     icon: 'handshake' },
  { id: 'custom',    label: 'Custom',        desc: 'Something else — describe it.', icon: 'sparkles' },
];

const INDUSTRIES = [
  'Theme Parks & Attractions',
  'Consumer Packaged Goods',
  'Financial Services',
  'Healthcare',
  'Retail',
  'Travel & Hospitality',
  'Telecommunications',
  'Automotive',
  'Technology',
  'Media & Entertainment',
];

const SAMPLE = {
  industry: 'Theme Parks & Attractions',
  desc: 'Walt Disney World is a destination resort in Orlando comprising four theme parks, two water parks, and resort hotels. The challenge is maximizing guest lifetime value by driving multi-day stays, park-hopping, and per-guest spend on dining, merchandise, and premium experiences.',
};

// --- shared form hook ----------------------------------------------------
function useBrief() {
  const [brief, setBrief] = useState(() => {
    try {
      const raw = localStorage.getItem('jg.brief');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { experienceTypes: ['marketing'], industry: '', desc: '' };
  });
  useEffect(() => {
    try { localStorage.setItem('jg.brief', JSON.stringify(brief)); } catch (e) {}
  }, [brief]);
  return [brief, setBrief];
}

function complete(brief) {
  return brief.experienceTypes.length > 0 && brief.industry.trim() && brief.desc.trim().length > 40;
}

// --- Small shared form inputs -------------------------------------------
function Field({ label, hint, children, num }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        {num && (
          <span style={{
            font: '600 11px/1 var(--font-mono)',
            color: 'var(--fg-3)', letterSpacing: '.08em',
          }}>{num}</span>
        )}
        <div style={{ font: '600 14px/1.2 var(--font-sans)', letterSpacing: '-.005em' }}>{label}</div>
        {hint && <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--fg-3)', marginLeft: 'auto' }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function ExperienceGrid({ value, onChange }) {
  const toggle = (id) => {
    const has = value.includes(id);
    onChange(has ? value.filter(x => x !== id) : [...value, id]);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {EXPERIENCE_TYPES.map(t => {
        const active = value.includes(t.id);
        return (
          <button key={t.id} onClick={() => toggle(t.id)} style={{
            textAlign: 'left', padding: 14,
            background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
            border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-1)',
            borderRadius: 10, cursor: 'pointer',
            transition: 'all 120ms ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: active ? 'var(--accent)' : 'var(--bg-3)',
                color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
                display: 'grid', placeItems: 'center',
              }}><Icon name={t.icon} size={14} /></div>
              <div style={{ font: '600 13px/1.2 var(--font-sans)', color: active ? 'var(--accent)' : 'var(--fg-1)' }}>{t.label}</div>
            </div>
            <div style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--fg-2)' }}>{t.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

function IndustryField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = INDUSTRIES.filter(i => i.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. Theme Parks & Attractions"
        style={{
          width: '100%',
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          borderRadius: 10, padding: '12px 14px',
          font: '400 14px/1.4 var(--font-sans)', color: 'var(--fg-1)',
          outline: 'none',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          borderRadius: 10, padding: 4, zIndex: 10,
          boxShadow: 'var(--shadow-lg)', maxHeight: 240, overflow: 'auto',
        }}>
          {filtered.map(i => (
            <div key={i} onMouseDown={() => { onChange(i); setOpen(false); }} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              font: '400 13px/1.4 var(--font-sans)', color: 'var(--fg-1)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{i}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function DescField({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe the business, what it sells, how customers interact with it, and what the strategic challenge is. The richer the brief, the better the model."
        rows={7}
        style={{
          width: '100%',
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          borderRadius: 10, padding: 14,
          font: '400 14px/1.55 var(--font-sans)', color: 'var(--fg-1)',
          outline: 'none', resize: 'vertical',
        }}
      />
      <div style={{
        position: 'absolute', right: 10, bottom: 10,
        font: '500 11px/1 var(--font-mono)', color: value.length > 40 ? 'var(--success)' : 'var(--fg-3)',
      }}>
        {value.length} / 400+ recommended
      </div>
    </div>
  );
}

// ======== V1: Composer ==================================================
function Composer({ brief, setBrief, onGenerate }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 120px' }}>
      <div style={{ marginBottom: 40 }}>
        <div className="eyebrow eyebrow--accent">New brief</div>
        <h1 style={{ font: '700 44px/1.05 var(--font-display)', letterSpacing: '-.025em', margin: '8px 0 8px' }}>
          What journey are we <span className="ital" style={{ color: 'var(--accent)' }}>making sense of</span>?
        </h1>
        <p style={{ font: '400 16px/1.5 var(--font-sans)', color: 'var(--fg-2)', margin: 0, maxWidth: 560 }}>
          We'll synthesize demand spaces, dimensions, and customer values from your brief — then you'll shape them on a canvas.
        </p>
      </div>

      <Field num="01" label="What are we mapping?" hint="Pick one or more">
        <ExperienceGrid value={brief.experienceTypes} onChange={v => setBrief({ ...brief, experienceTypes: v })} />
      </Field>

      <Field num="02" label="Industry or category">
        <IndustryField value={brief.industry} onChange={v => setBrief({ ...brief, industry: v })} />
      </Field>

      <Field num="03" label="Business & challenge" hint="40+ words">
        <DescField value={brief.desc} onChange={v => setBrief({ ...brief, desc: v })} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setBrief({ ...brief, industry: SAMPLE.industry, desc: SAMPLE.desc })}>
            <Icon name="zap" size={13} /> Use sample (Walt Disney World)
          </button>
          <button className="btn btn--ghost btn--sm"><Icon name="file-up" size={13} /> Import doc</button>
        </div>
      </Field>

      <div style={{
        position: 'sticky', bottom: 16,
        marginTop: 48, padding: 14,
        background: 'color-mix(in srgb, var(--bg-0) 92%, transparent)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-1)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)' }}>
          {complete(brief)
            ? <>Ready. Generating creates roughly <strong style={{ color: 'var(--fg-1)' }}>6 phases · 70 demand spaces · 800 values</strong>.</>
            : <>Add an industry and a description to enable generation.</>
          }
        </div>
        <button className="btn btn--ghost btn--sm"><Icon name="rotate-ccw" size={13} /> Reset</button>
        <button className="btn btn--primary btn--lg" onClick={onGenerate} disabled={!complete(brief)} style={{
          opacity: complete(brief) ? 1 : .5,
          cursor: complete(brief) ? 'pointer' : 'not-allowed',
        }}>
          <Icon name="sparkles" size={14} />
          Generate journey
          <span className="kbd" style={{ marginLeft: 4 }}>⌘↵</span>
        </button>
      </div>
    </div>
  );
}

// ======== V2: Wizard ====================================================
function Wizard({ brief, setBrief, onGenerate }) {
  const [step, setStep] = useState(0);
  const steps = [
    { key: 'type',     title: 'What are we mapping?',          sub: 'Pick one or more experience types. This shapes the phase model we generate.' },
    { key: 'industry', title: 'Which industry?',                sub: 'We tune generation to industry vocabulary and common behaviors.' },
    { key: 'desc',     title: 'Tell us about the business.',    sub: 'Describe the company, its customers, and the challenge. Four sentences is plenty.' },
    { key: 'review',   title: 'Review your brief.',             sub: 'This is what we\'ll send to generation.' },
  ];
  const canNext = [
    brief.experienceTypes.length > 0,
    brief.industry.trim().length > 0,
    brief.desc.trim().length > 40,
    true,
  ][step];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 120px' }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 40 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--accent)' : 'var(--border-1)',
            transition: 'background 240ms ease',
          }} />
        ))}
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow eyebrow--accent">Step {step + 1} of {steps.length}</div>
        <h1 style={{ font: '700 36px/1.1 var(--font-display)', letterSpacing: '-.02em', margin: '10px 0 8px' }}>
          {steps[step].title}
        </h1>
        <p style={{ font: '400 15px/1.5 var(--font-sans)', color: 'var(--fg-2)', margin: 0 }}>
          {steps[step].sub}
        </p>
      </div>

      <div style={{ marginBottom: 40 }}>
        {step === 0 && <ExperienceGrid value={brief.experienceTypes} onChange={v => setBrief({ ...brief, experienceTypes: v })} />}
        {step === 1 && <IndustryField value={brief.industry} onChange={v => setBrief({ ...brief, industry: v })} />}
        {step === 2 && (
          <>
            <DescField value={brief.desc} onChange={v => setBrief({ ...brief, desc: v })} />
            <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }}
              onClick={() => setBrief({ ...brief, industry: brief.industry || SAMPLE.industry, desc: SAMPLE.desc })}>
              <Icon name="zap" size={13} /> Use sample text
            </button>
          </>
        )}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ReviewRow label="Experience types" value={brief.experienceTypes.map(t => EXPERIENCE_TYPES.find(x => x.id === t)?.label).join(', ')} onEdit={() => setStep(0)} />
            <ReviewRow label="Industry" value={brief.industry} onEdit={() => setStep(1)} />
            <ReviewRow label="Business" value={brief.desc} onEdit={() => setStep(2)} clamp />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        <button className="btn btn--ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          style={{ opacity: step === 0 ? .4 : 1 }}>
          <Icon name="arrow-left" size={14} /> Back
        </button>
        {step < steps.length - 1 ? (
          <button className="btn btn--primary" onClick={() => setStep(s => s + 1)} disabled={!canNext}
            style={{ opacity: canNext ? 1 : .5, cursor: canNext ? 'pointer' : 'not-allowed' }}>
            Continue <Icon name="arrow-right" size={14} />
          </button>
        ) : (
          <button className="btn btn--primary btn--lg" onClick={onGenerate}>
            <Icon name="sparkles" size={14} /> Generate journey
          </button>
        )}
      </div>
    </div>
  );
}
function ReviewRow({ label, value, onEdit, clamp }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 16,
      padding: 14, background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10,
    }}>
      <div style={{ font: '500 12px/1.3 var(--font-sans)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-1)',
        display: clamp ? '-webkit-box' : 'block',
        WebkitLineClamp: clamp ? 3 : 'none', WebkitBoxOrient: 'vertical', overflow: clamp ? 'hidden' : 'visible' }}>
        {value || <em style={{ color: 'var(--fg-3)' }}>Not set</em>}
      </div>
      <button className="btn btn--ghost btn--sm" onClick={onEdit}><Icon name="pencil" size={12} /> Edit</button>
    </div>
  );
}

// ======== V3: Split =====================================================
function Split({ brief, setBrief, onGenerate }) {
  // Ghost preview rebuilds based on input fullness
  const ready = complete(brief);
  const types = brief.experienceTypes.map(t => EXPERIENCE_TYPES.find(x => x.id === t)?.label).filter(Boolean);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(520px, 1fr) minmax(420px, 1fr)', minHeight: 'calc(100vh - 56px)' }}>
      {/* Left: form */}
      <div style={{ padding: '40px 40px 120px', maxWidth: 640, justifySelf: 'end', width: '100%' }}>
        <div className="eyebrow eyebrow--accent">New brief</div>
        <h1 style={{ font: '700 34px/1.1 var(--font-display)', letterSpacing: '-.02em', margin: '8px 0 8px' }}>
          Shape the input.
        </h1>
        <p style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--fg-2)', margin: '0 0 36px' }}>
          As you fill out the brief, the right side will preview the shape of what you'll generate.
        </p>

        <Field num="01" label="What are we mapping?">
          <ExperienceGrid value={brief.experienceTypes} onChange={v => setBrief({ ...brief, experienceTypes: v })} />
        </Field>

        <Field num="02" label="Industry or category">
          <IndustryField value={brief.industry} onChange={v => setBrief({ ...brief, industry: v })} />
        </Field>

        <Field num="03" label="Business & challenge">
          <DescField value={brief.desc} onChange={v => setBrief({ ...brief, desc: v })} />
          <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }}
            onClick={() => setBrief({ ...brief, industry: SAMPLE.industry, desc: SAMPLE.desc })}>
            <Icon name="zap" size={13} /> Use sample (Walt Disney World)
          </button>
        </Field>

        <button className="btn btn--primary btn--lg" onClick={onGenerate} disabled={!ready}
          style={{ width: '100%', justifyContent: 'center', opacity: ready ? 1 : .5, cursor: ready ? 'pointer' : 'not-allowed', marginTop: 8 }}>
          <Icon name="sparkles" size={14} /> Generate journey <span className="kbd" style={{ marginLeft: 6 }}>⌘↵</span>
        </button>
      </div>

      {/* Right: live preview */}
      <div style={{
        background: 'var(--bg-1)', borderLeft: '1px solid var(--border-1)',
        padding: '40px 40px 80px', position: 'sticky', top: 56, alignSelf: 'start',
        height: 'calc(100vh - 56px)', overflow: 'hidden',
      }}>
        <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 14 }}>
          Preview — what we'll build
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header card */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ font: '500 10px/1 var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '.1em', marginBottom: 6 }}>
              {types.length ? types.join(' · ').toUpperCase() : 'EXPERIENCE TYPES'}
            </div>
            <div style={{ font: '700 20px/1.2 var(--font-display)', letterSpacing: '-.01em', color: ready ? 'var(--fg-1)' : 'var(--fg-3)' }}>
              {brief.industry || 'Your industry'}
            </div>
            <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)', marginTop: 8,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {brief.desc || <em style={{ color: 'var(--fg-3)' }}>Describe the business and its challenge…</em>}
            </div>
          </div>

          {/* Ghost phases */}
          <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            Phases <span style={{ float: 'right', color: ready ? 'var(--fg-1)' : 'var(--fg-3)' }}>{ready ? '≈ 6' : '—'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Dream & Discover','Plan & Book','Pre-Arrival','Magic in Motion','Enrichment','Reflect & Share'].map((label, i) => {
              const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899','#8b5cf6'];
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, background: 'var(--bg-2)',
                  border: '1px solid var(--border-1)', borderRadius: 10,
                  opacity: ready ? 1 : 0.4,
                  transition: 'opacity 240ms ease',
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: colors[i], color: '#fff', display: 'grid', placeItems: 'center', font: '700 11px/1 var(--font-sans)' }}>{i + 1}</div>
                  <div style={{ flex: 1, font: '500 13px/1.3 var(--font-sans)' }}>
                    {ready ? label : <span style={{ display: 'inline-block', width: 140, height: 12, background: 'var(--bg-3)', borderRadius: 4 }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ font: '500 10px/1 var(--font-mono)', color: 'var(--fg-3)', padding: '3px 6px', background: 'var(--bg-3)', borderRadius: 4 }}>
                      {ready ? ['12','12','12','12','12','11'][i] : '--'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ font: '400 11px/1.5 var(--font-sans)', color: 'var(--fg-3)', textAlign: 'center' }}>
            Final output shaped by your brief — these are illustrative.
          </div>
        </div>
      </div>
    </div>
  );
}

// ======== Generation overlay ============================================
function GeneratingOverlay({ open, onDone }) {
  const [phase, setPhase] = useState(0);
  const steps = [
    'Reading the brief…',
    'Identifying phases and triggers…',
    'Generating demand spaces…',
    'Mapping dimensions and values…',
    'Finalizing your landscape…',
  ];
  useEffect(() => {
    if (!open) { setPhase(0); return; }
    const intv = setInterval(() => {
      setPhase(p => {
        if (p >= steps.length - 1) {
          clearInterval(intv);
          setTimeout(onDone, 600);
          return p;
        }
        return p + 1;
      });
    }, 650);
    return () => clearInterval(intv);
  }, [open]);

  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'color-mix(in srgb, var(--bg-0) 85%, transparent)',
      backdropFilter: 'blur(12px)',
      display: 'grid', placeItems: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', color: 'var(--accent-fg)', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          animation: 'jg-pulse 1.2s ease-in-out infinite' }}>
          <Icon name="sparkles" size={26} />
        </div>
        <div style={{ font: '700 24px/1.2 var(--font-display)', letterSpacing: '-.015em', marginBottom: 8 }}>
          Generating your journey
        </div>
        <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--fg-2)', marginBottom: 24 }}>
          {steps[phase]}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: i <= phase ? 1 : .3,
              font: '500 13px/1 var(--font-sans)',
              color: i < phase ? 'var(--fg-3)' : 'var(--fg-1)',
              textDecoration: i < phase ? 'line-through' : 'none',
              padding: '6px 0',
            }}>
              <Icon name={i < phase ? 'check' : (i === phase ? 'loader' : 'circle')} size={14}
                style={{ color: i < phase ? 'var(--success)' : (i === phase ? 'var(--accent)' : 'var(--fg-3)') }} />
              {s}
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes jg-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: .85; } }`}</style>
    </div>
  );
}

// ======== Main Brief app ================================================
function BriefApp() {
  const [theme, setTheme] = useTheme();
  const [variation, setVariation] = useState(() => {
    try { return parseInt(localStorage.getItem('jg.brief.var') || '0'); } catch (e) { return 0; }
  });
  useEffect(() => {
    try { localStorage.setItem('jg.brief.var', String(variation)); } catch (e) {}
  }, [variation]);

  const [brief, setBrief] = useBrief();
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [gen, setGen] = useState(false);

  const onGenerate = () => setGen(true);
  const onGenDone = () => { window.location.href = './workspace.html'; };

  useEffect(() => { lucide.createIcons(); });

  // ⌘↵ shortcut
  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && complete(brief)) onGenerate();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [brief]);

  const V = [Composer, Wizard, Split][variation];

  return (
    <>
      <TopBar
        left="New brief"
        variation={variation}
        setVariation={setVariation}
        variationLabels={VARIATIONS.map(v => v.label)}
        onOpenTweaks={() => setTweaksOpen(true)}
        right={
          <a href="./workspace.html" className="btn btn--ghost btn--sm">
            Skip to workspace <Icon name="arrow-right" size={13} />
          </a>
        }
      />
      <main style={{ minHeight: 'calc(100vh - 56px)' }}>
        <V brief={brief} setBrief={setBrief} onGenerate={onGenerate} />
      </main>
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} theme={theme} setTheme={setTheme} />
      <GeneratingOverlay open={gen} onDone={onGenDone} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<BriefApp />);
