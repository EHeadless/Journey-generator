import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, DemandSpace, Circumstance } from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert product strategist generating feature specifications.

For each circumstance, generate a product feature that addresses how to serve this customer's demand space given their situation.

Your output must be a JSON object with an "activations" array.

Each activation must have:
- circumstanceLabel: The circumstance this feature is for (for reference)
- feature: Short feature name (2-5 words)
- description: What the feature does (1-2 sentences)
- userStory: Jira-ready user story in format "As a [user], I want [action] so that [benefit]"
- priority: "high" | "medium" | "low"

## Examples

For demand space "Stress-free planning" + circumstance "Budget traveler":
{
  "circumstanceLabel": "Budget traveler",
  "feature": "Price Alert System",
  "description": "Automatically monitors prices and notifies users when their saved items drop below their set threshold.",
  "userStory": "As a budget-conscious traveler, I want to set price alerts for my wishlist items so that I can book when prices drop within my budget.",
  "priority": "high"
}

For demand space "Navigate efficiently" + circumstance "Parents with infants":
{
  "circumstanceLabel": "Parents with infants",
  "feature": "Family Facilities Finder",
  "description": "Shows nearby baby changing stations, nursing rooms, and kid-friendly rest areas on the map.",
  "userStory": "As a parent with an infant, I want to quickly find baby facilities on my route so that I can plan breaks around my child's needs.",
  "priority": "high"
}

For demand space "Feel recognized" + circumstance "Low battery":
{
  "circumstanceLabel": "Low battery",
  "feature": "Battery-Aware Mode",
  "description": "Automatically reduces app animations and background refresh when device battery is low, and shows nearby charging stations.",
  "userStory": "As a user with low battery, I want the app to conserve power and show charging options so that I can stay connected without draining my device.",
  "priority": "medium"
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

    const prompt = `Generate product features for this demand space and circumstances:

Industry: ${input.industry}
Experience Type: ${input.experienceType}
Business Description: ${input.businessDescription}
${input.techStack ? `Tech Stack: ${input.techStack}` : ''}

Demand Space: ${demandSpace.label}
Motivation: ${demandSpace.jobToBeDone}

Circumstances to build features for:
${circumstanceList}

For EACH circumstance, generate a product feature:
1. feature (short name, 2-5 words)
2. description (what it does, 1-2 sentences)
3. userStory (Jira-ready: As a... I want... so that...)
4. priority (high/medium/low based on frequency × impact)

Think about how the circumstance MODIFIES what feature is needed.
A "Budget traveler" needs different product capabilities than a "High-spend luxury" customer, even for the same demand space.`;

    const result = await generateWithRetry<{ activations: Array<{
      circumstanceLabel: string;
      feature: string;
      description: string;
      userStory: string;
      priority: string;
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
    console.error('Error generating product activations:', error);
    return NextResponse.json(
      { error: 'Failed to generate product activations' },
      { status: 500 }
    );
  }
}
