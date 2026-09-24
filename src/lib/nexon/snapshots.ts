import { dataUrl } from '../paths';
import type { CharactersConfig, LookEntry, Snapshot, SnapshotIndex, SnapshotRow, WorldsDoc } from './types';
import { gainBetween, expToNext, expRemaining, levelsGained } from './exp';

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    // exp may exceed 2^53 one day; quote it before parsing.
    const text = await r.text();
    return JSON.parse(text.replace(/"exp":\s*(\d+)/g, '"exp":"$1"')) as T;
  } catch {
    return null;
  }
}

export const loadIndex = () => getJson<SnapshotIndex>(dataUrl('index.json'));
export const loadCharacters = () => getJson<CharactersConfig>(dataUrl('characters.json'));
export const loadSnapshot = (date: string) => getJson<Snapshot>(dataUrl(`snapshots/${date}.json`));
export const loadLooks = (name: string) => getJson<LookEntry[]>(dataUrl(`looks/${encodeURIComponent(name)}/index.json`));
export const loadWorlds = () => getJson<WorldsDoc>(dataUrl('worlds.json', 'public'));
export const lookImageUrl = (name: string, hash: string) => dataUrl(`looks/${encodeURIComponent(name)}/${hash}.png`);

export interface SeriesPoint {
  date: string;
  level: number;
  exp: bigint;
  rank: number;
  legionLevel: number | null;
  raidPower: number | null;
  row: SnapshotRow;
}

/** Ordered history for one character across all snapshots. */
export function seriesFor(name: string, snapshots: Snapshot[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const s of snapshots) {
    const row = s.rows.find((r) => r.name === name);
    if (!row) continue;
    out.push({ date: s.date, level: row.level, exp: BigInt(row.exp || '0'), rank: row.rank, legionLevel: row.legionLevel, raidPower: row.raidPower, row });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface GainPoint {
  date: string;
  gain: bigint;
  /** Levels gained (0.014 = 1.4% of a level); null when the EXP table lacks a level. */
  levels: number | null;
  /** Days between this observation and the previous one (gaps in history). */
  spanDays: number;
  levelUp: boolean;
}

export function dailyGains(series: SeriesPoint[]): GainPoint[] {
  const out: GainPoint[] = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    const gain = gainBetween(a.level, a.exp, b.level, b.exp);
    if (gain == null) continue;
    out.push({ date: b.date, gain, levels: levelsGained(a.level, a.exp, b.level, b.exp), spanDays: daysBetween(a.date, b.date), levelUp: b.level > a.level });
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}

/** Days of a `days`-long window that history actually covers: fewer while tracking is younger than the window. */
export function coveredDays(days: number, firstDate: string, today: string): number {
  return Math.max(0, Math.min(days, daysBetween(firstDate, today)));
}

/**
 * Average gain per day over the last `days` calendar days. Gaps count as
 * zero-gain days; days before the first snapshot (`firstDate`) don't count.
 */
export function averageGain(gains: GainPoint[], days: number, today: string, firstDate: string): bigint {
  const span = coveredDays(days, firstDate, today);
  return span > 0 ? gainOver(gains, days, today) / BigInt(span) : 0n;
}

/** Gain over a window: sum of gains dated after `today - days`. */
export function gainOver(gains: GainPoint[], days: number, today: string): bigint {
  const since = addDays(today, -days);
  let total = 0n;
  for (const g of gains) if (g.date > since) total += g.gain;
  return total;
}

/**
 * EXP gained since the first observation after `since`, per observation date
 * (the first is 0). Charts plot this rather than lifetime EXP, which is ~10^15
 * and moves by fractions of a percent a day.
 */
export function cumulativeGain(series: SeriesPoint[], gains: GainPoint[], since = ''): Map<string, bigint> {
  const byDate = new Map(gains.map((g) => [g.date, g.gain]));
  const out = new Map<string, bigint>();
  let total = 0n;
  for (const p of series) {
    if (p.date <= since) continue;
    if (out.size > 0) total += byDate.get(p.date) ?? 0n;
    out.set(p.date, total);
  }
  return out;
}

/** Date `remaining` EXP runs out at `avgPerDay`, or null when the rate is zero. */
export function projectDate(remaining: bigint, avgPerDay: bigint, today: string): string | null {
  if (avgPerDay <= 0n) return null;
  if (remaining <= 0n) return today;
  const days = Number((remaining + avgPerDay - 1n) / avgPerDay);
  if (!Number.isFinite(days) || days > 36500) return null;
  return addDays(today, days);
}

/** Projected date to reach the next level, or null when the rate is zero. */
export function projectedLevelDate(latest: SeriesPoint, avgPerDay: bigint, today: string): string | null {
  const remaining = expRemaining(latest.level, latest.exp);
  if (remaining == null || expToNext(latest.level) == null) return null;
  return projectDate(remaining, avgPerDay, today);
}

/** Places climbed in the overall ranking since the previous snapshot (negative = slipped). */
export function rankDelta(series: SeriesPoint[]): number | null {
  if (series.length < 2) return null;
  return series[series.length - 2].rank - series[series.length - 1].rank;
}

export function latestRow(snapshots: Snapshot[], name: string): SnapshotRow | undefined {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const r = snapshots[i].rows.find((x) => x.name === name);
    if (r) return r;
  }
  return undefined;
}

export interface LegionPoint {
  date: string;
  /** The character the legion ranking files the account under (its highest level). */
  reporter: string;
  worldId: number;
  legionLevel: number;
  legionRank: number | null;
  raidPower: number | null;
}

/** An account's legion on one snapshot, from whichever row carries it. */
export function legionOf(snapshot: Snapshot, owner = 'me'): LegionPoint | null {
  const r = snapshot.rows.find((x) => x.legionLevel != null && (x.owner ?? 'me') === owner);
  if (!r || r.legionLevel == null) return null;
  return { date: snapshot.date, reporter: r.name, worldId: r.worldId, legionLevel: r.legionLevel, legionRank: r.legionRank, raidPower: r.raidPower };
}
