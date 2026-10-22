import type { ChatProvider } from '../providers/ChatProvider';
import type { Attachment, ChatMessage, FormField, PageContext } from '../shared/types';
import type { TabStateStore } from './TabStateStore';

export interface SendInput {
  text: string;
  attachments: Attachment[];
  page: PageContext;
  fields: FormField[];
  screenshots?: string[];
}

/** Image data is too large for session storage, so persisted history keeps only the image name. */
function withoutImageData(message: ChatMessage): ChatMessage {
  if (!message.attachments) return message;
  return {
    ...message,
    attachments: message.attachments.map((a) => (a.kind === 'image' ? { kind: a.kind, name: a.name } : a)),
  };
}

export class ChatService {
  constructor(
    private readonly store: TabStateStore,
    private readonly provider: ChatProvider,
  ) {}

  async send(tabId: number, { text, attachments, page, fields, screenshots }: SendInput): Promise<ChatMessage> {
    const userMessage: ChatMessage = { role: 'user', content: text, attachments };
    const state = await this.store.update(tabId, (s) => ({
      ...s,
      messages: [...s.messages, withoutImageData(userMessage)],
    }));

    // Use the in-memory user message so its images are sent on this turn.
    const history = [...state.messages.slice(0, -1), userMessage];
    const response = await this.provider.send({
      messages: history.map(({ role, content, attachments: a }) => ({ role, content, attachments: a })),
      page,
      fields,
      screenshots,
    });

    const reply: ChatMessage = { role: 'assistant', content: response.reply, actions: response.actions };
    await this.store.update(tabId, (s) => ({ ...s, messages: [...s.messages, reply] }));
    return reply;
  }
}
