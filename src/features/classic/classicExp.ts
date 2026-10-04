import type { ClassicExpDoc } from './types';

/**
 * EXP math on Classic World's table (public/classic/exp-table.json). The numbers stay far below 2^53
 * (Lv 1 to 100 is about 180 million EXP), so plain numbers do, unlike the modern tracker's BigInts.
 */

/** EXP from `level` to the next; null at the cap or past the table. */
export const expToNext = (doc: ClassicExpDoc, level: number): number | null => doc.expToNext[String(level)] ?? null;

/** Total EXP since Lv 1 at `level` with `exp` into it; null if the table lacks a level below it. */
export function totalExp(doc: ClassicExpDoc, level: number, exp: number): number | null {
  let sum = exp;
  for (let l = 1; l < level; l++) {
    const need = expToNext(doc, l);
    if (need == null) return null;
    sum += need;
  }
  return sum;
}

/** EXP still to go from `level` with `exp` into it to reaching `target` (0% into it). */
export function expUntil(doc: ClassicExpDoc, level: number, exp: number, target: number): number | null {
  if (target <= level) return 0;
  const from = totalExp(doc, level, exp);
  const to = totalExp(doc, target, 0);
  return from == null || to == null ? null : Math.max(0, to - from);
}

/** How far into its level a character is (0 to 1); 1 at the cap. */
export function levelShare(doc: ClassicExpDoc, level: number, exp: number): number {
  const need = expToNext(doc, level);
  return need ? Math.min(1, Math.max(0, exp / need)) : 1;
}

/** EXP gained between two lookups across level-ups; null if a level is missing from the table or the character went down. */
export function gainedBetween(doc: ClassicExpDoc, a: { level: number; exp: number }, b: { level: number; exp: number }): number | null {
  const from = totalExp(doc, a.level, a.exp);
  const to = totalExp(doc, b.level, b.exp);
  return from == null || to == null || to < from ? null : to - from;
}

/** The level and EXP into it that `total` EXP since Lv 1 comes to (stopping at the table's end). */
export function atTotal(doc: ClassicExpDoc, total: number): { level: number; exp: number } {
  let level = 1;
  let rest = total;
  for (let need = expToNext(doc, level); need != null && rest >= need; need = expToNext(doc, level)) {
    rest -= need;
    level++;
  }
  return { level, exp: rest };
}
