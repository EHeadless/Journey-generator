import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import {
  JourneyPhase,
  ModelInput,
  Workshop,
  WorkshopAttendee,
  WorkshopQuestion,
  WorkshopQuestionIntent,
} from '@/lib/types';

/**
 * /api/generate-workshop-questions
 *
 * Given a specific workshop and the engagement brief, returns a
 * facilitator-ready question inventory for that workshop. Follows the
 * `workshop-questions-generator` skill:
 *
 *   • Pass A — open questions (untagged / context) always first.
 *   • Pass B — optional silos (phase / topic / intent) per workshop
 *     profile. Never enforced as a rigid ratio.
 *
 * Volume scales with workshop type — kick-off & definition ~15-25,
 * channel ~20-30, journey deep-dive (per phase) ~25-40, tech deep-dive
 * 30-50. The model is told not to cap itself.
 */

// ---------------------------------------------------------------------------
// Workshop profile detection
// ---------------------------------------------------------------------------

type WorkshopProfile =
  | 'kickoff'
  | 'governance'
  | 'high-level-journey'
  | 'channel'
  | 'journey-deep-dive'
  | 'tech-deep-dive'
  | 'audit-readout'
  | 'definition'
  | 'generic-discovery';

interface ProfileSpec {
  id: WorkshopProfile;
  label: string;
  target: string; // human volume guidance
  passA: string; // pass A instructions
  passB: string; // pass B instructions
}

const PROFILE_SPECS: Record<WorkshopProfile, ProfileSpec> = {
  kickoff: {
    id: 'kickoff',
    label: 'Kick-off / objectives',
    target: 'AT LEAST 15 questions (floor — go to 25+ if the brief or research support it)',
    passA:
      'All open questions, no intent forcing. Cover: business objectives (next 6/12/24 months), pain points leadership already sees, opportunity sizing, benchmarks and competitors, success criteria for this engagement, decision rights and executive sponsors, constraints (regulatory/political/timing), and what would make this engagement a failure.',
    passB:
      'Skip Pass B — stay conversational. Use `context` as the default intent tag.',
  },
  governance: {
    id: 'governance',
    label: 'Governance / delivery',
    target: 'AT LEAST 15 questions (floor — go to 25+ if evidence supports it)',
    passA:
      '5-8 open questions on how the client already runs complex programmes.',
    passB:
      'Topic silo: governance model (steering committees, working groups, RACI), operational reporting cadence and format, delivery methodology (SAFe/Scrum/Kanban/waterfall/hybrid), escalation paths, vendor ecosystem, prior-engagement success measures, tooling, and what has broken in past engagements.',
  },
  'high-level-journey': {
    id: 'high-level-journey',
    label: 'High-level journey',
    target:
      'AT LEAST 5-8 open questions + the full probe set for every phase supplied (a 5-phase journey should yield 25+ questions; never fewer than the floor)',
    passA:
      '5-8 open questions on the journey as a whole — who takes it, how often, what shape it has.',
    passB:
      'Phase silo. For EACH journey phase supplied, ask the same probe set: (a) all pain points in this phase, not just the top one, (b) what success looks like for the customer, (c) what the northstar looks like if everything worked perfectly, (d) hypotheses/ideas they already have, (e) signals telling them the phase is going well or badly, (f) who internally owns this phase. Tag every phase-silo question with that phase label.',
  },
  channel: {
    id: 'channel',
    label: 'Channel / product',
    target: 'AT LEAST 20 questions (floor — go to 30+ if the brief or research support it)',
    passA:
      '5-8 open questions on the channel/product overall — who uses it, what it is trying to do, what they are proud of, what they are embarrassed by.',
    passB:
      'Topic silo: audience strategy and segmentation, content strategy and message frameworks, orchestration rules and triggers, measurement and attribution, handoffs to and from other channels, data dependencies (identity/consent/preference), current performance (ALL the issues they care about — not just the top one), failure modes seen this year, and tooling/operational workflow.',
  },
  'journey-deep-dive': {
    id: 'journey-deep-dive',
    label: 'Journey deep-dive (single phase)',
    target: 'AT LEAST 25 questions for the selected phase (floor — go to 40+ if research surfaces more pains/opps)',
    passA:
      '5-8 open questions on the selected phase generally — who it matters to, how often customers hit it, what makes it hard.',
    passB:
      'Topic silo scoped to the selected phase. Cover: experience design (every touchpoint, what works, what does not, edge cases), tech (all systems involved, integrations, data flows, latency, auth), data (signals captured, what is missing, identity, consent), innovation (use-cases, AI opportunities, automation candidates), measurement (how instrumented today, what is blind), pain points (ALL of them), opportunities (unclaimed moments), contradictions (tensions between stated goals and observed behaviour). EVERY question must carry the selected phase label.',
  },
  'tech-deep-dive': {
    id: 'tech-deep-dive',
    label: 'Tech deep-dive',
    target: 'AT LEAST 30 questions (floor — go to 50+ when the stack is broad)',
    passA:
      '5-8 open questions on the stack overall — what they are proud of, what keeps them up at night, what they would rebuild if they could.',
    passB:
      'Topic silo — go wide. Stack inventory across CRM/CDP/CEP/DXP/analytics/AI; EVERY integration they rely on and how it fails (never ask about just "the last" one); data flows end-to-end (capture → store → activate); identity and consent architecture; observability, SLAs, incident history; security posture, compliance constraints; tech roadmap and investment priorities; tech debt and its cost; vendor lock-in and exit readiness; AI/automation readiness — data, eval, guardrails; team shape, skills gaps, staffing model.',
  },
  'audit-readout': {
    id: 'audit-readout',
    label: 'Current-state audit readout',
    target: 'AT LEAST 15 questions (floor — go to 25+ if the audit surfaces more)',
    passA:
      '4-6 open questions framing what the audit covers and how it was built.',
    passB:
      'Topic silo: what exists today (inventory); what is working well (keep list); what is broken (stop list); evidence sources behind each claim; ownership and accountability; when it was last reviewed/updated; dependencies on other audits or teams.',
  },
  definition: {
    id: 'definition',
    label: 'Definition workshop',
    target: 'AT LEAST 15 questions (floor — go to 25+ if scope is wide)',
    passA:
      '4-6 open questions on the workstream overall.',
    passB:
      'Topic silo: scope boundaries (in/out); success criteria for this workstream; stakeholders and approvers; dependencies on other workstreams; assumptions that could bite us later; risks and mitigations; timeline and sequencing constraints.',
  },
  'generic-discovery': {
    id: 'generic-discovery',
    label: 'Generic discovery',
    target: 'AT LEAST 12 questions (floor — go to 20+ when the brief is rich)',
    passA: '6-10 open questions grounded in the brief.',
    passB:
      'Optional intent silo (context → problem → jtbd → circumstance → need → opportunity → gap → contradiction) — only use the intents that sharpen this particular workshop. Contradictions go last.',
  },
};

function detectProfile(workshop: Partial<Workshop>): WorkshopProfile {
  const n = (workshop.name || '').toLowerCase();
  const summary = (workshop.summary || '').toLowerCase();
  const blob = `${n} ${summary}`;

  if (/kick[- ]?off|objective|introduction/.test(blob)) return 'kickoff';
  if (/governance|delivery|raci|operation/.test(blob)) return 'governance';
  if (/high[- ]level.*journey|journey.*overview/.test(blob))
    return 'high-level-journey';
  if (/deep[- ]dive.*journey|journey.*deep[- ]dive/.test(blob))
    return 'journey-deep-dive';
  if (/tech.*deep[- ]dive|technology deep[- ]dive|technical deep[- ]dive/.test(blob))
    return 'tech-deep-dive';
  if (/audit|current[- ]state|read[- ]?out/.test(blob)) return 'audit-readout';
  if (
    /scoping|cmp|dam|sitemap|ia |kpi|cpi|backlog|define[- ]?read|measurement framework|conceptual/.test(
      blob
    )
  )
    return 'definition';
  if (/channel|product|email|crm|web|mobile|contact centre|contact center/.test(blob))
    return 'channel';
  return 'generic-discovery';
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the Discovery Question Generator sub-agent
running in **workshop scope**. You build the question inventory for ONE
specific workshop, following the **workshop-questions-generator** skill.

## Non-negotiable rules

1. **Pass A — open questions come FIRST.** Broad, conversational, in the
   client's own frame. Usually tag these \`context\` or the clearest
   intent. Never skip Pass A.
2. **Pass B — silos are OPTIONAL.** Only add a Pass B section if the
   workshop's profile calls for it. Do not force the 8-intent taxonomy
   onto every workshop.
3. **Do NOT cap the client.** Never phrase questions as "the last X",
   "the biggest Y", "the top Z" when you really want to hear about all
   of them. Ask about "your integrations", "the pain points in this
   phase", "the kinds of X you see" — open the door wide.
4. Every question targets ONE role (\`targetRole\` must match a title
   from the workshop's clientAttendees or agencyAttendees). When no
   attendees are listed, use \`"(any attendee)"\`. Distribute questions
   across roles — one workshop should not be an interview with one
   person.
5. Every question has an **intent tag**, one of:
   \`context\` | \`problem\` | \`jtbd\` | \`circumstance\` | \`need\` |
   \`opportunity\` | \`gap\` | \`contradiction\`. \`context\` is the safe
   default for open questions.
6. If the engagement has defined journey phases, tag questions with the
   \`journeyPhase\` they probe (use the exact phase label). For
   journey-deep-dive workshops with a supplied phase, EVERY question
   MUST carry that phase label.
7. Include a brief \`rationale\` per question so the facilitator knows
   why we are asking and what signal we are fishing for.
8. **Volume is a FLOOR, not a ceiling.** The profile gives a minimum.
   Never return fewer than the floor. If the brief or research evidence
   support more good questions, write more — pad-free, distinct, sharp.
9. **Provenance is required.** Every question carries:
   - \`sourceContext\`: \`"form"\` | \`"brief"\` | \`"research"\` | \`"mixed"\`.
     Use \`"form"\` for questions you could have written from the
     structured brief form alone, \`"brief"\` for questions inspired by
     the verbatim brief document, \`"research"\` for questions inspired
     by an uploaded research artifact, and \`"mixed"\` when more than one
     source contributed.
   - \`sourceCitations\` (REQUIRED whenever \`sourceContext\` !== \`"form"\`):
     - \`briefExcerpt\`: ≤200-char verbatim snippet from the brief that
       seeded the question (omit when the brief was not the source).
     - \`researchDocId\`: the exact \`id\` of the research document the
       evidence came from (must match one of the supplied research doc
       ids — do NOT invent ids).
     - \`researchExcerpt\`: ≤200-char verbatim snippet from the research
       summary or quote list backing the question.
   When \`sourceContext\` is \`"form"\`, you may omit \`sourceCitations\`.

## Intent vocabulary (reference — not a required ratio)

- **context** — grounding / scene-setting, and safe default for open.
- **problem** — a specific pain that already exists.
- **jtbd** — the underlying motivation independent of the product.
- **circumstance** — the triggering context / forces before the moment.
- **need** — an explicit stated requirement.
- **opportunity** — unclaimed territory / expansion vectors.
- **gap** — delta between today and desired state.
- **contradiction** — pressure-test stated beliefs against evidence. Always last.

## Phrasing — narrow vs. open

| Narrow (do NOT produce)                               | Open (produce)                                                    |
|-------------------------------------------------------|-------------------------------------------------------------------|
| "Tell me about the **last** challenging integration." | "Walk us through your integrations — where do they break, which ones cost you most?" |
| "What is the **biggest** pain point in onboarding?"   | "What kinds of pain points show up during onboarding, across segments and devices?" |
| "What was the top feature request last quarter?"      | "What feature requests do you hear most — from customers, internal teams, partners?" |

## Grounding

Every question must include at least one of: a product/channel name
from the brief, a persona label, a pain point phrase, a specific metric
or artifact, or an industry-specific detail. Generic cross-client
questions are failures. When research evidence is supplied, prefer
language drawn from that evidence over generic phrasing.

## Output format

Return ONLY a valid JSON object:

\`\`\`json
{
  "questions": [
    {
      "targetRole": "Head of CRM",
      "text": "…",
      "intent": "problem",
      "journeyPhase": "Onboarding",
      "rationale": "…",
      "sourceContext": "research",
      "sourceCitations": {
        "researchDocId": "doc_abc123",
        "researchExcerpt": "First-time guests reported confusion picking up tickets at gate."
      }
    }
  ]
}
\`\`\`

No prose, no markdown — just the JSON.`;

const ALLOWED_INTENTS: WorkshopQuestionIntent[] = [
  'context',
  'problem',
  'jtbd',
  'circumstance',
  'need',
  'opportunity',
  'gap',
  'contradiction',
];

interface RawQuestion {
  targetRole?: string;
  text?: string;
  intent?: string;
  journeyPhase?: string;
  rationale?: string;
  sourceContext?: string;
  sourceCitations?: {
    briefExcerpt?: string;
    researchDocId?: string;
    researchExcerpt?: string;
  };
}

const ALLOWED_SOURCE_CONTEXTS = new Set([
  'form',
  'brief',
  'research',
  'mixed',
] as const);

const MAX_BRIEF_PROMPT_CHARS = 18_000;
const MAX_RESEARCH_DOC_PROMPT_CHARS = 4_000;
const MAX_CITATION_CHARS = 240;

function clipCitation(s: string): string {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > MAX_CITATION_CHARS
    ? trimmed.slice(0, MAX_CITATION_CHARS - 1) + '…'
    : trimmed;
}

interface RequestBody extends Partial<ModelInput> {
  apiKey?: string;
  workshop?: Partial<Workshop>;
  journeyPhases?: JourneyPhase[];
  /**
   * For journey-deep-dive workshops: the specific phase the room is
   * scoping to. When supplied, every generated question is forced to
   * carry this phase label (clobbers anything the model returns).
   */
  selectedPhaseLabel?: string;
  /**
   * For journey-deep-dive workshops: the journey name we're scoping to.
   * Used as prompt context.
   */
  selectedJourneyName?: string;
  /**
   * Optional override for profile detection — lets the UI force a
   * specific profile when the workshop name is ambiguous.
   */
  profileOverride?: WorkshopProfile;
}

/**
 * Attendees come in as WorkshopAttendee[] (with `title`) but legacy shape
 * may be string[]. Produce a plain list of role titles for the prompt.
 */
function titlesOf(
  attendees: WorkshopAttendee[] | string[] | undefined
): string[] {
  if (!attendees) return [];
  return attendees
    .map((a) => (typeof a === 'string' ? a : a.title))
    .filter((t) => typeof t === 'string' && t.trim().length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    const {
      apiKey,
      workshop,
      journeyPhases,
      selectedPhaseLabel,
      selectedJourneyName,
      profileOverride,
      industry,
      experienceTypes,
      businessDescription,
      personas,
      painPoints,
      products,
      techStack,
      briefDocument,
      researchDocuments,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!workshop || !workshop.name) {
      return NextResponse.json(
        { error: 'Workshop details are required' },
        { status: 400 }
      );
    }

    const profileId: WorkshopProfile =
      profileOverride && PROFILE_SPECS[profileOverride]
        ? profileOverride
        : detectProfile(workshop);
    const profile = PROFILE_SPECS[profileId];

    const clientTitles = titlesOf(workshop.clientAttendees);
    const agencyTitles = titlesOf(workshop.agencyAttendees);
    const attendeeList =
      clientTitles.length + agencyTitles.length > 0
        ? `
Client attendees (role titles): ${clientTitles.join(', ') || '(none listed)'}
Agency attendees (role titles): ${agencyTitles.join(', ') || '(none listed)'}`
        : '\nNo attendees listed — use "(any attendee)" as targetRole.';

    const sortedPhases = (journeyPhases || [])
      .slice()
      .sort((a, b) => a.order - b.order);

    const phaseContext =
      sortedPhases.length > 0
        ? `\nJourney phases available for tagging (use exact labels):
${sortedPhases
  .map((p) => `- ${p.label}${p.description ? ` — ${p.description}` : ''}`)
  .join('\n')}`
        : '';

    const selectedPhaseContext =
      profileId === 'journey-deep-dive' && selectedPhaseLabel
        ? `\n\n**SELECTED PHASE for this deep-dive:** "${selectedPhaseLabel}"${
            selectedJourneyName ? ` (in journey "${selectedJourneyName}")` : ''
          }\nEvery question you produce MUST carry journeyPhase="${selectedPhaseLabel}".`
        : '';

    const outcomes = (workshop.mainOutcomes || [])
      .map((o) => `- ${o}`)
      .join('\n');

    const formatTools = (
      tools: Array<{ value: string; purpose?: string }> | undefined
    ) =>
      tools
        ?.map((t) => (t.purpose ? `${t.value} (${t.purpose})` : t.value))
        .join(', ') || '';

    const techStackContext = techStack
      ? `
Tech Stack:
${techStack.crm?.length ? `- CRM: ${formatTools(techStack.crm)}` : ''}
${techStack.cdp?.length ? `- CDP: ${formatTools(techStack.cdp)}` : ''}
${techStack.cep?.length ? `- CEP: ${formatTools(techStack.cep)}` : ''}
${techStack.dxp?.length ? `- DXP: ${formatTools(techStack.dxp)}` : ''}
${techStack.aiModels?.length ? `- AI Models: ${formatTools(techStack.aiModels)}` : ''}`.trim()
      : '';

    const productsContext = products?.length
      ? `\nProducts/Channels:\n${products
          .map((p) => `- ${p.name}: ${p.description}`)
          .join('\n')}`
      : '';

    const personasContext = personas?.length
      ? `\nTarget Personas: ${personas.map((p) => p.label).join(', ')}`
      : '';

    const painPointsContext = painPoints
      ? `\nKnown Pain Points:\n${painPoints}`
      : '';

    // Brief and research documents — inject them as labelled blocks so
    // the model can ground questions in their language and cite back.
    const hasBrief = !!briefDocument?.text?.trim();
    const briefBlock = hasBrief
      ? `\n\n=== VERBATIM CLIENT BRIEF (filename: ${briefDocument!.filename}) ===\n${briefDocument!.text.slice(0, MAX_BRIEF_PROMPT_CHARS)}\n=== END BRIEF ===`
      : '';

    const validResearchDocs = (researchDocuments || []).filter(
      (d) => d && d.id && (d.summary?.summary?.trim() || d.text?.trim())
    );
    const knownResearchDocIds = new Set(validResearchDocs.map((d) => d.id));
    const hasResearch = validResearchDocs.length > 0;
    const researchBlock = hasResearch
      ? `\n\n=== RESEARCH EVIDENCE (${validResearchDocs.length} doc${
          validResearchDocs.length === 1 ? '' : 's'
        }) ===\n${validResearchDocs
          .map((d) => {
            const s = d.summary;
            const headline = s?.headline ? `Headline: ${s.headline}\n` : '';
            const findings =
              s?.keyFindings?.length
                ? `Key findings:\n${s.keyFindings.map((f) => `  - ${f}`).join('\n')}\n`
                : '';
            const pains =
              s?.painsAndFrictions?.length
                ? `Pains & frictions:\n${s.painsAndFrictions
                    .map((p) => `  - ${p}`)
                    .join('\n')}\n`
                : '';
            const opps =
              s?.opportunitiesOrHypotheses?.length
                ? `Opportunities / hypotheses:\n${s.opportunitiesOrHypotheses
                    .map((o) => `  - ${o}`)
                    .join('\n')}\n`
                : '';
            const quotes =
              s?.directQuotes?.length
                ? `Quotes:\n${s.directQuotes
                    .slice(0, 6)
                    .map((q) => `  · "${q}"`)
                    .join('\n')}\n`
                : '';
            const prose = s?.summary
              ? `Summary: ${s.summary}\n`
              : `Excerpt: ${(d.text || '').slice(0, MAX_RESEARCH_DOC_PROMPT_CHARS)}\n`;
            return `--- Research doc id: ${d.id} (filename: ${d.filename}) ---\n${headline}${prose}${findings}${pains}${opps}${quotes}`.trim();
          })
          .join('\n\n')}\n=== END RESEARCH ===`
      : '';

    const sourcesBanner = `\n\nSOURCES IN SCOPE: form fields${
      hasBrief ? ', verbatim brief' : ''
    }${hasResearch ? `, research evidence (${validResearchDocs.length} docs)` : ''}.
Use the \`sourceContext\` field on every question to indicate which source seeded it. When you cite the brief, supply \`sourceCitations.briefExcerpt\` (≤200 chars). When you cite research, supply \`sourceCitations.researchDocId\` (must be one of: ${
      hasResearch
        ? validResearchDocs.map((d) => d.id).join(', ')
        : '— no research available'
    }) and \`sourceCitations.researchExcerpt\` (≤200 chars).`;

    const prompt = `Generate the question inventory for this workshop.

Workshop:
  Name: ${workshop.name}
  Phase: ${workshop.phase || 'Discovery'}
  Duration: ${workshop.duration || '90 min'}
  Mode: ${workshop.mode || 'hybrid'}
  Summary: ${workshop.summary || '(no summary)'}
  Main outcomes:
${outcomes || '  (none specified)'}
${attendeeList}

## Profile for this workshop: ${profile.label}

**Target volume (FLOOR — never go below):** ${profile.target}.
Volume is a floor, not a ceiling. If the brief or research support more
good questions, write more — distinct, sharp, no padding.

**Pass A (open questions, always first):** ${profile.passA}

**Pass B:** ${profile.passB}

Engagement context:
  Industry: ${industry || 'Not specified'}
  Experience Types: ${(experienceTypes || []).join(', ') || 'Not specified'}
  Business Description: ${businessDescription || 'Not specified'}
${techStackContext}${productsContext}${personasContext}${painPointsContext}${phaseContext}${selectedPhaseContext}${sourcesBanner}${briefBlock}${researchBlock}

Order: Pass A first, then Pass B. Contradictions last (if used). Every
question must include \`sourceContext\` and (unless sourceContext is
"form") matching \`sourceCitations\`. Return only the JSON object.`;

    const raw = await generateWithRetry<
      { questions?: RawQuestion[] } | RawQuestion[]
    >(prompt, SYSTEM_PROMPT, apiKey);

    const rawList: RawQuestion[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.questions)
      ? raw.questions
      : [];

    if (rawList.length === 0) {
      console.error('Invalid workshop questions response:', raw);
      return NextResponse.json(
        { error: 'Generation produced no questions' },
        { status: 500 }
      );
    }

    const knownPhaseLabels = new Set(sortedPhases.map((p) => p.label));

    const questions: Array<
      Omit<WorkshopQuestion, 'id' | 'workshopId' | 'order'>
    > = rawList.map((q) => {
      const intent: WorkshopQuestionIntent = ALLOWED_INTENTS.includes(
        q.intent as WorkshopQuestionIntent
      )
        ? (q.intent as WorkshopQuestionIntent)
        : 'context';

      // Journey deep-dive with a selected phase: force the phase onto
      // every question regardless of what the model returned.
      let journeyPhase: string | undefined;
      if (profileId === 'journey-deep-dive' && selectedPhaseLabel) {
        journeyPhase = selectedPhaseLabel;
      } else if (q.journeyPhase && typeof q.journeyPhase === 'string') {
        journeyPhase =
          knownPhaseLabels.size === 0 || knownPhaseLabels.has(q.journeyPhase)
            ? q.journeyPhase
            : undefined;
      }

      // Validate provenance. If the model named a sourceContext that
      // requires evidence we didn't actually pass in, downgrade to
      // 'form' so the chip never lies.
      let sourceContext:
        | WorkshopQuestion['sourceContext']
        | undefined;
      const claimed = (q.sourceContext || '').toLowerCase();
      if (
        ALLOWED_SOURCE_CONTEXTS.has(
          claimed as 'form' | 'brief' | 'research' | 'mixed'
        )
      ) {
        sourceContext = claimed as WorkshopQuestion['sourceContext'];
      } else {
        // No claim — infer from what evidence we actually shipped to the
        // model, defaulting to 'form'.
        sourceContext = 'form';
      }
      if (sourceContext === 'brief' && !hasBrief) sourceContext = 'form';
      if (sourceContext === 'research' && !hasResearch) sourceContext = 'form';
      if (sourceContext === 'mixed' && !hasBrief && !hasResearch)
        sourceContext = 'form';

      // Validate citations. Drop research citations whose docId we
      // don't recognise — never trust an invented id downstream.
      let sourceCitations: WorkshopQuestion['sourceCitations'] | undefined;
      const rawCit = q.sourceCitations;
      if (rawCit && sourceContext !== 'form') {
        const briefExcerpt =
          typeof rawCit.briefExcerpt === 'string' && hasBrief
            ? clipCitation(rawCit.briefExcerpt)
            : undefined;
        const researchDocId =
          typeof rawCit.researchDocId === 'string' &&
          knownResearchDocIds.has(rawCit.researchDocId)
            ? rawCit.researchDocId
            : undefined;
        const researchExcerpt =
          typeof rawCit.researchExcerpt === 'string' && researchDocId
            ? clipCitation(rawCit.researchExcerpt)
            : undefined;
        if (briefExcerpt || researchDocId || researchExcerpt) {
          sourceCitations = {
            ...(briefExcerpt ? { briefExcerpt } : {}),
            ...(researchDocId ? { researchDocId } : {}),
            ...(researchExcerpt ? { researchExcerpt } : {}),
          };
        }
      }

      return {
        targetRole: q.targetRole || '(any attendee)',
        text: q.text || '',
        intent,
        ...(journeyPhase ? { journeyPhase } : {}),
        rationale: q.rationale,
        sourceContext,
        ...(sourceCitations ? { sourceCitations } : {}),
      };
    });

    return NextResponse.json({ questions, profile: profileId });
  } catch (error) {
    console.error('Error generating workshop questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate workshop questions' },
      { status: 500 }
    );
  }
}
