import type { ChatRequest, ChatResponse } from '../shared/types';

export interface ChatProvider {
  send(request: ChatRequest): Promise<ChatResponse>;
}
