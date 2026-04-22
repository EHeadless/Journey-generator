/**
 * Workshop → Excel export.
 *
 * Two modes:
 *   • `exportWorkshopToXlsx(workshop, questions)` — one-sheet file for a
 *     single workshop.
 *   • `exportAllWorkshopsToXlsx(workshops, questionsByWorkshop)` — one
 *     file with an overview sheet and one sheet per workshop.
 *
 * Uses exceljs. Runs entirely client-side — the returned Blob is fed to
 * a temporary anchor tag that we click programmatically.
 */

import ExcelJS from 'exceljs';
import {
  Workshop,
  WorkshopQuestion,
  WorkshopAttendee,
} from './types';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function sanitizeSheetName(name: string, fallback: string): string {
  // Excel disallows: : \ / ? * [ ] and length > 31
  const cleaned = (name || fallback)
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sliced = cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
  return sliced || fallback;
}

function uniqueSheetName(
  base: string,
  used: Set<string>,
  fallback: string
): string {
  const name = sanitizeSheetName(base, fallback);
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  let i = 2;
  while (i < 1000) {
    const candidate = sanitizeSheetName(`${name} (${i})`, fallback);
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
    i += 1;
  }
  const fb = `${fallback} ${Date.now()}`;
  used.add(fb.toLowerCase());
  return fb;
}

function formatAttendees(
  attendees: WorkshopAttendee[] | string[] | undefined
): string {
  if (!attendees || attendees.length === 0) return '';
  return attendees
    .map((a) => {
      if (typeof a === 'string') return a;
      const names = (a.names || []).filter((n) => n && n.trim());
      return names.length > 0 ? `${a.title} (${names.join(', ')})` : a.title;
    })
    .filter((s) => s && s.trim().length > 0)
    .join('; ');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function safeFilename(s: string): string {
  return s
    .replace(/[^a-z0-9-_. ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

/**
 * Write a workshop's metadata and question list onto the given worksheet.
 * Layout:
 *   rows 1-10 — workshop metadata (2-col key/value)
 *   row 12    — blank
 *   row 13    — question table header
 *   row 14+   — one row per question
 */
function writeWorkshopSheet(
  ws: ExcelJS.Worksheet,
  workshop: Workshop,
  questions: WorkshopQuestion[]
) {
  ws.columns = [
    { header: '', key: 'a', width: 22 },
    { header: '', key: 'b', width: 60 },
    { header: '', key: 'c', width: 24 },
    { header: '', key: 'd', width: 24 },
    { header: '', key: 'e', width: 40 },
    { header: '', key: 'f', width: 40 },
  ];

  const metaRows: Array<[string, string]> = [
    ['Code', workshop.code || ''],
    ['Name', workshop.name || ''],
    ['Phase', workshop.phase || ''],
    ['Track', workshop.track || ''],
    ['Duration', workshop.duration || ''],
    ['Mode', workshop.mode || ''],
    ['Status', workshop.status || ''],
    ['Summary', workshop.summary || ''],
    ['Main outcomes', (workshop.mainOutcomes || []).join('; ')],
    ['Client attendees', formatAttendees(workshop.clientAttendees)],
    ['Agency attendees', formatAttendees(workshop.agencyAttendees)],
    ['Pre-reads', (workshop.preReads || []).join('; ')],
    ['Dependencies', (workshop.dependencies || []).join('; ')],
    ['Notes', workshop.notes || ''],
  ];

  metaRows.forEach(([label, value], idx) => {
    const row = ws.getRow(idx + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });

  const tableStartRow = metaRows.length + 3;
  const header = ws.getRow(tableStartRow);
  ['#', 'Question', 'Intent', 'Target role', 'Journey phase', 'Rationale'].forEach(
    (h, i) => {
      const cell = header.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EDF3' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFB0B6C0' } },
      };
    }
  );

  questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((q, i) => {
      const row = ws.getRow(tableStartRow + 1 + i);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = q.text || '';
      row.getCell(3).value = q.intent || '';
      row.getCell(4).value = q.targetRole || '';
      row.getCell(5).value = q.journeyPhase || '';
      row.getCell(6).value = q.rationale || '';
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
    });
}

function writeOverviewSheet(
  ws: ExcelJS.Worksheet,
  workshops: Workshop[],
  questionsByWorkshop: Map<string, WorkshopQuestion[]>
) {
  ws.columns = [
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Name', key: 'name', width: 46 },
    { header: 'Phase', key: 'phase', width: 14 },
    { header: 'Track', key: 'track', width: 18 },
    { header: 'Duration', key: 'duration', width: 12 },
    { header: 'Mode', key: 'mode', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Questions', key: 'questions', width: 12 },
    { header: 'Main outcomes', key: 'outcomes', width: 50 },
    { header: 'Client attendees', key: 'client', width: 40 },
    { header: 'Agency attendees', key: 'agency', width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EDF3' },
  };

  workshops.forEach((w) => {
    ws.addRow({
      code: w.code || '',
      name: w.name || '',
      phase: w.phase || '',
      track: w.track || '',
      duration: w.duration || '',
      mode: w.mode || '',
      status: w.status || '',
      questions: (questionsByWorkshop.get(w.id) || []).length,
      outcomes: (w.mainOutcomes || []).join('; '),
      client: formatAttendees(w.clientAttendees),
      agency: formatAttendees(w.agencyAttendees),
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportWorkshopToXlsx(
  workshop: Workshop,
  questions: WorkshopQuestion[],
  suggestedFilenamePrefix = 'workshop'
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Journey Generator';
  wb.created = new Date();
  const used = new Set<string>();
  const sheetName = uniqueSheetName(
    workshop.name || workshop.code || 'Workshop',
    used,
    'Workshop'
  );
  const ws = wb.addWorksheet(sheetName);
  writeWorkshopSheet(ws, workshop, questions);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const base = safeFilename(
    `${suggestedFilenamePrefix}_${workshop.code || workshop.name || 'workshop'}`
  );
  triggerDownload(blob, `${base}.xlsx`);
}

export async function exportAllWorkshopsToXlsx(
  workshops: Workshop[],
  questionsByWorkshop: Map<string, WorkshopQuestion[]>,
  suggestedFilename = 'workshops_all.xlsx'
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Journey Generator';
  wb.created = new Date();

  const used = new Set<string>();
  const overviewName = uniqueSheetName('Overview', used, 'Overview');
  writeOverviewSheet(
    wb.addWorksheet(overviewName),
    workshops,
    questionsByWorkshop
  );

  workshops.forEach((w) => {
    const base = `${w.code ? `${w.code} ` : ''}${w.name || 'Workshop'}`;
    const name = uniqueSheetName(base, used, 'Workshop');
    const ws = wb.addWorksheet(name);
    writeWorkshopSheet(ws, w, questionsByWorkshop.get(w.id) || []);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, safeFilename(suggestedFilename) || 'workshops_all.xlsx');
}
