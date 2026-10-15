import type { TabState } from '../shared/messages';

export interface TabStateStore {
  get(tabId: number): Promise<TabState>;
  update(tabId: number, change: (state: TabState) => TabState): Promise<TabState>;
  remove(tabId: number): Promise<void>;
}

const EMPTY: TabState = { open: false, messages: [] };

/** Per-tab state kept in session storage: survives worker restarts, cleared when the browser closes. */
export class SessionTabStateStore implements TabStateStore {
  private key(tabId: number): string {
    return `tab:${tabId}`;
  }

  async get(tabId: number): Promise<TabState> {
    const key = this.key(tabId);
    const stored = await chrome.storage.session.get(key);
    return (stored[key] as TabState | undefined) ?? EMPTY;
  }

  async update(tabId: number, change: (state: TabState) => TabState): Promise<TabState> {
    const next = change(await this.get(tabId));
    await chrome.storage.session.set({ [this.key(tabId)]: next });
    return next;
  }

  async remove(tabId: number): Promise<void> {
    await chrome.storage.session.remove(this.key(tabId));
  }
}
