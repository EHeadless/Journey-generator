/**
 * Client-side helper: for every Discovery workshop on the model, generate a
 * synthetic Teams-style transcript via /api/generate-synthetic-transcript,
 * render each transcript as a PDF (same layout primitives as the
 * workshop-pdf-export / eval scripts), bundle into a zip, trigger download.
 *
 * Browser-only. Uses jsPDF + JSZip (already installed).
 */

import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { Workshop, WorkshopQuestion, ModelInput } from './types';

// Layout — matches lib/workshop-pdf-export.ts and scripts/eval/make-transcript-pdfs.mjs
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

export type SyntheticProgress = {
  workshopId: string;
  workshopLabel: string;
  index: number;
  total: number;
  status: 'generating' | 'rendering' | 'done' | 'failed';
  message?: string;
};

type GenerateOptions = {
  apiKey: string;
  workshops: Workshop[];
  workshopQuestions: WorkshopQuestion[];
  brief: ModelInput | undefined;
  onProgress?: (p: SyntheticProgress) => void;
  zipName?: string;
};

function sanitizeFilename(s: string): string {
  return (
    s
      .replace(/[/\\:*?"<>|]+/g, '-')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'workshop'
  );
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

// ---------- transcript text → PDF ----------

type Turn = { head: string; text: string };
type Parsed = { title: string; metaLines: string[]; turns: Turn[] };

function parseTranscript(raw: string): Parsed {
  const parts = raw.split(/^---\s*$/m);
  const header = (parts[0] || '').trim();
  const body = (parts.slice(1).join('---') || '').trim();

  const headerLines = header
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const title = headerLines[0] || 'Untitled transcript';
  const metaLines = headerLines.slice(1);

  const blocks = body.split(/\n\s*\n+/);
  const turns: Turn[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length === 0) continue;
    const head = (lines[0] || '').trim();
    const text = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    if (!head) continue;
    turns.push({ head, text });
  }
  return { title, metaLines, turns };
}

function buildTranscriptPdf(parsed: Parsed): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setFont('helvetica', 'normal');
  let y = MARGIN_TOP;

  const ensure = (lh: number) => {
    if (y + lh > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const write = (
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      gap?: number;
    } = {}
  ) => {
    const { size = 10, bold = false, color = [40, 40, 40], gap = 0 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, MARGIN_X, y);
      y += lh;
    }
    y += gap;
  };

  // Header
  write(parsed.title, { size: 18, bold: true, color: [20, 20, 20], gap: 4 });
  for (const m of parsed.metaLines) {
    write(m, { size: 9, color: [120, 120, 120] });
  }
  y += 6;
  ensure(10);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 14;

  // Body — turns
  for (const t of parsed.turns) {
    write(t.head, { size: 10, bold: true, color: [60, 60, 60], gap: 1 });
    if (t.text.trim()) {
      write(t.text, { size: 10.5, color: [30, 30, 30], gap: 8 });
    } else {
      y += 4;
    }
  }

  return doc.output('blob');
}

// ---------- API call ----------

async function requestTranscript(
  apiKey: string,
  workshop: Workshop,
  questions: WorkshopQuestion[],
  brief: ModelInput | undefined
): Promise<string> {
  const resp = await fetch('/api/generate-synthetic-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      workshop: {
        code: workshop.code,
        name: workshop.name,
        phase: workshop.phase,
        duration: workshop.duration,
        mode: workshop.mode,
        summary: workshop.summary,
        mainOutcomes: workshop.mainOutcomes,
        agenda: workshop.agenda,
        clientAttendees: workshop.clientAttendees,
        agencyAttendees: workshop.agencyAttendees,
        notes: workshop.notes,
      },
      questions: questions.map((q) => ({
        text: q.text,
        intent: q.intent,
        targetRole: q.targetRole,
        rationale: q.rationale,
        journeyPhase: q.journeyPhase,
      })),
      brief: brief
        ? {
            industry: brief.industry,
            businessDescription: brief.businessDescription,
            painPoints: brief.painPoints,
          }
        : undefined,
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const body = (await resp.json()) as { transcript?: string };
  const transcript = (body.transcript || '').trim();
  if (!transcript) throw new Error('Empty transcript from server');
  return transcript;
}

// ---------- Public: generate all + download zip ----------

export async function generateAndDownloadSyntheticTranscripts(
  opts: GenerateOptions
): Promise<{ successCount: number; failureCount: number; failures: { workshop: string; error: string }[] }> {
  const { apiKey, workshops, workshopQuestions, brief, onProgress, zipName = 'synthetic-workshops.zip' } = opts;
  if (!apiKey) throw new Error('OpenAI API key is required');
  if (!workshops.length) throw new Error('No workshops to generate');

  const zip = new JSZip();
  const total = workshops.length;
  const failures: { workshop: string; error: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < workshops.length; i++) {
    const ws = workshops[i];
    const label = `${ws.code ? `${ws.code} — ` : ''}${ws.name || 'Untitled'}`;
    const questionsForWs = workshopQuestions.filter((q) => q.workshopId === ws.id);

    onProgress?.({
      workshopId: ws.id,
      workshopLabel: label,
      index: i,
      total,
      status: 'generating',
    });

    let transcript: string;
    try {
      transcript = await requestTranscript(apiKey, ws, questionsForWs, brief);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ workshop: label, error: msg });
      onProgress?.({
        workshopId: ws.id,
        workshopLabel: label,
        index: i,
        total,
        status: 'failed',
        message: msg,
      });
      continue;
    }

    onProgress?.({
      workshopId: ws.id,
      workshopLabel: label,
      index: i,
      total,
      status: 'rendering',
    });

    const parsed = parseTranscript(transcript);
    const pdfBlob = buildTranscriptPdf(parsed);
    const arrayBuf = await pdfBlob.arrayBuffer();

    const filename = sanitizeFilename(
      [ws.code, ws.name].filter(Boolean).join('_') || ws.id
    );
    zip.file(`${filename}.pdf`, arrayBuf);
    // also drop the raw .txt alongside for debugging / reuse
    zip.file(`${filename}.txt`, transcript);
    successCount += 1;

    onProgress?.({
      workshopId: ws.id,
      workshopLabel: label,
      index: i,
      total,
      status: 'done',
    });
  }

  if (successCount === 0) {
    throw new Error(
      failures.length
        ? `All ${failures.length} generations failed. First error: ${failures[0].error}`
        : 'No transcripts were generated'
    );
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, zipName);

  return { successCount, failureCount: failures.length, failures };
}
