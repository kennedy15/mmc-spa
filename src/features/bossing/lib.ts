import { uid, type Assignment, type Boss, type BossesDoc, type BossPreset, type Clear, type PriceOverrides, type Settings } from '../../lib/types';
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

/**
 * Weekly and monthly bosses are tracked apart: a reset week only ever holds
 * weekly-boss clears (they are what the 14-per-character crystal cap counts),
 * and a month only holds monthly-boss clears, so a Black Mage clear never
 * inflates the week it happened in.
 */
export function clearsIn(clears: Clear[], cadence: Cadence, period: string): Clear[] {
  return clears.filter((c) => c.cadence === cadence && c.period === period);
}

export interface PeriodMeso {
  /** Reset-week start (YYYY-MM-DD) or month (YYYY-MM). */
  period: string;
  total: number;
  byCharacter: Record<string, number>;
}

/** Meso per reset week (weekly bosses) or per month (monthly bosses), from the first clear to now; empty periods are zero. */
export function mesoByPeriod(clears: Clear[], cadence: Cadence, now = new Date()): PeriodMeso[] {
  const mine = clears.filter((c) => c.cadence === cadence);
  if (!mine.length) return [];
  const first = mine.reduce((a, c) => (c.period < a ? c.period : a), mine[0].period);
  const rows = periodsBetween(cadence, first, periodKey(cadence, now)).map((period) => ({ period, total: 0, byCharacter: {} as Record<string, number> }));
  const idx = new Map(rows.map((r, i) => [r.period, i]));
  for (const c of mine) {
    const r = rows[idx.get(c.period) ?? -1];
    if (!r) continue;
    r.total += c.meso;
    r.byCharacter[c.character] = (r.byCharacter[c.character] ?? 0) + c.meso;
  }
  return rows;
}

/** Meso per period if every assignment of that cadence is cleared: per reset week for weekly bosses, per month for monthly ones. */
export function expectedPer(cadence: Cadence, assignments: Assignment[], doc: BossesDoc | null, prices: PriceOverrides, settings: Settings): number {
  return assignments.reduce((n, a) => n + (a.cadence === cadence ? assignmentMeso(a, doc, prices, settings) : 0), 0);
}

export function visibleCharacters(all: string[], settings: Settings): string[] {
  return all.filter((n) => !settings.hiddenCharacters.includes(n));
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
