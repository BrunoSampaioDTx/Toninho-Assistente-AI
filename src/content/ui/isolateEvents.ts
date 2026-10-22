// Events from a closed shadow root are retargeted to the host, so page shortcut handlers
// (e.g. GitHub hotkeys) do not see a text field as the target and act on every key typed in the chat.
const ISOLATED_EVENTS = ['keydown', 'keyup', 'keypress', 'focusin', 'focusout'] as const;

/** Stops keyboard and focus events from the widget reaching page listeners on document and window. */
export function isolateEvents(host: HTMLElement): void {
  for (const type of ISOLATED_EVENTS) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
}
