/**
 * Word (.docx) export for the Problem Diagnostics report.
 *
 * Produces a self-contained narrative document with:
 *   - title block (model id, generated date)
 *   - executive summary
 *   - per-discipline narratives + counts
 *   - per-phase narratives
 *   - per-quadrant narratives
 *   - full diagnostics table (problem · discipline · freq · impact · phases)
 *
 * Charts are intentionally NOT embedded here — the Word export is the
 * narrative artifact. Charts go in the PPT deck.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type {
  JourneyPhase,
  ProblemDiagnostic,
  ProblemDiagnosticNarrative,
} from './types';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  QUADRANT_LABELS,
  disciplineCounts,
  quadrantOf,
} from './problem-diagnostics-meta';

interface WordExportArgs {
  modelLabel: string;
  diagnostics: ProblemDiagnostic[];
  narrative: ProblemDiagnosticNarrative | null;
  journeyPhases: JourneyPhase[];
  problemTexts: Record<string, string>;
}

const HEADING_COLOR = '111827';
const SUBTLE_COLOR = '6B7280';

function p(
  text: string,
  opts: {
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    bold?: boolean;
    color?: string;
    size?: number; // half-points
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
  } = {}
): Paragraph {
  return new Paragraph({
    heading: opts.heading,
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color,
        size: opts.size,
      }),
    ],
  });
}

function cell(text: string, opts: { bold?: boolean; widthPct?: number } = {}): TableCell {
  return new TableCell({
    width: opts.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function diagnosticsTable(
  diagnostics: ProblemDiagnostic[],
  journeyPhases: JourneyPhase[],
  problemTexts: Record<string, string>
): Table {
  const phaseLabel = (id: string) =>
    journeyPhases.find((p) => p.id === id)?.label || id;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('Problem', { bold: true, widthPct: 36 }),
      cell('Primary', { bold: true, widthPct: 14 }),
      cell('Secondary', { bold: true, widthPct: 12 }),
      cell('Freq', { bold: true, widthPct: 6 }),
      cell('Impact', { bold: true, widthPct: 6 }),
      cell('Phases', { bold: true, widthPct: 26 }),
    ],
  });

  const rows = diagnostics.map(
    (d) =>
      new TableRow({
        children: [
          cell(problemTexts[d.problemSignalId] || '(text missing)'),
          cell(DISCIPLINE_LABELS[d.discipline]),
          cell(
            d.secondaryDiscipline
              ? DISCIPLINE_LABELS[d.secondaryDiscipline]
              : '—'
          ),
          cell(String(d.frequency)),
          cell(String(d.impact)),
          cell(d.affectedPhaseIds.map(phaseLabel).join(', ') || '—'),
        ],
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
    },
  });
}

export async function exportProblemDiagnosticsToWord({
  modelLabel,
  diagnostics,
  narrative,
  journeyPhases,
  problemTexts,
}: WordExportArgs): Promise<Blob> {
  const counts = disciplineCounts(diagnostics);
  const phaseLabel = (id: string) =>
    journeyPhases.find((p) => p.id === id)?.label || id;

  const quadrantTotals = {
    quickWins: 0,
    majorProjects: 0,
    timeSinks: 0,
    minor: 0,
  } as Record<keyof typeof QUADRANT_LABELS, number>;
  for (const d of diagnostics) quadrantTotals[quadrantOf(d)] += 1;

  const children: Array<Paragraph | Table> = [];

  // Title block
  children.push(
    p('Problem Diagnostics', {
      heading: HeadingLevel.TITLE,
      color: HEADING_COLOR,
      align: AlignmentType.LEFT,
      spacingAfter: 80,
    })
  );
  children.push(
    p(modelLabel, {
      color: SUBTLE_COLOR,
      size: 20,
      spacingAfter: 40,
    })
  );
  children.push(
    p(`Generated ${new Date().toLocaleString()}`, {
      color: SUBTLE_COLOR,
      size: 18,
      spacingAfter: 240,
    })
  );

  // Headline numbers
  children.push(
    p('At a glance', { heading: HeadingLevel.HEADING_2, color: HEADING_COLOR })
  );
  children.push(
    p(
      `${diagnostics.length} classified problem${diagnostics.length === 1 ? '' : 's'} · Quick Wins ${quadrantTotals.quickWins} · Major Projects ${quadrantTotals.majorProjects} · Time Sinks ${quadrantTotals.timeSinks} · Minor ${quadrantTotals.minor}`,
      { size: 22 }
    )
  );

  children.push(
    p('Discipline weighting (primary = 1.0, secondary = 0.5)', {
      color: SUBTLE_COLOR,
      size: 18,
    })
  );
  for (const d of DISCIPLINE_ORDER) {
    if ((counts[d] || 0) === 0) continue;
    children.push(
      p(`• ${DISCIPLINE_LABELS[d]}: ${counts[d].toFixed(1)}`, { size: 20 })
    );
  }

  // Narrative sections
  if (narrative) {
    children.push(
      p('Executive summary', {
        heading: HeadingLevel.HEADING_2,
        color: HEADING_COLOR,
      })
    );
    children.push(p(narrative.executiveSummary, { size: 22 }));

    if (narrative.perDiscipline.some((n) => n.narrative.trim())) {
      children.push(
        p('By discipline', {
          heading: HeadingLevel.HEADING_2,
          color: HEADING_COLOR,
        })
      );
      for (const item of narrative.perDiscipline) {
        if (!item.narrative.trim()) continue;
        children.push(
          p(
            `${DISCIPLINE_LABELS[item.discipline]} (${(counts[item.discipline] || 0).toFixed(1)} weighted)`,
            {
              heading: HeadingLevel.HEADING_3,
              color: HEADING_COLOR,
            }
          )
        );
        children.push(p(item.narrative, { size: 22 }));
      }
    }

    if (narrative.perPhase.some((n) => n.narrative.trim())) {
      children.push(
        p('By journey phase', {
          heading: HeadingLevel.HEADING_2,
          color: HEADING_COLOR,
        })
      );
      for (const item of narrative.perPhase) {
        if (!item.narrative.trim()) continue;
        children.push(
          p(phaseLabel(item.phaseId), {
            heading: HeadingLevel.HEADING_3,
            color: HEADING_COLOR,
          })
        );
        children.push(p(item.narrative, { size: 22 }));
      }
    }

    children.push(
      p('By Frequency × Impact quadrant', {
        heading: HeadingLevel.HEADING_2,
        color: HEADING_COLOR,
      })
    );
    for (const q of [
      'quickWins',
      'majorProjects',
      'timeSinks',
      'minor',
    ] as const) {
      const text = narrative.perQuadrant[q]?.trim();
      if (!text) continue;
      children.push(
        p(`${QUADRANT_LABELS[q]} (${quadrantTotals[q]})`, {
          heading: HeadingLevel.HEADING_3,
          color: HEADING_COLOR,
        })
      );
      children.push(p(text, { size: 22 }));
    }
  }

  // Full table
  children.push(
    p('Full diagnostic table', {
      heading: HeadingLevel.HEADING_2,
      color: HEADING_COLOR,
    })
  );
  children.push(diagnosticsTable(diagnostics, journeyPhases, problemTexts));

  const doc = new Document({
    creator: 'Journey Generator',
    title: 'Problem Diagnostics',
    description: `Problem Diagnostics report for ${modelLabel}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
