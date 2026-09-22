/**
 * Boss reset periods, computed in UTC so DST never shifts a period.
 * Weekly bosses reset Thursday 00:00 UTC; monthly bosses on the 1st 00:00 UTC.
 * Period keys: weekly = the Thursday the week started (YYYY-MM-DD); monthly = YYYY-MM.
 */
export type Cadence = 'weekly' | 'monthly';

const DAY = 86_400_000;
const THURSDAY = 4;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function weeklyPeriodStart(at: Date = new Date()): string {
  const t = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const dow = new Date(t).getUTCDay();
  const back = (dow - THURSDAY + 7) % 7;
  return iso(t - back * DAY);
}

export function monthlyPeriod(at: Date = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodKey(cadence: Cadence, at: Date = new Date()): string {
  return cadence === 'weekly' ? weeklyPeriodStart(at) : monthlyPeriod(at);
}

/** Start (inclusive) and end (exclusive) instants of a period. */
export function periodRange(cadence: Cadence, key: string): { start: Date; end: Date } {
  if (cadence === 'weekly') {
    const start = new Date(Date.parse(key + 'T00:00:00Z'));
    return { start, end: new Date(start.getTime() + 7 * DAY) };
  }
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function nextReset(cadence: Cadence, at: Date = new Date()): Date {
  return periodRange(cadence, periodKey(cadence, at)).end;
}

export function previousPeriod(cadence: Cadence, key: string): string {
  const { start } = periodRange(cadence, key);
  return periodKey(cadence, new Date(start.getTime() - DAY));
}

export function nextPeriod(cadence: Cadence, key: string): string {
  return periodKey(cadence, periodRange(cadence, key).end);
}

/** All period keys from `from` to `to` inclusive (both keys of the same cadence). */
export function periodsBetween(cadence: Cadence, from: string, to: string): string[] {
  const out: string[] = [];
  let k = from;
  let guard = 0;
  while (k <= to && guard++ < 5000) {
    out.push(k);
    k = nextPeriod(cadence, k);
  }
  return out;
}

/** Human label for a period key. */
export function periodLabel(cadence: Cadence, key: string): string {
  if (cadence === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  const { start, end } = periodRange('weekly', key);
  const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${f(start)} – ${f(new Date(end.getTime() - DAY))}`;
}

export function formatCountdown(to: Date, from: Date = new Date()): string {
  let ms = Math.max(0, to.getTime() - from.getTime());
  const d = Math.floor(ms / DAY); ms -= d * DAY;
  const h = Math.floor(ms / 3_600_000); ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
