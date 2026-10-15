import type { Attachment } from '../../shared/types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const TEXT_EXTENSIONS = ['.txt', '.csv', '.json', '.md'];
const PDF_EXTENSION = '.pdf';
const DOCX_EXTENSION = '.docx';

export interface AttachmentReader {
  /** Value for the file input `accept` attribute. */
  readonly accept: string;
  read(file: File): Promise<Attachment>;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function truncate(text: string): string {
  return text.length <= MAX_TEXT_CHARS ? text : `${text.slice(0, MAX_TEXT_CHARS)}\n[truncated]`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Images are kept as data URLs; text, PDF and Word files are converted to plain text in the browser. */
export class FileAttachmentReader implements AttachmentReader {
  readonly accept = [...IMAGE_TYPES, ...TEXT_EXTENSIONS, PDF_EXTENSION, DOCX_EXTENSION].join(',');

  async read(file: File): Promise<Attachment> {
    if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" excede 10 MB.`);

    if (IMAGE_TYPES.includes(file.type)) {
      return { kind: 'image', name: file.name, dataUrl: await readAsDataUrl(file) };
    }

    const extension = extensionOf(file.name);
    let text: string;
    if (TEXT_EXTENSIONS.includes(extension)) {
      text = await file.text();
    } else if (extension === PDF_EXTENSION) {
      // Loaded on demand: the PDF parser is large.
      const { extractPdfText } = await import('./pdf');
      text = await extractPdfText(await file.arrayBuffer());
    } else if (extension === DOCX_EXTENSION) {
      const { extractDocxText } = await import('./docx');
      text = await extractDocxText(await file.arrayBuffer());
    } else {
      throw new Error(`Tipo de ficheiro não suportado: "${file.name}".`);
    }

    return { kind: 'text', name: file.name, text: truncate(text.trim()) };
  }
}
