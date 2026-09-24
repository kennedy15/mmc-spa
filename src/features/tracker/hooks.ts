import { useMemo } from 'react';
import { useStore, allCharacterNames } from '../../store';
import { averageGain, coveredDays, dailyGains, gainOver, latestRow, legionOf, projectedLevelDate, rankDelta, seriesFor, lookImageUrl, type GainPoint, type LegionPoint, type SeriesPoint } from '../../lib/nexon/snapshots';
import type { SnapshotRow } from '../../lib/nexon/types';

export interface CharacterStats {
  name: string;
  latest: SnapshotRow | undefined;
  series: SeriesPoint[];
  gains: GainPoint[];
  today: string | null;
  /** First snapshot this character appears in. */
  firstDate: string | null;
  gainToday: bigint | null;
  /** Levels gained in the latest interval (0.014 = 1.4% of a level). */
  levelsToday: number | null;
  gain7: bigint;
  gain30: bigint;
  avg7: bigint;
  avg30: bigint;
  /** Days of history behind the 7- and 30-day figures (less than the window while tracking is new). */
  span7: number;
  span30: number;
  projected: string | null;
  /** Places climbed in the overall ranking since the previous snapshot. */
  rankDelta: number | null;
  imageUrl: string | null;
}

export function useCharacterStats(name: string | null): CharacterStats | null {
  const snapshots = useStore((s) => s.snapshots);
  const looks = useStore((s) => s.looks);
  return useMemo(() => {
    if (!name) return null;
    const series = seriesFor(name, snapshots);
    const gains = dailyGains(series);
    const latest = latestRow(snapshots, name);
    const today = series.length ? series[series.length - 1].date : null;
    const firstDate = series.length ? series[0].date : null;
    const last = gains.length ? gains[gains.length - 1] : null;
    const isToday = !!last && last.date === today;
    const win = (days: number) => (today && firstDate ? { avg: averageGain(gains, days, today, firstDate), total: gainOver(gains, days, today), span: coveredDays(days, firstDate, today) } : { avg: 0n, total: 0n, span: 0 });
    const w7 = win(7);
    const w30 = win(30);
    const projected = series.length && today ? projectedLevelDate(series[series.length - 1], w7.avg, today) : null;
    const lookList = looks[name];
    const lookHash = latest?.lookHash ?? (lookList && lookList[lookList.length - 1]?.hash) ?? null;
    const imageUrl = lookHash ? lookImageUrl(name, lookHash) : (latest?.imgUrl ?? null);
    return {
      name,
      latest,
      series,
      gains,
      today,
      firstDate,
      gainToday: isToday ? last.gain : null,
      levelsToday: isToday ? last.levels : null,
      gain7: w7.total,
      gain30: w30.total,
      avg7: w7.avg,
      avg30: w30.avg,
      span7: w7.span,
      span30: w30.span,
      projected,
      rankDelta: rankDelta(series),
      imageUrl,
    };
  }, [name, snapshots, looks]);
}

export function useCharacterNames(): string[] {
  const characters = useStore((s) => s.characters);
  const snapshots = useStore((s) => s.snapshots);
  const settings = useStore((s) => s.settings);
  return useMemo(() => allCharacterNames({ characters, snapshots, settings }), [characters, snapshots, settings]);
}

/** Names that appear in snapshots (i.e. have tracker data). */
export function useTrackedNames(): string[] {
  const characters = useStore((s) => s.characters);
  const snapshots = useStore((s) => s.snapshots);
  return useMemo(() => {
    const order = new Map<string, number>();
    (characters?.characters ?? []).forEach((c, i) => order.set(c.name, i));
    const seen = new Set<string>();
    for (const s of snapshots) for (const r of s.rows) seen.add(r.name);
    return [...seen].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b));
  }, [characters, snapshots]);
}

export interface Activity {
  /** Tracked names in characters.json order. */
  names: string[];
  /** Latest snapshot date. */
  today: string | null;
  /** The snapshot before it. */
  prevDate: string | null;
  /** First snapshot date. */
  firstDate: string | null;
  series: Record<string, SeriesPoint[]>;
  gains: Record<string, GainPoint[]>;
}

/** Every tracked character's history and daily gains, computed once per data load. */
export function useActivity(): Activity {
  const snapshots = useStore((s) => s.snapshots);
  const names = useTrackedNames();
  return useMemo(() => {
    const series: Record<string, SeriesPoint[]> = {};
    const gains: Record<string, GainPoint[]> = {};
    for (const n of names) {
      series[n] = seriesFor(n, snapshots);
      gains[n] = dailyGains(series[n]);
    }
    return { names, today: snapshots[snapshots.length - 1]?.date ?? null, prevDate: snapshots[snapshots.length - 2]?.date ?? null, firstDate: snapshots[0]?.date ?? null, series, gains };
  }, [names, snapshots]);
}

/** The account legion over time (owner "me"), whichever character reported it each day. */
export function useLegionHistory(): LegionPoint[] {
  const snapshots = useStore((s) => s.snapshots);
  return useMemo(() => snapshots.map((s) => legionOf(s)).filter((p): p is LegionPoint => !!p), [snapshots]);
}
