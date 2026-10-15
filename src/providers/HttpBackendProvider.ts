import type { SettingsStore } from '../shared/settings';
import type { ChatRequest, ChatResponse } from '../shared/types';
import type { ChatProvider } from './ChatProvider';

/** Sends chat requests to the user's own backend, which proxies the LLM. */
export class HttpBackendProvider implements ChatProvider {
  constructor(private readonly settings: SettingsStore) {}

  async send(request: ChatRequest): Promise<ChatResponse> {
    const { backendUrl, apiToken } = await this.settings.get();
    if (!backendUrl) throw new Error('Backend URL is not configured. Open the extension options.');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
    }

    const raw = await response.text();
    let body: ChatResponse;
    try {
      body = JSON.parse(raw) as ChatResponse;
    } catch {
      throw new Error(`Backend response is not JSON: ${raw.slice(0, 500)}`);
    }
    if (typeof body?.reply !== 'string') {
      throw new Error(`Invalid backend response: missing "reply". Received: ${raw.slice(0, 500)}`);
    }
    return { reply: body.reply, actions: body.actions ?? [] };
  }
}
