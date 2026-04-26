import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';

/**
 * Per-document research summarizer.
 *
 * Each research artifact (transcript, ethnography, market scan,
 * analyst report, competitive teardown) gets distilled into a short
 * structured summary so downstream context blends can carry the
 * substance of every doc without re-paying for full-text tokens
 * on every prompt. The full text remains on
 * Model.input.researchDocuments[i].text so an agent can still
 * dive verbatim when it needs to cite.
 *
 * Companion agent doc: `.claude/agents/research-summarizer.md`.
 */

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a behavioral strategy analyst at Digitas. You read a single piece of research evidence (could be a customer interview transcript, ethnography note, market scan, analyst report, social listening report, competitive teardown, internal memo) and distill it into a tight structured summary that downstream agents can blend into prompts WITHOUT re-reading the full document.

Output MUST be a single JSON object with this shape:
{
  "headline": string,                      // 1-sentence framing of what this document is and why it matters
  "evidenceType": string,                  // e.g. "Customer interview", "Market scan", "Analyst report", "Internal memo", "Ethnography", "Competitive teardown", "Survey results", "Social listening"
  "keyFindings": string[],                 // 3-7 bullets — substantive takeaways, not chapter headings. Each bullet 1-2 sentences.
  "namedSegments": string[],               // any customer segments / personas / behavioral cohorts the doc names (e.g. "Annual Passholders", "First-time international visitors"). Empty array OK.
  "namedJourneys": string[],               // any customer journeys / lifecycle moments the doc references (e.g. "Departure", "First-week postpartum"). Empty array OK.
  "painsAndFrictions": string[],           // pains, frictions, jobs-to-be-done frustrations the document evidences. Verbatim or close-paraphrase.
  "opportunitiesOrHypotheses": string[],   // forward-looking opportunities, hypotheses, or recommended interventions surfaced by the doc.
  "directQuotes": string[],                // 0-5 short direct quotes worth carrying forward (only if the doc contains attributable speech, e.g. interviews). Otherwise empty array.
  "summary": string                         // 80-150 word prose distillation. Strategic vocabulary, no fluff. Preserve the document's terminology.
}

RULES:
- Distill, do not invent. If the doc is silent on a field, return an empty array / empty string.
- keyFindings are SUBSTANTIVE. "Section 2 covers wait times" is not a finding. "Guests abandon dining queues after ~12 minutes, especially family groups" is.
- directQuotes only appear when the doc contains real attributable speech (interview transcripts, social listening, surveys with verbatim responses). Don't fabricate.
- Use the document's own strategic vocabulary so downstream prompts don't drift terminology.
- summary is your distilled paraphrase — never a copy-paste of the document's intro or conclusion.
- Strict JSON only. No commentary, no markdown.`;

interface ResearchDocSummary {
  headline?: string;
  evidenceType?: string;
  keyFindings?: string[];
  namedSegments?: string[];
  namedJourneys?: string[];
  painsAndFrictions?: string[];
  opportunitiesOrHypotheses?: string[];
  directQuotes?: string[];
  summary?: string;
}

const MAX_DOC_CHARS = 80_000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      apiKey?: string;
      text?: string;
      filename?: string;
      briefContext?: string;
    };

    const { apiKey, text, filename, briefContext } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Document text is required' },
        { status: 400 }
      );
    }

    // Trim very long documents from the middle so we keep both the
    // framing intro and the closing conclusions.
    const trimmed =
      text.length > MAX_DOC_CHARS
        ? `${text.slice(0, MAX_DOC_CHARS / 2)}\n\n[... ${text.length - MAX_DOC_CHARS} characters elided ...]\n\n${text.slice(-MAX_DOC_CHARS / 2)}`
        : text;

    const briefBlock = briefContext
      ? `ENGAGEMENT CONTEXT (from the client brief — use to disambiguate vocabulary and segments):\n${briefContext.slice(0, 4000)}\n\n`
      : '';

    const prompt = `${briefBlock}DOCUMENT FILENAME: ${filename || '(no filename)'}

DOCUMENT TEXT:
${trimmed}

Distill per the schema. Respond with strict JSON.`;

    const summary = await generateWithRetry<ResearchDocSummary>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error summarizing research document:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown summarization error';
    return NextResponse.json(
      { error: `Failed to summarize document: ${message}` },
      { status: 500 }
    );
  }
}
