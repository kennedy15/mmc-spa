export interface GenerateOptions {
  biome?: string;
  size?: 'small' | 'medium' | 'large';
  style?: string;
  allowFarms: boolean;
  /** Titles already on the board, to avoid repeats. */
  exclude: string[];
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
  buildType: string;
  biome: string;
  placement: string;
  lore: string;
  palette: string[];
  scale: string;
  sourceLinks: { title: string; url: string }[];
  imageUrls: string[];
}
