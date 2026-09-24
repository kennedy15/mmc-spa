export { formatBig, formatFull } from '../lib/nexon/exp';

export function fmtInt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('en-US');
}

export function fmtMeso(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e11 ? 1 : 2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${abs}`;
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00Z') : new Date(iso);
  return d.toLocaleDateString('en-US', { ...opts, timeZone: iso.length === 10 ? 'UTC' : undefined });
}

export function fmtDateLong(iso: string | null | undefined): string {
  return fmtDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const t = iso.length === 10 ? Date.parse(iso + 'T00:00:00Z') : Date.parse(iso);
  const diff = now - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Levels gained as a share of a level: 0.0197 -> 1.97%; a level or more -> 1.25 lv. */
export function fmtLevels(levels: number | null | undefined, digits = 2): string {
  if (levels == null) return '—';
  if (levels === 0) return '0%';
  if (Math.abs(levels) >= 1) return `${levels.toFixed(2)} lv`;
  if (levels > 0 && levels * 100 < 10 ** -digits) return `<${(10 ** -digits).toFixed(digits)}%`;
  return `${(levels * 100).toFixed(digits)}%`;
}

/** Rank movement, positive = climbed: ▲16, ▼385. */
export function fmtRankDelta(delta: number | null | undefined): string {
  if (!delta) return '–';
  return `${delta > 0 ? '▲' : '▼'}${Math.abs(delta).toLocaleString('en-US')}`;
}
