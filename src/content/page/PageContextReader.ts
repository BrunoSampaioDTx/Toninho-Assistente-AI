import type { PageContext } from '../../shared/types';
import { htmlToMarkdown } from '../htmlToMarkdown';

const MAX_TEXT_LENGTH = 12000;

export interface PageContextReader {
  read(): PageContext;
}

export class DomPageContextReader implements PageContextReader {
  constructor(private readonly root: Document = document) {}

  read(): PageContext {
    const main = this.root.querySelector('main, [role="main"]') ?? this.root.body;
    const text = main ? htmlToMarkdown(main) : '';
    return {
      url: this.root.location.href,
      title: this.root.title,
      selectedText: this.root.getSelection()?.toString().trim() ?? '',
      text: text.slice(0, MAX_TEXT_LENGTH),
    };
  }
}
