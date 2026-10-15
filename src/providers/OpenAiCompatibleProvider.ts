import type { SettingsStore } from '../shared/settings';
import type { ChatMessage, ChatRequest, ChatResponse, FillAction } from '../shared/types';
import type { ChatProvider } from './ChatProvider';

const FILL_TOOL = {
  type: 'function',
  function: {
    name: 'fill_fields',
    description: 'Propose values for form fields on the page. The user reviews and applies them.',
    parameters: {
      type: 'object',
      properties: {
        fills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fieldId: { type: 'string', description: 'The "id" of a field from the provided list.' },
              value: {
                type: 'string',
                description: 'Value to set. For selects use an option value; for checkboxes/radios use "true" or "false".',
              },
              reason: { type: 'string', description: 'Short justification shown to the user.' },
            },
            required: ['fieldId', 'value'],
          },
        },
      },
      required: ['fills'],
    },
  },
} as const;

interface ToolCall {
  function?: { name?: string; arguments?: string };
}

interface CompletionResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
}

export function buildSystemPrompt({ page, fields }: Pick<ChatRequest, 'page' | 'fields'>): string {
  return [
    'You are an assistant embedded in a web page. You help the user fill in forms and make decisions based on the page content.',
    'When the user wants fields filled, call the fill_fields tool using only field ids from the list below. Never invent data the user has not given you or that is not on the page; ask instead.',
    'For decision support, compare the options found on the page and give a clear recommendation with reasons.',
    "Answer concisely, in the user's language.",
    '',
    `Page URL: ${page.url}`,
    `Page title: ${page.title}`,
    page.selectedText ? `User-selected text:\n${page.selectedText}` : '',
    `Form fields (JSON):\n${JSON.stringify(fields)}`,
    `Visible page text (truncated):\n${page.text}`,
  ]
    .filter(Boolean)
    .join('\n');
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

interface OpenAiMessage {
  role: string;
  content: string | ContentPart[];
}

/** Maps history to OpenAI messages; attachments and the screenshot become content parts. */
export function toOpenAiMessages(
  messages: Omit<ChatMessage, 'actions'>[],
  screenshot?: string,
): OpenAiMessage[] {
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  return messages.map((message, i) => {
    const parts: ContentPart[] = [];
    for (const a of message.attachments ?? []) {
      if (a.kind === 'text') parts.push({ type: 'text', text: `Attached file "${a.name}":
${a.text}` });
      else if (a.dataUrl) parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
      else parts.push({ type: 'text', text: `[Image "${a.name}" was attached earlier and is no longer available]` });
    }
    if (i === lastUser && screenshot) {
      parts.push({ type: 'text', text: 'Screenshot of the visible part of the page:' });
      parts.push({ type: 'image_url', image_url: { url: screenshot } });
    }
    if (parts.length === 0) return { role: message.role, content: message.content };
    return { role: message.role, content: [{ type: 'text', text: message.content }, ...parts] };
  });
}

/** Calls an OpenAI-compatible /chat/completions endpoint (OpenAI, Azure, vLLM, Ollama, ...). */
export class OpenAiCompatibleProvider implements ChatProvider {
  constructor(private readonly settings: SettingsStore) {}

  async send(request: ChatRequest): Promise<ChatResponse> {
    const { backendUrl, apiToken, model } = await this.settings.get();
    if (!backendUrl) throw new Error('Endpoint URL is not configured. Open the extension options.');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...(model ? { model } : {}),
        messages: [
          { role: 'system', content: buildSystemPrompt(request) },
          ...toOpenAiMessages(request.messages, request.screenshot),
        ],
        tools: [FILL_TOOL],
        tool_choice: 'auto',
      }),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Endpoint returned ${response.status}: ${raw.slice(0, 500)}`);

    const message = (JSON.parse(raw) as CompletionResponse).choices?.[0]?.message;
    if (!message) throw new Error(`Invalid completion response: ${raw.slice(0, 500)}`);

    const actions = (message.tool_calls ?? [])
      .filter((call) => call.function?.name === FILL_TOOL.function.name)
      .flatMap((call) => this.parseFills(call.function?.arguments));

    const reply = message.content?.trim() || (actions.length > 0 ? 'Suggested values:' : '');
    return { reply, actions };
  }

  private parseFills(args: string | undefined): FillAction[] {
    try {
      const { fills } = JSON.parse(args ?? '{}') as { fills?: Omit<FillAction, 'type'>[] };
      return (fills ?? [])
        .filter((f) => typeof f.fieldId === 'string' && f.value !== undefined)
        .map((f) => ({ type: 'fill', fieldId: f.fieldId, value: String(f.value), reason: f.reason }));
    } catch {
      return [];
    }
  }
}
