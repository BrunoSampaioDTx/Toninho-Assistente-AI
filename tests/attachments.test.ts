import { describe, expect, it } from 'vitest';
import { ChatService } from '../src/background/ChatService';
import type { TabStateStore } from '../src/background/TabStateStore';
import { FileAttachmentReader } from '../src/content/attachments/AttachmentReader';
import type { ChatProvider } from '../src/providers/ChatProvider';
import { toOpenAiMessages } from '../src/providers/OpenAiCompatibleProvider';
import type { TabState } from '../src/shared/messages';
import type { ChatRequest } from '../src/shared/types';

describe('toOpenAiMessages', () => {
  it('keeps plain messages as strings', () => {
    expect(toOpenAiMessages([{ role: 'user', content: 'hi' }])).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('adds attachments as parts and the screenshot only to the last user message', () => {
    const result = toOpenAiMessages(
      [
        { role: 'user', content: 'first', attachments: [{ kind: 'image', name: 'old.png' }] },
        { role: 'assistant', content: 'ok' },
        {
          role: 'user',
          content: 'second',
          attachments: [
            { kind: 'text', name: 'a.txt', text: 'hello' },
            { kind: 'image', name: 'b.png', dataUrl: 'data:image/png;base64,AA' },
          ],
        },
      ],
      'data:image/jpeg;base64,SS',
    );

    expect(result[0].content).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: '[Image "old.png" was attached earlier and is no longer available]' },
    ]);
    expect(result[1]).toEqual({ role: 'assistant', content: 'ok' });
    expect(result[2].content).toEqual([
      { type: 'text', text: 'second' },
      { type: 'text', text: 'Attached file "a.txt":\nhello' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } },
      { type: 'text', text: 'Screenshot of the visible part of the page:' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,SS' } },
    ]);
  });
});

describe('ChatService', () => {
  it('sends image data and screenshot to the provider but persists only image names', async () => {
    let state: TabState = { open: true, messages: [] };
    const store: TabStateStore = {
      get: async () => state,
      update: async (_, change) => (state = change(state)),
      remove: async () => undefined,
    };
    let sent: ChatRequest | undefined;
    const provider: ChatProvider = {
      send: async (request) => {
        sent = request;
        return { reply: 'done', actions: [] };
      },
    };

    await new ChatService(store, provider).send(1, {
      text: 'look',
      attachments: [{ kind: 'image', name: 'x.png', dataUrl: 'data:image/png;base64,AA' }],
      page: { url: 'u', title: 't', selectedText: '', text: '' },
      fields: [],
      screenshot: 'data:image/jpeg;base64,SS',
    });

    expect(sent?.screenshot).toBe('data:image/jpeg;base64,SS');
    expect(sent?.messages[0].attachments).toEqual([{ kind: 'image', name: 'x.png', dataUrl: 'data:image/png;base64,AA' }]);
    expect(state.messages[0].attachments).toEqual([{ kind: 'image', name: 'x.png' }]);
    expect(state.messages[1]).toEqual({ role: 'assistant', content: 'done', actions: [] });
  });
});

describe('FileAttachmentReader', () => {
  const reader = new FileAttachmentReader();

  it('reads text files', async () => {
    const result = await reader.read(new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' }));
    expect(result).toEqual({ kind: 'text', name: 'data.csv', text: 'a,b\n1,2' });
  });

  it('reads images as data URLs', async () => {
    const result = await reader.read(new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' }));
    expect(result).toEqual({ kind: 'image', name: 'p.png', dataUrl: 'data:image/png;base64,AQID' });
  });

  it('rejects unsupported types', async () => {
    await expect(reader.read(new File(['x'], 'a.exe'))).rejects.toThrow(/não suportado/);
  });
});
