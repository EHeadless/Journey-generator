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
   - Dimensions generated per demand space
5. All cards auto-expand when generation completes
6. Activation outputs depend on experience type:

| Experience | Output per dimension value | Artifact |
|------------|---------------------------|----------|
| **Product** | Features → Jira-ready user stories | Prioritized feature backlog by demand space × dimension |
| **Marketing** | Behavior states → 6 CRM levers (message depth, urgency, channel, tone, offers, cadence) | CRM journey buildable in Emarsys/Braze/SFMC |
| **Service** | Features → tools, knowledge articles, C360 signals, handoff rules | Dimension catalog with agent specifications |

## Key definitions
- **Demand space** = Human life motivation (JTBD), NOT a product feature. Must pass the "remove the product" test. Example: "Live comfortably in my community without friction" — not "Track my maintenance request."
- **Dimension** = A characteristic axis that modifies how we serve a demand space. Organized by Universal Dimension Taxonomy (5 types).
- **Dimension value** = A specific position on a dimension. Example: dimension "Budget Level" → values "Budget-conscious", "Mid-range", "Premium".
- **Behavior state** (marketing only) = How the person is acting now — engagement level + cognitive/emotional state — drives the 6 CRM activation levers.
- **Feature** (product/service) = AI or system capability that resolves a demand space for a specific dimension value. Maps to backend tools and generates user stories.
- **Journey phase** = Business lifecycle stage. Not a demand space. The shared timeline customers move through. Example: Search → Onboarding → In-Life.

## Universal Dimension Taxonomy
Five dimension types that modify how we serve any demand space:

| Type | What it captures | Examples |
|------|------------------|----------|
| **Knowledge** | What the customer knows | Expert vs Novice, Familiar vs First-time |
| **Intent** | Why they're here now | Browsing vs Buying, Researching vs Ready |
| **Composition** | Who they're with/for | Solo vs Group, Self vs Gift, Family composition |
| **Constraint** | Limitations they face | Budget level, Time pressure, Accessibility needs |
| **Moment** | Situational context | Device type, Location, Time of day, Emotional state |

**Formula:** Demand Space × Dimension Value = Specific Activation

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
- Confuse dimensions with demand spaces — dimension is a modifying characteristic (budget level, expertise), demand space is the underlying motivation
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
│       ├── generate-dimensions/route.ts      # Universal Dimension Taxonomy
│       ├── generate-marketing-activations/route.ts
│       ├── generate-product-activations/route.ts
│       └── generate-service-activations/route.ts
├── components/
│   ├── InputForm.tsx
│   ├── JourneyPhaseCard.tsx
│   ├── DemandSpaceCard.tsx                   # Shows dimensions + values
│   └── Toast.tsx
├── lib/
│   ├── store.ts                              # Zustand store with dimension actions
│   ├── types.ts                              # Dimension, DimensionValue types
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
- **Stats bar:** Live-updating counts for phases, demand spaces, dimensions, and values with loading spinner during generation
