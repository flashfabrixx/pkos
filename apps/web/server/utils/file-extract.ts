/**
 * Best-effort text extraction for uploaded files. Returns plain UTF-8
 * text or null when the format isn't recognised. Failures degrade to
 * null rather than throwing so an upload still creates a capture even
 * if extraction fails (the operator can still re-process later).
 */
export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
  const mime = mimeType.toLowerCase()
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') {
    return buffer.toString('utf8')
  }
  if (mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return extractPdf(buffer)
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.toLowerCase().endsWith('.docx')) {
    return extractDocx(buffer)
  }
  if (mime === 'text/markdown' || filename.toLowerCase().endsWith('.md')) {
    return buffer.toString('utf8')
  }
  return null
}

async function extractPdf(buffer: Buffer): Promise<string | null> {
  try {
    // Lazy import keeps the bundle small when PDFs aren't in use.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as any
    const doc = await pdfjs.getDocument({ data: buffer, useWorker: false }).promise
    const parts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      parts.push(content.items.map((item: { str?: string }) => item.str || '').join(' '))
    }
    return parts.join('\n\n').trim() || null
  } catch {
    return null
  }
}

async function extractDocx(buffer: Buffer): Promise<string | null> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value?.trim() || null
  } catch {
    return null
  }
}
