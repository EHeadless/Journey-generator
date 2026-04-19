import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, GenerateJourneyPhasesResponse } from '@/lib/types';

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
    const body: ModelInput & { apiKey?: string } = await request.json();
    const { industry, businessDescription, experienceTypes, techStack, products, personas, painPoints, apiKey } = body;

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

    const prompt = `Generate journey phases for this business:

Industry: ${industry || 'Not specified'}
Experience Types: ${experienceTypes.join(', ')}
Business Description: ${businessDescription || 'Not specified'}
${techStackContext}
${productsContext}
${personasContext}
${painPointsContext}

Generate 4-7 sequential journey phases that represent THIS business's specific customer lifecycle. Remember:
- These are stages ALL customers move through, regardless of their motivation
- Each phase needs a clear entry trigger
- Be specific to this industry and business model
- Do NOT use generic marketing funnel stages`;

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
