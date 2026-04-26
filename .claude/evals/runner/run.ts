/**
 * CLI entrypoint. Usage:
 *   npm run eval                       # all surfaces
 *   npm run eval -- problem-diagnostics
 *   npm run eval -- demand-space
 *   npm run eval -- problem-diagnostics --update
 *
 * Requires:
 *   - OPENAI_API_KEY in env
 *   - dev server running on EVAL_BASE_URL (default http://localhost:3000)
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { runExactSurface, ExactCaseResult } from './exact';
import { runRubricSurface, RubricCaseResult } from './rubric';
import { SURFACES, findSurface, Surface } from './surfaces';
import { ensureDir, getApiKey, RESULTS_ROOT, todayStamp } from './util';

interface SurfaceResult {
  surface: Surface;
  exact?: ExactCaseResult[];
  rubric?: RubricCaseResult[];
}

async function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const explicit = args.filter((a) => !a.startsWith('--'));
  const targets = explicit.length > 0
    ? explicit.map((id) => {
        const s = findSurface(id);
        if (!s) {
          console.error(`Unknown surface: ${id}. Known: ${SURFACES.map((x) => x.id).join(', ')}`);
          process.exit(1);
        }
        return s;
      })
    : SURFACES;

  const baseUrl = process.env.EVAL_BASE_URL || 'http://localhost:3000';
  const apiKey = getApiKey();

  console.log(`\n▶ Eval run @ ${todayStamp()}`);
  console.log(`  base URL: ${baseUrl}`);
  console.log(`  surfaces: ${targets.map((t) => t.id).join(', ')}`);
  if (update) console.log(`  mode: --update (snapshots will be rewritten)`);
  console.log('');

  const results: SurfaceResult[] = [];

  for (const surface of targets) {
    console.log(`── ${surface.id} (${surface.method})`);
    if (surface.method === 'exact') {
      const cases = await runExactSurface({
        surface: surface.fixturesDir,
        baseUrl,
        apiKey,
        update,
      });
      cases.forEach((c) => {
        const tag = c.pass ? '✓' : '✗';
        console.log(`  ${tag} ${c.fixture} (${c.durationMs}ms)${c.reason ? ` — ${c.reason}` : ''}`);
      });
      results.push({ surface, exact: cases });
    } else {
      const cases = await runRubricSurface({
        surface: surface.fixturesDir,
        baseUrl,
        apiKey,
      });
      cases.forEach((c) => {
        const tag = c.pass ? '✓' : '✗';
        console.log(
          `  ${tag} ${c.fixture} weighted=${c.weightedTotal} gates=${c.failedGates.length === 0 ? 'pass' : c.failedGates.join(',')} (${c.durationMs}ms)${c.reason ? ` — ${c.reason}` : ''}`
        );
      });
      results.push({ surface, rubric: cases });
    }
  }

  // Write report
  const stamp = todayStamp();
  const dir = path.join(RESULTS_ROOT, stamp);
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(dir, `report-${ts}.md`);
  const jsonPath = path.join(dir, `report-${ts}.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(results, baseUrl));
  console.log(`\n→ ${path.relative(process.cwd(), mdPath)}`);

  const allPass = results.every((r) =>
    (r.exact || []).every((c) => c.pass) && (r.rubric || []).every((c) => c.pass)
  );
  process.exit(allPass ? 0 : 1);
}

function renderMarkdown(results: SurfaceResult[], baseUrl: string): string {
  const lines: string[] = [];
  lines.push(`# Eval Report — ${todayStamp()}`);
  lines.push('');
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push('');

  let totalCases = 0;
  let totalPass = 0;
  for (const r of results) {
    const cases = (r.exact || []).length + (r.rubric || []).length;
    const pass =
      (r.exact || []).filter((c) => c.pass).length +
      (r.rubric || []).filter((c) => c.pass).length;
    totalCases += cases;
    totalPass += pass;
  }
  lines.push(`**Overall: ${totalPass}/${totalCases} cases passed**`);
  lines.push('');

  for (const r of results) {
    lines.push(`## ${r.surface.id} — ${r.surface.label}`);
    lines.push('');
    lines.push(`Method: \`${r.surface.method}\``);
    if (r.surface.notes) lines.push(`> ${r.surface.notes}`);
    lines.push('');

    if (r.exact) {
      lines.push('| Fixture | Pass | Duration | Reason |');
      lines.push('|---|---|---|---|');
      for (const c of r.exact) {
        lines.push(`| ${c.fixture} | ${c.pass ? '✓' : '✗'} | ${c.durationMs}ms | ${c.reason || ''} |`);
      }
      lines.push('');
    }
    if (r.rubric) {
      lines.push('| Fixture | Pass | Weighted | Failed Gates | Duration |');
      lines.push('|---|---|---|---|---|');
      for (const c of r.rubric) {
        lines.push(
          `| ${c.fixture} | ${c.pass ? '✓' : '✗'} | ${c.weightedTotal} | ${c.failedGates.join(',') || '—'} | ${c.durationMs}ms |`
        );
      }
      lines.push('');
      // Per-criterion detail
      for (const c of r.rubric) {
        if (c.scores.length === 0) continue;
        lines.push(`### ${c.fixture}`);
        lines.push('');
        lines.push('| Criterion | Score | Weight | Gate | Rationale |');
        lines.push('|---|---|---|---|---|');
        for (const s of c.scores) {
          lines.push(`| ${s.criterion} | ${s.score} | ${s.weight} | ${s.isGate ? 'Y' : 'N'} | ${s.rationale.replace(/\|/g, '\\|')} |`);
        }
        if (c.reason) lines.push(`> Error: ${c.reason}`);
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
