import { uid, type Assignment, type BossesDoc, type BossPreset, type PresetEntry, type PriceOverrides, type Settings } from '../../../lib/types';
import { fmtMeso, titleCase } from '../../../app/format';
import { bossLabel, cadenceFor, diffPreset, entryParty, findBoss, levelGaps, maxParty, type PresetDiff } from '../lib';

/** Rung of the tray: characters on no preset, with a boss list of their own or none. Preset ids never start with a colon. */
export const TRAY = ':tray';

export interface Pricing {
  doc: BossesDoc;
  prices: PriceOverrides;
  settings: Settings;
}

export type LevelGap = ReturnType<typeof levelGaps>[number];

/** One character as the ladder shows it. */
export interface LadderChar {
  name: string;
  img: string | null;
  level: number | null;
  job: string | null;
  main: boolean;
  /** The id of the preset it's on, or TRAY. */
  rung: string;
  preset: BossPreset | null;
  /** On a preset, with a weekly list changed by hand since. */
  edited: boolean;
  /** In list order (the order the Checklist shows). */
  weekly: Assignment[];
  monthly: Assignment[];
  /** Weekly bosses it is under level for. */
  gaps: LevelGap[];
  /** Meso if every boss is cleared: weekly bosses per week, Black Mage per month. */
  meso: number;
  monthMeso: number;
}

/** Difficulty words keep one accent family; Extreme takes the bad tone so it stands out. */
const DIFF_TONE: Record<string, string> = { easy: 'text-ink-2', normal: 'text-ink', hard: 'text-accent-2', chaos: 'text-accent', extreme: 'text-bad' };
export const diffTone = (key: string) => DIFF_TONE[key] ?? 'text-ink';

/** Border and fill of a rung: dashed while a card is dragged, accent under the pointer. */
export function laneLook(dragging: boolean, over: boolean): string {
  if (over) return 'border-dashed border-accent bg-accent/5';
  return dragging ? 'border-dashed border-border-2 bg-surface' : 'border-border bg-surface';
}

export const signed = (n: number) => (n > 0 ? `+${fmtMeso(n)}` : n < 0 ? `−${fmtMeso(-n)}` : '±0');
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const bossCount = (n: number) => plural(n, 'boss', 'bosses');
export const shortList = (items: string[], max: number) => (items.length <= max ? items.join(', ') : `${items.slice(0, max).join(', ')} +${items.length - max} more`);
export const bossName = (doc: BossesDoc, bossId: string) => findBoss(doc, bossId)?.name ?? bossId;

/** Difficulties a weekly list can hold: weekly and daily ones (daily bosses go on the weekly tracker, as on the old page); only Black Mage's monthly ones are left out. */
export function weeklyDifficulties(doc: BossesDoc, bossId: string) {
  return findBoss(doc, bossId)?.difficulties.filter((d) => d.cadence !== 'monthly') ?? [];
}

/** What moving a character to a rung would change: the preset's diff, or every weekly boss removed for the tray. */
export function moveDiff(c: LadderChar, preset: BossPreset | null, p: Pricing): PresetDiff {
  if (preset) return diffPreset(c.weekly, preset, p.doc, p.prices, p.settings);
  return { removed: c.weekly, added: [], changed: [], kept: [], before: c.meso, after: 0 };
}

/** "4 out · 4 in · 8 kept", or "12 bosses added" when nothing was there before. */
export function churn(d: PresetDiff): string {
  const { removed, added, changed, kept } = d;
  if (!removed.length && !changed.length && !kept.length) return `${bossCount(added.length)} added`;
  if (!added.length && !changed.length && !kept.length) return `${bossCount(removed.length)} removed`;
  const bits: string[] = [];
  if (removed.length) bits.push(`${removed.length} out`);
  if (added.length) bits.push(`${added.length} in`);
  if (changed.length) bits.push(`${changed.length} changed`);
  if (kept.length) bits.push(`${kept.length} kept`);
  return bits.join(' · ');
}

export interface MovePreview {
  /** Characters that would change rung. */
  movers: LadderChar[];
  /** Characters already on the target rung. */
  stay: LadderChar[];
  /** Weekly meso change across the movers. */
  delta: number;
  /** The one mover's churn, or "3 weekly lists replaced". */
  churn: string;
  /** Movers under level for some of the target's bosses. */
  under: { name: string; gaps: LevelGap[] }[];
}

export function previewMove(chars: LadderChar[], to: string, preset: BossPreset | null, p: Pricing): MovePreview {
  const movers = chars.filter((c) => c.rung !== to);
  let delta = 0;
  let last: PresetDiff | null = null;
  const under: MovePreview['under'] = [];
  for (const c of movers) {
    last = moveDiff(c, preset, p);
    delta += last.after - last.before;
    const gaps = preset ? levelGaps(preset, c.level, p.doc) : [];
    if (gaps.length) under.push({ name: c.name, gaps });
  }
  return {
    movers,
    stay: chars.filter((c) => c.rung === to),
    delta,
    churn: movers.length === 1 && last ? churn(last) : `${plural(movers.length, 'weekly list')} replaced`,
    under,
  };
}

/** "Lucid Hard → Normal", "Seren party 1 → 2", or both. */
export function changeLabel(doc: BossesDoc, from: { bossId: string; difficulty: string; party: number }, to: { difficulty: string; party: number }): string {
  const name = bossName(doc, from.bossId);
  const party = `party ${from.party} → ${to.party}`;
  if (from.difficulty === to.difficulty) return `${name} ${party}`;
  const diff = `${name} ${titleCase(from.difficulty)} → ${titleCase(to.difficulty)}`;
  return from.party === to.party ? diff : `${diff} (${party})`;
}
export const fromAssignment = (a: Assignment) => ({ bossId: a.bossId, difficulty: a.difficulty, party: a.defaultPartySize });
export const fromEntry = (doc: BossesDoc, e: PresetEntry) => ({ bossId: e.bossId, difficulty: e.difficulty, party: entryParty(doc, e) });

/** "Under level: Normal Jupiter needs 295. Pikalus is Lv 292." */
export function gapNote(doc: BossesDoc, gaps: LevelGap[], c: LadderChar): string {
  if (!gaps.length) return '';
  const who = `${c.name} is Lv ${c.level}.`;
  if (gaps.length <= 2) return `Under level: ${gaps.map((g) => `${bossLabel(doc, g.bossId, g.difficulty)} needs ${g.need}`).join(', ')}. ${who}`;
  const needs = gaps.map((g) => g.need);
  return `Under level for ${gaps.length} bosses (Lv ${Math.min(...needs)}–${Math.max(...needs)}). ${who}`;
}

/** How an edited list differs from its preset: what Reset would undo. */
export function editedNote(doc: BossesDoc, d: PresetDiff): string {
  const bits: string[] = [];
  // Seen from the preset: its missing bosses were removed by hand, extra ones added.
  if (d.added.length) bits.push(`${shortList(d.added.map((e) => bossLabel(doc, e.bossId, e.difficulty)), 2)} removed`);
  if (d.removed.length) bits.push(`${shortList(d.removed.map((a) => bossLabel(doc, a.bossId, a.difficulty)), 2)} added`);
  if (d.changed.length) bits.push(shortList(d.changed.map((c) => changeLabel(doc, fromEntry(doc, c.to), { difficulty: c.from.difficulty, party: c.from.defaultPartySize })), 2));
  return bits.join('; ');
}

// ---- Hand edits: each returns the whole new assignment list --------------------------

export function withPatch(all: Assignment[], id: string, patch: Partial<Assignment>): Assignment[] {
  return all.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

export function withDifficulty(all: Assignment[], a: Assignment, key: string, doc: BossesDoc): Assignment[] {
  return withPatch(all, a.id, { difficulty: key, cadence: cadenceFor(doc, a.bossId, key), defaultPartySize: Math.min(a.defaultPartySize, maxParty(doc, a.bossId, key)) });
}

/** Moves one of a character's bosses to where another sits; the Checklist follows this order. */
export function withOrder(all: Assignment[], character: string, fromId: string, toId: string): Assignment[] {
  const ids = all.filter((a) => a.character === character).sort((a, b) => a.order - b.order).map((a) => a.id);
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return all;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  const order = new Map(ids.map((id, i) => [id, i]));
  return all.map((a) => (order.has(a.id) ? { ...a, order: order.get(a.id)! } : a));
}

export function withBoss(all: Assignment[], character: string, bossId: string, difficulty: string, party: number, doc: BossesDoc): Assignment[] {
  const mine = all.filter((a) => a.character === character);
  const order = mine.length ? Math.max(...mine.map((m) => m.order)) + 1 : 0;
  return [...all, { id: uid(), character, bossId, difficulty, cadence: cadenceFor(doc, bossId, difficulty), defaultPartySize: Math.min(party, maxParty(doc, bossId, difficulty)), order }];
}

/** Sets a character's monthly boss (Black Mage) to a difficulty, or removes it. Presets never touch this. */
export function withMonthly(all: Assignment[], character: string, bossId: string, difficulty: string | null, doc: BossesDoc): Assignment[] {
  const have = all.find((a) => a.character === character && a.bossId === bossId && a.cadence === 'monthly');
  if (!difficulty) return all.filter((a) => a !== have);
  if (have) return withDifficulty(all, have, difficulty, doc);
  return withBoss(all, character, bossId, difficulty, 1, doc);
}
