/**
 * MapleStory Classic World guide data (public/classic.json): builds and grinding
 * spots researched from Nexon's Closed Online Tests (COT #1 April 2026, COT #2
 * August 2026) and what testers posted afterwards, then checked against the launch
 * client's data (OSMS Data Explorer, Oct 6 2026). Hand-kept, like bosses.json.
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
  /** The game's own skill ID, keying public/classic/skill-levels.json. Skills with identical art share an icon file, so `icon` may name another ID. */
  id: number;
  tier: JobTier;
  max: number;
  type: SkillType;
  /** Skills of the same job this one needs first, and at what level (the skill data's requiredSkillLevels: launch client for 1st and 2nd job, COT #2 for 3rd). */
  req?: { skill: string; level: number }[];
  /** Where the skill's in-game text names a different requirement than its data (the game goes by the data). */
  reqNote?: string;
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
  /** Consensus tier for the launch job (2nd job), from the tier lists that rate it. */
  tier: Tier;
  /** Consensus tier for the 3rd job, which only COT #2 had. */
  tier3: Tier;
  /** Each list's grade ("—" when the source grades columns, not the class) and the jobs it rates. */
  tierSources: { source: string; tier: string; url: string; jobs: JobTier[] }[];
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
  /** null when the monster gives no EXP itself (e.g. one that transforms). */
  exp: number | null;
  /** Classic World monster ID and its sprite (COT #2 art) under public/. */
  id?: number | null;
  icon?: string;
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
  /** The Classic World map ID, when it could be matched. */
  mapId: number | null;
  /** The in-game world-map marker that covers this map: a `WorldMap.id` and an index into its `spots`. */
  place: { worldMap: string; spot: number } | null;
  /** Spawn points on the map and its mob-rate flag: launch map data, or COT #2 for areas not out yet. */
  spawns: number;
  mobRate: number;
  /** The in-game minimap (pixels) with every spawn point as [x, y, index into `monsters`]. */
  layout: { image: string; width: number; height: number; spawns: [number, number, number][] } | null;
}

/** A marker on an in-game world map; x and y are pixels from the image's top-left corner. */
export interface WorldMapSpot {
  x: number;
  y: number;
  /** The game's marker type (0 is a town). */
  type: number;
  /** Map IDs the marker stands for, and their names. */
  maps: number[];
  names: string[];
}

/** An in-game world map (Classic World COT #2 data): the art and its markers. */
export interface WorldMap {
  id: string;
  name: string;
  /** Image path under public/. */
  image: string;
  width: number;
  height: number;
  spots: WorldMapSpot[];
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

/**
 * public/classic/skill-levels.json, loaded when a skill sheet first opens: each build skill's in-game
 * description for every level (h1…hMax in the client's String data), keyed by skill ID. 1st and 2nd job
 * come from the launch client; 3rd job, which only COT #2 had, from that test's client.
 */
export interface SkillLevelsDoc {
  asOf: string;
  /** Where the launch jobs' text comes from. */
  source: Source;
  /** Where the 3rd-job (test only) text comes from. */
  testSource?: Source;
  skills: Record<string, string[]>;
  /** By skill ID and level: where the game's own value disagrees with that level's text (the game applies the value). */
  notes?: Record<string, Record<string, string>>;
}

/** public/classic/exp-table.json: Classic World's EXP to go from each level to the next. */
export interface ClassicExpDoc {
  source: Source;
  checked: Source;
  fetched: string;
  /** Levels up to here are confirmed for Classic World; above it the table is the original game's. */
  confirmedTo: number;
  note: string;
  /** EXP from each level to the next, by level ("1" … "99"). */
  expToNext: Record<string, number>;
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
  worldMaps: WorldMap[];
  partyQuests: PartyQuest[];
  tips: { text: string; source?: Source }[];
}
