/**
 * Shared source-block builders.
 *
 * Both Hypothesis Landscape (`hypothesis-context.ts`) and Informed
 * Landscape (`informed-context.ts`) need to render form fields, the
 * verbatim brief, and research summaries into prompt-ready blocks. This
 * file is the single source of truth so the two contexts can never drift.
 */

import type {
  ModelInput,
  ResearchDocument,
  TechStack,
  TechTool,
} from '@/lib/types';

/** Maximum chars of the verbatim brief carried into a single prompt. */
export const MAX_BRIEF_CHARS = 50_000;
/** Per-research-doc summary cap — keeps multi-doc engagements cost-bounded. */
export const MAX_RESEARCH_SUMMARY_CHARS = 6_000;

const formatTools = (tools?: TechTool[]) =>
  tools?.map((t) => (t.purpose ? `${t.value} (${t.purpose})` : t.value)).join(', ') || '';

export function buildFormBlock(input: ModelInput): string {
  const sections: string[] = [];
  if (input.industry) sections.push(`Industry: ${input.industry}`);
  if (input.experienceTypes?.length)
    sections.push(`Experience Types: ${input.experienceTypes.join(', ')}`);
  if (input.businessDescription)
    sections.push(`Business Description:\n${input.businessDescription}`);

  const techStack: TechStack | undefined = input.techStack;
  if (techStack) {
    const lines: string[] = [];
    if (techStack.cloudWarehouse?.length)
      lines.push(`- Cloud Warehouse: ${formatTools(techStack.cloudWarehouse)}`);
    if (techStack.dataStorage?.length)
      lines.push(`- Data Storage: ${formatTools(techStack.dataStorage)}`);
    if (techStack.crm?.length) lines.push(`- CRM: ${formatTools(techStack.crm)}`);
    if (techStack.cdp?.length) lines.push(`- CDP: ${formatTools(techStack.cdp)}`);
    if (techStack.cep?.length) lines.push(`- CEP: ${formatTools(techStack.cep)}`);
    if (techStack.dxp?.length) lines.push(`- DXP: ${formatTools(techStack.dxp)}`);
    if (techStack.aiModels?.length) lines.push(`- AI Models: ${formatTools(techStack.aiModels)}`);
    if (techStack.aiPlatform?.length)
      lines.push(`- AI Platform: ${formatTools(techStack.aiPlatform)}`);
    if (lines.length) sections.push(`Tech Stack:\n${lines.join('\n')}`);
  }
  if (input.products?.length)
    sections.push(
      `Products / Channels:\n${input.products.map((p) => `- ${p.name}: ${p.description}`).join('\n')}`
    );
  if (input.personas?.length)
    sections.push(`Target Personas: ${input.personas.map((p) => p.label).join(', ')}`);
  if (input.painPoints) sections.push(`Known Pain Points:\n${input.painPoints}`);
  if (input.channels?.length) sections.push(`Channels: ${input.channels.join(', ')}`);

  if (sections.length === 0) return '';
  return `FORM FIELDS\n${sections.join('\n\n')}`;
}

export function buildBriefBlock(input: ModelInput, cap: number = MAX_BRIEF_CHARS): string {
  const doc = input.briefDocument;
  if (!doc?.text?.trim()) return '';
  const text =
    doc.text.length > cap
      ? `${doc.text.slice(0, cap / 2)}\n\n[... ${doc.text.length - cap} characters elided ...]\n\n${doc.text.slice(-cap / 2)}`
      : doc.text;
  return `VERBATIM CLIENT BRIEF — filename: ${doc.filename}\n${text}`;
}

export function buildResearchBlock(
  input: ModelInput,
  cap: number = MAX_RESEARCH_SUMMARY_CHARS
): string {
  const docs: ResearchDocument[] = input.researchDocuments || [];
  if (docs.length === 0) return '';

  // Prefer summarized docs (cheap to inject). Fall back to the verbatim
  // text head when a doc was uploaded but never summarized — better to
  // include something than to silently drop the evidence.
  const blocks = docs.map((doc, i) => {
    const summary = doc.summary;
    if (summary) {
      const lines: string[] = [];
      lines.push(`### Research Doc ${i + 1}: ${doc.filename}`);
      if (summary.evidenceType) lines.push(`Type: ${summary.evidenceType}`);
      if (summary.headline) lines.push(`Headline: ${summary.headline}`);
      if (summary.summary) lines.push(`Summary: ${summary.summary}`);
      if (summary.keyFindings?.length)
        lines.push(`Key findings:\n${summary.keyFindings.map((f) => `- ${f}`).join('\n')}`);
      if (summary.painsAndFrictions?.length)
        lines.push(
          `Pains & frictions:\n${summary.painsAndFrictions.map((p) => `- ${p}`).join('\n')}`
        );
      if (summary.opportunitiesOrHypotheses?.length)
        lines.push(
          `Opportunities & hypotheses:\n${summary.opportunitiesOrHypotheses.map((o) => `- ${o}`).join('\n')}`
        );
      if (summary.namedSegments?.length)
        lines.push(`Named segments: ${summary.namedSegments.join(', ')}`);
      if (summary.namedJourneys?.length)
        lines.push(`Named journeys: ${summary.namedJourneys.join(', ')}`);
      if (summary.directQuotes?.length)
        lines.push(
          `Direct quotes:\n${summary.directQuotes.map((q) => `- "${q}"`).join('\n')}`
        );
      const block = lines.join('\n');
      return block.length > cap ? block.slice(0, cap) + '\n[truncated]' : block;
    }
    // Fallback: take the first ~3k chars of the verbatim text so the
    // doc isn't silently invisible. The strategist will be nudged in the
    // UI to summarize it for richer blending.
    const head = doc.text.slice(0, 3000);
    return `### Research Doc ${i + 1}: ${doc.filename} (NOT YET SUMMARIZED — using head excerpt)\n${head}${doc.text.length > 3000 ? '\n[... rest of document omitted; summarize for full coverage ...]' : ''}`;
  });

  return `RESEARCH EVIDENCE — ${docs.length} document${docs.length === 1 ? '' : 's'}\n\n${blocks.join('\n\n')}`;
}

/**
 * Lightweight, order-stable fingerprint for staleness detection. Not a
 * cryptographic hash — just a checksum of the inputs that fed into a
 * blend so the UI can warn when a variant is out of date.
 */
export function fingerprint(parts: string[]): string {
  const joined = parts.join('|');
  let hash = 5381;
  for (let i = 0; i < joined.length; i++) {
    hash = (hash * 33) ^ joined.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/** Source-availability helpers used by both context builders. */
export function hasFormSignal(input: ModelInput): boolean {
  return !!(
    input.industry ||
    input.businessDescription ||
    input.techStack ||
    input.products?.length ||
    input.personas?.length ||
    input.painPoints ||
    input.channels?.length
  );
}

export function hasBriefSignal(input: ModelInput): boolean {
  return !!input.briefDocument?.text;
}

export function hasResearchSignal(input: ModelInput): boolean {
  return (input.researchDocuments?.length || 0) > 0;
}
