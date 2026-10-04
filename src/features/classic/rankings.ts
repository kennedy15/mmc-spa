/**
 * Classic World character lookup. Nexon hasn't opened Classic World rankings yet (2026-10-04), so the request below
 * is left blank on purpose: set RANKINGS_URL and the request body, then read the response in toCharacter().
 * The page (CharacterLookup.tsx) only goes through lookupCharacter(), so nothing else has to change.
 *
 * Nexon's GMS rankings send no CORS headers, so a browser can't call them (docs/verification.md). If the
 * Classic World ones behave the same, the request has to run in a GitHub Action, as Add character does.
 */

/** Where the lookup POSTs to; blank until the rankings open. */
const RANKINGS_URL = '';

/** Whether the lookup can run yet. */
export const rankingsOpen = RANKINGS_URL !== '';

export interface ClassicCharacter {
  name: string;
  level: number;
  /** EXP into the current level (what the GMS rankings report), not the total since Lv 1. */
  exp: number;
  job: string | null;
  /** Overall rank, if the rankings give one. */
  rank: number | null;
  world: string | null;
  imageUrl: string | null;
}

export type LookupResult = { kind: 'found'; character: ClassicCharacter } | { kind: 'not-found' } | { kind: 'closed' };

export async function lookupCharacter(name: string, signal?: AbortSignal): Promise<LookupResult> {
  if (!rankingsOpen) return { kind: 'closed' };
  const res = await fetch(RANKINGS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    // The body the Classic World rankings want (the character name, world, ranking type…), once known.
    body: JSON.stringify({}),
    signal,
  });
  if (!res.ok) throw new Error(`the rankings answered HTTP ${res.status}`);
  const character = toCharacter(await res.json(), name);
  return character ? { kind: 'found', character } : { kind: 'not-found' };
}

/** The character called `name` in the rankings' response, or null when it isn't listed; to be written against the real response. */
function toCharacter(data: unknown, name: string): ClassicCharacter | null {
  void data;
  void name;
  return null;
}
