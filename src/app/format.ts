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
