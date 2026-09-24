import { useLayoutEffect, useState } from 'react';

/**
 * Tracks an element's content width with a ResizeObserver. Pass the returned
 * callback as the element's `ref`; it re-attaches whenever the element mounts
 * or changes. Returns [ref, width (0 until measured), element].
 */
export function useMeasure<T extends HTMLElement>(): [(el: T | null) => void, number, T | null] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width, el];
}
