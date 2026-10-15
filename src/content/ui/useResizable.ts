import { useEffect, useRef, useState, type PointerEvent } from 'react';

export interface Size {
  width: number;
  height: number;
}

export const DEFAULT_SIZE: Size = { width: 390, height: 560 };
const MIN_SIZE: Size = { width: 320, height: 380 };
const VIEWPORT_MARGIN = 32;
const STORAGE_KEY = 'widgetSize';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

/**
 * Resizing for a panel anchored to the bottom-right corner: dragging up/left grows it.
 * The size is shared by all tabs through extension storage.
 */
export function useResizable() {
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    chrome.storage.local
      .get(STORAGE_KEY)
      .then((stored) => {
        const saved = stored[STORAGE_KEY] as Size | undefined;
        if (saved) setSize(saved);
      })
      .catch(() => undefined);
  }, []);

  const persist = (value: Size) => chrome.storage.local.set({ [STORAGE_KEY]: value }).catch(() => undefined);

  function startResize(e: PointerEvent<HTMLElement>, edges: { horizontal: boolean; vertical: boolean }) {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const start = sizeRef.current;

    const onMove = (ev: globalThis.PointerEvent) => {
      setSize({
        width: edges.horizontal
          ? clamp(start.width + startX - ev.clientX, MIN_SIZE.width, window.innerWidth - VIEWPORT_MARGIN)
          : start.width,
        height: edges.vertical
          ? clamp(start.height + startY - ev.clientY, MIN_SIZE.height, window.innerHeight - VIEWPORT_MARGIN)
          : start.height,
      });
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      void persist(sizeRef.current);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  function reset() {
    setSize(DEFAULT_SIZE);
    void persist(DEFAULT_SIZE);
  }

  return { size, startResize, reset };
}
