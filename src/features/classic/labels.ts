import type { Archetype, ClassicBuild, ClassicDoc, RatingKey, SkillType, Tier } from './types';

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
