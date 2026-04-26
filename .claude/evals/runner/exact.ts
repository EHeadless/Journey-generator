/**
 * Exact-match harness.
 *
 * Each fixture has the shape:
 *   { name, request: <body sent to api route>, expected: { compareFields, items } }
 *
 * The harness:
 *  1. POSTs `request` to a configured API route URL.
 *  2. Filters response down to `compareFields` per item.
 *  3. Deep-equals against `expected.items` (unordered by `problemSignalId`).
 *  4. With --update, freezes the live response into the fixture's `expected`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deepEqualUnordered, listFixtures, readJson, writeJson } from './util';

interface ExactFixture {
  name: string;
  description?: string;
  endpoint: string;             // e.g. "/api/classify-problems"
  request: Record<string, unknown>;
  expected: {
    arrayPath: string;          // dotted path into response (e.g. "diagnostics")
    keyField: string;           // field that uniquely identifies an item
    compareFields: string[];    // which fields to compare (ignores rationales)
    items: Array<Record<string, unknown>>;
  };
}

export interface ExactCaseResult {
  fixture: string;
  pass: boolean;
  reason?: string;
  durationMs: number;
}

function getPath(obj: unknown, dotted: string): unknown {
  let cur: unknown = obj;
  for (const part of dotted.split('.')) {
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function pickFields(items: Array<Record<string, unknown>>, fields: string[]) {
  return items.map((it) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) out[f] = it[f];
    return out;
  });
}

export async function runExactSurface(opts: {
  surface: string;
  baseUrl: string;
  apiKey: string;
  update: boolean;
}): Promise<ExactCaseResult[]> {
  const { surface, baseUrl, apiKey, update } = opts;
  const files = listFixtures(surface);
  const out: ExactCaseResult[] = [];

  for (const file of files) {
    const fx = readJson<ExactFixture>(file);
    const t0 = Date.now();
    try {
      const body = { ...fx.request, apiKey };
      const url = `${baseUrl}${fx.endpoint}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const durationMs = Date.now() - t0;
      if (!resp.ok) {
        const text = await resp.text();
        out.push({
          fixture: path.basename(file),
          pass: false,
          reason: `HTTP ${resp.status}: ${text.slice(0, 300)}`,
          durationMs,
        });
        continue;
      }
      const json = (await resp.json()) as unknown;
      const itemsRaw = getPath(json, fx.expected.arrayPath);
      if (!Array.isArray(itemsRaw)) {
        out.push({
          fixture: path.basename(file),
          pass: false,
          reason: `arrayPath ${fx.expected.arrayPath} did not resolve to an array`,
          durationMs,
        });
        continue;
      }
      const filtered = pickFields(
        itemsRaw as Array<Record<string, unknown>>,
        [fx.expected.keyField, ...fx.expected.compareFields]
      );

      if (update) {
        fx.expected.items = filtered;
        writeJson(file, fx);
        out.push({
          fixture: path.basename(file),
          pass: true,
          reason: 'snapshot updated',
          durationMs,
        });
        continue;
      }

      const cmp = deepEqualUnordered(
        fx.expected.items,
        filtered,
        (x) =>
          x && typeof x === 'object'
            ? ((x as Record<string, unknown>)[fx.expected.keyField] as string | undefined)
            : undefined
      );
      out.push({
        fixture: path.basename(file),
        pass: cmp.equal,
        reason: cmp.equal ? undefined : cmp.reason,
        durationMs,
      });
    } catch (err) {
      out.push({
        fixture: path.basename(file),
        pass: false,
        reason: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      });
    }
  }

  return out;
}

// Avoid unused-import warning when fs is conditionally needed elsewhere.
void fs;
