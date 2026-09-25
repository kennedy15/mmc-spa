/** A farm dressed up as a build, or a build on its own. */
export type IdeaKind = 'farm' | 'build';
export type IdeaSize = 'small' | 'medium' | 'large';

/** An image sent to Claude with the prompt, already downscaled. */
export interface PromptImage {
  mediaType: 'image/jpeg';
  /** Base64 without the data: prefix. */
  data: string;
  /** Pixel size as sent, which sets what Claude bills to read it. */
  width: number;
  height: number;
}

/** An existing build the new idea can follow up on. */
export interface BuildRef {
  title: string;
  status: string;
  concept?: string;
  lore: string;
  coords?: { x: number; z: number };
}

export interface GenerateOptions {
  kind: IdeaKind;
  size: IdeaSize;
  /** Anything the player wants Claude to take into account. */
  note?: string;
  images?: PromptImage[];
  /** Titles already on the board, to avoid repeats. */
  exclude: string[];
  /** The idea must follow up on one of these (numbered from 1 in the prompt). */
  followUp?: BuildRef[];
  /** Real places from the seed scan, as prompt text. */
  world?: string;
  /** Offline only: the same seed rolls the same idea. */
  seed?: number;
}

export interface Draft {
  title: string;
  concept: string;
  buildType: string;
  biome: string;
  placement: string;
  lore: string;
  palette: string[];
  scale: string;
  sourceLinks: { title: string; url: string }[];
  imageUrls: string[];
  /** Which of `followUp` it builds on, from 1; 0 for none. */
  buildsOn: number;
  /** Coordinates of the real place Claude chose from the seed scan. */
  coords?: { x: number; z: number };
}
