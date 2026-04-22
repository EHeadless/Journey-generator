import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, JourneyPhase, GenerateDemandSpacesResponse } from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert behavioral strategist at Digitas, generating demand spaces (Jobs to Be Done) for client engagements.

Your output must be a JSON array containing 8-12 demand spaces.

Each demand space must have:
- label: 2-4 evocative words (NOT "I want to...")
- jobToBeDone: "When I [situation], I want to [action], so that [outcome]"

THE "REMOVE THE PRODUCT" TEST - CRITICAL:
Every demand space must pass this test: If you remove this company's product entirely, does the motivation still exist?

✅ GOOD: "Planned Family Holiday" — exists whether or not the company has an app
✅ GOOD: "Live Without Friction" — human desire that exists without any product

❌ BAD: "I want the app to enhance my visit" — fails the test, references product
❌ BAD: "Seamless booking experience" — this is a UX requirement, not a motivation

PHASE-SPECIFIC GENERATION - CRITICAL:
Journey phases represent different moments in the customer lifecycle with DIFFERENT motivations active.
- "Discover/Search" phase → Information-gathering, exploration, possibility mapping
- "Consider/Compare" phase → Evaluation, trade-off analysis, decision criteria
- "Purchase/Book" phase → Commitment, transaction confidence, logistics
- "Experience/Use" phase → In-the-moment needs, real-time problem solving
- "Reflect/Share" phase → Memory preservation, social signaling, future planning

RULES:
1. Labels must be 2-4 evocative words, NOT "I want to..." format
2. Job to Be Done follows: "When I [situation], I want to [action], so that [outcome]"
3. Each demand space must be distinct — no overlapping motivations
4. Be HIGHLY specific to this journey phase — the phase description tells you what motivations to focus on
5. Do NOT generate generic motivations that would apply to multiple phases`;

export async function POST(request: NextRequest) {
  try {
    const body: {
      input: ModelInput;
      journeyPhase: JourneyPhase;
      apiKey?: string;
    } = await request.json();

    const { input, journeyPhase, apiKey } = body;

    // Debug logging
    console.log('Generating demand spaces for phase:', {
      label: journeyPhase.label,
      description: journeyPhase.description,
      trigger: journeyPhase.trigger,
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!input || !journeyPhase) {
      return NextResponse.json(
        { error: 'Missing required fields: input, journeyPhase' },
        { status: 400 }
      );
    }

    // Helper to format tech tools
    const formatTools = (tools: Array<{value: string; purpose?: string}> | undefined) =>
      tools?.map(t => t.purpose ? `${t.value} (${t.purpose})` : t.value).join(', ') || '';

    // Build context sections
    const techStackContext = input.techStack ? `
Tech Stack:
${input.techStack.cloudWarehouse?.length ? `- Cloud Warehouse: ${formatTools(input.techStack.cloudWarehouse)}` : ''}
${input.techStack.dataStorage?.length ? `- Data Storage: ${formatTools(input.techStack.dataStorage)}` : ''}
${input.techStack.crm?.length ? `- CRM: ${formatTools(input.techStack.crm)}` : ''}
${input.techStack.cdp?.length ? `- CDP: ${formatTools(input.techStack.cdp)}` : ''}
${input.techStack.cep?.length ? `- CEP: ${formatTools(input.techStack.cep)}` : ''}
${input.techStack.dxp?.length ? `- DXP: ${formatTools(input.techStack.dxp)}` : ''}
${input.techStack.aiModels?.length ? `- AI Models: ${formatTools(input.techStack.aiModels)}` : ''}
${input.techStack.aiPlatform?.length ? `- AI Platform: ${formatTools(input.techStack.aiPlatform)}` : ''}`.trim() : '';

    const productsContext = input.products?.length ? `
Products/Channels:
${input.products.map(p => `- ${p.name}: ${p.description}`).join('\n')}` : '';

    const personasContext = input.personas?.length ? `
Target Personas: ${input.personas.map(p => p.label).join(', ')}` : '';

    const prompt = `Generate demand spaces for this specific journey phase:

JOURNEY PHASE: ${journeyPhase.label}
${journeyPhase.description ? `WHAT HAPPENS IN THIS PHASE: ${journeyPhase.description}` : ''}
${journeyPhase.trigger ? `PHASE ENTRY TRIGGER: ${journeyPhase.trigger}` : ''}

CRITICAL: The demand spaces you generate MUST be specific to what customers are doing in "${journeyPhase.label}" phase.
${journeyPhase.description ? `Focus on the motivations that are active when: ${journeyPhase.description}` : ''}

Business Context:
Industry: ${input.industry}
Experience Types: ${input.experienceTypes?.join(', ') || 'Not specified'}
Business Description: ${input.businessDescription}
${techStackContext}
${productsContext}
${personasContext}
${input.painPoints ? `Known Pain Points:\n${input.painPoints}` : ''}

Generate 8-12 demand spaces representing the HUMAN MOTIVATIONS that are SPECIFIC TO THIS PHASE.

PHASE-SPECIFIC REQUIREMENTS:
- Each demand space must reflect what customers are trying to accomplish during "${journeyPhase.label}"
- Different phases should surface DIFFERENT motivations
- If this is "Discover/Search", focus on exploration and information-gathering motivations
- If this is "Consider/Compare", focus on evaluation and decision-making motivations
- If this is "Purchase", focus on transaction and commitment motivations
- Etc.

Remember the "remove the product" test: Every motivation must exist even if this company's product doesn't exist.

DO NOT generate:
- Product features ("I want the app to...")
- UX requirements ("Seamless experience")
- Use cases ("Book a ticket", "Check my balance")
- Generic motivations that apply to ALL phases (make them phase-specific)`;

    const demandSpaces = await generateWithRetry<GenerateDemandSpacesResponse['demandSpaces']>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    // Validate we got an array with 8-12 items
    if (!Array.isArray(demandSpaces) || demandSpaces.length < 6 || demandSpaces.length > 14) {
      console.error('Invalid demand spaces response:', demandSpaces);
      return NextResponse.json(
        { error: 'Generation produced invalid number of demand spaces' },
        { status: 500 }
      );
    }

    // Basic validation: check that labels don't start with "I want"
    const invalidSpaces = demandSpaces.filter(
      (ds) => ds.label?.toLowerCase().startsWith('i want')
    );
    if (invalidSpaces.length > 0) {
      console.warn('Some demand spaces have invalid labels:', invalidSpaces);
    }

    return NextResponse.json({ demandSpaces });
  } catch (error) {
    console.error('Error generating demand spaces:', error);
    return NextResponse.json(
      { error: 'Failed to generate demand spaces' },
      { status: 500 }
    );
  }
}
