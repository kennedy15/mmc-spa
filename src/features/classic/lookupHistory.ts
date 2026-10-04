import type { ClassicCharacter } from './rankings';

/**
 * Every Classic World character looked up in this browser, with what each lookup found, so the next lookup
 * can show what was gained. Kept in localStorage: per browser, and fine to lose.
 */
const KEY = 'mt.classic.lookups';
/** Lookups kept per character (oldest dropped first). */
const KEEP = 300;
/** A repeat lookup this soon after the last one, finding the same level and EXP, isn't kept as a new entry. */
const REPEAT_MS = 10 * 60_000;

export interface Lookup {
  /** When it was looked up (ISO). */
  at: string;
  level: number;
  /** EXP into the level. */
  exp: number;
  rank: number | null;
}

export interface Looked {
  name: string;
  job: string | null;
  world: string | null;
  imageUrl: string | null;
  /** Oldest first. */
  lookups: Lookup[];
  /** The latest lookup, even one that wasn't kept as an entry. */
  checkedAt: string;
}

/** Looked-up characters by lowercase name (names are unique in a world regardless of case). */
export type LookBook = Record<string, Looked>;

export const keyOf = (name: string) => name.trim().toLowerCase();

const isLookup = (l: unknown): l is Lookup => !!l && typeof l === 'object' && typeof (l as Lookup).at === 'string' && Number.isFinite((l as Lookup).level) && Number.isFinite((l as Lookup).exp);

export function readBook(): LookBook {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, Looked> | null;
    if (!v || typeof v !== 'object') return {};
    const book: LookBook = {};
    for (const [key, c] of Object.entries(v)) {
      const lookups = Array.isArray(c?.lookups) ? c.lookups.filter(isLookup) : [];
      if (typeof c?.name === 'string' && lookups.length) book[key] = { ...c, lookups, checkedAt: c.checkedAt ?? lookups[lookups.length - 1].at };
    }
    return book;
  } catch {
    return {};
  }
}

function writeBook(book: LookBook) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    // Private mode or storage blocked: the lookup still shows, it just isn't remembered.
  }
}

/** The book with `c` looked up at `at`, saved; a quick repeat that finds nothing new only moves `checkedAt`. */
export function withLookup(book: LookBook, c: ClassicCharacter, at = new Date().toISOString()): LookBook {
  const key = keyOf(c.name);
  const prev = book[key];
  const last = prev?.lookups[prev.lookups.length - 1];
  const repeat = !!last && last.level === c.level && last.exp === c.exp && last.rank === c.rank && Date.parse(at) - Date.parse(last.at) < REPEAT_MS;
  const lookups = repeat ? prev.lookups : [...(prev?.lookups ?? []), { at, level: c.level, exp: c.exp, rank: c.rank }].slice(-KEEP);
  const next = { ...book, [key]: { name: c.name, job: c.job, world: c.world, imageUrl: c.imageUrl, lookups, checkedAt: at } };
  writeBook(next);
  return next;
}

/** The book without `name`, saved. */
export function withoutCharacter(book: LookBook, name: string): LookBook {
  const next = { ...book };
  delete next[keyOf(name)];
  writeBook(next);
  return next;
}
