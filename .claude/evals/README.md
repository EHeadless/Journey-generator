# Skills & Agents Evaluation Harness

Lightweight evaluation framework for skill/agent prompts in this project.

## Methods

- **Exact-match** — runs the real API route, deep-equals schema-bearing output
  fields against frozen expectations. Used when the surface has a closed taxonomy
  (e.g. `problem-diagnostics-framework` discipline classification).
- **Rubric** — runs the real API route, then asks `gpt-4o-mini` to score the
  output against a 3-6 criterion rubric. Used for open-ended generation
  (e.g. `demand-space-framework` JTBDs).

## Usage

```bash
# Set your key
export OPENAI_API_KEY=sk-...

# Run everything
npm run eval

# Run a single surface
npm run eval -- problem-diagnostics
npm run eval -- demand-space

# Update exact-match snapshots after intentional prompt changes
npm run eval -- problem-diagnostics --update
```

## Layout

```
.claude/evals/
├── fixtures/                # input + expected per surface
│   ├── problem-diagnostics/
│   │   ├── 01-tech-stack-noise.json
│   │   ├── 02-governance-ambiguity.json
│   │   └── 03-cross-cutting-data.json
│   └── demand-space/
│       ├── 01-airline-pre-booking.json
│       └── 02-real-estate-onboarding.json
├── rubrics/
│   └── demand-space.md      # judge rubric (criteria + weights + gates)
├── runner/
│   ├── run.ts               # CLI entrypoint
│   ├── exact.ts             # exact-match harness
│   ├── rubric.ts            # LLM-judge harness
│   ├── surfaces.ts          # surface registry (which method, which fixtures)
│   └── util.ts              # shared helpers
└── results/
    └── <YYYY-MM-DD>/        # markdown + json reports per run
```

## Pass thresholds

- Exact-match: 100% per fixture (any field mismatch = fail).
- Rubric: weighted total ≥ 4.0/5 AND no gate criterion below 3.

## Adding a new surface

1. Drop fixtures under `.claude/evals/fixtures/<surface>/NN-name.json`
2. For rubric surfaces, create/extend `.claude/evals/rubrics/<surface>.md`
3. Register in `runner/surfaces.ts`
