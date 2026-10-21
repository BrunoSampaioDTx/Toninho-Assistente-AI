import mammoth from 'mammoth/mammoth.browser.min.js';
import { htmlToMarkdown } from '../htmlToMarkdown';

export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(result.value, 'text/html');
  return htmlToMarkdown(doc.body);
}
