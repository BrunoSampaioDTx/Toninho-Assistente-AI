/** Most pages fit in this many viewport-high tiles; content below is still covered by the page Markdown. */
const MAX_TILES = 6;
const JPEG_QUALITY = 70;

export interface PageCapturer {
  /** Returns JPEG data URLs of the whole page, top to bottom, one per viewport-high tile. */
  capture(tabId: number): Promise<string[]>;
}

interface LayoutMetrics {
  cssLayoutViewport: { clientWidth: number; clientHeight: number };
  cssContentSize: { height: number };
}

/**
 * Captures beyond the viewport through the DevTools protocol, like DevTools "Capture full size screenshot".
 * The page is split into tiles because vision models downscale tall images until text is unreadable.
 */
export class DebuggerPageCapturer implements PageCapturer {
  async capture(tabId: number): Promise<string[]> {
    const target = { tabId };
    await chrome.debugger.attach(target, '1.3');
    try {
      const metrics = (await chrome.debugger.sendCommand(target, 'Page.getLayoutMetrics')) as LayoutMetrics;
      const { clientWidth: width, clientHeight: tileHeight } = metrics.cssLayoutViewport;
      const pageHeight = metrics.cssContentSize.height;
      const tiles = Math.min(MAX_TILES, Math.ceil(pageHeight / tileHeight));

      const images: string[] = [];
      for (let i = 0; i < tiles; i++) {
        const y = i * tileHeight;
        const { data } = (await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
          format: 'jpeg',
          quality: JPEG_QUALITY,
          captureBeyondViewport: true,
          clip: { x: 0, y, width, height: Math.min(tileHeight, pageHeight - y), scale: 1 },
        })) as { data: string };
        images.push(`data:image/jpeg;base64,${data}`);
      }
      return images;
    } finally {
      await chrome.debugger.detach(target);
    }
  }
}
