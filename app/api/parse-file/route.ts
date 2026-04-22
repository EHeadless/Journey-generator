import { NextRequest, NextResponse } from 'next/server';

// Ensure Node runtime (pdf-parse and mammoth rely on Node APIs, not edge)
export const runtime = 'nodejs';

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

async function parseFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith('.pdf')) {
    // Dynamic import — keeps pdf-parse out of the edge/client bundle
    const mod = await import('pdf-parse');
    const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string }> })
      .default;
    const result = await pdfParse(buffer);
    return result.text || '';
  }

  if (name.endsWith('.docx')) {
    const mammoth = (await import('mammoth')) as unknown as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  // Fallback — plain text for anything else the route is asked to handle
  return buffer.toString('utf-8');
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file uploaded (expected multipart field "file")' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB) — max 20MB` },
        { status: 413 }
      );
    }

    const text = await parseFile(file);

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'Parsed file contained no extractable text' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text,
      filename: file.name,
      sizeBytes: file.size,
      charCount: text.length,
    });
  } catch (error) {
    console.error('Error parsing file:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown parse error';
    return NextResponse.json(
      { error: `Failed to parse file: ${message}` },
      { status: 500 }
    );
  }
}
