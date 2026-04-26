/**
 * Shared helpers for converting accepted ExtractedSignals into curated
 * Signals on `model.signals`.
 *
 * The user-facing flow used to require three button clicks: Curate,
 * Apply to landscape, Promote accepted. That was hostile. This module
 * collapses the same pipeline into one server-call-aware function so
 * the Diagnostics tab can run it silently when the user clicks Run
 * Diagnostics, and the Findings UI doesn't have to know any of it.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ConfidenceLevel,
  ExtractedSignal,
  ExtractedSignalType,
  Signal,
  SignalType,
} from '@/lib/types';

// ---------- Type helpers ----------

/**
 * Only the four canonical SignalTypes (problem / need / opportunity /
 * gap) are promotable to the curated landscape. Other extracted kinds
 * (jtbd, initiative, wishlist, quote) are evidence-only.
 */
export function toSignalType(kind: ExtractedSignalType): SignalType | null {
  if (kind === 'problem' || kind === 'need' || kind === 'opportunity' || kind === 'gap') {
    return kind;
  }
  return null;
}

/** Most-frequent department across a set of signals, '' if none reported. */
export function pickDepartment(signals: ExtractedSignal[]): string {
  const counts = new Map<string, number>();
  for (const s of signals) {
    if (s.department) counts.set(s.department, (counts.get(s.department) || 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [dept, c] of counts) {
    if (c > bestCount) {
      best = dept;
      bestCount = c;
    }
  }
  return best;
}

const EXTRACTOR_KIND: Record<ExtractedSignalType, string> = {
  problem: 'problems',
  jtbd: 'jtbds',
  need: 'needs',
  opportunity: 'opportunities',
  gap: 'gaps',
  initiative: 'initiatives',
  wishlist: 'wishlist',
  quote: 'quotes',
};

// ---------- Curate API shape ----------

interface CurateGroup {
  canonicalText: string;
  mergedIds: string[];
  confidence: ConfidenceLevel;
  citedChunkIds: string[];
}

interface CurateResponse {
  groups: CurateGroup[];
}

async function curateOnServer(args: {
  apiKey: string;
  kind: ExtractedSignalType;
  signals: ExtractedSignal[];
}): Promise<CurateGroup[]> {
  const resp = await fetch('/api/curate-signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: args.apiKey,
      kind: EXTRACTOR_KIND[args.kind],
      signals: args.signals.map((s) => ({
        id: s.id,
        text: s.text,
        confidence: s.confidence,
        citedChunkIds: s.supportingChunkIds,
      })),
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Curate failed' }));
    throw new Error(err.error || `Curate failed (${resp.status})`);
  }
  const body = (await resp.json()) as CurateResponse;
  return body.groups || [];
}

// ---------- Pipeline ----------

export interface MergeLogEntry {
  canonicalText: string;
  mergedTexts: string[];
  confidence: ConfidenceLevel;
}

export interface PromoteResult {
  /** New Signals to write to model.signals (caller does the actual setSignals). */
  newSignals: Signal[];
  /** ExtractedSignal id → new Signal id (caller stamps these). */
  stamps: Array<{ extractedId: string; signalId: string }>;
  /** Signal ids on the existing landscape that should be dropped because they're being superseded. */
  supersededSignalIds: string[];
  /** Per-merge audit trail for the passive UI notification. */
  mergeLog: MergeLogEntry[];
  /** True if the curate API was actually called (vs a 1:1 promote-only path). */
  curateRan: boolean;
}

/**
 * Run the full silent pipeline for a single kind:
 *   1. Filter to accepted-but-not-yet-promoted ExtractedSignals of `kind`.
 *   2. If 2+ exist, call /api/curate-signals to dedupe; if only 1, skip the LLM call.
 *   3. Build `Signal[]` from the resulting groups.
 *   4. Return everything the caller needs to commit (newSignals, stamps,
 *      supersededSignalIds, mergeLog).
 *
 * The caller (ProblemDiagnosticsPanel) is responsible for actually
 * calling `setSignals` and `updateExtractedSignal` so we don't take a
 * dependency on Zustand from a pure module.
 */
export async function autoCurateAndPromote(args: {
  apiKey: string;
  kind: ExtractedSignalType;
  extractedSignals: ExtractedSignal[];
  /** Used to filter out signals that already point at a real Signal.id. */
  existingSignalIds: Set<string>;
}): Promise<PromoteResult> {
  const signalType = toSignalType(args.kind);
  if (!signalType) {
    return {
      newSignals: [],
      stamps: [],
      supersededSignalIds: [],
      mergeLog: [],
      curateRan: false,
    };
  }

  // Accepted = has any promotedToSignalId stamp (either provisional
  // 'accepted-...' or a real uuid). We re-promote both: provisional ones
  // become real, and real ones get superseded so a re-run is idempotent.
  const accepted = args.extractedSignals.filter(
    (s) =>
      s.type === args.kind &&
      !s.dismissedAt &&
      !!s.promotedToSignalId
  );

  if (accepted.length === 0) {
    return {
      newSignals: [],
      stamps: [],
      supersededSignalIds: [],
      mergeLog: [],
      curateRan: false,
    };
  }

  // Capture which existing Signals will be superseded by re-promotion.
  const supersededSignalIds = new Set<string>();
  for (const es of accepted) {
    const stamped = es.promotedToSignalId;
    if (stamped && !stamped.startsWith('accepted-') && args.existingSignalIds.has(stamped)) {
      supersededSignalIds.add(stamped);
    }
  }

  // 1 signal → skip the curate API, just promote 1:1.
  let groups: CurateGroup[];
  let curateRan = false;
  if (accepted.length === 1) {
    groups = [
      {
        canonicalText: accepted[0].text,
        mergedIds: [accepted[0].id],
        confidence: accepted[0].confidence,
        citedChunkIds: accepted[0].supportingChunkIds,
      },
    ];
  } else {
    groups = await curateOnServer({
      apiKey: args.apiKey,
      kind: args.kind,
      signals: accepted,
    });
    curateRan = true;
  }

  const byId = new Map(accepted.map((s) => [s.id, s]));
  const newSignals: Signal[] = [];
  const stamps: Array<{ extractedId: string; signalId: string }> = [];
  const mergeLog: MergeLogEntry[] = [];

  for (const group of groups) {
    const merged = group.mergedIds
      .map((id) => byId.get(id))
      .filter((s): s is ExtractedSignal => !!s);
    if (merged.length === 0) continue;

    const newId = uuidv4();
    newSignals.push({
      id: newId,
      type: signalType,
      text: group.canonicalText,
      department: pickDepartment(merged),
      sources: merged.map((m) => ({ evidenceId: m.uploadId })),
      confidence: group.confidence,
      confidenceReason:
        merged.length > 1
          ? `Auto-merged from ${merged.length} accepted signals`
          : 'Promoted from a single accepted signal',
    });
    for (const m of merged) {
      stamps.push({ extractedId: m.id, signalId: newId });
    }
    if (merged.length > 1) {
      mergeLog.push({
        canonicalText: group.canonicalText,
        mergedTexts: merged.map((m) => m.text),
        confidence: group.confidence,
      });
    }
  }

  return {
    newSignals,
    stamps,
    supersededSignalIds: Array.from(supersededSignalIds),
    mergeLog,
    curateRan,
  };
}
