export interface FieldOption {
  value: string;
  label: string;
}

/** A form control discovered on the page, identified by a stable `id` set by the scanner. */
export interface FormField {
  id: string;
  tag: 'input' | 'textarea' | 'select';
  type: string;
  name: string;
  label: string;
  placeholder: string;
  value: string;
  required: boolean;
  checked?: boolean;
  options?: FieldOption[];
}

export interface PageContext {
  url: string;
  title: string;
  selectedText: string;
  text: string;
}

/** A value the LLM proposes for a field. Applied only after user confirmation. */
export interface FillAction {
  type: 'fill';
  fieldId: string;
  value: string;
  reason?: string;
}

export type ChatRole = 'user' | 'assistant';

/** A file attached by the user. Image data is dropped when the message is persisted. */
export type Attachment =
  | { kind: 'image'; name: string; dataUrl?: string }
  | { kind: 'text'; name: string; text: string };

export interface ChatMessage {
  role: ChatRole;
  content: string;
  actions?: FillAction[];
  attachments?: Attachment[];
}

/** Request body sent to the backend. */
export interface ChatRequest {
  messages: Omit<ChatMessage, 'actions'>[];
  page: PageContext;
  fields: FormField[];
  /** JPEG data URLs of the whole page, top to bottom, for the current turn only. */
  screenshots?: string[];
}

/** Response body expected from the backend. */
export interface ChatResponse {
  reply: string;
  actions?: FillAction[];
}
