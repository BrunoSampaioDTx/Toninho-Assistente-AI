import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/content/htmlToMarkdown';
import { DomPageContextReader } from '../src/content/page/PageContextReader';

function md(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.replaceChildren(div);
  return htmlToMarkdown(div);
}

describe('htmlToMarkdown', () => {
  it('converts headings, paragraphs and emphasis', () => {
    expect(md('<h2>Plans</h2> <p>Pick <strong>one</strong> of the <em>options</em>.</p><p>Second<br>line</p>')).toBe(
      '## Plans\n\nPick **one** of the *options*.\n\nSecond\nline',
    );
  });

  it('converts nested lists', () => {
    expect(md('<ul><li>A<ul><li>A1</li><li>A2</li></ul></li><li>B</li></ul><ol><li>x</li><li>y</li></ol>')).toBe(
      '- A\n  - A1\n  - A2\n- B\n\n1. x\n2. y',
    );
  });

  it('converts tables', () => {
    expect(md('<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Basic</td><td>5 | 10</td></tr></table>')).toBe(
      '| Plan | Price |\n| --- | --- |\n| Basic | 5 \\| 10 |',
    );
  });

  it('converts blockquotes', () => {
    expect(md('<blockquote><p>One</p><p>Two</p></blockquote>')).toBe('> One\n>\n> Two');
  });

  it('skips hidden, navigation and form control content', () => {
    expect(
      md(`<nav>Menu</nav><p>Keep</p><p hidden>No</p><p style="display:none">No</p><span aria-hidden="true">No</span>
          <script>x()</script><label>Name <input value="secret"></label><button>Send</button><footer>Foot</footer>`),
    ).toBe('Keep\n\nName');
  });
});

describe('DomPageContextReader', () => {
  it('prefers the main element', () => {
    document.body.innerHTML = '<header><h1>Site</h1></header><main><h1>Form</h1><p>Fill in.</p></main>';
    expect(new DomPageContextReader().read().text).toBe('# Form\n\nFill in.');
  });
});
