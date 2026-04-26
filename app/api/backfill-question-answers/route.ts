import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 90;

export const BACKFILL_PROMPT_VERSION = '1.0.0';

type Confidence = 'high' | 'medium' | 'low';

interface RetrievedChunk {
  chunkIndex: number;
  text: string;
  speaker?: string;
}

interface QuestionInput {
  questionId: string;
  question: string;
  retrievedChunks: RetrievedChunk[];
}

interface BackfillRequestBody {
  apiKey?: string;
  model?: string;
  workshopContext?: string;
  questions?: QuestionInput[];
}

interface BackfillAnswer {
  questionId: string;
  answerText: string | null;
  confidence: Confidence;
  confidenceReason?: string;
  citedChunkIndexes: number[];
}

interface BackfillResponseBody {
  promptVersion: string;
  modelName: string;
  answers: BackfillAnswer[];
}

const SYSTEM_PROMPT = `You are a behavioral strategist at Digitas backfilling answers to workshop / discovery questions from an interview or workshop transcript.

## Your Task

For each question you are given, read the retrieved transcript chunks and decide whether the transcript actually answers the question.

## Hard Rules

1. If the transcript does NOT address the question, return \`answerText: null\`. Do NOT invent an answer. A null answer is the correct, honest output when evidence is absent.
2. When you give an answer, it MUST be grounded in the retrieved chunks. Cite at least one \`chunkIndex\` in \`citedChunkIndexes\`.
3. Never cite a chunkIndex that wasn't provided to you for that question.
4. Quote specifics where possible — names, numbers, cadences, constraints. Avoid generic paraphrase.
5. Keep \`answerText\` tight — 1–3 sentences max. This is evidence, not an essay.

## Confidence Rubric

- \`high\` — a direct quote (or tight paraphrase of one speaker's explicit statement) answers the question. Use this ONLY with a clear supporting quote.
- \`medium\` — the answer is implied across multiple chunks or by strong context, but no single quote settles it.
- \`low\` — inferred from tangential context. Use sparingly; prefer \`answerText: null\` over a weak inference.

Include a short \`confidenceReason\` when confidence is \`medium\` or \`low\`, explaining why it's not \`high\`.

## Output Format

Return ONLY valid JSON matching this exact shape:

\`\`\`json
{
  "answers": [
    {
      "questionId": "<echo input id>",
      "answerText": "string or null",
      "confidence": "high" | "medium" | "low",
      "confidenceReason": "optional short string",
      "citedChunkIndexes": [0, 3]
    }
  ]
}
\`\`\`

Every \`questionId\` in the input must appear exactly once in the output. Do not invent question ids.`;

function formatQuestionBlock(q: QuestionInput): string {
  const chunksText = q.retrievedChunks.length
    ? q.retrievedChunks
        .map((c) => {
          const speakerTag = c.speaker ? `[${c.speaker}] ` : '';
          return `  - chunkIndex ${c.chunkIndex}: ${speakerTag}${c.text.trim()}`;
        })
        .join('\n')
    : '  (no chunks retrieved)';

  return `Question id: ${q.questionId}
Question: ${q.question}
Retrieved chunks:
${chunksText}`;
}

function clampConfidence(v: unknown): Confidence {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BackfillRequestBody;
    const apiKey = body.apiKey;
    const modelName = body.model || 'gpt-4o';
    const workshopContext = body.workshopContext?.trim();
    const questions = Array.isArray(body.questions) ? body.questions : [];

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'At least one question is required' },
        { status: 400 }
      );
    }

    const allowedIds = new Set(questions.map((q) => q.questionId));
    const allowedChunkIndexesByQuestion = new Map<string, Set<number>>();
    for (const q of questions) {
      allowedChunkIndexesByQuestion.set(
        q.questionId,
        new Set(q.retrievedChunks.map((c) => c.chunkIndex))
      );
    }

    const contextBlock = workshopContext
      ? `Workshop / engagement context:\n${workshopContext}\n\n`
      : '';
    const userPrompt = `${contextBlock}Backfill answers for the following questions. Use only the retrieved chunks provided under each question. Return null when the transcript doesn't answer.

${questions.map(formatQuestionBlock).join('\n\n---\n\n')}`;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Model returned empty content' },
        { status: 500 }
      );
    }

    let parsed: { answers?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Model returned invalid JSON' },
        { status: 500 }
      );
    }

    const rawAnswers = Array.isArray(parsed.answers) ? parsed.answers : [];
    const seen = new Set<string>();
    const answers: BackfillAnswer[] = [];

    for (const raw of rawAnswers) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const questionId = typeof r.questionId === 'string' ? r.questionId : null;
      if (!questionId || !allowedIds.has(questionId) || seen.has(questionId)) continue;
      seen.add(questionId);

      const answerTextRaw = r.answerText;
      const answerText =
        typeof answerTextRaw === 'string' && answerTextRaw.trim().length > 0
          ? answerTextRaw.trim()
          : null;

      const allowedChunkIndexes =
        allowedChunkIndexesByQuestion.get(questionId) ?? new Set<number>();
      const citedRaw = Array.isArray(r.citedChunkIndexes) ? r.citedChunkIndexes : [];
      const citedChunkIndexes = citedRaw
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        .filter((v) => allowedChunkIndexes.has(v));

      let confidence = clampConfidence(r.confidence);
      // If there's no answer, force low and drop citations.
      if (answerText === null) {
        confidence = 'low';
      } else if (citedChunkIndexes.length === 0 && confidence === 'high') {
        // High confidence requires a citation; degrade.
        confidence = 'medium';
      }

      const confidenceReason =
        typeof r.confidenceReason === 'string' && r.confidenceReason.trim().length > 0
          ? r.confidenceReason.trim()
          : undefined;

      answers.push({
        questionId,
        answerText,
        confidence,
        confidenceReason,
        citedChunkIndexes: answerText === null ? [] : citedChunkIndexes,
      });
    }

    // Ensure every input question is represented, even if the model dropped it.
    for (const q of questions) {
      if (!seen.has(q.questionId)) {
        answers.push({
          questionId: q.questionId,
          answerText: null,
          confidence: 'low',
          confidenceReason: 'Model did not return an answer for this question.',
          citedChunkIndexes: [],
        });
      }
    }

    const result: BackfillResponseBody = {
      promptVersion: BACKFILL_PROMPT_VERSION,
      modelName,
      answers,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error backfilling question answers:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
