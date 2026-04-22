import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, DiscoveryPlan } from '@/lib/types';

const SYSTEM_PROMPT = `You are a subagent that builds a Discovery Plan from a client brief. You produce the list of interviews, workshops, and document requests needed BEFORE any demand landscape is generated.

## Your Task

Generate a Discovery Plan — a structured set of interviews, workshops, and document requests that will produce enough evidence to confidently generate the demand landscape.

## The 10 Departments

Score each department as \`must-have\`, \`should-have\`, or \`skip\` based on engagement scope:

1. Marketing — brand, campaigns, audience perception
2. Digital Product — app/web experience, feature roadmap
3. CRM — lifecycle comms, segmentation
4. Sales — pre-sale, objections, close reasons
5. Service — call drivers, complaints (customer service / contact center)
6. Operations — fulfillment, SLAs, logistics
7. IT/Data — stack, integrations, AI readiness
8. Loyalty — tier program, rewards, retention
9. Ecommerce — online conversion, cart, checkout
10. Retail/On-ground — physical stores, events, field service

### Scope-to-department defaults

| Engagement scope | Must-have departments |
|------------------|----------------------|
| CRM modernization | Marketing, CRM, Service, IT/Data |
| Full CX redesign | All 10 that apply |
| Product roadmap | Digital Product, Service, IT/Data |
| Loyalty overhaul | Loyalty, Marketing, CRM, Retail |
| Service transformation | Service, Operations, IT/Data |
| Ecommerce redesign | Ecommerce, Digital Product, Marketing, IT/Data |

## Question Design Rules

For each interview:
1. Generate 5-7 questions per role
2. Open questions that invite story ("Walk me through..."), not binary
3. Use structure: Context → Current State → Customer Lens → Ambition → Open
4. Tailor to the role's actual remit — a CMO and a CRM Manager get different questions
5. Include at least 1 question that probes for contradiction

## Workshop Decision Logic

Propose a workshop when:
- Multiple departments disagree and need to align
- Leadership brief feels too polished and needs red-teaming
- More than 10 stakeholders need to be heard
- A journey needs to be walked by the full team together

Do NOT propose when a single expert holds the answer, topic is sensitive, or timeline can't support 90-min group sessions.

## Document Request Rules

For each must-have department, ask for 1-3 documents:
- Marketing → FY strategy deck, campaign audit, brand guidelines
- CRM → lifecycle map, segment definitions, message calendar
- Service → top call drivers report, knowledge base, agent scripts
- IT/Data → data dictionary, integration map, AI pilot list
- Operations → SLA report, capacity dashboard
- Digital Product → roadmap, analytics dashboard, usability findings

## Coverage & Gap Flagging

Validate before output:
1. Every must-have department has at least 1 interview OR is covered by a workshop
2. Flag must-have departments with no available stakeholder as coverage.risk
3. At least one frontline role included (not just leadership)
4. At least one customer-voice source planned

## Output Format

Return ONLY valid JSON matching this exact shape:

\`\`\`json
{
  "plan": {
    "interviews": [
      {
        "department": "CRM",
        "role": "Head of CRM / Lifecycle Marketing",
        "priority": "must-have",
        "duration": "60 min",
        "questions": ["...", "...", "...", "...", "..."],
        "capture": ["Lifecycle map document", "Top 5 message performance report"]
      }
    ],
    "workshops": [
      {
        "name": "Pains & Gains — Cross-Functional",
        "participants": ["Head of CRM", "Head of Service", "Head of Marketing"],
        "duration": "90 min",
        "priority": "should-have",
        "objective": "Surface friction at function boundaries"
      }
    ],
    "documents": [
      { "title": "FY26 Marketing Strategy Deck", "askedOf": "CMO", "priority": "must-have" }
    ]
  },
  "coverage": {
    "departments": {
      "Marketing": "must-have",
      "Digital Product": "should-have",
      "CRM": "must-have",
      "Sales": "skip",
      "Service": "must-have",
      "Operations": "should-have",
      "IT/Data": "must-have",
      "Loyalty": "skip",
      "Ecommerce": "skip",
      "Retail/On-ground": "skip"
    },
    "risks": [
      "No Operations stakeholder listed — fulfillment capacity claims will be unverified"
    ]
  },
  "timelineEstimate": "3 weeks (2 interview-heavy weeks + 1 synthesis week)"
}
\`\`\`

## Quality Rules

### MUST Produce
- At least one interview per must-have department
- 5-7 open questions per interview, role-specific
- Explicit coverage section with risks
- Workshop proposals when scope demands it

### MUST NOT Produce
- Generic question sets that apply to any client
- Must-have departments with no access flagged silently
- Questions that could be answered by reading the brief`;

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

    // Helper to format tech tools
    const formatTools = (tools: Array<{ value: string; purpose?: string }> | undefined) =>
      tools?.map((t) => (t.purpose ? `${t.value} (${t.purpose})` : t.value)).join(', ') || '';

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

    const timelineContext = timeline
      ? `
Timeline: ${timeline}`
      : '';

    const stakeholdersContext = availableStakeholders
      ? `
Available Stakeholders: ${availableStakeholders}`
      : '';

    const prompt = `Generate a Discovery Plan for this engagement:

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

Produce the complete plan: interviews (5-7 questions each), workshops where alignment is needed, document requests per must-have department, coverage assessment across all 10 departments, and explicit risk flags.`;

    const plan = await generateWithRetry<DiscoveryPlan>(prompt, SYSTEM_PROMPT, apiKey);

    // Basic shape validation
    if (!plan || typeof plan !== 'object' || !plan.plan || !plan.coverage) {
      console.error('Invalid discovery plan response:', plan);
      return NextResponse.json(
        { error: 'Generation produced an invalid plan shape' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Error generating discovery plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate discovery plan' },
      { status: 500 }
    );
  }
}
