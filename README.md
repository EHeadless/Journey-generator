# Demand Space Generation

A behavioral strategy engine that generates complete demand space models organized by journey phase. Built for CX strategists, CRM strategists, and product teams at agencies who need to systematize behavioral modeling before designing journeys, features, or service processes.

## What it does

Input a client brief and industry, and the system auto-generates:

1. **Journey Phases** — Business lifecycle stages (Search → Onboarding → In-Life)
2. **Demand Spaces** — Human life motivations (Jobs to Be Done), not product features
3. **Dimensions** — Contextual axes that modify how you serve each demand space (Knowledge, Intent, Composition, Constraint, Moment)
4. **Activations** — Specific outputs based on experience type:

| Experience Type | Output | Artifact |
|-----------------|--------|----------|
| **Marketing** | Behavior states → 6 CRM levers | CRM journey for Emarsys/Braze/SFMC |
| **Product** | Features → Jira-ready user stories | Prioritized feature backlog |
| **Service** | Agent specs → tools, knowledge, handoffs | Dimension catalog with agent specifications |

## Key concepts

- **Demand Space** = A human life motivation that exists independent of your product. Must pass the "remove the product" test. Example: "Live comfortably in my community without friction" — not "Track my maintenance request."

- **Dimension** = A characteristic axis that modifies how you serve a demand space. Five types: Knowledge, Intent, Composition, Constraint, Moment.

- **Formula**: Demand Space × Dimension Value = Specific Activation

## Getting started

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Enter your OpenAI API key in the header (stored in localStorage, never sent to our servers), fill in the client brief, and click Generate.

## Tech stack

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- Zustand (state management)
- OpenAI GPT-4o (generation)

## Project structure

```
├── app/
│   ├── page.tsx                    # Landing page
│   ├── new/page.tsx                # Input form
│   ├── model/[id]/page.tsx         # Main workspace
│   └── api/
│       ├── generate-journey-phases/
│       ├── generate-demand-spaces/
│       ├── generate-dimensions/
│       ├── generate-marketing-activations/
│       ├── generate-product-activations/
│       └── generate-service-activations/
├── components/
│   ├── InputForm.tsx
│   ├── JourneyPhaseCard.tsx
│   └── DemandSpaceCard.tsx
├── lib/
│   ├── store.ts                    # Zustand store
│   ├── types.ts                    # TypeScript definitions
│   └── openai.ts                   # OpenAI client
└── docs/                           # Reference materials
```

## How it works

1. User selects experience type (Marketing, Product, or Service)
2. User enters industry and client brief
3. System auto-cascades generation:
   - Journey phases generated first
   - Demand spaces generated per phase
   - Dimensions generated per demand space
   - Activations generated per dimension value
4. All cards auto-expand when generation completes
5. Export to HTML, PDF, or PPTX

## License

MIT
