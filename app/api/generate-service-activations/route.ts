import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, DemandSpace, Circumstance } from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert service design strategist generating agent specifications.

For each circumstance, generate the service tools, knowledge, and processes needed to serve this customer.

Your output must be a JSON object with an "activations" array.

Each activation must have:
- circumstanceLabel: The circumstance this specification is for (for reference)
- tools: Systems/tools the agent should use (CRM actions, backend systems, etc.)
- knowledge: Knowledge articles or scripts to surface
- c360Signals: Customer 360 data points to show the agent
- handoffRules: When/how to escalate or transfer

## Examples

For demand space "Resolve issues quickly" + circumstance "Budget traveler":
{
  "circumstanceLabel": "Budget traveler",
  "tools": "Refund calculator with fee waiver authority, alternative rebooking tool sorted by price",
  "knowledge": "Budget-friendly resolution options, payment plan eligibility, fee waiver guidelines",
  "c360Signals": "Price sensitivity score, past complaint history, loyalty tier, total spend",
  "handoffRules": "Escalate to supervisor if refund exceeds $500 or if customer requests manager"
}

For demand space "Feel recognized" + circumstance "VIP/Celebrity":
{
  "circumstanceLabel": "VIP/Celebrity",
  "tools": "VIP protocol activation, privacy mode toggle, direct escalation to VIP desk",
  "knowledge": "VIP handling procedures, media protocol, privacy requirements",
  "c360Signals": "VIP tier, special requirements, past preferences, assigned relationship manager",
  "handoffRules": "Immediate transfer to VIP desk, never place on hold, supervisor notified automatically"
}

For demand space "Navigate efficiently" + circumstance "Parents with infants":
{
  "circumstanceLabel": "Parents with infants",
  "tools": "Family services locator, stroller/wheelchair dispatch, priority queue override",
  "knowledge": "Baby facilities locations, family-friendly routes, child safety procedures",
  "c360Signals": "Family profile, child ages, accessibility needs, past service requests",
  "handoffRules": "Transfer to family services desk for complex requests, escalate safety concerns immediately"
}`;

export async function POST(request: NextRequest) {
  try {
    const body: {
      input: ModelInput;
      demandSpace: DemandSpace;
      circumstances: Circumstance[];
      apiKey?: string;
    } = await request.json();

    const { input, demandSpace, circumstances, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!input || !demandSpace || !circumstances?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: input, demandSpace, circumstances' },
        { status: 400 }
      );
    }

    const circumstanceList = circumstances.map((c) => `- ${c.label}`).join('\n');

    const prompt = `Generate service specifications for this demand space and circumstances:

Industry: ${input.industry}
Experience Type: ${input.experienceType}
Business Description: ${input.businessDescription}
${input.techStack ? `Tech Stack: ${input.techStack}` : ''}

Demand Space: ${demandSpace.label}
Motivation: ${demandSpace.jobToBeDone}

Circumstances to create service specs for:
${circumstanceList}

For EACH circumstance, generate agent specifications:
1. tools (systems/tools to use - CRM actions, backend systems, dispatch tools)
2. knowledge (articles, scripts, procedures to surface)
3. c360Signals (customer data points to show the agent)
4. handoffRules (when/how to escalate or transfer)

Think about how the circumstance MODIFIES what the agent needs.
A "Budget traveler" needs different service approach than a "VIP customer", even for the same demand space.`;

    const result = await generateWithRetry<{ activations: Array<{
      circumstanceLabel: string;
      tools: string;
      knowledge: string;
      c360Signals: string;
      handoffRules: string;
    }> }>(prompt, SYSTEM_PROMPT, apiKey);

    const activations = result.activations || result;

    if (!Array.isArray(activations) || activations.length === 0) {
      console.error('Invalid activations response:', result);
      return NextResponse.json(
        { error: 'Generation produced invalid activations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ activations });
  } catch (error) {
    console.error('Error generating service activations:', error);
    return NextResponse.json(
      { error: 'Failed to generate service activations' },
      { status: 500 }
    );
  }
}
