import { HttpBackendProvider } from '../providers/HttpBackendProvider';
import { OpenAiCompatibleProvider } from '../providers/OpenAiCompatibleProvider';
import { SettingsAwareProvider } from '../providers/SettingsAwareProvider';
import type { BackgroundEvent, ContentRequest, Result } from '../shared/messages';
import { ChromeSettingsStore } from '../shared/settings';
import { ChatService } from './ChatService';
import { DebuggerPageCapturer } from './PageCapturer';
import { SessionTabStateStore } from './TabStateStore';

// Composition root
const settings = new ChromeSettingsStore();
const tabStates = new SessionTabStateStore();
const provider = new SettingsAwareProvider(settings, {
  openai: new OpenAiCompatibleProvider(settings),
  custom: new HttpBackendProvider(settings),
});
const chatService = new ChatService(tabStates, provider);
const pageCapturer = new DebuggerPageCapturer();

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  const { open } = await tabStates.update(tab.id, (s) => ({ ...s, open: !s.open, minimized: false }));
  const event: BackgroundEvent = { type: 'WIDGET_SET_VISIBLE', open };
  // Fails on pages without the content script (chrome://, store, tabs opened before install).
  chrome.tabs.sendMessage(tab.id, event).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void tabStates.remove(tabId);
});

async function handle(tabId: number, request: ContentRequest): Promise<unknown> {
  switch (request.type) {
    case 'CHAT_GET_STATE':
      return tabStates.get(tabId);
    case 'CHAT_SEND':
      return chatService.send(tabId, request);
    case 'CAPTURE_PAGE':
      return pageCapturer.capture(tabId);
    case 'CHAT_CLEAR':
      await tabStates.update(tabId, (s) => ({ ...s, messages: [] }));
      return;
    case 'WIDGET_SET_OPEN':
      await tabStates.update(tabId, (s) => ({ ...s, open: request.open }));
      return;
    case 'WIDGET_SET_MINIMIZED':
      await tabStates.update(tabId, (s) => ({ ...s, minimized: request.minimized }));
      return;
  }
}

chrome.runtime.onMessage.addListener((request: ContentRequest, sender, sendResponse) => {
  const tab = sender.tab;
  if (tab?.id === undefined) return false;

  handle(tab.id, request)
    .then((data): Result<unknown> => ({ ok: true, data }))
    .catch((e: unknown): Result<unknown> => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
    .then(sendResponse);
  return true; // async response
});
