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
    const { industry, businessDescription, experienceType, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!industry || !businessDescription || !experienceType) {
      return NextResponse.json(
        { error: 'Missing required fields: industry, businessDescription, experienceType' },
        { status: 400 }
      );
    }

    const prompt = `Generate journey phases for this business:

Industry: ${industry}
Experience Type: ${experienceType}
Business Description: ${businessDescription}

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
