import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, DemandSpace, Circumstance } from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert CRM strategist generating marketing activations.

For each circumstance, generate the 6 CRM levers that determine how to communicate with this customer.

Your output must be a JSON object with an "activations" array.

Each activation must have:
- circumstanceLabel: The circumstance this activation is for (for reference)
- messageDepth: "awareness" | "consideration" | "action" — where in the funnel to focus
- urgency: "low" | "medium" | "high" — how time-sensitive the message should be
- channel: Primary channel (email, SMS, push, in-app, etc.)
- tone: Message tone (informative, empathetic, urgent, celebratory, reassuring, etc.)
- offer: What to offer or highlight (deals, features, content, etc.)
- cadence: Frequency and timing (e.g., "immediate single touch", "weekly for 2 weeks", "event-triggered")

## Examples

For demand space "Stress-free planning" + circumstance "Budget traveler":
{
  "circumstanceLabel": "Budget traveler",
  "messageDepth": "consideration",
  "urgency": "medium",
  "channel": "email",
  "tone": "helpful",
  "offer": "Price drop alerts, budget-friendly packages, payment plans",
  "cadence": "Trigger on price drop, weekly deals digest"
}

For demand space "Build anticipation" + circumstance "First-time nervous visitor":
{
  "circumstanceLabel": "First-time nervous visitor",
  "messageDepth": "awareness",
  "urgency": "low",
  "channel": "email",
  "tone": "reassuring",
  "offer": "What to expect guides, FAQs, customer stories",
  "cadence": "Drip sequence: 7, 3, 1 days before"
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

    // NOTE: activation generation is pending migration to the new Circumstance
    // shape (Knowledge/Intent/Composition/Constraint/Moment axes + narrative +
    // struggle/progress). Using `moment` as a label substitute for now; the
    // UI is disabled until this is re-designed end-to-end.
    const circumstanceList = circumstances.map((c) => `- ${c.moment}`).join('\n');

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

    const painPointsContext = input.painPoints ? `
Known Pain Points:
${input.painPoints}` : '';

    const prompt = `Generate marketing activations for this demand space and circumstances:

Industry: ${input.industry}
Experience Types: ${input.experienceTypes?.join(', ') || 'Not specified'}
Business Description: ${input.businessDescription}
${techStackContext}
${productsContext}
${personasContext}
${painPointsContext}

Demand Space: ${demandSpace.label}
Motivation: ${demandSpace.jobToBeDone}

Circumstances to activate for:
${circumstanceList}

For EACH circumstance, generate the 6 CRM levers:
1. messageDepth (awareness/consideration/action)
2. urgency (low/medium/high)
3. channel (email/SMS/push/in-app/etc.)
4. tone (informative/empathetic/urgent/celebratory/reassuring/etc.)
5. offer (what to highlight or offer)
6. cadence (frequency and timing)

Think about how the circumstance MODIFIES how you'd serve this demand space.
A "Budget traveler" seeking "Stress-free planning" needs different messaging than a "High-spend luxury" customer.`;

    const result = await generateWithRetry<{ activations: Array<{
      circumstanceLabel: string;
      messageDepth: string;
      urgency: string;
      channel: string;
      tone: string;
      offer: string;
      cadence: string;
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
    console.error('Error generating marketing activations:', error);
    return NextResponse.json(
      { error: 'Failed to generate marketing activations' },
      { status: 500 }
    );
  }
}
