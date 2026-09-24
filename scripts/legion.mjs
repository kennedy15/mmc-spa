// Which tracked character reports an account's legion in Nexon's rankings.
//
// The legion ranking holds one row per account and world, filed under the
// account's highest-level character. On a tie the character that reached the
// level first keeps the row: if A is 292 and B levels to 292 (even with more
// EXP into the level), A still reports until B reaches 293 while A is still
// 292. The rankings don't say who got somewhere first, so the collector asks
// the legion ranking about each candidate in this order and stops at the first
// one that returns a row. Usually that is one request.

/**
 * Order in which to look up one account/world group in the legion ranking.
 * @param {{ name: string, level: number }[]} rows today's rows for the group, in characters.json order
 * @param {string | null} incumbent the character that reported the legion in the latest earlier snapshot
 * @returns {string[]} character names, most likely reporter first
 */
export function legionCandidates(rows, incumbent) {
  if (!rows.length) return [];
  const top = Math.max(...rows.map((r) => r.level));
  const current = rows.find((r) => r.name === incumbent) ?? null;
  const order = [];
  const add = (r) => {
    if (r && !order.includes(r.name)) order.push(r.name);
  };
  // 1. The current reporter keeps the row until someone passes its level.
  if (current && current.level === top) add(current);
  // 2. Otherwise the highest level reports; among ties nothing says who got there first.
  for (const r of rows) if (r.level === top) add(r);
  // 3. The legion ranking can lag a level-up, so the old reporter comes next.
  add(current);
  // 4. Everyone else, highest level first (first run, or several changes at once).
  for (const r of [...rows].sort((a, b) => b.level - a.level)) add(r);
  return order;
}
