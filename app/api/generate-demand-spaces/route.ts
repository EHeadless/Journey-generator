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

RULES:
1. Labels must be 2-4 evocative words, NOT "I want to..." format
2. Job to Be Done follows: "When I [situation], I want to [action], so that [outcome]"
3. Each demand space must be distinct — no overlapping motivations
4. Be specific to this journey phase — different phases surface different motivations`;

export async function POST(request: NextRequest) {
  try {
    const body: {
      input: ModelInput;
      journeyPhase: JourneyPhase;
      apiKey?: string;
    } = await request.json();

    const { input, journeyPhase, apiKey } = body;

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

    const prompt = `Generate demand spaces for this journey phase:

Industry: ${input.industry}
Experience Type: ${input.experienceType}
Business Description: ${input.businessDescription}
${input.personaContext ? `Persona Context: ${input.personaContext}` : ''}
${input.painPoints ? `Known Pain Points: ${input.painPoints}` : ''}

Journey Phase: ${journeyPhase.label}
Phase Description: ${journeyPhase.description}
Phase Trigger: ${journeyPhase.trigger}

Generate 8-12 demand spaces representing the HUMAN MOTIVATIONS that bring customers into this specific journey phase.

Remember the "remove the product" test: Every motivation must exist even if this company's product doesn't exist.

DO NOT generate:
- Product features ("I want the app to...")
- UX requirements ("Seamless experience")
- Use cases ("Book a ticket", "Check my balance")`;

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
