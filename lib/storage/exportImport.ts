/**
 * Combined export/import — packages the full Model (strategy layer) plus
 * the Capture bundle (ingestion layer) into a single downloadable JSON
 * file. This is the prototype's backup strategy; use it before clearing
 * browser data or moving between machines.
 *
 * File shape:
 * {
 *   version: 1,
 *   exportedAt: "2026-...Z",
 *   model: Model,              // full journey/phase/demand-space tree
 *   capture: ExportBundle      // uploads + chunks + extractions + ...
 * }
 */

import type { Model } from '../types';
import { storage, type ExportBundle } from './index';
import { EXPORT_SCHEMA_VERSION } from './adapter';

export interface FullExportFile {
  version: number;
  exportedAt: string;
  model: Model;
  capture: ExportBundle;
}

/**
 * Build a full export of the current model. Caller supplies the Model
 * (from Zustand); Capture data is pulled from IDB.
 */
export async function buildExport(model: Model): Promise<FullExportFile> {
  const capture = await storage.exportModel(model.id);
  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    model,
    capture,
  };
}

/** Trigger a browser download for an export file. */
export function downloadExport(file: FullExportFile): void {
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = (model_slug(file.model) || 'model').slice(0, 40);
  a.download = `journey-${slug}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function model_slug(model: Model): string {
  const raw =
    model.input?.industry ||
    model.input?.businessDescription ||
    model.id;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse a user-selected file and validate it's a well-formed export.
 * Does not apply changes — caller decides when to import.
 */
export async function parseExportFile(file: File): Promise<FullExportFile> {
  const text = await file.text();
  const parsed = JSON.parse(text) as FullExportFile;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid export file: not an object');
  }
  if (parsed.version !== EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported export version ${parsed.version}; expected ${EXPORT_SCHEMA_VERSION}`
    );
  }
  if (!parsed.model || !parsed.capture) {
    throw new Error('Invalid export file: missing model or capture');
  }
  return parsed;
}

/**
 * Apply an imported bundle. Writes Capture data through the storage
 * adapter (replacing anything already there for this modelId). The Model
 * itself is returned so the caller can push it into the Zustand store.
 */
export async function applyImport(
  file: FullExportFile
): Promise<{ model: Model }> {
  await storage.importModel(file.capture);
  return { model: reviveModelDates(file.model) };
}

// JSON.parse turns Dates into strings — revive them for the Model tree.
const DATE_KEYS = new Set(['createdAt', 'updatedAt', 'date', 'approvedAt']);
function reviveModelDates<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => reviveModelDates(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_KEYS.has(k) && typeof v === 'string') {
        const d = new Date(v);
        out[k] = isNaN(d.getTime()) ? v : d;
      } else {
        out[k] = reviveModelDates(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}
