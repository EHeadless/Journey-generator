'use client';

/**
 * Word + PPT export buttons for the Problem Diagnostics report.
 *
 * Word export is text-only (narrative + table). PPT export snapshots
 * three live chart nodes (donut, quadrant, heatmap) into PNG data URIs
 * via html-to-image, then ships them to the pptx export utility.
 *
 * The chart refs are passed in by the parent so the snapshot fires
 * against the actual rendered nodes — not a hidden duplicate that
 * could drift from what the user sees.
 */

import { useState, type RefObject } from 'react';
import { Loader2, FileText, Presentation } from 'lucide-react';
import { toPng } from 'html-to-image';
import type {
  JourneyPhase,
  ProblemDiagnostic,
  ProblemDiagnosticNarrative,
} from '@/lib/types';
import {
  exportProblemDiagnosticsToWord,
  downloadBlob,
} from '@/lib/problem-diagnostics-word-export';
import { exportProblemDiagnosticsToPptx } from '@/lib/problem-diagnostics-pptx-export';

interface ProblemDiagnosticsExportProps {
  modelLabel: string;
  diagnostics: ProblemDiagnostic[];
  narrative: ProblemDiagnosticNarrative | null;
  journeyPhases: JourneyPhase[];
  problemTexts: Record<string, string>;
  /** Refs to the three chart container nodes; any may be null. */
  chartRefs: {
    donut: RefObject<HTMLDivElement | null>;
    quadrant: RefObject<HTMLDivElement | null>;
    heatmap: RefObject<HTMLDivElement | null>;
  };
}

async function snapshotNode(
  node: HTMLElement | null
): Promise<string | undefined> {
  if (!node) return undefined;
  try {
    return await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
  } catch (err) {
    console.error('[ProblemDiagnosticsExport] snapshot failed', err);
    return undefined;
  }
}

function safeFilename(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function ProblemDiagnosticsExport({
  modelLabel,
  diagnostics,
  narrative,
  journeyPhases,
  problemTexts,
  chartRefs,
}: ProblemDiagnosticsExportProps) {
  const [busyKind, setBusyKind] = useState<'word' | 'pptx' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = diagnostics.length === 0;

  const handleWord = async () => {
    if (disabled || busyKind) return;
    setBusyKind('word');
    setError(null);
    try {
      const blob = await exportProblemDiagnosticsToWord({
        modelLabel,
        diagnostics,
        narrative,
        journeyPhases,
        problemTexts,
      });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const slug = safeFilename(modelLabel) || 'model';
      downloadBlob(blob, `problem-diagnostics_${slug}_${stamp}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  };

  const handlePptx = async () => {
    if (disabled || busyKind) return;
    setBusyKind('pptx');
    setError(null);
    try {
      const [donutDataUrl, quadrantDataUrl, heatmapDataUrl] = await Promise.all([
        snapshotNode(chartRefs.donut.current),
        snapshotNode(chartRefs.quadrant.current),
        snapshotNode(chartRefs.heatmap.current),
      ]);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const slug = safeFilename(modelLabel) || 'model';
      await exportProblemDiagnosticsToPptx({
        modelLabel,
        diagnostics,
        narrative,
        journeyPhases,
        problemTexts,
        charts: { donutDataUrl, quadrantDataUrl, heatmapDataUrl },
        filename: `problem-diagnostics_${slug}_${stamp}.pptx`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleWord}
          disabled={disabled || busyKind !== null}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
            opacity: disabled || busyKind !== null ? 0.4 : 1,
            cursor: disabled || busyKind !== null ? 'not-allowed' : 'pointer',
          }}
          title={
            disabled
              ? 'Run classification first'
              : 'Export the diagnostic report as a .docx file'
          }
        >
          {busyKind === 'word' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
          {busyKind === 'word' ? 'Building Word' : 'Export Word'}
        </button>

        <button
          type="button"
          onClick={handlePptx}
          disabled={disabled || busyKind !== null}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-1)',
            border: '1px solid var(--border-1)',
            opacity: disabled || busyKind !== null ? 0.4 : 1,
            cursor: disabled || busyKind !== null ? 'not-allowed' : 'pointer',
          }}
          title={
            disabled
              ? 'Run classification first'
              : 'Export the diagnostic deck as a .pptx file with embedded chart snapshots'
          }
        >
          {busyKind === 'pptx' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Presentation size={14} />
          )}
          {busyKind === 'pptx' ? 'Building deck' : 'Export PPT'}
        </button>
      </div>
      {error && (
        <div className="text-xs" style={{ color: '#EF4444' }}>
          {error}
        </div>
      )}
    </div>
  );
}
