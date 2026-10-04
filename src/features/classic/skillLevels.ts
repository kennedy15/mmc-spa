/**
 * Reading a skill's per-level game text ("MP -4; Damage 160%" … "MP -12; Damage 260%") as numbers: which ones
 * change from one level to the next, by how much, and how each one grows over the whole skill.
 */

/** One level's text cut at its numbers: text[0] num[0] text[1] … num[n-1] text[n]; `raw` keeps each number as written. */
export interface LevelLine {
  text: string[];
  nums: number[];
  raw: string[];
}

// Thousands first ("1,000"), so a list like "3, 4" isn't read as one number; then whole and decimal numbers.
const NUM = /\d{1,3}(?:,\d{3})+(?!\d)|\d+(?:\.\d+)?/g;

export function splitLine(s: string): LevelLine {
  const raw = s.match(NUM) ?? [];
  return { text: s.split(NUM), nums: raw.map((x) => Number(x.replace(/,/g, ''))), raw };
}

/**
 * Two levels whose numbers line up by position. The wording around them can shift ("1 stage" → "2 stages",
 * "1 enemy" → "2 enemies"); a level that adds or drops a number (Dark Sight's last level loses its Speed penalty) doesn't line up.
 */
const sameShape = (a: LevelLine, b: LevelLine) => a.nums.length === b.nums.length;

const tidy = (n: number) => Math.round(n * 1000) / 1000;

/** For each level, every number's change from the level before; null on level 1 or where the numbers don't line up. */
export function changesByLevel(lines: LevelLine[]): (number[] | null)[] {
  return lines.map((l, i) => (i > 0 && sameShape(l, lines[i - 1]) ? l.nums.map((n, k) => tidy(n - lines[i - 1].nums[k])) : null));
}

/** How one number grows over the skill: its first and last value and the usual step per point. */
export interface Growth {
  from: string;
  to: string;
  /** "+5 a point", "+1 every 2–3 points", "+5 a point, +10 for the last", or "+8 over 19 points" when the steps follow no pattern. */
  step: string;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * The usual step of a run of values: "+5 a point", "+1 every 2–3 points", with the bigger last point many skills
 * give called out ("+5 a point, +10 for the last"); the total when the steps follow no pattern.
 */
function stepOf(values: number[]): string {
  // diffs[i] is the step from level i+1 to level i+2.
  const diffs = values.slice(1).map((v, i) => tidy(v - values[i]));
  const moves = diffs.flatMap((d, i) => (d !== 0 ? [{ d, i }] : []));
  if (moves.length === 1) return `${signed(moves[0].d)} at Lv ${moves[0].i + 2}`;
  const count = new Map<number, number>();
  for (const m of moves) count.set(m.d, (count.get(m.d) ?? 0) + 1);
  const usual = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const last = moves[moves.length - 1];
  const lastOdd = last.d !== usual && last.i === diffs.length - 1;
  const body = lastOdd ? moves.slice(0, -1) : moves;
  if (body.length && body.every((m) => m.d === usual)) {
    // Only the gaps between moves count: the first move may come a little early or late.
    const gaps = body.length > 1 ? body.slice(1).map((m, i) => m.i - body[i].i) : [1];
    const lo = Math.min(...gaps);
    const hi = Math.max(...gaps);
    const cadence = hi === 1 ? 'a point' : lo === hi ? `every ${lo} points` : hi - lo === 1 ? `every ${lo}–${hi} points` : null;
    if (cadence) return `${signed(usual)} ${cadence}${lastOdd ? `, ${signed(last.d)} for the last` : ''}`;
  }
  return `${signed(tidy(values[values.length - 1] - values[0]))} over ${diffs.length} points`;
}

/**
 * The skill's sentence (worded as at the last level it covers) with each changing number as a range and its step.
 * It covers the levels from Lv 1 whose numbers line up (`upTo`, usually the max); null for a one-level skill.
 */
export function growth(lines: LevelLine[]): { text: string[]; nums: (Growth | string)[]; upTo: number } | null {
  let upTo = 1;
  while (upTo < lines.length && sameShape(lines[upTo], lines[0])) upTo++;
  if (upTo < 2) return null;
  const run = lines.slice(0, upTo);
  const first = run[0];
  const last = run[run.length - 1];
  return {
    text: last.text,
    upTo,
    nums: last.nums.map((_, k) => (run.every((l) => l.nums[k] === first.nums[k]) ? last.raw[k] : { from: first.raw[k], to: last.raw[k], step: stepOf(run.map((l) => l.nums[k])) })),
  };
}
