export interface GenerateOptions {
  biome?: string;
  size?: 'small' | 'medium' | 'large';
  style?: string;
  allowFarms: boolean;
  /** Titles already on the board, to avoid repeats. */
  exclude: string[];
  seed?: number;
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
