import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { ModelInput, Workshop, WorkshopAgendaItem } from '@/lib/types';

/**
 * /api/generate-workshop-agenda
 *
 * Proposes a tentative agenda (time-boxed slots) for one workshop. Backed
 * by the `discovery-question-generator` sub-agent in `agenda` scope.
 */

const SYSTEM_PROMPT = `You propose a **tentative agenda** for one workshop.

## Rules

1. Respect the workshop's duration — slot durations should sum to roughly
   the total (leave 5-10 min buffer for 60-90 min workshops).
2. Every workshop opens with a \`Context-set\` slot (5-10 min) and closes
   with a \`Synthesis & next steps\` slot (10-15 min).
3. Group related questions into discussion slots (not one slot per
   question).
4. Include a **facilitator note** for any slot that requires setup,
   artifacts, or specific framing. Keep notes to 1 sentence.
5. Produce **4-7 slots** total.

## Output Format

Return ONLY valid JSON:

\`\`\`json
{
  "agenda": [
    { "label": "Context-set + framing", "duration": "10 min", "notes": "Share the brief, map attendees to outcomes." },
    { "label": "Friction mapping — customer lens", "duration": "30 min", "notes": "Walk journey stages, sticky-note each friction." },
    { "label": "Opportunity scoring", "duration": "25 min" },
    { "label": "Synthesis & next steps", "duration": "15 min", "notes": "Assign owners for follow-ups." }
  ]
}
\`\`\`
`;

interface RawAgendaItem {
  label?: string;
  duration?: string;
  notes?: string;
}

interface RequestBody extends Partial<ModelInput> {
  apiKey?: string;
  workshop?: Partial<Workshop>;
  existingQuestions?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { apiKey, workshop, existingQuestions, industry, experienceTypes } =
      body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!workshop || !workshop.name) {
      return NextResponse.json(
        { error: 'Workshop details are required' },
        { status: 400 }
      );
    }

    const outcomes = (workshop.mainOutcomes || [])
      .map((o) => `- ${o}`)
      .join('\n');

    const titlesOf = (a: unknown[]): string[] =>
      a
        .map((x) =>
          typeof x === 'string' ? x : (x as { title?: string })?.title
        )
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    const attendees = [
      ...titlesOf(workshop.clientAttendees || []),
      ...titlesOf(workshop.agencyAttendees || []),
    ].join(', ');

    const questionsContext =
      existingQuestions && existingQuestions.length > 0
        ? `\nQuestions to cover in the room:\n${existingQuestions
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n')}`
        : '';

    const prompt = `Propose a tentative agenda for this workshop.

Workshop:
  Name: ${workshop.name}
  Phase: ${workshop.phase || 'Discovery'}
  Duration: ${workshop.duration || '90 min'}
  Mode: ${workshop.mode || 'hybrid'}
  Summary: ${workshop.summary || '(no summary)'}
  Main outcomes:
${outcomes || '  (none specified)'}
  Attendees: ${attendees || '(none listed)'}

Engagement context:
  Industry: ${industry || 'Not specified'}
  Experience Types: ${(experienceTypes || []).join(', ') || 'Not specified'}
${questionsContext}

Produce 4-7 slots that fit the duration.`;

    const raw = await generateWithRetry<
      { agenda?: RawAgendaItem[] } | RawAgendaItem[]
    >(prompt, SYSTEM_PROMPT, apiKey);

    const rawList: RawAgendaItem[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.agenda)
      ? raw.agenda
      : [];

    if (rawList.length === 0) {
      console.error('Invalid agenda response:', raw);
      return NextResponse.json(
        { error: 'Generation produced no agenda slots' },
        { status: 500 }
      );
    }

    const agenda: Array<Omit<WorkshopAgendaItem, 'id'>> = rawList.map((a) => ({
      label: a.label || '',
      duration: a.duration,
      notes: a.notes,
    }));

    return NextResponse.json({ agenda });
  } catch (error) {
    console.error('Error generating workshop agenda:', error);
    return NextResponse.json(
      { error: 'Failed to generate workshop agenda' },
      { status: 500 }
    );
  }
}
