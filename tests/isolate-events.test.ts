import { describe, expect, it, vi } from 'vitest';
import { isolateEvents } from '../src/content/ui/isolateEvents';

describe('isolateEvents', () => {
  it('keeps keyboard events inside the widget away from page listeners', () => {
    const host = document.createElement('lfa-assistant');
    const shadow = host.attachShadow({ mode: 'closed' });
    const textarea = document.createElement('textarea');
    shadow.append(textarea);
    document.body.append(host);
    isolateEvents(host);

    const inWidget = vi.fn();
    const onPage = vi.fn();
    textarea.addEventListener('keydown', inWidget);
    document.addEventListener('keydown', onPage);

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, composed: true }));

    expect(inWidget).toHaveBeenCalledOnce();
    expect(onPage).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onPage);
  });
});
