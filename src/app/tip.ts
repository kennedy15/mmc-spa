export interface TipRow {
  value: string;
  label?: string;
  /** Series color, drawn as a short line key. */
  color?: string;
}

/** A tooltip anchored at (x, y) inside a relatively positioned container; it opens upward. */
export interface Tip {
  x: number;
  y: number;
  rows: TipRow[];
}

/** Top-center of `el` relative to `container`, where a tooltip should point. */
export function anchorOf(el: Element, container: Element): { x: number; y: number } {
  const a = el.getBoundingClientRect();
  const b = container.getBoundingClientRect();
  return { x: a.left - b.left + a.width / 2, y: a.top - b.top };
}

/** Pointer position relative to `container`. */
export function pointerIn(e: { clientX: number; clientY: number }, container: Element): { x: number; y: number } {
  const b = container.getBoundingClientRect();
  return { x: e.clientX - b.left, y: e.clientY - b.top };
}
