import type { ApiFormat, SettingsStore } from '../shared/settings';
import type { ChatRequest, ChatResponse } from '../shared/types';
import type { ChatProvider } from './ChatProvider';

/** Delegates to the provider matching the API format currently selected in settings. */
export class SettingsAwareProvider implements ChatProvider {
  constructor(
    private readonly settings: SettingsStore,
    private readonly providers: Record<ApiFormat, ChatProvider>,
  ) {}

  async send(request: ChatRequest): Promise<ChatResponse> {
    const { apiFormat } = await this.settings.get();
    return this.providers[apiFormat].send(request);
  }
}
