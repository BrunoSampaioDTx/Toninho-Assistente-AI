// Form controls are skipped because fields are sent to the LLM separately.
const SKIPPED_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'img',
  'nav', 'footer', 'aside',
  'input', 'select', 'textarea', 'button',
  'lfa-assistant',
]);

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'main', 'form', 'fieldset', 'legend',
  'figure', 'figcaption', 'address', 'dl', 'dt', 'dd', 'details', 'summary', 'li',
]);

/** Converts the visible content of an element to Markdown, keeping headings, lists, tables and emphasis. */
export function htmlToMarkdown(root: Element): string {
  return normalize(render(root));
}

function normalize(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/(?<=\n\n)[ \t]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isSkipped(el: Element): boolean {
  if (SKIPPED_TAGS.has(el.localName)) return true;
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
  // Detached documents (e.g. from DOMParser) have no view and no computed styles.
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  return style?.display === 'none' || style?.visibility === 'hidden';
}

function block(text: string): string {
  const trimmed = text.trim();
  return trimmed ? `\n\n${trimmed}\n\n` : '';
}

function wrap(marker: string, text: string): string {
  const trimmed = text.trim();
  return trimmed ? `${marker}${trimmed}${marker}` : '';
}

function children(el: Element): string {
  return Array.from(el.childNodes, render).join('');
}

function render(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  if (isSkipped(el)) return '';

  const tag = el.localName;
  const heading = /^h([1-6])$/.exec(tag);
  if (heading) return block(`${'#'.repeat(Number(heading[1]))} ${children(el).trim()}`);

  switch (tag) {
    case 'br':
      return '\n';
    case 'hr':
      return block('---');
    case 'strong':
    case 'b':
      return wrap('**', children(el));
    case 'em':
    case 'i':
      return wrap('*', children(el));
    case 'code':
      return wrap('`', el.textContent ?? '');
    case 'pre':
      return block(`\`\`\`\n${el.textContent ?? ''}\n\`\`\``);
    case 'blockquote':
      return block(normalize(children(el)).replace(/^/gm, '> '));
    case 'ul':
    case 'ol':
      return list(el);
    case 'table':
      return table(el);
    default:
      return BLOCK_TAGS.has(tag) ? block(children(el)) : children(el);
  }
}

function list(el: Element): string {
  const ordered = el.localName === 'ol';
  const items = Array.from(el.children).filter((c) => c.localName === 'li' && !isSkipped(c));
  const lines = items.map((li, i) => {
    const marker = ordered ? `${i + 1}. ` : '- ';
    const body = children(li).trim().replace(/\n\s*\n/g, '\n').replace(/\n/g, `\n${' '.repeat(marker.length)}`);
    return marker + body;
  });
  return block(lines.join('\n'));
}

function table(el: Element): string {
  const rows = Array.from(el.querySelectorAll('tr')).filter((r) => r.closest('table') === el && !isSkipped(r));
  const cells = rows
    .map((r) =>
      Array.from(r.children)
        .filter((c) => (c.localName === 'td' || c.localName === 'th') && !isSkipped(c))
        .map((c) => children(c).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')),
    )
    .filter((r) => r.length > 0);
  if (cells.length === 0) return '';

  const width = Math.max(...cells.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  return block([line(cells[0]), line(Array(width).fill('---')), ...cells.slice(1).map(line)].join('\n'));
}
