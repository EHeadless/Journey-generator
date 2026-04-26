/**
 * Registry of evaluation surfaces. Each surface declares its method
 * and the directory under fixtures/ it pulls from.
 */
export interface Surface {
  id: string;            // CLI identifier
  label: string;
  method: 'exact' | 'rubric';
  fixturesDir: string;   // relative to .claude/evals/fixtures/
  notes?: string;
}

export const SURFACES: Surface[] = [
  {
    id: 'problem-diagnostics',
    label: 'Problem Diagnostics — discipline + impact + phase',
    method: 'exact',
    fixturesDir: 'problem-diagnostics',
    notes: 'Closed taxonomy: 8 disciplines, 1-5 impact, phase IDs from input.',
  },
  {
    id: 'demand-space',
    label: 'Demand Space — JTBDs per journey phase',
    method: 'rubric',
    fixturesDir: 'demand-space',
    notes: 'Open generation. Judged on Remove-the-Product test, format, distinctness.',
  },
];

export function findSurface(id: string): Surface | undefined {
  return SURFACES.find((s) => s.id === id);
}
