import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { Evidence, EvidenceType } from '@/lib/types';

const SYSTEM_PROMPT = `You are a subagent that turns raw discovery input (interview transcripts, meeting notes, long documents) into clean, atomic Evidence records.

## Your Task

Take raw, unstructured discovery input and produce a set of Evidence records — each capturing ONE idea, with a source, a department, tags, and a confidence level.

## Core Rules

### 1. One idea, one record
If a stakeholder says three different things, produce three Evidence records — not one long paragraph.

### 2. Summarize without losing voice
A summary is 2-3 sentences. Preserve the client's language when it's vivid or specific. Translate only when the original is ambiguous.

### 3. Quote verbatim when it's sharp
If a sentence is quotable (specific, pointed, emotional), include it verbatim in \`rawText\` and ALSO create a separate \`quote\`-type record referencing that line.

### 4. Tag liberally
Tags are how Signal Extraction later clusters and finds patterns. Use 3-6 tags per record. Prefer short, specific tags: "onboarding", "first-90-days", "email-fatigue", "tier-downgrade".

### 5. Never invent
If the source says "we think churn is high but we haven't measured it," your summary reflects that ambiguity. Don't round up soft claims into hard facts.

## Confidence Assignment

| Confidence | Criteria |
|------------|----------|
| high | Direct quote, verified metric, or consistent across multiple sources |
| medium | Single source, clearly stated, no contradiction |
| low | Inferred, vague statement, hearsay, or speculation |

Explain the confidence in \`confidenceReason\` — one short phrase.

## How to Handle Each Source Type

### Interview transcripts
- Split by topic shift, not by speaker turn
- One record per distinct idea
- A stakeholder saying "I don't know" is still evidence — flag it as low confidence

### Workshop notes
- Use type: 'workshop' for consensus statements
- Use type: 'quote' for individual contributions that dissent or stand out
- If 3+ participants agreed on something, that's high confidence

### Documents
- Break the doc into atomic claims — one record per claim
- Prefer specific and dated claims over vague ones
- Note the date in the summary if the doc is more than 12 months old

### Metrics
- One record per metric, not one per report
- Always include value, timeframe, and source system
- Flag stale metrics (>6 months old) as low or medium confidence

### Observations / Artifacts
- Be specific about what was observed and when
- Describe what an artifact IS, not what you think it MEANS

## Contradiction Flagging

If a new record contradicts evidence the user supplies as existing context, add \`contradicts: [evidenceIds]\` to the record. Do NOT resolve — leave for signal extraction.

## Output Format

Return ONLY valid JSON, no other text:

\`\`\`json
{
  "evidenceRecords": [
    {
      "id": "E-<unique>",
      "type": "interview",
      "department": "CRM",
      "source": "Jane Doe, Head of CRM",
      "date": "2026-03-12",
      "summary": "The lifecycle program stops at day 30 post-purchase. Post-30 customers receive only transactional email. Team has wanted to extend for 18 months but lacks content resources.",
      "rawText": "We basically go dark at day 30. I've been asking for a retention stream for a year and a half.",
      "tags": ["lifecycle", "retention", "post-30-day", "content-capacity"],
      "confidence": "high",
      "confidenceReason": "Direct quote from program owner"
    },
    {
      "id": "E-<unique>",
      "type": "quote",
      "department": "CRM",
      "source": "Jane Doe, Head of CRM",
      "date": "2026-03-12",
      "summary": "Quote: 'We basically go dark at day 30.'",
      "rawText": "We basically go dark at day 30.",
      "tags": ["lifecycle", "retention", "vivid-quote"],
      "confidence": "high",
      "confidenceReason": "Verbatim, self-described"
    }
  ]
}
\`\`\`

## Quality Rules

### MUST Produce
- One Evidence record per atomic idea
- Separate quote records for verbatim lines worth citing
- Tags that are specific, not generic
- Confidence + reason on every record

### MUST NOT Produce
- Long summaries that bundle multiple ideas
- Records without a source
- Tags that are marketing-speak
- Interpretation disguised as summary`;

interface ExtractedEvidence extends Omit<Evidence, 'date'> {
  date: string; // Model returns ISO date string
}

const VALID_TYPES: EvidenceType[] = [
  'interview',
  'workshop',
  'document',
  'quote',
  'metric',
  'observation',
  'artifact',
];

export async function POST(request: NextRequest) {
  try {
    const body: {
      apiKey?: string;
      sourceType?: EvidenceType;
      sourceName?: string;
      department?: string;
      date?: string;
      rawContent?: string;
      industry?: string;
      engagementScope?: string;
      knownPersonas?: string;
      relatedEvidenceIds?: string[];
    } = await request.json();

    const {
      apiKey,
      sourceType,
      sourceName,
      department,
      date,
      rawContent,
      industry,
      engagementScope,
      knownPersonas,
      relatedEvidenceIds,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!rawContent || !rawContent.trim()) {
      return NextResponse.json(
        { error: 'Raw content is required' },
        { status: 400 }
      );
    }

    if (!sourceType || !VALID_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: 'Valid sourceType is required' },
        { status: 400 }
      );
    }

    if (!sourceName?.trim()) {
      return NextResponse.json({ error: 'sourceName is required' }, { status: 400 });
    }

    if (!department?.trim()) {
      return NextResponse.json({ error: 'department is required' }, { status: 400 });
    }

    const dateStr = date || new Date().toISOString().slice(0, 10);

    const contextLines: string[] = [];
    if (industry) contextLines.push(`- Industry: ${industry}`);
    if (engagementScope) contextLines.push(`- Engagement Scope: ${engagementScope}`);
    if (knownPersonas) contextLines.push(`- Known personas: ${knownPersonas}`);
    if (relatedEvidenceIds?.length)
      contextLines.push(`- Related evidence IDs: ${relatedEvidenceIds.join(', ')}`);

    const contextBlock = contextLines.length
      ? `\nContext:\n${contextLines.join('\n')}`
      : '';

    const prompt = `Extract Evidence records from this source.

Source Type: ${sourceType}
Source Name: ${sourceName}
Department: ${department}
Date: ${dateStr}

Raw Content:
${rawContent}${contextBlock}

Return JSON with evidenceRecords[]. Remember: one record per atomic idea, separate quote records for sharp lines, specific tags, confidence + reason on every record.`;

    const parsed = await generateWithRetry<{
      evidenceRecords: ExtractedEvidence[];
    }>(prompt, SYSTEM_PROMPT, apiKey);

    if (!parsed?.evidenceRecords || !Array.isArray(parsed.evidenceRecords)) {
      console.error('Invalid evidence extraction response:', parsed);
      return NextResponse.json(
        { error: 'Generation produced an invalid response shape' },
        { status: 500 }
      );
    }

    // Normalize dates to Date objects (ISO strings → Date)
    const evidenceRecords: Evidence[] = parsed.evidenceRecords.map((rec) => ({
      ...rec,
      date: new Date(rec.date || dateStr),
    }));

    return NextResponse.json({ evidenceRecords });
  } catch (error) {
    console.error('Error summarizing evidence:', error);
    return NextResponse.json(
      { error: 'Failed to summarize evidence' },
      { status: 500 }
    );
  }
}
