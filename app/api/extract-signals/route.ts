import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { Evidence, Signal } from '@/lib/types';

const SYSTEM_PROMPT = `You are a subagent that reads a set of Evidence records and extracts structured Signals — Problems, Needs, Opportunities, and Gaps — that will drive generation.

## Your Task

Read all Evidence records and produce Signal records. Each Signal is classified as one of four types, cites its evidence sources (by evidenceId), and carries a confidence level derived from evidence.

## The Four Signal Types

| Type | Definition |
|------|------------|
| problem | A pain the client has NAMED and felt |
| need | An explicit request or capability ask |
| opportunity | A growth play the client sees but hasn't pursued |
| gap | A missing capability, data point, or process the consultant identifies |

### Disambiguation rules
- Pain language ("we lose customers", "our data is broken") → problem
- Request language ("we need", "we should have") → need
- Ambition language ("we could", "there's room to") → opportunity
- Consultant-identified missing element (not client-voiced) → gap

## Extraction Process

### Step 1: Read all evidence before extracting
Signals cluster across records. Don't extract record-by-record.

### Step 2: Cluster before naming
If 5 stakeholders from 3 departments describe the same friction, that's ONE signal with FIVE sources.

### Step 3: Classify
If a cluster contains both problem-language and need-language, produce TWO signals (one problem, one need) and link them via relatedSignalIds.

### Step 4: Write signal text
- 1-2 sentences
- Specific and actionable
- Use the client's language when vivid
- WHAT is happening, not the root cause

### Step 5: Assign confidence (FROM EVIDENCE)

| Confidence | Required |
|------------|----------|
| high | >= 2 Evidence records OR 1 quote + 1 metric |
| medium | 1 Evidence record, or multiple of same type from same person |
| low | Inferred / consultant-identified with no direct evidence / single low-confidence source |

### Step 6: Identify gaps
After extracting client-voiced signals, review for what's NOT there. Consultant-identified gaps are always low or medium confidence.

### Step 7: Flag contradictions
If two signals conflict, add a contradictions entry — signalIds + neutral note. Do NOT resolve.

### Step 8: Propose action (optional)
If there's an obvious next step, include it in proposedAction. One sentence.

## CRITICAL: Use the Provided Evidence IDs

The evidence records provided in input have specific \`id\` values (they may look like UUIDs or short codes). You MUST cite those exact IDs in the \`sources[].evidenceId\` field. Do not invent new evidence IDs.

## Output Format

Return ONLY valid JSON, no other text:

\`\`\`json
{
  "signals": [
    {
      "id": "S-001",
      "type": "problem",
      "text": "The lifecycle program stops at day 30 post-purchase — post-30 customers receive only transactional email.",
      "department": "CRM",
      "sources": [
        { "evidenceId": "<exact id from input>", "quote": "We basically go dark at day 30." }
      ],
      "relatedSignalIds": ["S-003"],
      "confidence": "high",
      "confidenceReason": "Named by CRM lead + corroborated by CSAT metric",
      "proposedAction": "Propose 'post-purchase relationship' demand space in In-Life phase"
    }
  ],
  "contradictions": [
    {
      "signalIds": ["S-008", "S-019"],
      "note": "Marketing claims brand resonance is high; Service reports daily complaints about brand-promise gap."
    }
  ],
  "stats": {
    "signalCount": 42,
    "byType": { "problem": 18, "need": 12, "opportunity": 8, "gap": 4 },
    "byConfidence": { "high": 22, "medium": 16, "low": 4 },
    "contradictionCount": 2
  },
  "redFlags": []
}
\`\`\`

## Red Flags to Surface in redFlags[]
- All signals are problem type
- All signals are high confidence
- One department has >50% of signals
- Zero gap signals

## Quality Rules

### MUST Produce
- Signals classified into exactly one of four types
- At least one evidence source per signal
- Confidence derived from evidence rules, not guessed
- Separate signals for problem vs need when both exist in a cluster

### MUST NOT Produce
- Signals without evidence citations
- High-confidence ratings for single-source signals (unless verified metric + quote)
- Silent contradiction resolution
- Generic signals that could apply to any client
- Signals that are just restatements of the brief`;

export async function POST(request: NextRequest) {
  try {
    const body: {
      apiKey?: string;
      evidence?: Evidence[];
      industry?: string;
      experienceTypes?: string[];
      businessDescription?: string;
      engagementScope?: string;
      personas?: string[];
    } = await request.json();

    const {
      apiKey,
      evidence,
      industry,
      experienceTypes,
      businessDescription,
      engagementScope,
      personas,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }
    if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
      return NextResponse.json(
        { error: 'At least one evidence record is required' },
        { status: 400 }
      );
    }

    // Serialize evidence for the model — strip noise, ensure dates are strings.
    const serializedEvidence = evidence.map((e) => ({
      id: e.id,
      type: e.type,
      department: e.department,
      source: e.source,
      date:
        e.date instanceof Date
          ? e.date.toISOString().slice(0, 10)
          : String(e.date).slice(0, 10),
      summary: e.summary,
      rawText: e.rawText,
      tags: e.tags,
      confidence: e.confidence,
    }));

    const contextLines: string[] = [];
    if (industry) contextLines.push(`Industry: ${industry}`);
    if (experienceTypes?.length)
      contextLines.push(`Experience Types: ${experienceTypes.join(', ')}`);
    if (businessDescription)
      contextLines.push(`Business Description: ${businessDescription}`);
    if (engagementScope) contextLines.push(`Engagement Scope: ${engagementScope}`);
    if (personas?.length) contextLines.push(`Target Personas: ${personas.join(', ')}`);

    const prompt = `Extract signals from these evidence records.

${contextLines.join('\n')}

Evidence Records (${serializedEvidence.length} total):
${JSON.stringify(serializedEvidence, null, 2)}

Produce signals with types (problem/need/opportunity/gap), cite sources using the exact evidenceId values above, assign confidence from evidence rules, flag contradictions, surface red flags in stats.`;

    const parsed = await generateWithRetry<{
      signals: Signal[];
      contradictions?: { signalIds: string[]; note: string }[];
      stats?: Record<string, unknown>;
      redFlags?: string[];
    }>(prompt, SYSTEM_PROMPT, apiKey);

    if (!parsed?.signals || !Array.isArray(parsed.signals)) {
      console.error('Invalid signal extraction response:', parsed);
      return NextResponse.json(
        { error: 'Generation produced an invalid response shape' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signals: parsed.signals,
      contradictions: parsed.contradictions || [],
      stats: parsed.stats || {},
      redFlags: parsed.redFlags || [],
    });
  } catch (error) {
    console.error('Error extracting signals:', error);
    return NextResponse.json(
      { error: 'Failed to extract signals' },
      { status: 500 }
    );
  }
}
