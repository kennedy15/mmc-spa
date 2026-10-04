import type { Archetype, ClassicBuild, ClassicDoc, GrindSpot, Monster, RatingKey, SkillType, Tier } from './types';

export const ARCHETYPES: Archetype[] = ['Warrior', 'Magician', 'Bowman', 'Thief', 'Pirate'];
export const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export const RATINGS: { key: RatingKey; label: string; hint: string }[] = [
  { key: 'mobbing', label: 'Mobbing', hint: 'Clearing groups of monsters' },
  { key: 'bossing', label: 'Bossing', hint: 'Single-target damage' },
  { key: 'mobility', label: 'Mobility', hint: 'Getting around maps' },
  { key: 'survival', label: 'Survival', hint: 'Staying alive' },
  { key: 'funding', label: 'Budget', hint: '5 = cheap to run and gear' },
  { key: 'party', label: 'Party value', hint: 'What it brings a party' },
];

const TYPE_LABEL: Record<SkillType, string> = { attack: 'Attack', passive: 'Passive', buff: 'Buff', mobility: 'Mobility', heal: 'Heal', summon: 'Summon' };
export const skillTypeLabel = (t: SkillType) => TYPE_LABEL[t] ?? t;

export const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

/** Host name for a source link, without "www.". */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** What the build is called at launch: its highest job the launch opens (2nd job while 3rd job is held back). */
export function launchName(build: ClassicBuild, world: ClassicDoc['world']): string {
  return build.path[Math.min(3, Math.max(1, world.launchJobs)) - 1];
}

/** Key skills the launch has first (highest open job first), then the rest in their listed order; `onlyOpen` drops the rest unless none are open. */
export function launchKeySkills(build: ClassicBuild, world: ClassicDoc['world'], onlyOpen = false): string[] {
  const tier = (k: string) => build.skillInfo.find((s) => s.skill === k)?.tier ?? 3;
  const open = (k: string) => tier(k) <= world.launchJobs;
  const sorted = [...build.keySkills].sort((a, b) => Number(open(b)) - Number(open(a)) || (open(a) ? tier(b) - tier(a) : 0));
  return onlyOpen && sorted.some(open) ? sorted.filter(open) : sorted;
}

/** A build's consensus tier for its 2nd job (the launch job) or its 3rd job (COT #2 only). */
export const tierFor = (b: ClassicBuild, job: 2 | 3): Tier => (job === 2 ? b.tier : b.tier3);

/** The lists that grade a build's 2nd or 3rd job (column-only grades left out), and how many give its consensus tier. */
export function tierLists(b: ClassicBuild, job: 2 | 3) {
  const lists = b.tierSources.filter((t) => t.jobs.includes(job) && t.tier !== '—');
  return { lists, agree: lists.filter((t) => t.tier.startsWith(tierFor(b, job))).length };
}

/** Monsters ordered by how many spawn points they have on the map, with that count. */
export function bySpawns(spot: GrindSpot): { monster: Monster; index: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const [, , i] of spot.layout?.spawns ?? []) counts.set(i, (counts.get(i) ?? 0) + 1);
  return spot.monsters.map((monster, index) => ({ monster, index, count: counts.get(index) ?? 0 })).sort((a, b) => b.count - a.count);
}

/**
 * EXP per HP across the map's monsters, weighted by their spawn points: higher means more EXP for the
 * same damage. It ignores overkill, so it compares maps you kill in the same number of hits best.
 */
export function expPerHp(spot: GrindSpot): number | null {
  const ranked = bySpawns(spot);
  const weighted = ranked.some((r) => r.count > 0);
  let exp = 0;
  let hp = 0;
  for (const r of ranked) {
    if (r.monster.hp == null) continue;
    const w = weighted ? r.count : 1;
    exp += w * (r.monster.exp ?? 0);
    hp += w * r.monster.hp;
  }
  return hp > 0 ? exp / hp : null;
}
