'use client';

/**
 * Problem Diagnostics — top-level panel.
 *
 * Orchestrates the full silent pipeline around accepted Problem
 * ExtractedSignals: dedupe (curate) → promote to model.signals →
 * classify into 8 disciplines → score Frequency × Impact → map onto
 * journey phases → render charts and narrative.
 *
 * The user clicks one button — "Run Diagnostics" — and the curate /
 * promote / classify steps happen behind the scenes. There is no
 * surfaced "Curate" or "Apply to landscape" button anywhere in the UI.
 *
 * Frequency is computed deterministically client-side from
 * Signal.sources; impact comes from the LLM. Manual edits to the
 * resulting ProblemDiagnostic table are preserved across re-classify
 * runs via the diff modal.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Loader2,
  RefreshCw,
  FileText,
  Sparkles,
  ArrowLeft,
  Inbox,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useCaptureStore } from '@/lib/captureStore';
import type {
  ClassifyProblemsResponse,
  DiagnoseNarrativeResponse,
  JourneyPhase,
  ProblemDiagnostic,
  ProblemDiagnosticNarrative,
  Signal,
} from '@/lib/types';
import {
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  computeFrequency,
  disciplineCounts,
  quadrantOf,
  QUADRANT_LABELS,
  type Quadrant,
} from '@/lib/problem-diagnostics-meta';
import { autoCurateAndPromote, type MergeLogEntry } from '@/lib/extraction/promote-signals';
import { DisciplineDonut } from './DisciplineDonut';
import { JourneyCanvas } from './JourneyCanvas';
import { FrequencyImpactQuadrant } from './FrequencyImpactQuadrant';
import { ProblemTable } from './ProblemTable';
import {
  ReclassifyDiffModal,
  type ProposedDiagnostic,
} from './ReclassifyDiffModal';
import { ProblemDiagnosticsExport } from './ProblemDiagnosticsExport';

interface ProblemDiagnosticsPanelProps {
  modelId: string;
  apiKey: string;
  /** Lets the empty state push the user back to the Review Findings tab. */
  onNavigateToReview?: () => void;
  /**
   * Optional journey filter. When set, the panel scopes journey phases
   * and diagnostics to phases on this journey only. Pass `undefined`
   * (or omit) to show every journey at once. The page-level switcher
   * is responsible for picking which journey is active.
   *
   * Cross-cutting diagnostics (empty `affectedPhaseIds`) ignore this
   * filter and are always rendered in the cross-cutting banner.
   */
  activeJourneyId?: string;
}

interface FrequencyContext {
  sourceCount: number;
  chunkCount: number;
  departmentSpread: number;
}

export function ProblemDiagnosticsPanel({
  modelId,
  apiKey,
  onNavigateToReview,
  activeJourneyId,
}: ProblemDiagnosticsPanelProps) {
  // ---------- Store wiring ----------

  const modelSignalsRaw = useStore((s) => s.model?.signals);
  const modelEvidenceRaw = useStore((s) => s.model?.evidenceRecords);
  const modelPhasesRaw = useStore((s) => s.model?.journeyPhases);
  const modelJourneysRaw = useStore((s) => s.model?.journeys);
  const modelWorkshopsRaw = useStore((s) => s.model?.workshops);
  const modelInput = useStore((s) => s.model?.input);
  const setSignals = useStore((s) => s.setSignals);

  const extractedSignalsRaw = useCaptureStore((s) => s.extractedSignals);
  const captureUploadsRaw = useCaptureStore((s) => s.uploads);
  const updateExtractedSignal = useCaptureStore((s) => s.updateExtractedSignal);
  const diagnostics = useCaptureStore((s) => s.problemDiagnostics);
  const narrative = useCaptureStore((s) => s.problemDiagnosticNarrative);
  const replaceProblemDiagnostics = useCaptureStore(
    (s) => s.replaceProblemDiagnostics
  );
  const upsertProblemDiagnostics = useCaptureStore(
    (s) => s.upsertProblemDiagnostics
  );
  const updateProblemDiagnostic = useCaptureStore(
    (s) => s.updateProblemDiagnostic
  );
  const setProblemDiagnosticNarrative = useCaptureStore(
    (s) => s.setProblemDiagnosticNarrative
  );

  const modelSignals = useMemo(() => modelSignalsRaw ?? [], [modelSignalsRaw]);
  const modelEvidence = useMemo(
    () => modelEvidenceRaw ?? [],
    [modelEvidenceRaw]
  );
  const modelJourneys = useMemo(
    () => modelJourneysRaw ?? [],
    [modelJourneysRaw]
  );
  const modelWorkshops = useMemo(
    () => modelWorkshopsRaw ?? [],
    [modelWorkshopsRaw]
  );
  const captureUploads = useMemo(
    () => captureUploadsRaw ?? [],
    [captureUploadsRaw]
  );
  const extractedSignals = useMemo(
    () => extractedSignalsRaw ?? [],
    [extractedSignalsRaw]
  );

  // ---------- Local state ----------

  const [running, setRunning] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeLog, setMergeLog] = useState<MergeLogEntry[]>([]);
  const [diffModal, setDiffModal] = useState<{
    proposed: ProposedDiagnostic[];
  } | null>(null);

  // Refs to chart container nodes — passed to the PPT exporter so it can
  // snapshot what the strategist actually sees on screen.
  const donutRef = useRef<HTMLDivElement | null>(null);
  const quadrantRef = useRef<HTMLDivElement | null>(null);
  const heatmapRef = useRef<HTMLDivElement | null>(null);

  // ---------- Source data ----------

  const problems: Signal[] = useMemo(() => {
    return modelSignals.filter((s) => s.type === 'problem');
  }, [modelSignals]);

  // Full phase list from the store — used for classify (we always
  // classify against every phase the model has, regardless of which
  // journey is on screen).
  const allJourneyPhases: JourneyPhase[] = useMemo(
    () => [...(modelPhasesRaw ?? [])].sort((a, b) => a.order - b.order),
    [modelPhasesRaw]
  );

  // Phases scoped to the active journey for visualization. When no
  // `activeJourneyId` is supplied, fall through to all phases so the
  // panel still renders for callers that don't care about journey
  // filtering (legacy single-journey models, exporters, etc.).
  const journeyPhases: JourneyPhase[] = useMemo(() => {
    if (!activeJourneyId) return allJourneyPhases;
    return allJourneyPhases.filter((p) => p.journeyId === activeJourneyId);
  }, [allJourneyPhases, activeJourneyId]);

  // Set of phase IDs on the active journey — used to filter
  // diagnostics whose `affectedPhaseIds` intersect with this journey.
  const activeJourneyPhaseIds = useMemo(
    () => new Set(journeyPhases.map((p) => p.id)),
    [journeyPhases]
  );

  /**
   * Accepted Problem ExtractedSignals (still owned by the capture store)
   * that the silent pipeline can promote into model.signals on Run.
   * "Accepted" = has any promotedToSignalId stamp (provisional
   * 'accepted-...' or a real uuid). Re-running is idempotent.
   */
  const acceptedProblemExtracted = useMemo(
    () =>
      extractedSignals.filter(
        (s) =>
          s.type === 'problem' && !s.dismissedAt && !!s.promotedToSignalId
      ),
    [extractedSignals]
  );

  /** problemSignalId → text for charts, table headers, modal labels. */
  const problemTexts: Record<string, string> = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of problems) out[s.id] = s.text;
    return out;
  }, [problems]);

  /**
   * problemSignalId → frequency inputs derived from Signal.sources.
   * Re-derived on every render; the skill specifies: never trust the
   * model with frequency.
   */
  const frequencyContext: Map<string, FrequencyContext> = useMemo(() => {
    const evidenceById = new Map(modelEvidence.map((e) => [e.id, e]));
    const map = new Map<string, FrequencyContext>();
    for (const s of problems) {
      const sources = s.sources || [];
      const sourceCount = sources.length;
      const departments = new Set<string>();
      for (const src of sources) {
        const ev = evidenceById.get(src.evidenceId);
        if (ev?.department) departments.add(ev.department);
      }
      if (s.department) departments.add(s.department);
      const chunkCount =
        sources.filter((sr) => !!sr.quote).length || sourceCount;
      map.set(s.id, {
        sourceCount,
        chunkCount,
        departmentSpread: departments.size,
      });
    }
    return map;
  }, [problems, modelEvidence]);

  // ---------- Pre-flight gates ----------

  // PHASE-SCOPED diagnostics for the active journey only. The donut uses
  // these directly so its discipline mix actually moves when the
  // strategist switches journeys (cross-cutting problems otherwise show
  // up identically in every journey's view and make the donut feel
  // global). When no `activeJourneyId` is supplied, fall through to all
  // diagnostics so legacy single-journey models still render.
  const phaseScopedDiagnostics = useMemo(() => {
    if (!activeJourneyId) return diagnostics;
    return diagnostics.filter((d) =>
      d.affectedPhaseIds.some((id) => activeJourneyPhaseIds.has(id))
    );
  }, [diagnostics, activeJourneyId, activeJourneyPhaseIds]);

  // SYSTEMIC / cross-cutting diagnostics — empty `affectedPhaseIds`.
  // Surveyed once across the whole model, journey-independent.
  const systemicDiagnostics = useMemo(
    () => diagnostics.filter((d) => d.affectedPhaseIds.length === 0),
    [diagnostics]
  );

  // Diagnostics for the matrix / table / canvas — UNION of phase-scoped
  // and systemic, so the strategist can still survey systemic problems
  // alongside this journey's phase-scoped ones in the lower views.
  // Only the donut uses `phaseScopedDiagnostics` directly.
  const visibleDiagnostics = useMemo(() => {
    if (!activeJourneyId) return diagnostics;
    return [...phaseScopedDiagnostics, ...systemicDiagnostics];
  }, [activeJourneyId, diagnostics, phaseScopedDiagnostics, systemicDiagnostics]);

  // Donut subtitle — disambiguates the new phase-scoped semantics so
  // the strategist sees clearly which slice they're looking at.
  const activeJourneyName = useMemo(
    () =>
      activeJourneyId
        ? modelJourneys.find((j) => j.id === activeJourneyId)?.name
        : undefined,
    [activeJourneyId, modelJourneys]
  );
  const donutSubtitle = activeJourneyName
    ? `${activeJourneyName} · phase-scoped problems only`
    : undefined;

  const hasApiKey = apiKey.trim().length > 0;
  const hasProblems = problems.length > 0;
  const hasAcceptedExtracted = acceptedProblemExtracted.length > 0;
  // Pipeline gate uses the full phase set — without ANY phase context
  // we can't classify. Empty `journeyPhases` (filter result) is fine,
  // we just show an empty visualization.
  const hasPhases = allJourneyPhases.length > 0;
  const hasDiagnostics = diagnostics.length > 0;
  const hasVisibleDiagnostics = visibleDiagnostics.length > 0;
  const hasManualEdits = diagnostics.some((d) => d.manuallyEdited);

  // Count of accepted ExtractedSignals that are still on a provisional
  // `accepted-...` stamp (i.e. haven't yet been promoted to a real
  // Signal). Used by the auto-run trigger to decide if there is pending
  // work, and by the action-bar copy.
  const pendingPromote = useMemo(
    () =>
      acceptedProblemExtracted.filter((s) =>
        (s.promotedToSignalId || '').startsWith('accepted-')
      ).length,
    [acceptedProblemExtracted]
  );

  // Auto-clear stale error when inputs change.
  useEffect(() => setError(null), [problems.length, allJourneyPhases.length]);

  // ---------- Pipeline ----------

  const buildDiagnosticRow = (
    item: ClassifyProblemsResponse['diagnostics'][number],
    freqCtx: Map<string, FrequencyContext>,
    existing?: ProblemDiagnostic
  ): ProblemDiagnostic => {
    const ctx = freqCtx.get(item.problemSignalId) || {
      sourceCount: 0,
      chunkCount: 0,
      departmentSpread: 0,
    };
    const freq = computeFrequency(ctx);
    const now = new Date();
    return {
      id: existing?.id ?? uuidv4(),
      modelId,
      problemSignalId: item.problemSignalId,
      discipline: item.discipline,
      disciplineRationale: item.disciplineRationale,
      secondaryDiscipline: item.secondaryDiscipline,
      secondaryRationale: item.secondaryRationale,
      frequency: freq.score,
      frequencyRationale: freq.rationale,
      impact: item.impact,
      impactRationale: item.impactRationale,
      affectedPhaseIds: item.affectedPhaseIds,
      phaseRationale: item.phaseRationale,
      manuallyEdited: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  };

  /**
   * Step 1 of the silent pipeline. Returns the next set of Problem
   * Signals to classify (newly-promoted + already-curated). Caller is
   * responsible for actually flushing the curate output to the stores.
   */
  const promoteAcceptedProblems = async (): Promise<{
    nextProblems: Signal[];
    nextAllSignals: Signal[];
  }> => {
    const existingSignalIds = new Set(modelSignals.map((s) => s.id));
    const result = await autoCurateAndPromote({
      apiKey,
      kind: 'problem',
      extractedSignals,
      existingSignalIds,
    });

    const supersededSet = new Set(result.supersededSignalIds);
    const nextAllSignals: Signal[] = modelSignals
      .filter((s) => !supersededSet.has(s.id))
      .concat(result.newSignals);

    if (result.newSignals.length > 0 || result.supersededSignalIds.length > 0) {
      setSignals(nextAllSignals);
    }

    // Stamp each ExtractedSignal with its new real Signal.id.
    await Promise.all(
      result.stamps.map((st) =>
        updateExtractedSignal(st.extractedId, {
          promotedToSignalId: st.signalId,
        })
      )
    );

    setMergeLog(result.mergeLog);

    const nextProblems = nextAllSignals.filter((s) => s.type === 'problem');
    return { nextProblems, nextAllSignals };
  };

  const callClassify = async (
    targetProblems: Signal[]
  ): Promise<ClassifyProblemsResponse | null> => {
    // Compute workshop labels for the target set fresh, since
    // `targetProblems` may include newly-promoted signals not yet
    // reflected in the memoised `workshopLabelsBySignal`.
    const uploadById = new Map(captureUploads.map((u) => [u.id, u]));
    const workshopById = new Map(modelWorkshops.map((w) => [w.id, w]));
    const labelsFor = (sig: Signal): string[] => {
      const labels = new Set<string>();
      for (const src of sig.sources || []) {
        const upload = uploadById.get(src.evidenceId);
        if (!upload) continue;
        const workshop = workshopById.get(upload.workshopId);
        if (!workshop) continue;
        const label = workshop.code
          ? `${workshop.code} — ${workshop.name}`
          : workshop.name;
        labels.add(label);
      }
      return Array.from(labels);
    };

    const journeyById = new Map(modelJourneys.map((j) => [j.id, j]));

    const journeyPhasesPayload = allJourneyPhases.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      trigger: p.trigger,
      journeyId: p.journeyId,
      journeyName: p.journeyId
        ? journeyById.get(p.journeyId)?.name
        : undefined,
    }));
    const journeysPayload = [...modelJourneys]
      .sort((a, b) => a.order - b.order)
      .map((j) => ({ id: j.id, name: j.name }));

    // Chunk to keep each response well under the 16k completion cap.
    // Each diagnostic emits ~600-800 tokens (four rationales + arrays);
    // 15 problems per chunk leaves comfortable headroom for the wrapper
    // and any prose drift, while still benefiting from cross-problem
    // context within each chunk.
    const CHUNK_SIZE = 15;
    const chunks: Signal[][] = [];
    for (let i = 0; i < targetProblems.length; i += CHUNK_SIZE) {
      chunks.push(targetProblems.slice(i, i + CHUNK_SIZE));
    }

    const merged: ClassifyProblemsResponse = {
      promptVersion: '',
      modelName: '',
      diagnostics: [],
    };

    for (const chunk of chunks) {
      const res = await fetch('/api/classify-problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          problems: chunk.map((p) => ({
            signalId: p.id,
            text: p.text,
            department: p.department,
            sourceQuotes: (p.sources || [])
              .map((s) => s.quote)
              .filter((q): q is string => !!q)
              .slice(0, 3),
            sourceWorkshops: labelsFor(p),
          })),
          // Always classify against every phase on the model — a single
          // problem can span multiple journeys, and the LLM needs the
          // full phase context to map them correctly.
          journeyPhases: journeyPhasesPayload,
          // Journey grouping for the prompt — disambiguates same-named
          // phases across journeys. Sorted by `order` to match on-screen.
          journeys: journeysPayload,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Classify failed: ${res.status}`);
      }
      const part = (await res.json()) as ClassifyProblemsResponse;
      merged.promptVersion = part.promptVersion;
      merged.modelName = part.modelName;
      merged.diagnostics.push(...part.diagnostics);
    }

    return merged;
  };

  /**
   * Recompute frequency context for an arbitrary problem set (used
   * post-promotion when `problems` is still the stale memoised value).
   */
  const buildFrequencyContext = (
    targetProblems: Signal[]
  ): Map<string, FrequencyContext> => {
    const evidenceById = new Map(modelEvidence.map((e) => [e.id, e]));
    const map = new Map<string, FrequencyContext>();
    for (const s of targetProblems) {
      const sources = s.sources || [];
      const departments = new Set<string>();
      for (const src of sources) {
        const ev = evidenceById.get(src.evidenceId);
        if (ev?.department) departments.add(ev.department);
      }
      if (s.department) departments.add(s.department);
      map.set(s.id, {
        sourceCount: sources.length,
        chunkCount:
          sources.filter((sr) => !!sr.quote).length || sources.length,
        departmentSpread: departments.size,
      });
    }
    return map;
  };

  /**
   * Single-button entry point. Promotes accepted problems silently,
   * then classifies the resulting problem set. If the model has manual
   * diagnostic edits, opens the diff modal instead of overwriting.
   */
  const handleRunDiagnostics = async () => {
    if (!hasApiKey || !hasPhases) return;
    if (!hasProblems && !hasAcceptedExtracted) return;
    setRunning(true);
    setError(null);
    setMergeLog([]);
    try {
      const { nextProblems } = await promoteAcceptedProblems();
      if (nextProblems.length === 0) {
        setError('Nothing to classify — no Problem signals after promotion.');
        return;
      }

      const result = await callClassify(nextProblems);
      if (!result) return;

      const freqCtx = buildFrequencyContext(nextProblems);
      const proposed: ProposedDiagnostic[] = result.diagnostics;

      if (!hasDiagnostics || !hasManualEdits) {
        const rows = proposed.map((p) => buildDiagnosticRow(p, freqCtx));
        await replaceProblemDiagnostics(modelId, rows);
        return;
      }

      setDiffModal({ proposed });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  // Data-state-based auto-run.
  //
  // Problem Diagnostics is now its own top-level step in the header — the
  // user can land on this panel from anywhere, any number of times. The
  // trigger is purely data-state: classify once on arrival when there is
  // genuinely pending work (accepted findings exist AND we either have
  // no diagnostics yet, or there are accepted findings still waiting to
  // be promoted). Subsequent visits with no new work do nothing — manual
  // edits and existing reports are preserved. The "Re-run diagnostics"
  // button is the explicit re-run path.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (running) return;
    if (!hasApiKey || !hasPhases) return;
    if (!hasAcceptedExtracted && !hasProblems) return;
    const pendingWork =
      hasAcceptedExtracted && (!hasDiagnostics || pendingPromote > 0);
    if (!pendingWork) return;
    autoRanRef.current = true;
    void handleRunDiagnostics();
    // handleRunDiagnostics is stable enough for this purpose; deliberately
    // not in deps to keep the trigger one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasApiKey,
    hasPhases,
    hasProblems,
    hasAcceptedExtracted,
    hasDiagnostics,
    pendingPromote,
    running,
  ]);

  const handleApplyDiff = async (acceptedSignalIds: string[]) => {
    if (!diffModal) return;
    const accept = new Set(acceptedSignalIds);
    const existingBySignal = new Map(
      diagnostics.map((d) => [d.problemSignalId, d])
    );
    const updates: ProblemDiagnostic[] = [];
    for (const p of diffModal.proposed) {
      if (!accept.has(p.problemSignalId)) continue;
      const existing = existingBySignal.get(p.problemSignalId);
      updates.push(buildDiagnosticRow(p, frequencyContext, existing));
    }
    if (updates.length > 0) {
      await upsertProblemDiagnostics(updates);
    }
    setDiffModal(null);
  };

  const handleUpdateRow = (
    id: string,
    updates: Partial<ProblemDiagnostic>
  ) => {
    void updateProblemDiagnostic(id, updates);
  };

  const handleGenerateNarrative = async () => {
    if (!hasApiKey || !hasVisibleDiagnostics) return;
    setGeneratingNarrative(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnose-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          // Narrative is journey-scoped — match the on-screen filter so
          // the report describes what the strategist is looking at.
          diagnostics: visibleDiagnostics,
          journeyPhases,
          problemTexts,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Narrative failed: ${res.status}`);
      }
      const data = (await res.json()) as DiagnoseNarrativeResponse;
      const next: ProblemDiagnosticNarrative = {
        id: narrative?.id ?? uuidv4(),
        modelId,
        ...data.narrative,
        generatedAt: new Date(),
      };
      await setProblemDiagnosticNarrative(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingNarrative(false);
    }
  };

  // ---------- Header counters ----------

  // Counters reflect the on-screen filter (active journey only) so the
  // strategist's framing of the report stays consistent.
  const counts = useMemo(
    () => disciplineCounts(visibleDiagnostics),
    [visibleDiagnostics]
  );
  const quadrantTotals = useMemo(() => {
    const out: Record<Quadrant, number> = {
      quickWins: 0,
      majorProjects: 0,
      timeSinks: 0,
      minor: 0,
    };
    for (const d of visibleDiagnostics) out[quadrantOf(d)] += 1;
    return out;
  }, [visibleDiagnostics]);

  // ---------- Empty state: nothing to diagnose ----------

  if (!hasProblems && !hasAcceptedExtracted) {
    return (
      <div
        className="rounded-lg border p-8 flex flex-col items-center text-center gap-4"
        style={{
          background: 'var(--bg-1)',
          borderColor: 'var(--border-1)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'var(--bg-2)', color: 'var(--fg-2)' }}
        >
          <Inbox size={22} />
        </div>
        <div className="max-w-xl space-y-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>
            No accepted Problem findings yet
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
            Head to{' '}
            <span style={{ color: 'var(--fg-1)' }}>3. Review Findings</span>{' '}
            and accept the Problem rows you want to diagnose. Diagnostics
            runs silent dedupe + classification on whatever you accept.
          </p>
        </div>
        {onNavigateToReview && (
          <button
            type="button"
            onClick={onNavigateToReview}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md font-semibold"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <ArrowLeft size={14} />
            Go to Review Findings
          </button>
        )}
      </div>
    );
  }

  // ---------- Main panel ----------

  const runDisabled =
    !hasApiKey || !hasPhases || running || (!hasProblems && !hasAcceptedExtracted);
  const runLabel = running
    ? hasDiagnostics
      ? 'Re-running diagnostics'
      : 'Running diagnostics'
    : hasDiagnostics
      ? 'Re-run diagnostics'
      : 'Run diagnostics';
  const runIcon = running ? (
    <Loader2 size={14} className="animate-spin" />
  ) : hasDiagnostics ? (
    <RefreshCw size={14} />
  ) : (
    <Sparkles size={14} />
  );
  const runTitle = !hasApiKey
    ? 'Add your OpenAI API key in the header first'
    : !hasPhases
      ? 'Generate journey phases first — diagnostics needs phase context'
      : pendingPromote > 0
        ? `Will dedupe + promote ${pendingPromote} accepted finding${pendingPromote === 1 ? '' : 's'}, then classify`
        : hasDiagnostics
          ? 'Re-classify all promoted problems'
          : 'Classify all promoted problems';

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div
        className="rounded-lg border p-4 flex flex-wrap items-center gap-3"
        style={{
          background: 'var(--bg-1)',
          borderColor: 'var(--border-1)',
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>
            {hasProblems
              ? `${problems.length} promoted problem${problems.length === 1 ? '' : 's'}`
              : 'No promoted problems yet'}
            {pendingPromote > 0
              ? ` · ${pendingPromote} accepted ready to promote`
              : ''}
            {hasDiagnostics ? ` · ${diagnostics.length} classified` : ''}
          </div>
          <div className="text-xs" style={{ color: 'var(--fg-3)' }}>
            {hasManualEdits
              ? 'Some rows have been manually edited — re-run will open a diff for review.'
              : 'One click runs dedupe → promote → classify. Frequency is computed from source/department spread; impact is LLM-rated.'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunDiagnostics}
          disabled={runDisabled}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md font-semibold"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            opacity: runDisabled ? 0.4 : 1,
            cursor: runDisabled ? 'not-allowed' : 'pointer',
          }}
          title={runTitle}
        >
          {runIcon}
          {runLabel}
        </button>

        <button
          type="button"
          onClick={handleGenerateNarrative}
          disabled={
            !hasApiKey || !hasVisibleDiagnostics || generatingNarrative
          }
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
            opacity:
              !hasApiKey || !hasVisibleDiagnostics || generatingNarrative
                ? 0.4
                : 1,
            cursor:
              !hasApiKey || !hasVisibleDiagnostics || generatingNarrative
                ? 'not-allowed'
                : 'pointer',
          }}
          title={
            !hasVisibleDiagnostics
              ? activeJourneyId
                ? 'No problems on this journey — switch journeys or run diagnostics'
                : 'Run diagnostics first'
              : narrative
                ? 'Regenerate the diagnostic narrative report'
                : 'Generate the diagnostic narrative report'
          }
        >
          {generatingNarrative ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
          {generatingNarrative
            ? 'Generating report'
            : narrative
              ? 'Regenerate report'
              : 'Generate report'}
        </button>

        <ProblemDiagnosticsExport
          modelLabel={modelInput?.industry || modelId}
          diagnostics={visibleDiagnostics}
          narrative={narrative}
          journeyPhases={journeyPhases}
          problemTexts={problemTexts}
          chartRefs={{
            donut: donutRef,
            quadrant: quadrantRef,
            heatmap: heatmapRef,
          }}
        />
      </div>

      {/* Passive merge-log notification — fires after a silent dedupe */}
      {mergeLog.length > 0 && (
        <div
          className="rounded-md p-3 text-xs space-y-2"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-2)',
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--fg-1)' }}>
            <CheckCircle2 size={14} />
            Auto-merged {mergeLog.length} duplicate group
            {mergeLog.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-1 pl-5 list-disc">
            {mergeLog.slice(0, 5).map((m, i) => (
              <li key={i}>
                <span style={{ color: 'var(--fg-1)' }}>{m.canonicalText}</span>{' '}
                <span style={{ color: 'var(--fg-3)' }}>
                  ← merged from {m.mergedTexts.length} signals
                </span>
              </li>
            ))}
            {mergeLog.length > 5 && (
              <li style={{ color: 'var(--fg-3)' }}>
                +{mergeLog.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <div
          className="rounded-md p-3 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Pre-flight reminders */}
      {!hasPhases && (
        <div
          className="rounded-md p-3 text-xs"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-3)',
          }}
        >
          No journey phases on this model yet. Diagnostics needs phase
          context — generate journey phases first.
        </div>
      )}

      {/* Pre-classification placeholder when only accepted findings exist */}
      {!hasDiagnostics && hasAcceptedExtracted && !hasProblems && (
        <div
          className="rounded-md p-3 text-xs"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-3)',
          }}
        >
          {acceptedProblemExtracted.length} accepted Problem finding
          {acceptedProblemExtracted.length === 1 ? '' : 's'} ready. Click{' '}
          <span style={{ color: 'var(--fg-1)' }}>Run diagnostics</span> to
          dedupe, promote, and classify in one pass.
        </div>
      )}

      {/* Quadrant counters strip */}
      {hasVisibleDiagnostics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(QUADRANT_LABELS) as Quadrant[]).map((q) => (
            <div
              key={q}
              className="rounded-lg border p-3"
              style={{
                background: 'var(--bg-1)',
                borderColor: 'var(--border-1)',
              }}
            >
              <div
                className="text-[10px] uppercase tracking-wide"
                style={{ color: 'var(--fg-3)' }}
              >
                {QUADRANT_LABELS[q]}
              </div>
              <div
                className="text-2xl font-bold"
                style={{ color: 'var(--fg-1)' }}
              >
                {quadrantTotals[q]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visualizations */}
      {hasVisibleDiagnostics && (
        <>
          {/* Donut sits next to summary; the matrix gets full width below
              so problem text can render legibly inside cards. The donut
              uses STRICTLY phase-scoped diagnostics so its discipline mix
              actually moves when journeys switch. Systemic problems are
              surfaced separately via SystemicSummary. */}
          <div ref={donutRef}>
            <DisciplineDonut
              diagnostics={phaseScopedDiagnostics}
              subtitle={donutSubtitle}
            />
          </div>
          {systemicDiagnostics.length > 0 && (
            <SystemicSummary diagnostics={systemicDiagnostics} />
          )}
          <div ref={quadrantRef}>
            <FrequencyImpactQuadrant
              diagnostics={visibleDiagnostics}
              problemTexts={problemTexts}
            />
          </div>
          <div ref={heatmapRef}>
            <JourneyCanvas
              diagnostics={visibleDiagnostics}
              journeyPhases={journeyPhases}
              problemTexts={problemTexts}
            />
          </div>
        </>
      )}

      {/* Empty-state when an active journey filter has no diagnostics */}
      {hasDiagnostics && !hasVisibleDiagnostics && activeJourneyId && (
        <div
          className="rounded-md p-4 text-xs"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-3)',
          }}
        >
          No problems mapped to this journey&apos;s phases yet. Switch
          journeys above, or re-run diagnostics if you just edited
          phases.
        </div>
      )}

      {/* Editable table */}
      {hasVisibleDiagnostics && (
        <ProblemTable
          diagnostics={visibleDiagnostics}
          journeyPhases={journeyPhases}
          problemTexts={problemTexts}
          onUpdate={handleUpdateRow}
        />
      )}

      {/* Narrative report */}
      {narrative && (
        <NarrativeReport
          narrative={narrative}
          journeyPhases={journeyPhases}
          counts={counts}
        />
      )}

      {/* Diff modal */}
      {diffModal && (
        <ReclassifyDiffModal
          open={true}
          current={diagnostics}
          proposed={diffModal.proposed}
          problemTexts={problemTexts}
          journeyPhases={journeyPhases}
          onApply={handleApplyDiff}
          onCancel={() => setDiffModal(null)}
        />
      )}
    </div>
  );
}

// ---------- Narrative renderer ----------

/**
 * Systemic / cross-cutting problem summary tile. Renders the count and
 * a one-line discipline-chip breakdown for problems whose
 * `affectedPhaseIds` is empty. These problems span the whole model and
 * are intentionally excluded from the per-journey donut so the donut
 * actually changes when the strategist switches journeys.
 */
function SystemicSummary({
  diagnostics,
}: {
  diagnostics: ProblemDiagnostic[];
}) {
  const counts = useMemo(() => disciplineCounts(diagnostics), [diagnostics]);
  const total = diagnostics.length;
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--fg-1)' }}
        >
          Systemic problems · {total} across all journeys
        </h3>
        <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
          Cross-cutting — excluded from the per-journey donut above.
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DISCIPLINE_ORDER.filter((d) => counts[d] > 0).map((d) => (
          <span
            key={d}
            className="text-[11px] rounded-full px-2 py-0.5 inline-flex items-center gap-1.5"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border-1)',
              color: 'var(--fg-1)',
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: DISCIPLINE_COLORS[d] }}
            />
            {DISCIPLINE_LABELS[d]} · {counts[d].toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

interface NarrativeReportProps {
  narrative: ProblemDiagnosticNarrative;
  journeyPhases: JourneyPhase[];
  counts: ReturnType<typeof disciplineCounts>;
}

function NarrativeReport({
  narrative,
  journeyPhases,
  counts,
}: NarrativeReportProps) {
  const phaseLabel = useMemo(() => {
    const m = new Map(journeyPhases.map((p) => [p.id, p.label]));
    return (id: string) => m.get(id) || id;
  }, [journeyPhases]);

  return (
    <div
      className="rounded-lg border p-6 space-y-6"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
      }}
    >
      <div>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--fg-1)' }}>
          Diagnostic report
        </h3>
        <div className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
          generated {new Date(narrative.generatedAt).toLocaleString()}
        </div>
      </div>

      <section>
        <h4
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--fg-2)' }}
        >
          Executive summary
        </h4>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-1)' }}>
          {narrative.executiveSummary}
        </p>
      </section>

      {narrative.perDiscipline.length > 0 && (
        <section>
          <h4
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: 'var(--fg-2)' }}
          >
            By discipline
          </h4>
          <div className="space-y-3">
            {narrative.perDiscipline
              .filter((p) => p.narrative.trim())
              .map((p) => (
                <div key={p.discipline}>
                  <div
                    className="text-xs font-semibold mb-1"
                    style={{ color: 'var(--fg-1)' }}
                  >
                    {DISCIPLINE_LABELS[p.discipline]}{' '}
                    <span style={{ color: 'var(--fg-3)' }}>
                      · {(counts[p.discipline] || 0).toFixed(1)} weighted
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--fg-2)' }}
                  >
                    {p.narrative}
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      {narrative.perPhase.length > 0 && (
        <section>
          <h4
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: 'var(--fg-2)' }}
          >
            By journey phase
          </h4>
          <div className="space-y-3">
            {narrative.perPhase
              .filter((p) => p.narrative.trim())
              .map((p) => (
                <div key={p.phaseId}>
                  <div
                    className="text-xs font-semibold mb-1"
                    style={{ color: 'var(--fg-1)' }}
                  >
                    {phaseLabel(p.phaseId)}
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--fg-2)' }}
                  >
                    {p.narrative}
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      <section>
        <h4
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--fg-2)' }}
        >
          By Frequency × Impact quadrant
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['quickWins', 'majorProjects', 'timeSinks', 'minor'] as const).map(
            (q) =>
              narrative.perQuadrant[q]?.trim() ? (
                <div
                  key={q}
                  className="rounded p-3"
                  style={{
                    background: 'var(--bg-0)',
                    border: '1px solid var(--border-1)',
                  }}
                >
                  <div
                    className="text-xs font-semibold mb-1"
                    style={{ color: 'var(--fg-1)' }}
                  >
                    {QUADRANT_LABELS[q]}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--fg-2)' }}>
                    {narrative.perQuadrant[q]}
                  </p>
                </div>
              ) : null
          )}
        </div>
      </section>
    </div>
  );
}
