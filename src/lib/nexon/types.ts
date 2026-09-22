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
}

export interface CharactersConfig {
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
