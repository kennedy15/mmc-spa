import { useMemo } from 'react';
import { useStore, allCharacterNames } from '../../store';
import { averageGain, dailyGains, gainOver, latestRow, projectedLevelDate, seriesFor, lookImageUrl, type GainPoint, type SeriesPoint } from '../../lib/nexon/snapshots';
import type { SnapshotRow } from '../../lib/nexon/types';

export interface CharacterStats {
  name: string;
  latest: SnapshotRow | undefined;
  series: SeriesPoint[];
  gains: GainPoint[];
  today: string | null;
  gainToday: bigint | null;
  gain7: bigint;
  gain30: bigint;
  avg7: bigint;
  avg30: bigint;
  projected: string | null;
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
    const last = gains.length ? gains[gains.length - 1] : null;
    const gainToday = last && today && last.date === today ? last.gain : null;
    const avg7 = today ? averageGain(gains, 7, today) : 0n;
    const avg30 = today ? averageGain(gains, 30, today) : 0n;
    const gain7 = today ? gainOver(gains, 7, today) : 0n;
    const gain30 = today ? gainOver(gains, 30, today) : 0n;
    const projected = series.length && today ? projectedLevelDate(series[series.length - 1], avg7, today) : null;
    const lookList = looks[name];
    const lookHash = latest?.lookHash ?? (lookList && lookList[lookList.length - 1]?.hash) ?? null;
    const imageUrl = lookHash ? lookImageUrl(name, lookHash) : (latest?.imgUrl ?? null);
    return { name, latest, series, gains, today, gainToday, gain7, gain30, avg7, avg30, projected, imageUrl };
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
