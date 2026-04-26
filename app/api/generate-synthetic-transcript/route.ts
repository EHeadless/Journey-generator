import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Generates a single synthetic Teams-style meeting transcript for a workshop.
 *
 * Input:
 *   - apiKey: OpenAI key
 *   - workshop: { code, name, phase, duration, summary, mainOutcomes,
 *                 agenda, clientAttendees, agencyAttendees, notes }
 *   - questions: WorkshopQuestion[] (optional)
 *   - brief: { industry, businessDescription, painPoints } (optional)
 *
 * Output: { transcript: string } — full transcript text in the exact format:
 *   Title line
 *   Metadata line 1 (Date · Duration · Location)
 *   Metadata line 2 (Attendees)
 *   ---
 *   [HH:MM:SS] Speaker
 *   Dialogue...
 *   (blank line between turns)
 *
 * The prompt enforces Teams-style messiness: cross-talk, tangents, parking-lot
 * items, contradictions, mind-changes, unidentified speakers, interruptions.
 */

type AttendeeIn = { title?: string; names?: string[] };
type QuestionIn = {
  text?: string;
  intent?: string;
  targetRole?: string;
  rationale?: string;
  journeyPhase?: string;
};

const SYSTEM_PROMPT = `You generate synthetic meeting transcripts that mimic a messy, real-world Microsoft Teams transcript captured when several people are sharing ONE room microphone. You are NOT summarising or narrating — you ONLY produce dialogue.

OUTPUT FORMAT
- JSON object with ONE field: "transcript" (string).
- The transcript is plain text (no markdown).
- Structure:
  line 1: title, e.g. "W03 — Pre-arrival Guest Journey"
  line 2: metadata, e.g. "Date: 2026-02-05 · Duration: 00:52:30 · Location: Emaar HQ, Dubai — Meeting Room Marina"
  line 3: attendees line, e.g. "Attendees: Ahmed Khan (CRM), Nadia Rahman (CX), Emma Thompson, Carlos Ramirez, Unidentified Speaker, Speaker 2"
  line 4: "---" on its own
  Then 60 to 100 dialogue turns, each turn is two lines:
      [HH:MM:SS] Speaker Name
      Their dialogue text on the following line(s).
  A single blank line separates turns.
- Timestamps increase monotonically. Start around 00:00:05. Gaps are realistic (3-90 seconds). The final timestamp should be between 00:40:00 and 01:10:00.

REALISM RULES — FOLLOW ALL
- Everyone is in one room. Speaker separation is unreliable. A large portion of turns (at least 15%) must be "Unidentified Speaker", "Speaker 2", or "Speaker 3".
- Some attendees join online / dial in late. Give one of them a late-join turn with a "Sorry I'm late, what did I miss?" vibe, or an off-mic note.
- Use the provided attendees by name AND by role. Mix named turns and role-only references.
- Dialogue must be conversational — people talk over each other, interrupt, trail off with a dash "—", say "um" / "uh" / "honestly" / "I mean" occasionally, repeat words ("that's — that's bad"), sigh.
- Include these moments, each at least once, woven naturally:
    (a) CROSS-TALK — two people responding at once, with "[laughter]" or similar bracketed note.
    (b) TANGENT — someone goes off-topic for 2-4 turns (e.g., parking, AC is too loud, traffic), then gets redirected.
    (c) PARKING LOT — facilitator says "park that", "we'll come back to it", etc.
    (d) CONTRADICTION — two attendees give different numbers / different positions, neither fully retracts.
    (e) MIND-CHANGE — one attendee retracts a prior position: "Actually — I've changed my mind" / "I came in thinking X, now I think Y."
    (f) SARCASM or dark humour — once, understated.
    (g) COMPOUND PROBLEM — one speaker lists three issues in one sentence.
    (h) INTERRUPTION mid-sentence — another speaker finishes the thought.
- Numbers: throw in at least 10 realistic numbers — percentages, currency (AED/USD), dates, vendor names (Emarsys, Salesforce, Opera, Tealium, Cloudsoft, Snowflake, etc.), durations.
- Keep each turn SHORT most of the time (1-3 sentences). Allow 5-10 longer turns for substantive answers.

ANSWERING QUESTIONS
- When the user provides workshop questions, ensure each one is ANSWERED somewhere in the transcript, but:
  - Scatter the answers. Don't ask the question verbatim. Don't answer it cleanly.
  - Answers may be partial, delivered across multiple turns, or require inference.
  - Sometimes the answer is buried INSIDE a tangent.
  - The right attendee role should provide the substantive answer, but others may chime in.
- ALSO include content that is OUTSIDE the provided questions:
  - New problems attendees raise spontaneously ("while we're on this — can I flag...")
  - Edge cases (a specific failure in a specific property, a data bug, a compliance risk)
  - Contradictions with things you are making up (numbers, policies)
  - Items that will be "parked" and never resolved
- Use the client brief (industry, business description, pain points) to ground the content so the transcript sounds like it belongs to THIS client — not generic.

HARD NO
- No markdown. No bullet points. No section headings inside the transcript body.
- No speaker lists / cast of characters at the end.
- No "end of transcript" marker.
- Do NOT break character — the transcript is raw captured dialogue, not a polished document.

Return ONLY the JSON object { "transcript": "..." }.`;

function formatAttendees(list: AttendeeIn[] | undefined, sideLabel: string): string {
  if (!list || list.length === 0) return '';
  const lines = list
    .map((a) => {
      const title = (a.title || '').trim();
      const names = (a.names || []).map((n) => (n || '').trim()).filter(Boolean);
      if (title && names.length) return `- ${title}: ${names.join(', ')}`;
      if (title) return `- ${title}`;
      if (names.length) return `- ${names.join(', ')}`;
      return null;
    })
    .filter(Boolean) as string[];
  if (!lines.length) return '';
  return `${sideLabel}:\n${lines.join('\n')}`;
}

function formatQuestions(qs: QuestionIn[] | undefined): string {
  if (!qs || qs.length === 0) return '(none provided — invent relevant workshop content from scratch based on brief + workshop summary)';
  const lines = qs.map((q, i) => {
    const bits: string[] = [];
    if (q.intent) bits.push(`[${q.intent}]`);
    if (q.targetRole) bits.push(`(for ${q.targetRole})`);
    const tag = bits.join(' ');
    return `${i + 1}. ${tag ? tag + ' ' : ''}${(q.text || '').trim()}`;
  });
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey: string = body.apiKey;
    const workshop = body.workshop || {};
    const questions: QuestionIn[] = Array.isArray(body.questions) ? body.questions : [];
    const brief = body.brief || {};

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!workshop.name) {
      return NextResponse.json(
        { error: 'Workshop name is required' },
        { status: 400 }
      );
    }

    const agencyBlock = formatAttendees(workshop.agencyAttendees, 'Agency attendees');
    const clientBlock = formatAttendees(workshop.clientAttendees, 'Client attendees');
    const agendaBlock =
      Array.isArray(workshop.agenda) && workshop.agenda.length > 0
        ? workshop.agenda
            .map((a: { duration?: string; label?: string; notes?: string }, i: number) => {
              const head = [a.duration, a.label].filter(Boolean).join(' — ') || `Slot ${i + 1}`;
              return `- ${head}${a.notes ? ` (${a.notes})` : ''}`;
            })
            .join('\n')
        : '(no agenda provided)';
    const outcomesBlock =
      Array.isArray(workshop.mainOutcomes) && workshop.mainOutcomes.length > 0
        ? workshop.mainOutcomes.map((o: string) => `- ${o}`).join('\n')
        : '(no outcomes provided)';

    const userPrompt = `Generate a synthetic Microsoft Teams transcript for the following workshop. Follow every realism rule in the system prompt. The transcript should feel like a ROOM recording — messy, natural, frustrating to read in places, full of cross-talk and tangents.

=== WORKSHOP ===
Code: ${workshop.code || '(no code)'}
Name: ${workshop.name}
Phase: ${workshop.phase || 'Discovery'}
Duration target: ${workshop.duration || '45-60 min'}
Summary: ${workshop.summary || '(no summary)'}

Main outcomes:
${outcomesBlock}

Agenda:
${agendaBlock}

${agencyBlock}

${clientBlock}

Notes: ${workshop.notes || '(none)'}

=== CLIENT BRIEF (for grounding) ===
Industry: ${brief.industry || '(not specified)'}
Business description: ${brief.businessDescription || '(not specified)'}
Known pain points: ${brief.painPoints || '(none supplied)'}

=== WORKSHOP QUESTIONS ===
Each of these questions MUST be answered somewhere in the transcript, but scattered, buried, or partial. Do not ask them verbatim. Use natural dialogue that eventually reveals the answer.

${formatQuestions(questions)}

=== INSTRUCTIONS ===
- Use the NAMED attendees provided. If an attendee has no name, use their title/role as the speaker name.
- Mix in "Unidentified Speaker", "Speaker 2", "Speaker 3" for ~15-25% of turns.
- If no agency attendees are listed, invent 1-2 Digitas facilitators with plausible English names.
- If a workshop is remote, include one late-joiner and maybe an off-mic comment.
- Weave in industry-specific detail: vendor names, metrics, process pain points drawn from the brief. DON'T be generic.
- Include AT LEAST: one cross-talk, one tangent, one parking-lot, one contradiction, one mind-change, one sarcasm, one compound problem, one mid-sentence interruption.
- Also include AT LEAST 3 things that are OUTSIDE the provided questions — spontaneous complaints, edge cases, side issues, data bugs, compliance worries.
- Timestamps must be in the format [HH:MM:SS] with leading zeros.
- Return ONLY the JSON: { "transcript": "<entire transcript as a single string>" }.`;

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.95,
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Empty response from OpenAI' },
        { status: 502 }
      );
    }

    let parsed: { transcript?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Model returned invalid JSON' },
        { status: 502 }
      );
    }

    const transcript = (parsed.transcript || '').trim();
    if (!transcript) {
      return NextResponse.json(
        { error: 'Model returned empty transcript' },
        { status: 502 }
      );
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('[generate-synthetic-transcript]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
