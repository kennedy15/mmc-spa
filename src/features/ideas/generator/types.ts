/** A farm dressed up as a build, or a build on its own. */
export type IdeaKind = 'farm' | 'build';
export type IdeaSize = 'small' | 'medium' | 'large';

/** An image sent to Claude with the prompt, already downscaled. */
export interface PromptImage {
  mediaType: 'image/jpeg';
  /** Base64 without the data: prefix. */
  data: string;
}

export interface GenerateOptions {
  kind: IdeaKind;
  size: IdeaSize;
  /** Anything the player wants Claude to take into account. */
  note?: string;
  images?: PromptImage[];
  /** Titles already on the board, to avoid repeats. */
  exclude: string[];
  /** Offline only: the same seed rolls the same idea. */
  seed?: number;
}

/** What one AI generation used, summed over all of its requests. */
export interface AiUsage {
  /** All input, cache reads and writes included. */
  inputTokens: number;
  outputTokens: number;
  searches: number;
  /** Estimated at list prices. */
  usd: number;
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
}
