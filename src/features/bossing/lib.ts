import { uid, type AppliedPresets, type Assignment, type Boss, type BossesDoc, type BossPreset, type Clear, type PresetEntry, type PriceOverrides, type Settings } from '../../lib/types';
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

/** Party size a preset entry is assigned with, within the boss's limit. */
export function entryParty(doc: BossesDoc | null, e: PresetEntry): number {
  return Math.max(1, Math.min(e.partySize ?? 1, maxParty(doc, e.bossId, e.difficulty)));
}

/** A character's weekly boss list, in order. */
export function weeklyOf(assignments: Assignment[], character: string): Assignment[] {
  return assignments.filter((a) => a.character === character && a.cadence === 'weekly').sort((a, b) => a.order - b.order);
}

/**
 * Switch characters to a preset: each one's weekly bosses are wiped and replaced
 * by the preset's (difficulties and party sizes included). Monthly bosses (Black
 * Mage) are kept. `preset` null clears the weekly list. Recorded clears are
 * separate and never touched.
 */
export function switchToPreset(assignments: Assignment[], characters: string[], preset: BossPreset | null, doc: BossesDoc | null): Assignment[] {
  const who = new Set(characters);
  const kept = assignments.filter((a) => !who.has(a.character) || a.cadence !== 'weekly');
  if (!preset) return kept;
  const added: Assignment[] = [];
  for (const character of characters) {
    const monthly = kept.filter((a) => a.character === character);
    let order = monthly.length ? Math.max(...monthly.map((m) => m.order)) + 1 : 0;
    for (const e of preset.entries) {
      const cadence = cadenceFor(doc, e.bossId, e.difficulty);
      if (cadence === 'monthly' && monthly.some((a) => a.bossId === e.bossId)) continue;
      added.push({ id: uid(), character, bossId: e.bossId, difficulty: e.difficulty, cadence, defaultPartySize: entryParty(doc, e), order: order++ });
    }
  }
  return [...kept, ...added];
}

/** Same presets in the same order: ids, names, Main tags, descriptions and bosses (difficulty and party size; the order of a preset's bosses doesn't count). */
export function samePresets(a: BossPreset[], b: BossPreset[], doc: BossesDoc | null): boolean {
  const key = (p: BossPreset) => JSON.stringify([p.id, p.name, !!p.main, p.description ?? '', p.entries.map((e) => `${e.bossId}:${e.difficulty}:${entryParty(doc, e)}`).sort()]);
  return a.length === b.length && a.every((p, i) => key(p) === key(b[i]));
}

/** Weekly meso of a preset for one character if every boss is cleared (party sizes from the preset). */
export function presetMeso(preset: BossPreset, doc: BossesDoc | null, prices: PriceOverrides, settings: Settings): number {
  return preset.entries.reduce((n, e) => n + (cadenceFor(doc, e.bossId, e.difficulty) === 'weekly' ? mesoPerClear(crystalValue(doc, prices, settings, e.bossId, e.difficulty), entryParty(doc, e)) : 0), 0);
}

/** Preset entries a character is under-level for. Unknown level → none. */
export function levelGaps(preset: BossPreset, level: number | null | undefined, doc: BossesDoc | null): { bossId: string; difficulty: string; need: number }[] {
  if (level == null) return [];
  const out: { bossId: string; difficulty: string; need: number }[] = [];
  for (const e of preset.entries) {
    const need = findBoss(doc, e.bossId)?.difficulties.find((d) => d.key === e.difficulty)?.minLevel ?? 0;
    if (need > level) out.push({ bossId: e.bossId, difficulty: e.difficulty, need });
  }
  return out;
}

export interface PresetDiff {
  /** Weekly bosses the switch drops. */
  removed: Assignment[];
  /** Preset bosses the character doesn't have yet. */
  added: PresetEntry[];
  /** Same boss, different difficulty or party size. */
  changed: { from: Assignment; to: PresetEntry }[];
  kept: Assignment[];
  /** Weekly meso before and after, if every boss is cleared. */
  before: number;
  after: number;
}

/** What switching a character's weekly list to `preset` would change (also how far an edited list has drifted from it). */
export function diffPreset(weekly: Assignment[], preset: BossPreset, doc: BossesDoc | null, prices: PriceOverrides, settings: Settings): PresetDiff {
  const entries = preset.entries.filter((e) => cadenceFor(doc, e.bossId, e.difficulty) === 'weekly');
  const removed: Assignment[] = [];
  const changed: { from: Assignment; to: PresetEntry }[] = [];
  const kept: Assignment[] = [];
  for (const a of weekly) {
    const t = entries.find((e) => e.bossId === a.bossId);
    if (!t) removed.push(a);
    else if (t.difficulty !== a.difficulty || entryParty(doc, t) !== a.defaultPartySize) changed.push({ from: a, to: t });
    else kept.push(a);
  }
  const added = entries.filter((e) => !weekly.some((a) => a.bossId === e.bossId));
  const before = weekly.reduce((n, a) => n + assignmentMeso(a, doc, prices, settings), 0);
  return { removed, added, changed, kept, before, after: presetMeso(preset, doc, prices, settings) };
}

/** The preset a character is on (null when none or deleted), and whether its weekly list has drifted from it. */
export function presetOf(character: string, applied: AppliedPresets, presets: BossPreset[], assignments: Assignment[], doc: BossesDoc | null): { preset: BossPreset | null; edited: boolean } {
  const preset = presets.find((p) => p.id === applied[character]) ?? null;
  if (!preset) return { preset: null, edited: false };
  const weekly = weeklyOf(assignments, character);
  const entries = preset.entries.filter((e) => cadenceFor(doc, e.bossId, e.difficulty) === 'weekly');
  const same = weekly.length === entries.length && entries.every((e) => weekly.some((a) => a.bossId === e.bossId && a.difficulty === e.difficulty && a.defaultPartySize === entryParty(doc, e)));
  return { preset, edited: !same };
}
