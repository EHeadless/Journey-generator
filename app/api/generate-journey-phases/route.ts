import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import {
  ModelInput,
  GenerateJourneyPhasesResponse,
  DiscoveryBundle,
} from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert behavioral strategist at Digitas, generating journey phases for client engagements.

Your output must be a JSON object with a "journeyPhases" array containing 4-7 journey phases.

Each phase must have:
- label: Short name for the phase
- description: What happens during this phase (1-2 sentences)
- trigger: What event marks entry into this phase

CRITICAL RULES:
1. Phases must be BUSINESS-SPECIFIC, not generic marketing funnels
2. Phases represent the customer LIFECYCLE — stages ALL customers move through
3. Do NOT use generic phases like "Awareness → Consideration → Decision"
4. Think about how THIS specific business's customers actually progress

Example for a theme park:
{"journeyPhases": [
  {"label": "Inspire", "description": "Customer discovers the destination and begins imagining a visit", "trigger": "First exposure to brand content or word-of-mouth"},
  {"label": "Purchase", "description": "Customer commits to visiting by booking tickets or packages", "trigger": "Completes ticket purchase"},
  {"label": "Pre-Arrival", "description": "Period between booking and arriving at the destination", "trigger": "Purchase confirmed"},
  {"label": "On-Site", "description": "Customer is physically at the destination experiencing attractions", "trigger": "Enters the park gates"},
  {"label": "Post-Visit", "description": "Customer reflects on their experience and considers future visits", "trigger": "Leaves the destination"}
]}`;

export async function POST(request: NextRequest) {
  try {
    const body: ModelInput & {
      apiKey?: string;
      discoveryBundle?: DiscoveryBundle;
      // Per-journey context. A single model can have multiple journeys
      // (e.g. Arrival / Transit / Departure). The caller tells us which
      // journey we're generating phases for; we scope the prompt to it
      // so the phases fit the journey, not the whole model.
      journeyContext?: { name?: string; jtbdBlueprint?: string };
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
      discoveryBundle,
      journeyContext,
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
    const formatTools = (tools: Array<{value: string; purpose?: string}> | undefined) =>
      tools?.map(t => t.purpose ? `${t.value} (${t.purpose})` : t.value).join(', ') || '';

    // Build context sections
    const techStackContext = techStack ? `
Tech Stack:
${techStack.cloudWarehouse?.length ? `- Cloud Warehouse: ${formatTools(techStack.cloudWarehouse)}` : ''}
${techStack.dataStorage?.length ? `- Data Storage: ${formatTools(techStack.dataStorage)}` : ''}
${techStack.crm?.length ? `- CRM: ${formatTools(techStack.crm)}` : ''}
${techStack.cdp?.length ? `- CDP: ${formatTools(techStack.cdp)}` : ''}
${techStack.cep?.length ? `- CEP: ${formatTools(techStack.cep)}` : ''}
${techStack.dxp?.length ? `- DXP: ${formatTools(techStack.dxp)}` : ''}
${techStack.aiModels?.length ? `- AI Models: ${formatTools(techStack.aiModels)}` : ''}
${techStack.aiPlatform?.length ? `- AI Platform: ${formatTools(techStack.aiPlatform)}` : ''}`.trim() : '';

    const productsContext = products?.length ? `
Products/Channels:
${products.map(p => `- ${p.name}: ${p.description}`).join('\n')}` : '';

    const personasContext = personas?.length ? `
Target Personas: ${personas.map(p => p.label).join(', ')}` : '';

    const painPointsContext = painPoints ? `
Known Pain Points:
${painPoints}` : '';

    // Build discovery context if a bundle is attached. Evidence and signals
    // become a "reality check" section — the model should let the lifecycle
    // reflect what real customers and operators are saying, not only the brief.
    const buildDiscoveryContext = (bundle?: DiscoveryBundle): string => {
      if (!bundle) return '';

      const sig = bundle.candidateSignals;
      const totalSignals =
        sig.problems.length + sig.needs.length + sig.opportunities.length + sig.gaps.length;

      // Top 10 evidence records, biased toward high-confidence + quotes
      const rankedEvidence = [...bundle.approvedEvidence]
        .sort((a, b) => {
          const rank = (e: typeof a) =>
            (e.confidence === 'high' ? 2 : e.confidence === 'medium' ? 1 : 0) +
            (e.type === 'quote' ? 1 : 0);
          return rank(b) - rank(a);
        })
        .slice(0, 10);

      const evidenceLines = rankedEvidence
        .map((e) => `- [${e.department}·${e.confidence}·${e.type}] ${e.summary}`)
        .join('\n');

      const signalLines = [
        ...sig.problems.slice(0, 3).map((s) => `- PROBLEM: ${s.text}`),
        ...sig.needs.slice(0, 3).map((s) => `- NEED: ${s.text}`),
        ...sig.opportunities.slice(0, 2).map((s) => `- OPPORTUNITY: ${s.text}`),
        ...sig.gaps.slice(0, 2).map((s) => `- GAP: ${s.text}`),
      ].join('\n');

      return `

DISCOVERY BUNDLE (approved by ${bundle.approvedBy}) — use this as the dominant signal.
${bundle.approvedEvidence.length} evidence records · ${totalSignals} signals across problems/needs/opportunities/gaps.

Representative evidence:
${evidenceLines || '(none)'}

Key signals:
${signalLines || '(none)'}

When generating phases:
- Let the real friction points and transitions named in the evidence shape the phase boundaries.
- Phases should name moments where these problems actually bite or these opportunities emerge.
- If the evidence contradicts a generic lifecycle shape, follow the evidence.`;
    };

    const discoveryContext = buildDiscoveryContext(discoveryBundle);

    // If the caller passed a specific journey (name + Pre-discovery JTBD blueprint), we
    // narrow the prompt to that journey. The business may span several
    // parallel journeys (Arrival / Transit / Departure); phases for one
    // should not bleed into the others.
    const journeyName = journeyContext?.name?.trim();
    const journeyBlueprint = journeyContext?.jtbdBlueprint?.trim();
    const journeyContextSection = journeyName
      ? `\n\nJOURNEY SCOPE — generate phases ONLY for this journey:
- Name: ${journeyName}${journeyBlueprint ? `\n- Customer's job-to-be-done: ${journeyBlueprint}` : ''}

Phases must live inside this journey. Do not describe the broader lifecycle or other journeys. Start at the trigger that opens this journey and end where it closes.`
      : '';

    const prompt = `Generate journey phases for this business:

Industry: ${industry || 'Not specified'}
Experience Types: ${experienceTypes.join(', ')}
Business Description: ${businessDescription || 'Not specified'}
${techStackContext}
${productsContext}
${personasContext}
${painPointsContext}
${discoveryContext}${journeyContextSection}

Generate 4-7 sequential journey phases that represent ${journeyName ? `the ${journeyName} journey` : `THIS business's specific customer lifecycle`}. Remember:
- These are stages ALL customers move through${journeyName ? ` inside the ${journeyName} journey` : ', regardless of their motivation'}
- Each phase needs a clear entry trigger
- Be specific to this industry and business model
- Do NOT use generic marketing funnel stages${discoveryContext ? '\n- Ground phase boundaries and triggers in the approved discovery evidence above' : ''}${journeyName ? `\n- Stay inside the ${journeyName} journey scope; ignore activity that belongs to other journeys` : ''}`;

    const journeyPhases = await generateWithRetry<GenerateJourneyPhasesResponse['journeyPhases']>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    // Validate we got an array with 4-7 items
    if (!Array.isArray(journeyPhases) || journeyPhases.length < 4 || journeyPhases.length > 7) {
      console.error('Invalid journey phases response:', journeyPhases);
      return NextResponse.json(
        { error: 'Generation produced invalid number of phases' },
        { status: 500 }
      );
    }

    return NextResponse.json({ journeyPhases });
  } catch (error) {
    console.error('Error generating journey phases:', error);
    return NextResponse.json(
      { error: 'Failed to generate journey phases' },
      { status: 500 }
    );
  }
}
