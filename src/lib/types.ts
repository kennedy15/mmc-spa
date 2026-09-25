export type IdeaStatus = 'new' | 'progress' | 'complete';

export interface Idea {
  id: string;
  title: string;
  /** One sentence saying what to build, e.g. the farm and the build around it. */
  concept?: string;
  lore: string;
  buildType: string;
  biome: string;
  placement: string;
  scale: string;
  palette: string[];
  sourceLinks: { title: string; url: string }[];
  /** Hotlinked reference thumbnails (URLs only). */
  imageUrls: string[];
  /** Attached photos stored locally as photos/<id>.png. */
  photoIds: string[];
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  generated: boolean;
  allowFarms?: boolean;
  /** The idea this one follows up on, e.g. a perimeter for a witch farm. */
  parentId?: string;
  /** Where it goes in the world. The generator fills it from the seed scan; edit it to where it was actually built. */
  coords?: IdeaCoords;
}

export interface IdeaCoords {
  x: number;
  z: number;
  /** The scanned place the coordinates came from, e.g. structure:swamp_hut, for /locate. */
  place?: string;
}

/** The Minecraft Java world ideas are placed in. */
export interface WorldSettings {
  /** As typed in level-seed: a number, or text that Java hashes. */
  seed: string;
  version: string;
  baseX: number;
  baseZ: number;
}

/** Boards saved before the rename used idle and done; read them as new and complete. */
export function normalizeIdea(idea: Idea): Idea {
  const status = idea.status as string;
  if (status === 'idle') return { ...idea, status: 'new' };
  if (status === 'done') return { ...idea, status: 'complete' };
  return idea;
}

export interface PhotoMeta {
  id: string;
  name: string;
  addedAt: string;
  sourceUrl?: string;
}

export type BossCadence = 'daily' | 'weekly' | 'monthly';

export interface BossDifficulty {
  key: string;
  crystal: number;
  cadence: BossCadence;
  minLevel?: number;
  /** Largest party the boss allows; 6 when absent. */
  maxParty?: number;
}
export interface Boss {
  id: string;
  name: string;
  difficulties: BossDifficulty[];
}
export interface BossPreset {
  id: string;
  name: string;
  description?: string;
  entries: { bossId: string; difficulty: string }[];
}
export interface BossesDoc {
  asOf: string;
  version?: string;
  source?: string;
  bosses: Boss[];
  presets?: BossPreset[];
}

export interface Assignment {
  id: string;
  character: string;
  bossId: string;
  difficulty: string;
  cadence: 'weekly' | 'monthly';
  defaultPartySize: number;
  order: number;
}

export interface Clear {
  id: string;
  character: string;
  bossId: string;
  difficulty: string;
  cadence: 'weekly' | 'monthly';
  /** Reset-week start date (YYYY-MM-DD) or month (YYYY-MM). */
  period: string;
  clearedAt: string;
  partySize: number;
  /** Meso recorded at the time of the clear. */
  meso: number;
  note?: string;
}

/** A level target for one character; kept locally like the boss ledger. */
export interface Goal {
  id: string;
  character: string;
  /** Level to reach (0% into it). */
  level: number;
  /** Target date, YYYY-MM-DD. */
  by: string;
  createdAt: string;
  /** Where the character stood when the goal was set, for the progress bar. */
  startLevel: number;
  startExp: string;
}

/** Overrides of bundled crystal values, keyed `${bossId}:${difficulty}`. */
export type PriceOverrides = Record<string, number>;

export interface Settings {
  /** Crystals one character can sell per week (GMS: 14). */
  crystalCap: number;
  /** Crystals the whole world/account can sell per week (GMS: 180). */
  worldCrystalCap: number;
  /** Multiply crystal values by 5 (GMS Heroic worlds). */
  heroic: boolean;
  /** Extra character names for the ledger that are not in characters.json. */
  extraCharacters: string[];
  /** Characters hidden from bossing pages. */
  hiddenCharacters: string[];
  /** Friend's main to overlay on the dashboard chart. */
  compareWith: string | null;
  /** Minecraft world for placing build ideas; null until a seed is saved. */
  world: WorldSettings | null;
}

export const DEFAULT_SETTINGS: Settings = {
  crystalCap: 14,
  worldCrystalCap: 180,
  heroic: true,
  extraCharacters: [],
  hiddenCharacters: [],
  compareWith: null,
  world: null,
};

export function uid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 16);
}
