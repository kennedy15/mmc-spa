import type { ReactNode } from 'react';

/** Validated dark categorical palette (fixed order, never cycled). */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const ACCENT = '#ff7a1a';
export const GRID = '#262a32';
export const AXIS = '#6b717d';

export const axisProps = { tick: { fill: AXIS, fontSize: 11 }, axisLine: false, tickLine: false } as const;

export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length];
}

interface TipProps {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; dataKey?: unknown; payload?: unknown }>;
  format?: (value: unknown, name: string, row: unknown) => ReactNode;
  labelFormat?: (label: unknown) => ReactNode;
}

export function ChartTip({ active, label, payload, format, labelFormat }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border-2 bg-surface-2/95 backdrop-blur px-3 py-2 text-xs shadow-xl">
      <div className="text-ink-2 mb-1">{labelFormat ? labelFormat(label) : String(label ?? '')}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color ?? ACCENT }} />
          <span className="text-ink-2">{String(p.name ?? p.dataKey ?? '')}</span>
          <span className="ml-auto text-ink font-medium">{format ? format(p.value, String(p.name ?? p.dataKey ?? ''), p.payload) : String(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 mt-2">
      {items.map((it) => (
        <span key={it.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

export function shortDate(label: unknown): string {
  const s = String(label ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return s;
}

export function dateLabel(label: unknown): string {
  const s = String(label ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return s;
}

/** Format a value expressed in billions (chart units) compactly: 12.5B, 1.3T, 2.14Q. */
export function fmtBillions(v: unknown, digits?: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits ?? 2)}Q`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(digits ?? 1)}T`;
  return `${sign}${abs.toFixed(digits ?? (abs < 10 ? 1 : 0))}B`;
}
