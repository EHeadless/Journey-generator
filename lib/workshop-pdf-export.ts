/**
 * Workshop PDF export — renders each workshop (metadata + agenda +
 * attendees + questions grouped by intent) into a standalone PDF, and
 * zips them all into a single download.
 *
 * Uses jsPDF for rendering (client-side, no network) and JSZip for
 * bundling. Intentionally simple typography — this is a working
 * document, not a pitch deck.
 */

import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { Workshop, WorkshopQuestion, WorkshopQuestionIntent } from './types';

const INTENT_LABELS: Record<WorkshopQuestionIntent, string> = {
  context: 'Context',
  problem: 'Problems',
  jtbd: 'Jobs-to-be-Done',
  circumstance: 'Circumstances',
  need: 'Needs',
  opportunity: 'Opportunities',
  gap: 'Gaps',
  contradiction: 'Contradictions',
};

const INTENT_ORDER: WorkshopQuestionIntent[] = [
  'context',
  'problem',
  'jtbd',
  'circumstance',
  'need',
  'opportunity',
  'gap',
  'contradiction',
];

// Layout constants (points — 72pt = 1in; letter = 612 x 792)
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function sanitizeFilename(s: string): string {
  return s
    .replace(/[\/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'workshop';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// ---------- PDF rendering ----------

class PdfWriter {
  doc: jsPDF;
  y: number;

  constructor() {
    this.doc = new jsPDF({ unit: 'pt', format: 'letter' });
    this.doc.setFont('helvetica', 'normal');
    this.y = MARGIN_TOP;
  }

  ensureSpace(lines: number, lineHeight = 14) {
    if (this.y + lines * lineHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN_TOP;
    }
  }

  heading(text: string, size: number, weight: 'normal' | 'bold' = 'bold') {
    this.doc.setFont('helvetica', weight);
    this.doc.setFontSize(size);
    this.doc.setTextColor(20, 20, 20);
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    const lineHeight = size * 1.2;
    this.ensureSpace(lines.length, lineHeight);
    this.doc.text(lines, MARGIN_X, this.y);
    this.y += lines.length * lineHeight;
  }

  paragraph(text: string, size = 10, color: [number, number, number] = [40, 40, 40]) {
    if (!text) return;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      this.ensureSpace(1, lineHeight);
      this.doc.text(line, MARGIN_X, this.y);
      this.y += lineHeight;
    }
  }

  bullet(text: string, size = 10, indent = 12) {
    if (!text) return;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(40, 40, 40);
    const wrapWidth = CONTENT_WIDTH - indent;
    const lines = this.doc.splitTextToSize(text, wrapWidth) as string[];
    const lineHeight = size * 1.35;
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(1, lineHeight);
      const prefix = i === 0 ? '\u2022 ' : '  ';
      this.doc.text(prefix + lines[i], MARGIN_X + (i === 0 ? 0 : indent), this.y);
      this.y += lineHeight;
    }
  }

  spacer(h = 8) {
    this.y += h;
  }

  rule() {
    this.ensureSpace(1, 10);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN_X, this.y, PAGE_WIDTH - MARGIN_X, this.y);
    this.y += 10;
  }

  output(): Blob {
    return this.doc.output('blob');
  }
}

function formatAttendee(a: { title: string; names?: string[] }): string {
  const title = (a.title || '').trim();
  const names = (a.names || [])
    .map((n) => (n || '').trim())
    .filter(Boolean)
    .join(', ');
  if (title && names) return `${title} — ${names}`;
  return title || names || '(unspecified)';
}

export function buildWorkshopPdf(
  workshop: Workshop,
  questions: WorkshopQuestion[]
): Blob {
  const w = new PdfWriter();

  // Title block
  const title = `${workshop.code ? `[${workshop.code}] ` : ''}${workshop.name || 'Untitled workshop'}`;
  w.heading(title, 18, 'bold');
  w.spacer(4);

  const metaLine: string[] = [];
  if (workshop.phase) metaLine.push(workshop.phase);
  if (workshop.duration) metaLine.push(workshop.duration);
  if (workshop.mode) metaLine.push(workshop.mode);
  if (workshop.status) metaLine.push(workshop.status);
  if (workshop.track) metaLine.push(`Track: ${workshop.track}`);
  if (metaLine.length > 0) {
    w.paragraph(metaLine.join(' · '), 9, [120, 120, 120]);
  }
  w.spacer(6);
  w.rule();

  // Summary
  if (workshop.summary?.trim()) {
    w.heading('Summary', 12, 'bold');
    w.paragraph(workshop.summary);
    w.spacer(8);
  }

  // Main outcomes
  if (workshop.mainOutcomes && workshop.mainOutcomes.length > 0) {
    w.heading('Main outcomes', 12, 'bold');
    for (const o of workshop.mainOutcomes) {
      if (o && o.trim()) w.bullet(o);
    }
    w.spacer(8);
  }

  // Attendees
  const hasClient = workshop.clientAttendees?.length > 0;
  const hasAgency = workshop.agencyAttendees?.length > 0;
  if (hasClient || hasAgency) {
    w.heading('Attendees', 12, 'bold');
    if (hasClient) {
      w.paragraph('Client:', 10, [80, 80, 80]);
      for (const a of workshop.clientAttendees) {
        w.bullet(formatAttendee(a));
      }
    }
    if (hasAgency) {
      w.paragraph('Digitas:', 10, [80, 80, 80]);
      for (const a of workshop.agencyAttendees) {
        w.bullet(formatAttendee(a));
      }
    }
    w.spacer(8);
  }

  // Agenda
  if (workshop.agenda && workshop.agenda.length > 0) {
    w.heading('Agenda', 12, 'bold');
    for (const item of workshop.agenda) {
      const parts: string[] = [];
      if (item.duration) parts.push(item.duration);
      if (item.label) parts.push(item.label);
      const head = parts.join(' — ') || '(untitled slot)';
      w.bullet(head);
      if (item.notes) {
        w.paragraph('    ' + item.notes, 9, [90, 90, 90]);
      }
    }
    w.spacer(8);
  }

  // Pre-reads
  if (workshop.preReads && workshop.preReads.length > 0) {
    w.heading('Pre-reads', 12, 'bold');
    for (const p of workshop.preReads) {
      if (p && p.trim()) w.bullet(p);
    }
    w.spacer(8);
  }

  // Dependencies
  if (workshop.dependencies && workshop.dependencies.length > 0) {
    w.heading('Dependencies', 12, 'bold');
    for (const d of workshop.dependencies) {
      if (d && d.trim()) w.bullet(d);
    }
    w.spacer(8);
  }

  // Notes
  if (workshop.notes?.trim()) {
    w.heading('Notes', 12, 'bold');
    w.paragraph(workshop.notes);
    w.spacer(8);
  }

  // Questions — grouped by intent
  if (questions.length > 0) {
    w.rule();
    w.heading(`Questions (${questions.length})`, 14, 'bold');
    w.spacer(4);

    const byIntent = new Map<WorkshopQuestionIntent, WorkshopQuestion[]>();
    for (const q of questions) {
      const key = (INTENT_ORDER as readonly string[]).includes(q.intent)
        ? q.intent
        : 'context';
      const list = byIntent.get(key) || [];
      list.push(q);
      byIntent.set(key, list);
    }

    for (const intent of INTENT_ORDER) {
      const list = byIntent.get(intent);
      if (!list || list.length === 0) continue;
      const sorted = list.slice().sort((a, b) => a.order - b.order);
      w.heading(`${INTENT_LABELS[intent]} · ${sorted.length}`, 11, 'bold');
      for (const q of sorted) {
        const role = q.targetRole?.trim();
        const phase = q.journeyPhase?.trim();
        const tag = [role, phase].filter(Boolean).join(' · ');
        w.bullet(q.text || '(empty question)');
        if (tag) {
          w.paragraph('    ' + tag, 9, [120, 120, 120]);
        }
        if (q.rationale?.trim()) {
          w.paragraph('    Why: ' + q.rationale.trim(), 9, [110, 110, 110]);
        }
      }
      w.spacer(6);
    }
  }

  return w.output();
}

// ---------- Zip + download ----------

export async function downloadAllWorkshopsAsZip(
  workshops: Workshop[],
  questionsByWorkshop: Map<string, WorkshopQuestion[]>,
  zipName = 'workshops.zip'
): Promise<void> {
  if (workshops.length === 0) {
    throw new Error('No workshops to export');
  }

  const zip = new JSZip();
  const used = new Set<string>();

  for (const w of workshops) {
    const qs = questionsByWorkshop.get(w.id) || [];
    const pdfBlob = buildWorkshopPdf(w, qs);
    const buffer = await pdfBlob.arrayBuffer();

    const base = sanitizeFilename(
      `${w.code ? w.code + '_' : ''}${w.name || 'workshop'}`
    );
    let name = `${base}.pdf`;
    let n = 2;
    while (used.has(name)) {
      name = `${base}_${n}.pdf`;
      n += 1;
    }
    used.add(name);
    zip.file(name, buffer);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, zipName);
}
