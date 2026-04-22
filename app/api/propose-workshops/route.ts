import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import {
  ModelInput,
  Workshop,
  WorkshopMode,
  WorkshopStatus,
} from '@/lib/types';

/** Attendee shape emitted by the model. Title-only; specific names are
 *  filled in by humans in the UI. */
interface RawAttendee {
  title?: string;
  role?: string; // tolerate legacy / alternative key
  names?: unknown;
}

/**
 * /api/propose-workshops
 *
 * Given a client brief, returns a proposed workshop inventory (4-10 scoped
 * workshops across Discovery → Alignment → Strategy → Activation phases).
 * Backed by the `workshop-planner` sub-agent (see
 * `.claude/agents/workshop-planner.md`).
 */

const SYSTEM_PROMPT = `You are the Workshop Planner sub-agent for the Digitas Journey Generator.

Given a client brief, propose a **workshop inventory**: 4-10 scoped workshops
across the phases Discovery → Alignment → Strategy → Activation. Each
workshop in the inventory has a fixed shape (see below).

## Phase Ordering

- Discovery: surface truth, pressure-test the brief
- Alignment: converge on shared language (demand spaces, dimensions, personas)
- Strategy: decide what we build (activations, features, CRM levers)
- Activation: prep the launch (rollout, metrics)

Evidence precedes alignment. Do not propose an Alignment or Strategy
workshop before at least one Discovery workshop.

## Design Rules

1. **Name is action-oriented.** "Pains & Gains — CRM Lifecycle", not
   "CRM Workshop".
2. **Summary is 1-3 sentences.** What + why, not how.
3. **Main outcomes are 3-5 concrete decisions or deliverables.**
   "Agreed list of 6-8 demand spaces for Pre-Arrival" — not "align on
   demand spaces".
4. **Attendees match outcomes.** If the outcome is a signed-off feature
   backlog, the Product Owner must be in the room.
5. **Duration matches complexity.** 60 min narrow, 90 min cross-functional,
   2-3h all-day strategy rooms.
6. **Mode defaults to hybrid** unless timeline/geography forces otherwise.
7. **Status starts at "proposed".**
8. **Dependencies are explicit.** "Needs W02 complete".
9. **Pre-reads are real docs.** Lifecycle map, KPI dashboard, NPS report.

## MUST Produce
- 4-10 workshops, sequenced by phase
- At least one Discovery workshop before any Alignment workshop
- At least one workshop per experience type in scope
- Realistic dependencies where ordering matters

## MUST NOT Produce
- Generic workshops that apply to any client
- "Kickoff" / "Intro" sessions (those are meetings)
- Workshops with >15 attendees
- Outcomes like "discuss X" (not an outcome)
- One workshop per department

## Output Format

Return ONLY valid JSON matching this exact shape:

\`\`\`json
{
  "workshops": [
    {
      "code": "W01",
      "phase": "Discovery",
      "name": "Customer Journey Walk",
      "track": "CX",
      "duration": "90 min",
      "mode": "hybrid",
      "status": "proposed",
      "summary": "Walk end-to-end journey with a cross-functional group.",
      "mainOutcomes": [
        "Annotated journey map with friction flags",
        "Shortlist of top 8-10 friction moments ranked by severity",
        "Agreement on which 2-3 stages to prioritize for signal extraction"
      ],
      "clientAttendees": [
        { "title": "Head of CX" },
        { "title": "Head of CRM" }
      ],
      "agencyAttendees": [
        { "title": "CX Strategist" }
      ],
      "preReads": ["Current journey map", "NPS trend"],
      "dependencies": []
    }
  ]
}
\`\`\`

- phase ∈ {Discovery, Alignment, Strategy, Activation}
- mode ∈ {onsite, hybrid, remote}
- status: always "proposed"
- code: "W01", "W02", … in phase order
- **clientAttendees / agencyAttendees are arrays of \`{ title: string }\`**.
  Do NOT include people's names — propose the **role** only. Humans fill
  in names in the UI. If you have zero good candidates for a side, return
  an empty array, not a placeholder.
`;

const ALLOWED_MODES: WorkshopMode[] = ['onsite', 'hybrid', 'remote'];
const ALLOWED_STATUSES: WorkshopStatus[] = [
  'draft',
  'proposed',
  'scheduled',
  'done',
  'skipped',
];

interface RawWorkshop {
  code?: string;
  phase?: string;
  name?: string;
  track?: string;
  duration?: string;
  mode?: string;
  status?: string;
  summary?: string;
  mainOutcomes?: string[];
  clientAttendees?: Array<string | RawAttendee>;
  agencyAttendees?: Array<string | RawAttendee>;
  preReads?: string[];
  dependencies?: string[];
  notes?: string;
}

/** Coerce LLM attendee output (strings or {title}) into {title, names?}. */
function coerceAttendees(
  input: unknown
): Array<{ title: string; names?: string[] }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (typeof item === 'string') {
        const title = item.trim();
        return title ? { title } : null;
      }
      if (item && typeof item === 'object') {
        const rec = item as RawAttendee;
        const title =
          typeof rec.title === 'string'
            ? rec.title
            : typeof rec.role === 'string'
            ? rec.role
            : '';
        if (!title.trim()) return null;
        const namesRaw = rec.names;
        const names = Array.isArray(namesRaw)
          ? (namesRaw.filter(
              (n) => typeof n === 'string' && n.trim()
            ) as string[])
          : undefined;
        return names && names.length
          ? { title: title.trim(), names }
          : { title: title.trim() };
      }
      return null;
    })
    .filter((a): a is { title: string; names?: string[] } => a !== null);
}

/** Normalize a model-produced workshop so it matches the Workshop shape. */
function normalizeWorkshop(
  w: RawWorkshop,
  idx: number
): Omit<
  Workshop,
  'id' | 'order' | 'agenda' | 'clientAttendees' | 'agencyAttendees'
> & {
  agenda: [];
  clientAttendees: Array<{ title: string; names?: string[] }>;
  agencyAttendees: Array<{ title: string; names?: string[] }>;
} {
  const mode = ALLOWED_MODES.includes(w.mode as WorkshopMode)
    ? (w.mode as WorkshopMode)
    : 'hybrid';
  const status = ALLOWED_STATUSES.includes(w.status as WorkshopStatus)
    ? (w.status as WorkshopStatus)
    : 'proposed';

  return {
    code: w.code || `W${String(idx + 1).padStart(2, '0')}`,
    phase: w.phase || 'Discovery',
    name: w.name || 'Untitled workshop',
    track: w.track,
    duration: w.duration || '90 min',
    mode,
    status,
    summary: w.summary || '',
    mainOutcomes: Array.isArray(w.mainOutcomes) ? w.mainOutcomes : [],
    agenda: [],
    clientAttendees: coerceAttendees(w.clientAttendees),
    agencyAttendees: coerceAttendees(w.agencyAttendees),
    preReads: Array.isArray(w.preReads) ? w.preReads : [],
    dependencies: Array.isArray(w.dependencies) ? w.dependencies : [],
    notes: w.notes,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ModelInput & {
      apiKey?: string;
      engagementScope?: string;
      timeline?: string;
      availableStakeholders?: string;
    } = await request.json();

    const {
      industry,
      businessDescription,
      experienceTypes,
      techStack,
      products,
      personas,
      painPoints,
      apiKey,
      engagementScope,
      timeline,
      availableStakeholders,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!experienceTypes || experienceTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one experience type is required' },
        { status: 400 }
      );
    }

    const formatTools = (
      tools: Array<{ value: string; purpose?: string }> | undefined
    ) =>
      tools
        ?.map((t) => (t.purpose ? `${t.value} (${t.purpose})` : t.value))
        .join(', ') || '';

    const techStackContext = techStack
      ? `
Tech Stack:
${techStack.cloudWarehouse?.length ? `- Cloud Warehouse: ${formatTools(techStack.cloudWarehouse)}` : ''}
${techStack.dataStorage?.length ? `- Data Storage: ${formatTools(techStack.dataStorage)}` : ''}
${techStack.crm?.length ? `- CRM: ${formatTools(techStack.crm)}` : ''}
${techStack.cdp?.length ? `- CDP: ${formatTools(techStack.cdp)}` : ''}
${techStack.cep?.length ? `- CEP: ${formatTools(techStack.cep)}` : ''}
${techStack.dxp?.length ? `- DXP: ${formatTools(techStack.dxp)}` : ''}
${techStack.aiModels?.length ? `- AI Models: ${formatTools(techStack.aiModels)}` : ''}
${techStack.aiPlatform?.length ? `- AI Platform: ${formatTools(techStack.aiPlatform)}` : ''}`.trim()
      : '';

    const productsContext = products?.length
      ? `
Products/Channels:
${products.map((p) => `- ${p.name}: ${p.description}`).join('\n')}`
      : '';

    const personasContext = personas?.length
      ? `
Target Personas: ${personas.map((p) => p.label).join(', ')}`
      : '';

    const painPointsContext = painPoints
      ? `
Known Pain Points:
${painPoints}`
      : '';

    const scopeContext = engagementScope
      ? `
Engagement Scope: ${engagementScope}`
      : '';
    const timelineContext = timeline ? `\nTimeline: ${timeline}` : '';
    const stakeholdersContext = availableStakeholders
      ? `\nAvailable Stakeholders: ${availableStakeholders}`
      : '';

    const prompt = `Propose a workshop inventory for this engagement.

Industry: ${industry || 'Not specified'}
Experience Types: ${experienceTypes.join(', ')}
Business Description: ${businessDescription || 'Not specified'}
${techStackContext}
${productsContext}
${personasContext}
${painPointsContext}
${scopeContext}
${timelineContext}
${stakeholdersContext}

Return 4-10 scoped workshops, sequenced across Discovery → Alignment →
Strategy → Activation phases. Every workshop must have concrete main
outcomes and a realistic attendee list drawn from the context above.`;

    const raw = await generateWithRetry<{ workshops?: RawWorkshop[] } | RawWorkshop[]>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    const rawList: RawWorkshop[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.workshops)
      ? raw.workshops
      : [];

    if (rawList.length === 0) {
      console.error('Invalid workshop proposal response:', raw);
      return NextResponse.json(
        { error: 'Generation produced no workshops' },
        { status: 500 }
      );
    }

    const workshops = rawList.map(normalizeWorkshop);

    return NextResponse.json({ workshops });
  } catch (error) {
    console.error('Error proposing workshops:', error);
    return NextResponse.json(
      { error: 'Failed to propose workshops' },
      { status: 500 }
    );
  }
}
