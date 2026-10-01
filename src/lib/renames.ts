import type { CharacterConfig, CharactersConfig, Snapshot, SnapshotRow } from './nexon/types';
import type { AppliedPresets, Assignment, Clear, Goal, Settings } from './types';

// A character renamed in game stays one character. data/characters.json lists
// it under its current name, with the earlier ones in `formerNames` and the
// date the tracker switched over. Snapshots and local records keep the name
// they were made under; these helpers file them under the current one.

/** Current name for a name as recorded, on a date (YYYY-MM-DD) when known. */
export type ResolveName = (name: string, date?: string) => string;

/**
 * A name recorded on a date belongs to the character that gave it up soonest
 * after that date. Otherwise (no date, or every rename came earlier) it belongs
 * to whoever uses it now, else to the character that gave it up last. `inUse`
 * adds names outside characters.json, such as ledger-only characters.
 */
export function nameResolver(config: CharactersConfig | null, inUse: Iterable<string> = []): ResolveName {
  const current = new Set([...(config?.characters ?? []).map((c) => c.name), ...inUse]);
  const holders = new Map<string, { to: string; until: string }[]>();
  for (const c of config?.characters ?? []) {
    for (const f of c.formerNames ?? []) {
      if (f.name === c.name) continue;
      // A hand-written entry without a date covers every snapshot.
      holders.set(f.name, [...(holders.get(f.name) ?? []), { to: c.name, until: f.renamedOn ?? '9999-12-31' }]);
    }
  }
  for (const list of holders.values()) list.sort((a, b) => a.until.localeCompare(b.until));
  return (name, date) => {
    const list = holders.get(name);
    if (!list) return name;
    const holder = date ? list.find((h) => date < h.until) : undefined;
    if (holder) return holder.to;
    return current.has(name) ? name : list[list.length - 1].to;
  };
}

/** Snapshots with every row under its character's current name; a moved row keeps the old one in `recordedName`. */
export function renameSnapshots(snapshots: Snapshot[], resolve: ResolveName): Snapshot[] {
  return snapshots.map((s) => {
    let moved = false;
    const file = (name: string) => {
      const to = resolve(name, s.date);
      if (to !== name) moved = true;
      return to;
    };
    const rows = s.rows.map((r) => {
      const name = file(r.name);
      return name === r.name ? r : { ...r, name, recordedName: r.name };
    });
    const missing = (s.missing ?? []).map(file);
    return moved ? { ...s, rows, missing } : s;
  });
}

/**
 * Records kept under a former name, moved to the current one. A moved record
 * that repeats one the current name already has (same `key`) is dropped.
 * Returns `list` itself when nothing moved.
 */
function moveRecords<T extends { character: string }>(list: T[], resolve: ResolveName, key: (r: T) => string, dateOf?: (r: T) => string): T[] {
  const next = list.map((r) => {
    const character = resolve(r.character, dateOf?.(r));
    return character === r.character ? r : { ...r, character };
  });
  if (next.every((r, i) => r === list[i])) return list;
  const taken = new Set(next.filter((r, i) => r === list[i]).map(key));
  return next.filter((r, i) => {
    if (r === list[i]) return true;
    if (taken.has(key(r))) return false;
    taken.add(key(r));
    return true;
  });
}

export const renameAssignments = (list: Assignment[], resolve: ResolveName) => moveRecords(list, resolve, (a) => `${a.character}|${a.bossId}|${a.difficulty}`);

export const renameClears = (list: Clear[], resolve: ResolveName) =>
  moveRecords(
    list,
    resolve,
    (c) => `${c.character}|${c.bossId}|${c.difficulty}|${c.period}`,
    (c) => c.clearedAt.slice(0, 10),
  );

/** Applied presets under current names; when both names had one, the current name's stays. Returns `map` itself when nothing moved. */
export function renameAppliedPresets(map: AppliedPresets, resolve: ResolveName): AppliedPresets {
  const entries = Object.entries(map);
  if (entries.every(([n]) => resolve(n) === n)) return map;
  const out: AppliedPresets = {};
  for (const [n, id] of entries) if (resolve(n) === n) out[n] = id;
  for (const [n, id] of entries) if (resolve(n) !== n && !(resolve(n) in out)) out[resolve(n)] = id;
  return out;
}

/** One goal per character: when both names had one, the current name's stays. */
export const renameGoals = (list: Goal[], resolve: ResolveName) => moveRecords(list, resolve, (g) => g.character);

/** Hidden characters and the compare-with pick, under current names. Returns `settings` itself when nothing moved. */
export function renameSettings(settings: Settings, resolve: ResolveName): Settings {
  const hiddenCharacters = [...new Set(settings.hiddenCharacters.map((n) => resolve(n)))];
  const compareWith = settings.compareWith == null ? null : resolve(settings.compareWith);
  const same = compareWith === settings.compareWith && hiddenCharacters.length === settings.hiddenCharacters.length && hiddenCharacters.every((n, i) => n === settings.hiddenCharacters[i]);
  return same ? settings : { ...settings, hiddenCharacters, compareWith };
}

/** A tracked character's earlier names, latest first. */
export function formerNamesOf(entry: CharacterConfig | undefined): string[] {
  const out: string[] = [];
  for (const f of [...(entry?.formerNames ?? [])].reverse()) if (f.name !== entry?.name && !out.includes(f.name)) out.push(f.name);
  return out;
}

export interface NameSpan {
  name: string;
  /** First and last snapshot under this name. */
  from: string;
  to: string;
}

/** The names a character's snapshots were taken under, oldest first: one span per run of snapshots. */
export function nameSpans(series: { date: string; row: SnapshotRow }[]): NameSpan[] {
  const out: NameSpan[] = [];
  for (const p of series) {
    const name = p.row.recordedName ?? p.row.name;
    const last = out[out.length - 1];
    if (last?.name === name) last.to = p.date;
    else out.push({ name, from: p.date, to: p.date });
  }
  return out;
}
