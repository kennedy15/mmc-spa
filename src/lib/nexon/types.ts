export interface SnapshotRow {
  name: string;
  level: number;
  /** EXP as a decimal string; use BigInt for arithmetic. */
  exp: string;
  job: string;
  worldId: number;
  world: string;
  rank: number;
  rankChange: number;
  legionLevel: number | null;
  legionRank: number | null;
  raidPower: number | null;
  imgUrl: string;
  lookHash: string | null;
  role: string;
  owner: string;
  /** Set by the app, never stored: the name the rankings listed that day, when the character has been renamed since. */
  recordedName?: string;
}

export interface Snapshot {
  date: string;
  fetchedAt: string;
  rows: SnapshotRow[];
  missing: string[];
}

export interface SnapshotIndex {
  updatedAt: string | null;
  dates: string[];
}

export interface CharacterConfig {
  name: string;
  role?: string;
  owner?: string;
  worldId?: number;
  world?: string;
  /** Names the character had before a name change in game, oldest first. */
  formerNames?: FormerName[];
}

export interface FormerName {
  name: string;
  /** UTC date the tracker switched to the next name; snapshots dated before it were taken under this one. */
  renamedOn?: string;
}

export interface CharactersConfig {
  /** "owner/name" of the repo this data was set up for; a copy that still holds another repo's data skips its scheduled jobs (scripts/repo-guard.mjs). */
  repo?: string;
  /** That repo's numeric GitHub id; it survives a rename, so the data still counts as this repo's. */
  repoId?: number;
  world: string;
  worldId: number;
  characters: CharacterConfig[];
}

export interface LookEntry {
  hash: string;
  firstSeen: string;
  lastSeen: string;
}

export interface WorldInfo {
  name: string;
  region: string;
  heroic: boolean;
}
export interface WorldsDoc {
  worlds: Record<string, WorldInfo>;
}
