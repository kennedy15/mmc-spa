/**
 * MapleStory Classic World guide data (public/classic.json): builds and grinding
 * spots researched from Nexon's Closed Online Tests (COT #1 April 2026, COT #2
 * August 2026) and what testers posted afterwards. Hand-kept, like bosses.json.
 */
export type Archetype = 'Warrior' | 'Magician' | 'Bowman' | 'Thief' | 'Pirate';
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';
export type StatName = 'STR' | 'DEX' | 'INT' | 'LUK';
export type RatingKey = 'mobbing' | 'bossing' | 'mobility' | 'survival' | 'funding' | 'party';
export type SkillType = 'attack' | 'passive' | 'buff' | 'mobility' | 'heal' | 'summon';
/** 1st, 2nd or 3rd job. */
export type JobTier = 1 | 2 | 3;

export interface Source {
  title: string;
  url: string;
}

/** Raise `skill` to level `to` (cumulative: a skill can come back with a higher target). */
export interface SkillStep {
  skill: string;
  to: number;
  note?: string;
}

export interface JobSkills {
  tier: JobTier;
  /** Job name, e.g. "Spearman". */
  job: string;
  /** Level of the advancement. */
  from: number;
  order: SkillStep[];
  skip: { skill: string; why: string }[];
  /** Anything about this job's points worth saying (e.g. how few 3rd-job SP a capped character has). */
  note?: string;
}

export interface SkillInfo {
  skill: string;
  tier: JobTier;
  max: number;
  type: SkillType;
  what: string;
  /** What Classic World changed against the original game, if anything. */
  classicChange: string | null;
  /** 32px icon under public/ (e.g. "classic/skills/1001001.png"); null when the game data has none yet. */
  icon?: string | null;
}

export interface ClassicBuild {
  id: string;
  archetype: Archetype;
  /** The 3rd job, e.g. "Dragon Knight". */
  name: string;
  /** 1st, 2nd and 3rd job names. */
  path: [string, string, string];
  /** Levels of the three advancements. */
  jobLevels: [number, number, number];
  tier: Tier;
  tierSources: { source: string; tier: string; url: string }[];
  weapons: { type: string; preferred?: boolean; why: string }[];
  summary: string;
  ratings: Record<RatingKey, { score: number; why: string }>;
  stats: {
    primary: StatName;
    secondary: StatName | null;
    /** Recommended roll at character creation, if it matters. */
    creation: string | null;
    rule: string;
    plan: { levels: string; do: string }[];
    variants: { name: string; how: string; tradeoff: string }[];
  };
  skills: JobSkills[];
  skillInfo: SkillInfo[];
  keySkills: string[];
  gear: string[];
  strengths: string[];
  weaknesses: string[];
  tips: string[];
  classicChanges: string[];
  /** What is confirmed for Classic World and what is inferred. */
  confidence: string;
  sources: Source[];
}

export interface Monster {
  name: string;
  level: number;
  hp: number | null;
  exp: number | null;
}

/** Where a spot stands for the launch: open, only seen in the second test, or announced for later. */
export type Availability = 'launch' | 'cot2' | 'soon';

export interface GrindSpot {
  id: string;
  available: Availability;
  map: string;
  area: string;
  region: string;
  /** Recommended character levels, inclusive. */
  levels: [number, number];
  monsters: Monster[];
  /** "All", archetypes or 3rd-job names. */
  bestFor: string[];
  style: 'solo' | 'party' | 'both';
  why: string;
  tips: string[];
  classicNote: string | null;
  confidence: string;
  sources: Source[];
}

export interface PartyQuest {
  id: string;
  name: string;
  levels: [number, number];
  where: string;
  party: string;
  why: string;
  available: string;
  sources: Source[];
}

export interface ClassicDoc {
  /** When the research was done (YYYY-MM-DD). */
  asOf: string;
  world: {
    /** Founder's Access start (ISO, UTC). */
    foundersAccess: string;
    /** Grand Launch (ISO, UTC). */
    launch: string;
    /** Max level at launch. */
    levelCap: number;
    /** Job advancements open at launch (2 = 1st and 2nd job; 3rd job was only in COT #2). */
    launchJobs: number;
    tests: { name: string; dates: string; notes: string; url?: string }[];
    /** How AP and SP are earned; drives the skill timelines. */
    rules: { spPerLevel: number; spAtAdvancement: number; apPerLevel: number; notes: { text: string; source?: Source }[] };
    sources: Source[];
  };
  builds: ClassicBuild[];
  spots: GrindSpot[];
  partyQuests: PartyQuest[];
  tips: { text: string; source?: Source }[];
}
