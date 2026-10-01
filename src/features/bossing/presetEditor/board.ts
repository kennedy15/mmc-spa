import type { Boss, BossDifficulty, BossesDoc, BossPreset, PresetEntry } from '../../../lib/types';
import { cadenceFor, entryParty, maxParty } from '../lib';

/** bosses.json lists bosses in progression order; from Lotus on is the endgame, which leads the board. */
const ENDGAME_FROM = 'lotus';

export interface BoardBoss {
  boss: Boss;
  /** The difficulties a preset can use: weekly ones only. */
  difficulties: BossDifficulty[];
}

/**
 * Every boss a preset can hold (one with a weekly difficulty; daily-only bosses and
 * monthly Black Mage are left out). Endgame bosses come first in progression order;
 * the older ones follow, those the default presets use first. (The defaults, not the
 * saved list, so a tile doesn't jump when a preset is saved.)
 */
export function boardBosses(doc: BossesDoc): { endgame: BoardBoss[]; older: BoardBoss[] } {
  const all = doc.bosses.map((boss) => ({ boss, difficulties: boss.difficulties.filter((d) => d.cadence === 'weekly') })).filter((b) => b.difficulties.length);
  const from = Math.max(0, all.findIndex((b) => b.boss.id === ENDGAME_FROM));
  const used = new Set((doc.presets ?? []).flatMap((p) => p.entries.map((e) => e.bossId)));
  const older = all.slice(0, from);
  return { endgame: all.slice(from), older: [...older.filter((b) => used.has(b.boss.id)), ...older.filter((b) => !used.has(b.boss.id))] };
}

/** Weekly crystals the preset uses: one per weekly boss. */
export function crystalsOf(preset: BossPreset, doc: BossesDoc | null): number {
  return preset.entries.filter((e) => cadenceFor(doc, e.bossId, e.difficulty) === 'weekly').length;
}

/** The entry list with a boss set to a difficulty (null takes it out). A boss keeps its place and party size, within the new difficulty's limit; a new one goes last. */
export function withDifficulty(entries: PresetEntry[], bossId: string, difficulty: string | null, doc: BossesDoc | null): PresetEntry[] {
  if (!difficulty) return entries.filter((e) => e.bossId !== bossId);
  const cur = entries.find((e) => e.bossId === bossId);
  if (!cur) return [...entries, { bossId, difficulty }];
  return entries.map((e) => (e.bossId === bossId ? partied({ bossId, difficulty }, Math.min(entryParty(doc, cur), maxParty(doc, bossId, difficulty))) : e));
}

export function withParty(entries: PresetEntry[], bossId: string, party: number): PresetEntry[] {
  return entries.map((e) => (e.bossId === bossId ? partied(e, party) : e));
}

/** Party size is only written when above 1, as in bosses.json. */
function partied(e: PresetEntry, party: number): PresetEntry {
  return party > 1 ? { bossId: e.bossId, difficulty: e.difficulty, partySize: party } : { bossId: e.bossId, difficulty: e.difficulty };
}

/** Same bosses, difficulties and party sizes; the order of the bosses doesn't count. */
export function sameBosses(a: BossPreset, b: BossPreset, doc: BossesDoc | null): boolean {
  const keys = (p: BossPreset) => p.entries.map((e) => `${e.bossId}:${e.difficulty}:${entryParty(doc, e)}`).sort().join('|');
  return keys(a) === keys(b);
}

/** Same name, Main tag and bosses. */
export function samePreset(a: BossPreset, b: BossPreset, doc: BossesDoc | null): boolean {
  return a.name.trim() === b.name.trim() && !!a.main === !!b.main && (a.description ?? '') === (b.description ?? '') && sameBosses(a, b, doc);
}

/** What to save: name trimmed, party sizes within each boss's limit. */
export function cleanPreset(p: BossPreset, doc: BossesDoc | null): BossPreset {
  const { main, ...rest } = p;
  return { ...rest, ...(main ? { main } : {}), name: p.name.trim(), entries: p.entries.map((e) => partied(e, entryParty(doc, e))) };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Why the name can't be saved, or null. `selfId` is the preset being renamed (null for a new one). */
export function nameProblem(name: string, presets: BossPreset[], selfId: string | null): string | null {
  if (!name.trim()) return 'Give the preset a name.';
  const twin = presets.find((p) => p.id !== selfId && sameName(p.name, name));
  return twin ? `${twin.name} already uses that name.` : null;
}

/** `base`, or `base 2`, `base 3`… when another preset already has the name. */
export function uniqueName(base: string, presets: BossPreset[]): string {
  let name = base;
  for (let n = 2; presets.some((p) => sameName(p.name, name)); n++) name = `${base} ${n}`;
  return name;
}

/** A readable id from the name that no preset, default preset or character's applied preset uses. Renaming later keeps it. */
export function newPresetId(name: string, taken: Set<string>): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';
  let id = slug;
  for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
  return id;
}

/** "1 character", "3 characters". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The verb for n subjects: agree(1, 'keeps', 'keep'). */
export function agree(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "Apox, Jurni and Strom", "Apox, Jurni, Strom and 5 more". */
export function nameList(names: string[], max = 3): string {
  if (names.length <= 1) return names.join('');
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}
