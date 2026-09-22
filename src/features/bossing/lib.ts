import type { Assignment, Boss, BossesDoc, Clear, PriceOverrides, Settings } from '../../lib/types';
import { periodKey, periodsBetween, previousPeriod, type Cadence } from '../../lib/reset/period';

export const priceKey = (bossId: string, difficulty: string) => `${bossId}:${difficulty}`;

export function findBoss(doc: BossesDoc | null, bossId: string): Boss | undefined {
  return doc?.bosses.find((b) => b.id === bossId);
}

export function bossLabel(doc: BossesDoc | null, bossId: string, difficulty: string): string {
  const b = findBoss(doc, bossId);
  return `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} ${b?.name ?? bossId}`;
}

/** Crystal value after overrides and the Heroic multiplier. */
export function crystalValue(doc: BossesDoc | null, prices: PriceOverrides, settings: Settings, bossId: string, difficulty: string): number {
  const override = prices[priceKey(bossId, difficulty)];
  const base = override ?? findBoss(doc, bossId)?.difficulties.find((d) => d.key === difficulty)?.crystal ?? 0;
  return base * (settings.heroic ? 5 : 1);
}

export function mesoPerClear(crystal: number, partySize: number): number {
  return Math.floor(crystal / Math.max(1, partySize));
}

export function assignmentMeso(a: Assignment, doc: BossesDoc | null, prices: PriceOverrides, settings: Settings): number {
  return mesoPerClear(crystalValue(doc, prices, settings, a.bossId, a.difficulty), a.defaultPartySize);
}

export function clearFor(clears: Clear[], a: Assignment, period: string): Clear | undefined {
  return clears.find((c) => c.character === a.character && c.bossId === a.bossId && c.difficulty === a.difficulty && c.period === period);
}

export function currentPeriods(now = new Date()): Record<Cadence, string> {
  return { weekly: periodKey('weekly', now), monthly: periodKey('monthly', now) };
}

/** Consecutive periods (ending with the current one or the one before) this assignment was cleared. */
export function streak(clears: Clear[], a: Assignment, now = new Date()): number {
  let p = periodKey(a.cadence, now);
  let n = 0;
  if (!clearFor(clears, a, p)) p = previousPeriod(a.cadence, p);
  let guard = 0;
  while (clearFor(clears, a, p) && guard++ < 1000) {
    n++;
    p = previousPeriod(a.cadence, p);
  }
  return n;
}

/** Meso per weekly period, per character, across the ledger. Monthly clears land in the week they were cleared. */
export function mesoByWeek(clears: Clear[], now = new Date()): { period: string; total: number; byCharacter: Record<string, number> }[] {
  if (!clears.length) return [];
  const weeks = clears.map(weekOfClear);
  const first = weeks.reduce((a, b) => (a < b ? a : b));
  const last = periodKey('weekly', now);
  const rows = periodsBetween('weekly', first, last).map((period) => ({ period, total: 0, byCharacter: {} as Record<string, number> }));
  const idx = new Map(rows.map((r, i) => [r.period, i]));
  for (const c of clears) {
    const r = rows[idx.get(weekOfClear(c)) ?? -1];
    if (!r) continue;
    r.total += c.meso;
    r.byCharacter[c.character] = (r.byCharacter[c.character] ?? 0) + c.meso;
  }
  return rows;
}

/** Expected meso per week if every assignment is cleared (monthly ones spread over ~4.35 weeks). */
export function expectedWeekly(assignments: Assignment[], doc: BossesDoc | null, prices: PriceOverrides, settings: Settings): number {
  return assignments.reduce((n, a) => n + assignmentMeso(a, doc, prices, settings) / (a.cadence === 'monthly' ? 4.345 : 1), 0);
}

export function visibleCharacters(all: string[], settings: Settings): string[] {
  return all.filter((n) => !settings.hiddenCharacters.includes(n));
}

/** The weekly period a clear belongs to on the history chart. */
export function weekOfClear(c: Clear): string {
  return c.cadence === 'weekly' ? c.period : periodKey('weekly', new Date(c.clearedAt));
}
