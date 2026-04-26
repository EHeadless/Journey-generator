/**
 * Shared helpers for the eval runner.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const EVALS_ROOT = path.resolve(__dirname, '..');
export const FIXTURES_ROOT = path.join(EVALS_ROOT, 'fixtures');
export const RUBRICS_ROOT = path.join(EVALS_ROOT, 'rubrics');
export const RESULTS_ROOT = path.join(EVALS_ROOT, 'results');

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

export function writeJson(file: string, data: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function listFixtures(surface: string): string[] {
  const dir = path.join(FIXTURES_ROOT, surface);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

export function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('Missing OPENAI_API_KEY environment variable');
    process.exit(1);
  }
  return key;
}

/**
 * Deep-equality check that ignores ordering of arrays whose items have
 * a `problemSignalId` (or other declared key). Used to compare classify
 * output against frozen expectations.
 */
export function deepEqualUnordered(
  a: unknown,
  b: unknown,
  keyForArrayItem: (x: unknown) => string | undefined = () => undefined
): { equal: boolean; reason?: string } {
  if (a === b) return { equal: true };
  if (typeof a !== typeof b) return { equal: false, reason: `type mismatch ${typeof a} vs ${typeof b}` };
  if (a === null || b === null) return { equal: false, reason: 'one side is null' };

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { equal: false, reason: `array length ${a.length} vs ${b.length}` };
    }
    const aKeyed = a.every((x) => keyForArrayItem(x) !== undefined);
    const bKeyed = b.every((x) => keyForArrayItem(x) !== undefined);
    if (aKeyed && bKeyed) {
      const bByKey = new Map(b.map((x) => [keyForArrayItem(x)!, x] as const));
      for (const item of a) {
        const k = keyForArrayItem(item)!;
        const match = bByKey.get(k);
        if (!match) return { equal: false, reason: `missing key ${k}` };
        const sub = deepEqualUnordered(item, match, keyForArrayItem);
        if (!sub.equal) return { equal: false, reason: `at key ${k}: ${sub.reason}` };
      }
      return { equal: true };
    }
    for (let i = 0; i < a.length; i++) {
      const sub = deepEqualUnordered(a[i], b[i], keyForArrayItem);
      if (!sub.equal) return { equal: false, reason: `at index ${i}: ${sub.reason}` };
    }
    return { equal: true };
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>).sort();
    const bKeys = Object.keys(b as Record<string, unknown>).sort();
    if (aKeys.join('|') !== bKeys.join('|')) {
      return { equal: false, reason: `key set differs: [${aKeys.join(',')}] vs [${bKeys.join(',')}]` };
    }
    for (const k of aKeys) {
      const sub = deepEqualUnordered(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        keyForArrayItem
      );
      if (!sub.equal) return { equal: false, reason: `at .${k}: ${sub.reason}` };
    }
    return { equal: true };
  }

  return { equal: false, reason: `value differs (${JSON.stringify(a)} vs ${JSON.stringify(b)})` };
}
