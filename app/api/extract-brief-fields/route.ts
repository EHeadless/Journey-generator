import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import type { ExperienceType } from '@/lib/types';

/**
 * Brief field extraction.
 *
 * Takes the parsed plain text of an uploaded brief document and asks the
 * LLM to extract the structured fields the home-page form needs to
 * pre-fill. Designed as a *suggestion* layer — the route never replaces
 * user-typed values; the client decides which empty fields to populate
 * from the response.
 *
 * The full brief text is also retained verbatim on the model
 * (Model.input.briefDocument.text) so downstream prompts get the
 * complete document, not just the extracted summary.
 *
 * Companion agent doc: `.claude/agents/brief-parser.md`.
 */

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a behavioral strategy analyst at Digitas. You read a client brief (could be PDF/Word/notes) and extract a structured first-pass of the engagement so a strategist can review and edit, not retype.

Your output MUST be a single JSON object with this shape:
{
  "industry": string,                          // one of the canonical industries below, or "Other"
  "experienceTypes": ("marketing"|"product"|"service")[],  // which kinds of work this brief implies
  "businessDescription": string,               // 60-120 word distilled brief
  "painPoints": string,                         // newline-separated list of stated pains/challenges
  "channels": string[],                         // marketing/service channels mentioned (Email, SMS, App, Web, WhatsApp, Push, In-app, Kiosk, Call center, etc.)
  "personas": string[],                         // target personas/segments named in the brief (3-7 items max)
  "products": [{ "name": string, "description": string }],  // products/channels/touchpoints the client owns or builds
  "techStack": {
    "cloudWarehouse": [{ "value": string, "purpose": string }],
    "dataStorage":    [{ "value": string, "purpose": string }],
    "crm":            [{ "value": string, "purpose": string }],
    "cdp":            [{ "value": string, "purpose": string }],
    "cep":            [{ "value": string, "purpose": string }],
    "dxp":            [{ "value": string, "purpose": string }],
    "aiModels":       [{ "value": string, "purpose": string }],
    "aiPlatform":     [{ "value": string, "purpose": string }]
  },
  "journeys": [{ "name": string, "jtbdBlueprint": string, "phases": string[] }]
}

CANONICAL INDUSTRIES (pick the closest, otherwise "Other"):
Theme Parks & Attractions, Consumer Packaged Goods, Financial Services, Healthcare, Retail & E-commerce, Travel & Hospitality, Telecommunications, Automotive, Technology, Media & Entertainment, Real Estate & Property, Airlines & Aviation, Quick Service Restaurant, Other.

RULES:
- If the brief implies more than one experience type (e.g. "redesign the app, run CRM, build agentic service"), include all that apply.
- businessDescription must be your distilled paraphrase, not a copy-paste of the brief; preserve the strategic challenge and any named objectives.
- painPoints: only include pains stated or strongly implied; do not invent. Empty string is fine if none are mentioned.
- channels: include only what the brief mentions or clearly implies as a customer-facing channel.
- personas: titles only (e.g. "Annual Passholders", "First-time international visitors"). Skip generic ones unless the brief calls them out.
- products: things the client owns or is building (Mobile App, Website, Kiosks, Wayfinding, Loyalty Program). Keep description to a phrase.
- techStack: ONLY include tools the brief actually names. Do NOT invent a stack. Empty arrays are correct when the brief is silent.
- journeys: name the parallel journeys the brief defines (e.g. an airport brief might list Departure / Arrival / Transit). If the brief is single-journey, return one journey with a sensible name and JTBD. Phases are optional; only include them when the brief lists them.
- jtbdBlueprint: a one-sentence framing of what the customer is fundamentally trying to do during that journey, not a feature description.

Return STRICT JSON. No commentary, no markdown.`;

interface ExtractedTechItem {
  value: string;
  purpose?: string;
}

interface ExtractedTechStack {
  cloudWarehouse?: ExtractedTechItem[];
  dataStorage?: ExtractedTechItem[];
  crm?: ExtractedTechItem[];
  cdp?: ExtractedTechItem[];
  cep?: ExtractedTechItem[];
  dxp?: ExtractedTechItem[];
  aiModels?: ExtractedTechItem[];
  aiPlatform?: ExtractedTechItem[];
}

interface ExtractedJourney {
  name?: string;
  jtbdBlueprint?: string;
  phases?: string[];
}

interface ExtractBriefFieldsResponse {
  industry?: string;
  experienceTypes?: ExperienceType[];
  businessDescription?: string;
  painPoints?: string;
  channels?: string[];
  personas?: string[];
  products?: Array<{ name?: string; description?: string }>;
  techStack?: ExtractedTechStack;
  journeys?: ExtractedJourney[];
}

const MAX_BRIEF_CHARS = 60_000; // keep prompt within sane token budget

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      apiKey?: string;
      text?: string;
      filename?: string;
    };

    const { apiKey, text, filename } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Brief text is required' },
        { status: 400 }
      );
    }

    // Trim very long briefs from the middle so we keep both the framing
    // intro and the closing objectives. The full text is still stored
    // verbatim on the model for downstream context blending.
    const trimmed =
      text.length > MAX_BRIEF_CHARS
        ? `${text.slice(0, MAX_BRIEF_CHARS / 2)}\n\n[... ${text.length - MAX_BRIEF_CHARS} characters elided ...]\n\n${text.slice(-MAX_BRIEF_CHARS / 2)}`
        : text;

    const prompt = `Filename: ${filename || '(no filename)'}

BRIEF TEXT:
${trimmed}

Extract the structured fields per the schema. Respond with strict JSON.`;

    const extracted = await generateWithRetry<ExtractBriefFieldsResponse>(
      prompt,
      SYSTEM_PROMPT,
      apiKey
    );

    return NextResponse.json({ fields: extracted });
  } catch (error) {
    console.error('Error extracting brief fields:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown extraction error';
    return NextResponse.json(
      { error: `Failed to extract brief fields: ${message}` },
      { status: 500 }
    );
  }
}
