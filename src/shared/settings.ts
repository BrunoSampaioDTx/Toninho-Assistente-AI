/** `openai`: OpenAI-compatible chat completions endpoint. `custom`: own backend contract (see README). */
export type ApiFormat = 'openai' | 'custom';

export type Settings = {
  apiFormat: ApiFormat;
  /** Full URL of the endpoint, e.g. https://llm.example.com/v1/chat/completions */
  backendUrl: string;
  /** Optional bearer token sent in the Authorization header. */
  apiToken: string;
  /** Model name for the OpenAI-compatible format; omitted from the request when empty. */
  model: string;
};

export interface SettingsStore {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = { apiFormat: 'openai', backendUrl: '', apiToken: '', model: '' };

export class ChromeSettingsStore implements SettingsStore {
  async get(): Promise<Settings> {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    return stored as Settings;
  }

  async save(settings: Settings): Promise<void> {
    await chrome.storage.local.set(settings);
  }
}
