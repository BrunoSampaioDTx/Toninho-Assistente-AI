import { getDocument } from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs';

// Content scripts cannot start a worker from the extension origin, so pdf.js runs on the main thread
// using the worker module registered here.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const task = getDocument({ data });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return pages.join('\n\n');
  } finally {
    await task.destroy();
  }
}
