/**
 * Rubric (LLM-judge) harness.
 *
 * Each fixture has the shape:
 *   {
 *     name, endpoint, request, rubricFile,
 *     extractPath  // dotted path to the array/object the judge should score
 *   }
 *
 * The harness:
 *  1. POSTs `request` to the API route.
 *  2. Reads the rubric markdown.
 *  3. Asks gpt-4o-mini to score each criterion (1-5) + overall.
 *  4. Pass iff weighted total >= 4.0 AND every gate criterion >= 3.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import OpenAI from 'openai';
import { listFixtures, readJson, RUBRICS_ROOT } from './util';

interface RubricFixture {
  name: string;
  description?: string;
  endpoint: string;
  request: Record<string, unknown>;
  rubricFile: string;        // e.g. "demand-space.md"
  extractPath: string;       // e.g. "demandSpaces"
}

export interface RubricCriterionScore {
  criterion: string;
  score: number;             // 1-5
  weight: number;
  isGate: boolean;
  rationale: string;
}

export interface RubricCaseResult {
  fixture: string;
  pass: boolean;
  weightedTotal: number;
  scores: RubricCriterionScore[];
  failedGates: string[];
  durationMs: number;
  reason?: string;
}

interface RubricSpec {
  criteria: Array<{ name: string; weight: number; gate: boolean; description: string }>;
  raw: string;
}

/**
 * Parse a rubric markdown file. Expected format:
 *
 * ## Criteria
 *
 * | Criterion | Weight | Gate | Description |
 * |---|---|---|---|
 * | name | 0.3 | yes | desc |
 */
function parseRubric(file: string): RubricSpec {
  const raw = fs.readFileSync(file, 'utf-8');
  const lines = raw.split('\n');
  const criteria: RubricSpec['criteria'] = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('Criterion')) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith('|---')) continue;
    if (inTable && !trimmed.startsWith('|')) {
      inTable = false;
      continue;
    }
    if (inTable && trimmed.startsWith('|')) {
      const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length < 4) continue;
      const [name, weightStr, gateStr, description] = cells;
      const weight = parseFloat(weightStr);
      const gate = /^y(es)?|true|gate$/i.test(gateStr);
      if (!isNaN(weight) && name) criteria.push({ name, weight, gate, description });
    }
  }
  if (criteria.length === 0) {
    throw new Error(`No criteria parsed from ${file}`);
  }
  return { criteria, raw };
}

export async function runRubricSurface(opts: {
  surface: string;
  baseUrl: string;
  apiKey: string;
  judgeModel?: string;
}): Promise<RubricCaseResult[]> {
  const { surface, baseUrl, apiKey } = opts;
  const judgeModel = opts.judgeModel || 'gpt-4o-mini';
  const files = listFixtures(surface);
  const out: RubricCaseResult[] = [];
  const openai = new OpenAI({ apiKey });

  for (const file of files) {
    const fx = readJson<RubricFixture>(file);
    const rubric = parseRubric(path.join(RUBRICS_ROOT, fx.rubricFile));
    const t0 = Date.now();
    try {
      const body = { ...fx.request, apiKey };
      const resp = await fetch(`${baseUrl}${fx.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        out.push({
          fixture: path.basename(file),
          pass: false,
          weightedTotal: 0,
          scores: [],
          failedGates: [],
          durationMs: Date.now() - t0,
          reason: `HTTP ${resp.status}: ${text.slice(0, 300)}`,
        });
        continue;
      }
      const json = (await resp.json()) as Record<string, unknown>;
      const extracted =
        fx.extractPath === ''
          ? json
          : fx.extractPath.split('.').reduce<unknown>(
              (acc, p) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined),
              json as unknown
            );

      const judgeSystem = `You are a strict evaluator scoring a model's output against a rubric. Score each criterion 1-5 (1=fails badly, 5=excellent). Provide a one-sentence rationale per criterion. Return ONLY JSON of shape { "scores": [ { "criterion": "...", "score": 1-5, "rationale": "..." } ] }.`;

      const judgeUser = `# Rubric

${rubric.raw}

# Output to evaluate

\`\`\`json
${JSON.stringify(extracted, null, 2)}
\`\`\`

Score every criterion in the rubric table. Use the exact criterion names from the table.`;

      const judgeResp = await openai.chat.completions.create({
        model: judgeModel,
        messages: [
          { role: 'system', content: judgeSystem },
          { role: 'user', content: judgeUser },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });
      const content = judgeResp.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as { scores?: Array<{ criterion: string; score: number; rationale: string }> };
      const scoreMap = new Map((parsed.scores || []).map((s) => [s.criterion.toLowerCase().trim(), s]));

      const scores: RubricCriterionScore[] = rubric.criteria.map((c) => {
        const found = scoreMap.get(c.name.toLowerCase().trim());
        const score = found && typeof found.score === 'number' ? Math.max(1, Math.min(5, Math.round(found.score))) : 1;
        return {
          criterion: c.name,
          score,
          weight: c.weight,
          isGate: c.gate,
          rationale: found?.rationale || 'Judge did not score this criterion.',
        };
      });

      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      const weightedTotal =
        totalWeight > 0
          ? scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight
          : 0;
      const failedGates = scores.filter((s) => s.isGate && s.score < 3).map((s) => s.criterion);
      const pass = weightedTotal >= 4.0 && failedGates.length === 0;

      out.push({
        fixture: path.basename(file),
        pass,
        weightedTotal: Math.round(weightedTotal * 100) / 100,
        scores,
        failedGates,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      out.push({
        fixture: path.basename(file),
        pass: false,
        weightedTotal: 0,
        scores: [],
        failedGates: [],
        durationMs: Date.now() - t0,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}
