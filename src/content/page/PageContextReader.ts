import type { PageContext } from '../../shared/types';

const MAX_TEXT_LENGTH = 8000;

export interface PageContextReader {
  read(): PageContext;
}

export class DomPageContextReader implements PageContextReader {
  constructor(private readonly root: Document = document) {}

  read(): PageContext {
    const text = (this.root.body?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim();
    return {
      url: this.root.location.href,
      title: this.root.title,
      selectedText: this.root.getSelection()?.toString().trim() ?? '',
      text: text.slice(0, MAX_TEXT_LENGTH),
    };
  }
}
