import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from '../src/providers/OpenAiCompatibleProvider';
import { DEFAULT_SETTINGS, type Settings, type SettingsStore } from '../src/shared/settings';
import type { ChatRequest } from '../src/shared/types';

const settings = (overrides: Partial<Settings> = {}): SettingsStore => ({
  get: async () => ({ ...DEFAULT_SETTINGS, backendUrl: 'http://llm/v1/chat/completions', ...overrides }),
  save: async () => undefined,
});

const request: ChatRequest = {
  messages: [{ role: 'user', content: 'Fill my name: Ana' }],
  page: { url: 'http://site/form', title: 'Form', selectedText: '', text: 'Sign up' },
  fields: [
    { id: 'f1', tag: 'input', type: 'text', name: 'name', label: 'Name', placeholder: '', value: '', required: true },
  ],
};

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiCompatibleProvider', () => {
  it('sends system prompt with page context, history, tools and model', async () => {
    const fetchFn = mockFetch({ choices: [{ message: { content: 'ok' } }] });

    await new OpenAiCompatibleProvider(settings({ model: 'm1', apiToken: 't' })).send(request);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(url).toBe('http://llm/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
    expect(body.model).toBe('m1');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('http://site/form');
    expect(body.messages[0].content).toContain('"id":"f1"');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Fill my name: Ana' });
    expect(body.tools[0].function.name).toBe('fill_fields');
  });

  it('omits model when not configured', async () => {
    const fetchFn = mockFetch({ choices: [{ message: { content: 'ok' } }] });
    await new OpenAiCompatibleProvider(settings()).send(request);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty('model');
  });

  it('maps content and fill_fields tool calls', async () => {
    mockFetch({
      choices: [
        {
          message: {
            content: '\n\nDone.',
            tool_calls: [
              {
                type: 'function',
                function: { name: 'fill_fields', arguments: '{"fills":[{"fieldId":"f1","value":"Ana","reason":"given"}]}' },
              },
            ],
          },
        },
      ],
    });

    const response = await new OpenAiCompatibleProvider(settings()).send(request);

    expect(response).toEqual({
      reply: 'Done.',
      actions: [{ type: 'fill', fieldId: 'f1', value: 'Ana', reason: 'given' }],
    });
  });

  it('uses a default reply when only tool calls are returned', async () => {
    mockFetch({
      choices: [{ message: { content: null, tool_calls: [{ function: { name: 'fill_fields', arguments: '{"fills":[{"fieldId":"f1","value":"Ana"}]}' } }] } }],
    });
    const response = await new OpenAiCompatibleProvider(settings()).send(request);
    expect(response.reply).toBe('Suggested values:');
    expect(response.actions).toHaveLength(1);
  });

  it('surfaces HTTP errors with body', async () => {
    mockFetch({ error: 'tool choice requires --enable-auto-tool-choice' }, 400);
    await expect(new OpenAiCompatibleProvider(settings()).send(request)).rejects.toThrow(/400.*enable-auto-tool-choice/);
  });
});
