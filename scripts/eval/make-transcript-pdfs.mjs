#!/usr/bin/env node
/**
 * One-off generator — reads each .txt under docs/eval/capture/source/ and
 * writes a matching .pdf under docs/eval/capture/transcripts/.
 *
 * PDF styling matches lib/workshop-pdf-export.ts: helvetica, letter, 54pt
 * margins, soft gray rule under the header block. Body uses Teams-style
 * turn blocks (speaker + timestamp in bold, dialogue underneath).
 *
 * Source .txt format:
 *
 *   Title line
 *   Metadata line 1 (date · duration · location)
 *   Metadata line 2 (attendees)
 *   ---
 *   [HH:MM:SS] Speaker Name
 *   Dialogue for that turn, possibly wrapping across
 *   multiple source lines until a blank line.
 *
 *   [HH:MM:SS] Next Speaker
 *   ...
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SOURCE = join(ROOT, 'docs/eval/capture/source');
const OUT = join(ROOT, 'docs/eval/capture/transcripts');

mkdirSync(OUT, { recursive: true });

// Layout — mirrors lib/workshop-pdf-export.ts
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function buildPdf(title, metaLines, turns) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setFont('helvetica', 'normal');
  let y = MARGIN_TOP;

  const ensure = (lh) => {
    if (y + lh > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const write = (text, { size = 10, bold = false, color = [40, 40, 40], gap = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, MARGIN_X, y);
      y += lh;
    }
    y += gap;
  };

  // Header
  write(title, { size: 18, bold: true, color: [20, 20, 20], gap: 4 });
  for (const m of metaLines) {
    write(m, { size: 9, color: [120, 120, 120] });
  }
  y += 6;
  ensure(10);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 14;

  // Body — turns
  for (const t of turns) {
    write(t.head, { size: 10, bold: true, color: [60, 60, 60], gap: 1 });
    if (t.text.trim()) {
      write(t.text, { size: 10.5, color: [30, 30, 30], gap: 8 });
    } else {
      y += 4;
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function parseTranscript(raw) {
  const parts = raw.split(/^---\s*$/m);
  const header = (parts[0] || '').trim();
  const body = (parts.slice(1).join('---') || '').trim();

  const headerLines = header.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = headerLines[0] || 'Untitled transcript';
  const metaLines = headerLines.slice(1);

  const blocks = body.split(/\n\s*\n+/);
  const turns = [];
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

const files = readdirSync(SOURCE)
  .filter((f) => f.endsWith('.txt'))
  .sort();

if (files.length === 0) {
  console.error(`No .txt files found in ${SOURCE}`);
  process.exit(1);
}

for (const file of files) {
  const raw = readFileSync(join(SOURCE, file), 'utf8');
  const { title, metaLines, turns } = parseTranscript(raw);
  const pdf = buildPdf(title, metaLines, turns);
  const outName = basename(file, '.txt') + '.pdf';
  const outPath = join(OUT, outName);
  writeFileSync(outPath, pdf);
  console.log(`  ${outName}  (${turns.length} turns)`);
}

console.log(`\nDone. ${files.length} PDFs in ${OUT}`);
