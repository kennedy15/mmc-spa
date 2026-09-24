import { uid, type Assignment, type Boss, type BossesDoc, type BossPreset, type Clear, type PriceOverrides, type Settings } from '../../lib/types';
import { periodKey, periodRange, periodsBetween, previousPeriod, type Cadence } from '../../lib/reset/period';

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

/** Largest party a boss difficulty allows (Extreme Lotus 2, the Grandis bosses from First Adversary on 3, others 6). */
export function maxParty(doc: BossesDoc | null, bossId: string, difficulty: string): number {
  return findBoss(doc, bossId)?.difficulties.find((d) => d.key === difficulty)?.maxParty ?? 6;
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

/** Tracker cadence for a boss difficulty: monthly stays monthly, daily and weekly go to the weekly tracker. */
export function cadenceFor(doc: BossesDoc | null, bossId: string, difficulty: string): 'weekly' | 'monthly' {
  const d = findBoss(doc, bossId)?.difficulties.find((x) => x.key === difficulty);
  return d?.cadence === 'monthly' ? 'monthly' : 'weekly';
}

/** Assignments a preset would add for a character (skipping ones already assigned). */
export function presetAssignments(preset: BossPreset, character: string, existing: Assignment[], doc: BossesDoc | null): Assignment[] {
  const mine = existing.filter((a) => a.character === character);
  let order = mine.length ? Math.max(...mine.map((m) => m.order)) + 1 : 0;
  const out: Assignment[] = [];
  for (const e of preset.entries) {
    if (mine.some((a) => a.bossId === e.bossId && a.difficulty === e.difficulty)) continue;
    out.push({ id: uid(), character, bossId: e.bossId, difficulty: e.difficulty, cadence: cadenceFor(doc, e.bossId, e.difficulty), defaultPartySize: 1, order: order++ });
  }
  return out;
}

/** Clears that consume a crystal in the given weekly period: weekly clears of that period plus monthly clears made during it. */
export function crystalsInWeek(clears: Clear[], weeklyPeriod: string): Clear[] {
  const { start, end } = periodRange('weekly', weeklyPeriod);
  return clears.filter((c) => (c.cadence === 'weekly' ? c.period === weeklyPeriod : c.clearedAt >= start.toISOString() && c.clearedAt < end.toISOString()));
}
