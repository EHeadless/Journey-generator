import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, DemandSpace, JourneyPhase, GenerateDimensionsResponse } from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert behavioral strategist generating dimensions for a demand space within a journey phase.

Dimensions are NAMED AXES OF CUSTOMER CONTEXT — aspects of a person's situation that change HOW a demand space should be fulfilled.

**The Personalization Formula:**
Demand Space × Dimension Value = Specific Activation

## The 5 Universal Dimension Types (Your Scaffold)

Use these 5 types as your thinking framework. Output industry-specific labels, NOT the type names.

### 1. Knowledge (The Friction Dimension)
How much does this person know about the product, place, process, or category?
- Banking: "Financial literacy" · Theme park: "Familiarity" · SaaS: "Technical proficiency"
- Values: First-time user, Returning customer, Expert

### 2. Intent (The Stakes Dimension)
What's the urgency, emotional weight, and definition of success?
- Aviation: "Trip purpose" · E-commerce: "Purchase context" · Healthcare: "Visit urgency"
- Values: High-stakes event, Routine task, Emergency

### 3. Composition (The Ecosystem Dimension)
Who or what is around them during this interaction?
- Theme park: "Group" · Streaming: "Viewing context" · B2B: "User role"
- Values: Solo, Couple, Family with kids, Large group, Corporate

### 4. Constraint (The Limitation Dimension)
What external factors limit what's possible right now?
- Theme park: "Accessibility" · Aviation: "Travel constraints" · E-commerce: "Fulfillment limitations"
- Values: Wheelchair user, Budget cap, Time restriction, Language barrier

### 5. Moment (The Temporal Dimension)
What's the life context, calendar context, or emotional moment?
- Theme park: "Life moment" · E-commerce: "Life context" · Real Estate: "Life transition"
- Values: Birthday, Holiday rush, Bereavement, New baby, Routine

## Generation Rules

1. Consider all 5 types before generating
2. Include at least 3 types that are relevant to this crossing
3. Skip types that genuinely don't apply (justify by phase relevance)
4. Use industry-specific labels — output "Familiarity" not "Knowledge"
5. You MAY add a custom 6th dimension if industry demands it — but this should be rare
6. Total: 3-5 dimensions, each with 2-4 values

## Output Format

Your output must be a JSON object with a "dimensions" array containing 3-5 dimensions.

Each dimension must have:
- label: Short axis name (e.g., "Familiarity", "Group", "Economic")
- description: What this axis represents
- values: Array of 2-4 specific positions on this axis

Each value must have:
- label: Specific position (e.g., "First-time visitor", "Budget-conscious")
- description: What this value means
- impact: How this changes what we do for them

## Quality Test

Every dimension must pass: "Would a customer use this word to describe an aspect of their situation?"
- ✅ "I'm on a budget" → Economic dimension (Constraint type)
- ✅ "I'm here with my grandparents" → Group dimension (Composition type)
- ✅ "It's my first time" → Familiarity dimension (Knowledge type)
- ❌ "My digital engagement is high" — no customer says this
- ❌ "I'm in the consideration phase" — marketing funnel, not situation

## BAD DIMENSIONS (REJECT these)
- "Digital Engagement" — channel metric, not customer situation
- "Guest Demographics" — data table, not experience axis
- "Touchpoint Integration" — systems architecture concept
- "Pass Holder Lifecycle" — CRM segment, not situation
- "Personal Condition" — too vague
- The type names themselves: "Knowledge", "Intent", "Composition", "Constraint", "Moment"`;

export async function POST(request: NextRequest) {
  try {
    const body: {
      input: ModelInput;
      journeyPhase: JourneyPhase;
      demandSpace: DemandSpace;
      apiKey?: string;
    } = await request.json();

    const { input, journeyPhase, demandSpace, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!input || !journeyPhase || !demandSpace) {
      return NextResponse.json(
        { error: 'Missing required fields: input, journeyPhase, demandSpace' },
        { status: 400 }
      );
    }

    const prompt = `Generate dimensions for this demand space × journey phase crossing:

**Industry:** ${input.industry}
**Business Description:** ${input.businessDescription}
**Experience Type:** ${input.experienceType}
${input.personaContext ? `**Persona Context:** ${input.personaContext}` : ''}

**Journey Phase:** ${journeyPhase.label}
**Phase Description:** ${journeyPhase.description}

**Demand Space:** ${demandSpace.label}
**Job to Be Done:** ${demandSpace.jobToBeDone}

Generate 3-5 dimensions using the 5 Universal Dimension Types as your scaffold:
1. **Knowledge** — How much do they know? → Output: "Familiarity", "Experience level", "Technical proficiency"
2. **Intent** — What's at stake? → Output: "Purpose", "Urgency", "Visit occasion"
3. **Composition** — Who's around them? → Output: "Group", "Travel party", "Viewing context"
4. **Constraint** — What limits them? → Output: "Mobility", "Budget", "Accessibility"
5. **Moment** — What's the bigger picture? → Output: "Life stage", "Occasion", "Calendar context"

Consider all 5 types. Include at least 3 that are relevant. Skip types that genuinely don't apply. Use industry-specific labels, NOT the type names.

For each dimension, generate 2-4 values — specific positions on that axis that would change how this demand space should be fulfilled.

CRITICAL:
- Dimensions must be relevant to THIS phase — Mobility matters on-site, not during online browsing
- Values must be SPECIFIC SITUATIONS a customer would describe
- Labels must be industry-specific — never output the type names (Knowledge, Intent, etc.)

Return ONLY valid JSON with a "dimensions" array.`;

    const result = await generateWithRetry<GenerateDimensionsResponse>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    const dimensions = result.dimensions || result;

    // Validate we got an array with 3-5 items
    if (!Array.isArray(dimensions) || dimensions.length < 2 || dimensions.length > 6) {
      console.error('Invalid dimensions response:', result);
      return NextResponse.json(
        { error: 'Generation produced invalid number of dimensions' },
        { status: 500 }
      );
    }

    // Validate each dimension has values
    const dimensionsWithoutValues = dimensions.filter(
      (d) => !d.values || d.values.length < 2
    );
    if (dimensionsWithoutValues.length > 0) {
      console.warn('Some dimensions have few values:', dimensionsWithoutValues);
    }

    return NextResponse.json({ dimensions });
  } catch (error) {
    console.error('Error generating dimensions:', error);
    return NextResponse.json(
      { error: 'Failed to generate dimensions' },
      { status: 500 }
    );
  }
}
