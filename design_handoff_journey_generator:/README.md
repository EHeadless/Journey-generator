# Handoff: Journey Generator — Brief + Workspace redesign

## Overview
Redesign of the two core screens of Journey Generator (`app/page.tsx` and `app/model/[id]/page.tsx`): a richer **Brief intake** and a Miro/Figma-style **Workspace canvas** with horizontal phase rail, free pan & zoom, demand-space cards, and an AI co-pilot panel.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Recreate them in your existing Next.js + Tailwind v4 app (the stack already in the repo), using your established patterns and Tailwind tokens. Mirror the visual language and interactions; do **not** port the inline `<style>` objects verbatim.

## Fidelity
**High-fidelity.** Colors, type, spacing, and interactions are final-intent. Reproduce layout, density, and motion. Pixel-perfect isn't required, but visual parity is.

## Files in this bundle
- `tokens.css` — CSS variables for all 3 themes (Linear / Editorial / EI). Translate to `theme.ts` + Tailwind config.
- `shared.jsx` — top bar, tweaks panel, theme hook.
- `brief.jsx` — three brief variations (Composer / Wizard / Split). Pick **Composer** as the default; the others are exploration.
- `workspace.jsx` — canvas controller, phase rail, demand-space card, AI panel. The **"Linear rail" variation (v1)** is the recommended one.
- `data.js` — mock `MOCK_MODEL` matching the shape in `lib/types.ts`.
- `brief.html`, `workspace.html` — shells to run the prototypes locally.

## Screens

### 1. Brief (`app/page.tsx`) — Composer variation (recommended)
- **Layout:** single column, `max-w-[760px]` centered, `py-12 px-6`. Sticky action bar at bottom of page with `bg-[color-mix(in_srgb,var(--bg-0)_92%,transparent)]` + backdrop blur.
- **Header:** eyebrow "NEW BRIEF" (accent color), H1 44px/1.05, `-0.025em` tracking, with one serif-italic accent word ("making sense of") in accent color.
- **Three fields** — each prefixed with a monospace step number ("01", "02", "03"):
  1. **Experience types** — 3-column grid of toggleable cards, icon + label + sub (`lucide` icons: `megaphone`, `layout-dashboard`, `headphones`, `shopping-bag`, `handshake`, `sparkles`). Multi-select. Active = accent-soft background, accent border.
  2. **Industry** — typeahead input with suggestions dropdown.
  3. **Description** — textarea, 7 rows, with live char counter bottom-right that turns green at >40 chars. Below: "Use sample (Walt Disney World)" + "Import doc" ghost buttons.
- **Generate CTA:** primary, large, with `⌘↵` kbd hint. Disabled until valid. Triggers `<GeneratingOverlay>` (5-step progress, ~3.5s) then navigates to `/model/:id`.

### 2. Workspace (`app/model/[id]/page.tsx`) — Linear rail variation (recommended)

**Layout**
- Full-viewport, `overflow: hidden`. Top bar (56px) + phase rail (~140px absolute-positioned inside the main area) + infinite canvas underneath.

**Phase rail** (sticky inside main, outside the canvas transform)
- Title block "Workspace / Demand Landscape"
- 4 summary counters (Phases / Spaces / Dimensions / Values) — large mono numbers, tiny uppercase labels.
- Actions right: "Add phase" (ghost), "Regenerate" (primary).
- Phase tabs row below: pill per phase with colored ordinal badge. Click = zoom-to-phase.

**Canvas**
- Wrap children in `transform: translate(x,y) scale(s)` with `transform-origin: 0 0`.
- Controller (`useCanvasController`) handles:
  - `⌘/Ctrl + wheel` → zoom toward cursor (clamp 0.2–2.5)
  - plain wheel / two-finger scroll → pan
  - `Space + drag` → pan (cursor becomes grab/grabbing)
  - Middle-mouse drag → pan
  - `⌘0` fit · `⌘+` / `⌘-` zoom
- Phases render as vertical columns (width 360px, 18px gap). Each column has a 6px colored accent bar + phase title + metadata chips, then a vertical stack of demand-space cards with `gap: 14px`.

**Demand-space card**
- White (`--bg-2`) card, `rounded-[12px]`, 1px border.
- Header: bold 15px title + sparkles icon-button ("Ask AI") top-right.
- JTBD: 12px/1.45 in `--fg-2`, 2–3 lines.
- Two chips: accent "N dim" + neutral "N values".
- Divider, then up to 4 dimension rows: `86px label column | wrapped value chips` (max 3 values shown, "+N" overflow).
- Selected = 1.5px accent border + shadow.

**Floating UI**
- Bottom-right: zoom controls (-, %, +, divider, fit).
- Bottom-left: minimap (180×56 SVG) — one rect per phase tinted with its accent, viewport outline in accent.
- Bottom-center: keyboard-hint bar with `kbd` chips.

**AI co-pilot panel** (docked right, 360px)
- Opens from any card's sparkles button. Shows context card (title + JTBD + dimension chips) + chat thread + suggestion chips + composer with `⌘↵` send.

## Interactions
- Variation switcher in the top bar (Composer/Wizard/Split on brief; Linear/Stacked/Editorial on workspace) — persists in `localStorage` under `jg.brief.var` / `jg.workspace.var`. Ship only Composer + Linear in v1; keep others behind a feature flag if desired.
- Theme (mode/density/bg/typography/accent) persists under `jg.theme`.
- Generating overlay: stepped progress animation, then `router.push` to the generated model route.

## Design tokens
All defined in `tokens.css` under three `:root[data-theme=...]` blocks. Key ones (Linear / dark default):

- **Background:** `--bg-0: #0a0a0b`, `--bg-1: #0f0f11`, `--bg-2: #17171a`, `--bg-3: #1f1f24`, `--bg-4: #26262c`
- **Foreground:** `--fg-1: #e8e8ea`, `--fg-2: #a0a0a8`, `--fg-3: #6b6b72`
- **Borders:** `rgba(255,255,255,.08)` / `.14`
- **Accent:** `#6366f1` (indigo) · **success** `#4ade80` · **warn** `#f59e0b` · **danger** `#f87171`
- **Radii:** 6 / 10 / 14 / 20 / 28
- **Spacing:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64
- **Shadow-lg:** `0 20px 48px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35)`
- **Fonts:** Geist (sans & mono), Fraunces (serif italic accents)
- **Grid dot:** `rgba(255,255,255,.06)` at 24px spacing · **grid line:** `rgba(255,255,255,.04)` at 48px

The Editorial and EI themes override the same token names — see `tokens.css`.

## Implementation notes
- Replace this prototype's inline style objects with Tailwind utility classes + a small number of `className="card"`, `btn btn--primary` primitives (already classed consistently in the prototype — grep for `.btn`, `.card`, `.chip`, `.eyebrow`, `.kbd`).
- Swap the mock `MOCK_MODEL` hookup for `useModel(id)` from the existing `lib/storage.ts`.
- Keep the component split: `<PhaseRail>`, `<PhaseColumn>`, `<DemandSpaceCard>`, `<AIPanel>`, `<ZoomControls>`, `<Minimap>`, `useCanvasController`.
- For the AI panel, wire to the existing Gemini route in `app/api/`; the `suggestions` array is just quick-replies.
- Lucide icons used: `sparkles`, `sliders-horizontal`, `arrow-left/right/up`, `plus`, `minus`, `maximize`, `x`, `pencil`, `zap`, `check`, `circle`, `loader`, `layers`, `circle-dot`, `more-horizontal`, `rotate-ccw`, `download`, `file-up`, `megaphone`, `layout-dashboard`, `headphones`, `shopping-bag`, `handshake`.

## Assets
No images — all UI is CSS + SVG + lucide. No external assets to copy.
