import type { Attachment, ChatMessage, FormField, PageContext } from './types';

/** Messages from the content script to the background worker. */
export type ContentRequest =
  | { type: 'CHAT_GET_STATE' }
  | {
      type: 'CHAT_SEND';
      text: string;
      attachments: Attachment[];
      page: PageContext;
      fields: FormField[];
      screenshots?: string[];
    }
  | { type: 'CAPTURE_PAGE' }
  | { type: 'CHAT_CLEAR' }
  | { type: 'WIDGET_SET_OPEN'; open: boolean }
  | { type: 'WIDGET_SET_MINIMIZED'; minimized: boolean };

/** Messages from the background worker to the content script. */
export type BackgroundEvent = { type: 'WIDGET_SET_VISIBLE'; open: boolean };

export interface TabState {
  open: boolean;
  minimized?: boolean;
  messages: ChatMessage[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type ResponseOf<R extends ContentRequest> = R extends { type: 'CHAT_GET_STATE' }
  ? TabState
  : R extends { type: 'CHAT_SEND' }
    ? ChatMessage
    : R extends { type: 'CAPTURE_PAGE' }
      ? string[]
      : void;

export async function sendToBackground<R extends ContentRequest>(request: R): Promise<ResponseOf<R>> {
  const result = (await chrome.runtime.sendMessage(request)) as Result<ResponseOf<R>>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
