/**
 * PPTX export for the Problem Diagnostics report.
 *
 * Slide deck shape (deliberate, in order):
 *   1. Title
 *   2. Headline numbers
 *   3. Discipline donut (PNG snapshot of the live chart)
 *   4. Frequency × Impact quadrant (PNG snapshot)
 *   5. Journey × Discipline heatmap (PNG snapshot)
 *   6. Executive summary
 *   7. By discipline (one bullet block, condensed)
 *   8. By journey phase
 *   9. By quadrant
 *  10. Top problems table (the highest-impact 10)
 *
 * Charts are passed in as data-URI PNG strings (rendered by the caller
 * via html-to-image). If a chart PNG is missing, the slide is skipped
 * rather than emitting an empty placeholder.
 */

import PptxGenJS from 'pptxgenjs';
import type {
  JourneyPhase,
  ProblemDiagnostic,
  ProblemDiagnosticNarrative,
  ProblemDiscipline,
} from './types';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_ORDER,
  QUADRANT_LABELS,
  disciplineCounts,
  quadrantOf,
} from './problem-diagnostics-meta';

interface PptxExportArgs {
  modelLabel: string;
  diagnostics: ProblemDiagnostic[];
  narrative: ProblemDiagnosticNarrative | null;
  journeyPhases: JourneyPhase[];
  problemTexts: Record<string, string>;
  /** Optional pre-rendered chart PNGs (data: URIs). */
  charts?: {
    donutDataUrl?: string;
    quadrantDataUrl?: string;
    heatmapDataUrl?: string;
  };
  /** Output filename. Caller can pass with or without `.pptx`. */
  filename?: string;
}

const ACCENT = '111827';
const SUBTLE = '6B7280';

function addTitleBar(slide: PptxGenJS.Slide, title: string, subtitle?: string) {
  slide.addText(title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontFace: 'Arial',
    fontSize: 24,
    bold: true,
    color: ACCENT,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.85,
      w: 9,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 12,
      color: SUBTLE,
    });
  }
}

function addBodyText(
  slide: PptxGenJS.Slide,
  text: string,
  opts: { y?: number; h?: number; fontSize?: number } = {}
) {
  slide.addText(text, {
    x: 0.5,
    y: opts.y ?? 1.4,
    w: 9,
    h: opts.h ?? 4,
    fontFace: 'Arial',
    fontSize: opts.fontSize ?? 14,
    color: '1F2937',
    valign: 'top',
  });
}

export async function exportProblemDiagnosticsToPptx({
  modelLabel,
  diagnostics,
  narrative,
  journeyPhases,
  problemTexts,
  charts,
  filename,
}: PptxExportArgs): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pptx.title = 'Problem Diagnostics';

  const counts = disciplineCounts(diagnostics);
  const quadrantTotals = {
    quickWins: 0,
    majorProjects: 0,
    timeSinks: 0,
    minor: 0,
  } as Record<keyof typeof QUADRANT_LABELS, number>;
  for (const d of diagnostics) quadrantTotals[quadrantOf(d)] += 1;

  // ---- Slide 1: Title ----
  {
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addText('Problem Diagnostics', {
      x: 0.5,
      y: 2.5,
      w: 12,
      h: 1,
      fontFace: 'Arial',
      fontSize: 44,
      bold: true,
      color: ACCENT,
    });
    s.addText(modelLabel, {
      x: 0.5,
      y: 3.6,
      w: 12,
      h: 0.5,
      fontFace: 'Arial',
      fontSize: 18,
      color: SUBTLE,
    });
    s.addText(`Generated ${new Date().toLocaleString()}`, {
      x: 0.5,
      y: 4.1,
      w: 12,
      h: 0.4,
      fontFace: 'Arial',
      fontSize: 12,
      color: SUBTLE,
    });
  }

  // ---- Slide 2: Headline numbers ----
  {
    const s = pptx.addSlide();
    addTitleBar(s, 'At a glance', modelLabel);
    const headline = `${diagnostics.length} classified problems`;
    s.addText(headline, {
      x: 0.5,
      y: 1.4,
      w: 12,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: ACCENT,
      fontFace: 'Arial',
    });

    // Quadrant tiles
    const tiles: Array<keyof typeof QUADRANT_LABELS> = [
      'quickWins',
      'majorProjects',
      'timeSinks',
      'minor',
    ];
    tiles.forEach((q, i) => {
      const x = 0.5 + i * 3.1;
      s.addShape('rect', {
        x,
        y: 2.3,
        w: 2.9,
        h: 1.4,
        fill: { color: 'F3F4F6' },
        line: { color: 'E5E7EB', width: 1 },
      });
      s.addText(QUADRANT_LABELS[q], {
        x: x + 0.2,
        y: 2.4,
        w: 2.7,
        h: 0.4,
        fontSize: 12,
        color: SUBTLE,
        bold: true,
        fontFace: 'Arial',
      });
      s.addText(String(quadrantTotals[q]), {
        x: x + 0.2,
        y: 2.85,
        w: 2.7,
        h: 0.8,
        fontSize: 36,
        bold: true,
        color: ACCENT,
        fontFace: 'Arial',
      });
    });

    // Discipline mix
    const lines = (DISCIPLINE_ORDER as ProblemDiscipline[])
      .filter((d) => (counts[d] || 0) > 0)
      .map((d) => `• ${DISCIPLINE_LABELS[d]} — ${counts[d].toFixed(1)}`)
      .join('\n');
    s.addText('Discipline mix (primary 1.0, secondary 0.5)', {
      x: 0.5,
      y: 4.0,
      w: 12,
      h: 0.4,
      fontSize: 12,
      color: SUBTLE,
      bold: true,
      fontFace: 'Arial',
    });
    s.addText(lines || '—', {
      x: 0.5,
      y: 4.4,
      w: 12,
      h: 2.5,
      fontSize: 14,
      color: '1F2937',
      fontFace: 'Arial',
      valign: 'top',
    });
  }

  // ---- Slides 3-5: Charts ----
  if (charts?.donutDataUrl) {
    const s = pptx.addSlide();
    addTitleBar(s, 'Discipline distribution', 'Primary 1.0 · Secondary 0.5');
    s.addImage({
      data: charts.donutDataUrl,
      x: 1.5,
      y: 1.3,
      w: 10.3,
      h: 5.7,
      sizing: { type: 'contain', w: 10.3, h: 5.7 },
    });
  }
  if (charts?.quadrantDataUrl) {
    const s = pptx.addSlide();
    addTitleBar(s, 'Frequency × Impact', 'Quick Wins · Major Projects · Time Sinks · Minor');
    s.addImage({
      data: charts.quadrantDataUrl,
      x: 1.5,
      y: 1.3,
      w: 10.3,
      h: 5.7,
      sizing: { type: 'contain', w: 10.3, h: 5.7 },
    });
  }
  if (charts?.heatmapDataUrl) {
    const s = pptx.addSlide();
    addTitleBar(s, 'Journey × Discipline heatmap', 'sum of frequency × impact');
    s.addImage({
      data: charts.heatmapDataUrl,
      x: 0.5,
      y: 1.3,
      w: 12.3,
      h: 5.7,
      sizing: { type: 'contain', w: 12.3, h: 5.7 },
    });
  }

  // ---- Slide: Executive summary ----
  if (narrative?.executiveSummary?.trim()) {
    const s = pptx.addSlide();
    addTitleBar(s, 'Executive summary');
    addBodyText(s, narrative.executiveSummary, { fontSize: 16 });
  }

  // ---- Slide: By discipline ----
  if (narrative?.perDiscipline.some((p) => p.narrative.trim())) {
    const s = pptx.addSlide();
    addTitleBar(s, 'By discipline');
    const text = narrative.perDiscipline
      .filter((p) => p.narrative.trim())
      .map(
        (p) =>
          `${DISCIPLINE_LABELS[p.discipline]} (${(counts[p.discipline] || 0).toFixed(1)})\n${p.narrative}`
      )
      .join('\n\n');
    addBodyText(s, text, { fontSize: 12 });
  }

  // ---- Slide: By journey phase ----
  if (narrative?.perPhase.some((p) => p.narrative.trim())) {
    const phaseLabel = (id: string) =>
      journeyPhases.find((p) => p.id === id)?.label || id;
    const s = pptx.addSlide();
    addTitleBar(s, 'By journey phase');
    const text = narrative.perPhase
      .filter((p) => p.narrative.trim())
      .map((p) => `${phaseLabel(p.phaseId)}\n${p.narrative}`)
      .join('\n\n');
    addBodyText(s, text, { fontSize: 12 });
  }

  // ---- Slide: By quadrant ----
  if (narrative) {
    const quadrantOrder = [
      'quickWins',
      'majorProjects',
      'timeSinks',
      'minor',
    ] as const;
    const hasAny = quadrantOrder.some((q) =>
      narrative.perQuadrant[q]?.trim()
    );
    if (hasAny) {
      const s = pptx.addSlide();
      addTitleBar(s, 'By Frequency × Impact quadrant');
      // 2x2 grid of text tiles
      quadrantOrder.forEach((q, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 6.4;
        const y = 1.4 + row * 2.8;
        s.addShape('rect', {
          x,
          y,
          w: 6.2,
          h: 2.6,
          fill: { color: 'F9FAFB' },
          line: { color: 'E5E7EB', width: 1 },
        });
        s.addText(`${QUADRANT_LABELS[q]} (${quadrantTotals[q]})`, {
          x: x + 0.2,
          y: y + 0.15,
          w: 6.0,
          h: 0.4,
          fontSize: 13,
          bold: true,
          color: ACCENT,
          fontFace: 'Arial',
        });
        s.addText(narrative.perQuadrant[q] || '—', {
          x: x + 0.2,
          y: y + 0.6,
          w: 6.0,
          h: 1.9,
          fontSize: 11,
          color: '1F2937',
          fontFace: 'Arial',
          valign: 'top',
        });
      });
    }
  }

  // ---- Slide: Top problems table ----
  {
    const top = [...diagnostics]
      .sort((a, b) => b.impact * b.frequency - a.impact * a.frequency)
      .slice(0, 10);

    if (top.length > 0) {
      const s = pptx.addSlide();
      addTitleBar(s, 'Top 10 problems by frequency × impact');
      const phaseLabel = (id: string) =>
        journeyPhases.find((p) => p.id === id)?.label || id;
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: 'Problem', options: { bold: true, fill: { color: 'F3F4F6' } } },
          { text: 'Discipline', options: { bold: true, fill: { color: 'F3F4F6' } } },
          { text: 'F', options: { bold: true, fill: { color: 'F3F4F6' } } },
          { text: 'I', options: { bold: true, fill: { color: 'F3F4F6' } } },
          { text: 'Phases', options: { bold: true, fill: { color: 'F3F4F6' } } },
        ],
        ...top.map(
          (d): PptxGenJS.TableRow => [
            { text: problemTexts[d.problemSignalId] || '(text missing)' },
            { text: DISCIPLINE_LABELS[d.discipline] },
            { text: String(d.frequency) },
            { text: String(d.impact) },
            { text: d.affectedPhaseIds.map(phaseLabel).join(', ') || '—' },
          ]
        ),
      ];

      s.addTable(rows, {
        x: 0.5,
        y: 1.4,
        w: 12.3,
        colW: [5.5, 2.4, 0.6, 0.6, 3.2],
        fontSize: 11,
        fontFace: 'Arial',
        border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      });
    }
  }

  const out = filename
    ? filename.endsWith('.pptx')
      ? filename
      : `${filename}.pptx`
    : `problem-diagnostics_${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19)}.pptx`;

  await pptx.writeFile({ fileName: out });
}
