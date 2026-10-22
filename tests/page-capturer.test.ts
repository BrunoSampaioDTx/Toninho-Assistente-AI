import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebuggerPageCapturer } from '../src/background/PageCapturer';

function mockDebugger(pageHeight: number) {
  const clips: { y: number; height: number }[] = [];
  const debuggerApi = {
    attach: vi.fn(async () => undefined),
    detach: vi.fn(async () => undefined),
    sendCommand: vi.fn(async (_target: unknown, method: string, params?: { clip: { y: number; height: number } }) => {
      if (method === 'Page.getLayoutMetrics') {
        return { cssLayoutViewport: { clientWidth: 1200, clientHeight: 800 }, cssContentSize: { height: pageHeight } };
      }
      clips.push({ y: params!.clip.y, height: params!.clip.height });
      return { data: `T${clips.length}` };
    }),
  };
  vi.stubGlobal('chrome', { debugger: debuggerApi });
  return { debuggerApi, clips };
}

afterEach(() => vi.unstubAllGlobals());

describe('DebuggerPageCapturer', () => {
  it('splits the page into viewport-high tiles and detaches', async () => {
    const { debuggerApi, clips } = mockDebugger(2000);

    const images = await new DebuggerPageCapturer().capture(7);

    expect(images).toEqual(['data:image/jpeg;base64,T1', 'data:image/jpeg;base64,T2', 'data:image/jpeg;base64,T3']);
    expect(clips).toEqual([
      { y: 0, height: 800 },
      { y: 800, height: 800 },
      { y: 1600, height: 400 },
    ]);
    expect(debuggerApi.detach).toHaveBeenCalledWith({ tabId: 7 });
  });

  it('caps the number of tiles', async () => {
    const { clips } = mockDebugger(100_000);
    await new DebuggerPageCapturer().capture(7);
    expect(clips).toHaveLength(6);
  });

  it('detaches when a capture fails', async () => {
    const { debuggerApi } = mockDebugger(800);
    debuggerApi.sendCommand.mockRejectedValueOnce(new Error('boom'));

    await expect(new DebuggerPageCapturer().capture(7)).rejects.toThrow('boom');
    expect(debuggerApi.detach).toHaveBeenCalledOnce();
  });
});
