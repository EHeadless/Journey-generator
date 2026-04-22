# Demand Space Generation

## Who I am
- Product manager at Digitas, behavioral strategy background
- Can read and understand code; prefer not to write it
- Building an internal tool to systematize how we approach client engagements

## What this is
Demand Space Generation — a behavioral strategy engine that takes a client brief, industry, and tech stack, and generates a complete behavioral model organized by journey phase using a dimensions-based taxonomy.

**Stage:** Working prototype with auto-cascading generation. Input form → journey phases → demand spaces → dimensions → activations.

**Users:** CX strategists, CRM strategists, UX/UI designers, product strategists, AI strategists, and managers at Digitas who build behavioral models before designing journeys, features, or service processes.

## Core flow
1. User selects experience type: **Product**, **Marketing**, or **Service**
2. User selects industry and enters client brief (business description, tech/martech stack, channels, customer segments, pain points)
3. User enters OpenAI API key (stored in localStorage, not in code)
4. User clicks Generate — system auto-cascades:
   - Journey phases generated first
   - Demand spaces generated per phase
   - **Exactly 5 Circumstances** generated per demand space (composite across Knowledge / Intent / Composition / Constraint / Moment, with narrative + Struggle + Progress)
5. All cards auto-expand when generation completes
6. Activation outputs depend on experience type (*currently deferred — being re-designed around the new Circumstance entity*):

| Experience | Output per Circumstance | Artifact |
|------------|-------------------------|----------|
| **Product** | Features → Jira-ready user stories | Prioritized feature backlog by demand space × circumstance |
| **Marketing** | Behavior states → 6 CRM levers (message depth, urgency, channel, tone, offers, cadence) | CRM journey buildable in Emarsys/Braze/SFMC |
| **Service** | Features → tools, knowledge articles, C360 signals, handoff rules | Circumstance catalog with agent specifications |

## Key definitions
- **Demand space** = Human life motivation (JTBD), NOT a product feature. Must pass the "remove the product" test. Example: "Live comfortably in my community without friction" — not "Track my maintenance request."
- **Circumstance** = A composite position across all 5 universal axes (Knowledge, Intent, Composition, Constraint, Moment) that deconstructs a demand space's JTBD into a specific, real-life situation. Each demand space has exactly 5 distinct Circumstances. Each one carries a JTBD narrative ("When I am [context], I want to [action], so that [outcome]"), a **Struggle** (what pushes them away from the current habit), and a **Progress** (what they're reaching for).
- **Behavior state** (marketing only) = How the person is acting now — engagement level + cognitive/emotional state — drives the 6 CRM activation levers.
- **Feature** (product/service) = AI or system capability that resolves a demand space for a specific Circumstance. Maps to backend tools and generates user stories.
- **Journey phase** = Business lifecycle stage. Not a demand space. The shared timeline customers move through. Example: Search → Onboarding → In-Life.

## Universal Axis Taxonomy
Every Circumstance picks one value on each of these 5 axes:

| Axis | What it captures | Examples |
|------|------------------|----------|
| **Knowledge** | What the customer knows | Expert vs Novice, Familiar vs First-time |
| **Intent** | Why they're here now / the stakes | Routine vs High-stakes, Browsing vs Buying |
| **Composition** | Who they're with or for | Solo, Couple, Family, Group, Corporate |
| **Constraint** | What's limiting them | Time, Space, Budget, Accessibility, Language |
| **Moment** | Situational / temporal / life context | "Long-haul business travel", "First week postpartum", "Connecting after a delayed flight" |

**Formula:** Demand Space → 5 Circumstances (each a tuple across the 5 axes) → Activations (deferred — being re-designed)

## Reference engagements (source of truth)
Read these before generating output:

- **Digitas_MiralCXConsultancy_CRMStrategyScope.pdf** (Marketing) — Gold standard for marketing activation. Shows demand space × dimension × behavior model, 8 demand spaces, dimension types, behavior dimensions driving 6 CRM levers, end-to-end example (Ahmed's Pre-Arrival Message).

- **Genome_AI_Transformation_Program.pdf** (Service) — Gold standard for service activation. Shows journey phase × vertical matrix, dimensions mapped to features/tools/knowledge/C360/handoffs, 5-step cyclic approach, prioritization via frequency × impact, orchestration patterns, HHH eval framework.

- **Product** (no PDF yet) — Same demand space × dimension hierarchy, but output is a feature backlog with Jira-ready user stories. No UI mockups — produces the strategic backlog that designers and engineers build from.

## How Claude should respond
- Think like a product strategist, not a developer
- Be concise and opinionated — don't hedge
- Push back when my thinking is weak
- Use behavioral science language: forces framework, drive vs resistance, trade-offs, demand spaces, JTBDs, circumstances
- Write like Digitas — confident, structured, no fluff
- Don't over-explain

## What I use Claude Code for
- Build the interactive prototype (React/Next.js)
- Generate and refine prompts for demand space, circumstance, and activation generation
- Write product copy and documentation (PRDs, sprint specs, user stories)
- Stress-test the framework across industries
- Structure the pitch for internal stakeholders

## What Claude should NOT do
- Generate demand spaces that describe product features — they must be human life motivations
- Use "When I / I want / So I can" format for demand spaces — use short evocative labels
- Confuse circumstances with demand spaces — a Circumstance is a specific real-life situation (composite across 5 axes); a demand space is the underlying life motivation
- Treat this as CRM-only — it spans marketing, product, and service
- Build features solvable by prompting Claude directly — this is a structured workspace, not a chat
- Generate vague impacts — every output must be specific enough for implementation teams to act on

## Tech stack
Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Zustand (state), OpenAI GPT-4o (generation), Supabase (database + auth), Vercel (deployment). Export: HTML, PDF, PPTX.

## Project structure
```
├── .claude/
│   ├── settings.local.json
│   └── skills/
│       ├── prd-generator/
│       ├── user-story-writer/
│       ├── journey-phase-generator/
│       ├── demand-space-generator/
│       ├── dimension-generator/
│       ├── marketing-activation-generator/
│       ├── product-activation-generator/
│       └── service-activation-generator/
├── app/
│   ├── page.tsx                              # Home/landing page
│   ├── new/page.tsx                          # New model input form
│   ├── model/[id]/page.tsx                   # Main workspace (generation UI)
│   └── api/
│       ├── generate-journey-phases/route.ts
│       ├── generate-demand-spaces/route.ts
│       ├── generate-circumstances/route.ts   # 5 Circumstances per demand space (Knowledge/Intent/Composition/Constraint/Moment + narrative + struggle/progress)
│       ├── generate-marketing-activations/route.ts  # deferred — being re-designed
│       ├── generate-product-activations/route.ts    # deferred — being re-designed
│       └── generate-service-activations/route.ts    # deferred — being re-designed
├── components/
│   ├── InputForm.tsx
│   ├── JourneyPhaseCard.tsx
│   ├── DemandSpaceCard.tsx                   # Shows 5 Circumstances (axis chips + narrative + Struggle/Progress)
│   └── Toast.tsx
├── lib/
│   ├── store.ts                              # Zustand store with circumstance actions
│   ├── types.ts                              # Circumstance type (5 axes + narrative + struggle/progress)
│   ├── openai.ts                             # API key passed as parameter
│   └── utils.ts
├── docs/
│   ├── Digitas_MiralCXConsultancy_CRMStrategyScope.pdf
│   └── Genome_AI_Transformation_Program.pdf
├── CLAUDE.md
└── package.json
```

## Key implementation details
- **API key handling:** OpenAI key entered via header input, stored in localStorage, passed to API routes in request body — never stored in code/env files
- **Auto-cascade generation:** useEffect hooks watch for new entities and trigger next generation step automatically
- **Controlled expansion:** Parent component manages card expansion state; all cards auto-expand when generation completes
- **Stats bar:** Live-updating counts for phases, demand spaces, and circumstances with loading spinner during generation
