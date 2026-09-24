import type { Tip } from './tip';

/** Chart tooltip: values lead, labels follow. Kept inside `width` so it never spills off the card. */
export function HoverTip({ tip, width }: { tip: Tip | null; width?: number }) {
  if (!tip) return null;
  const left = width ? Math.min(Math.max(tip.x, 96), Math.max(96, width - 96)) : tip.x;
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border-2 bg-surface-2/95 backdrop-blur px-2.5 py-1.5 text-xs shadow-xl whitespace-nowrap" style={{ left, top: tip.y - 8 }}>
      {tip.rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {r.color && <span className="inline-block h-0.5 w-2.5 rounded-full" style={{ background: r.color }} />}
          <span className="text-ink font-medium tabular">{r.value}</span>
          {r.label && <span className="text-ink-3">{r.label}</span>}
        </div>
      ))}
    </div>
  );
}
