export type IdeaStatus = 'idle' | 'progress' | 'done';

export interface Idea {
  id: string;
  title: string;
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
}
export interface Boss {
  id: string;
  name: string;
  difficulties: BossDifficulty[];
}
export interface BossesDoc {
  asOf: string;
  version?: string;
  source?: string;
  bosses: Boss[];
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

/** Overrides of bundled crystal values, keyed `${bossId}:${difficulty}`. */
export type PriceOverrides = Record<string, number>;

export interface Settings {
  crystalCap: number;
  /** Multiply crystal values by 5 (GMS Heroic worlds). */
  heroic: boolean;
  /** Extra character names for the ledger that are not in characters.json. */
  extraCharacters: string[];
  /** Characters hidden from bossing pages. */
  hiddenCharacters: string[];
  /** Friend's main to overlay on the dashboard chart. */
  compareWith: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  crystalCap: 14,
  heroic: true,
  extraCharacters: [],
  hiddenCharacters: [],
  compareWith: null,
};

export function uid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 16);
}
