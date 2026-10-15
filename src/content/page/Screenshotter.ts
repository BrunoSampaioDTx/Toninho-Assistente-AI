import { sendToBackground } from '../../shared/messages';

export interface Screenshotter {
  /** Returns a JPEG data URL of the visible tab area, without the widget. */
  capture(): Promise<string>;
}

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export class TabScreenshotter implements Screenshotter {
  constructor(private readonly widgetHost: HTMLElement) {}

  async capture(): Promise<string> {
    const previous = this.widgetHost.style.visibility;
    this.widgetHost.style.visibility = 'hidden';
    try {
      await nextPaint();
      return await sendToBackground({ type: 'CAPTURE_VISIBLE_TAB' });
    } finally {
      this.widgetHost.style.visibility = previous;
    }
  }
}
