import { dataUrl } from '../../../lib/paths';
import type { Draft, GenerateOptions } from './types';

export interface Recipes {
  archetypes: { name: string; type: string; sizes: Record<'small' | 'medium' | 'large', string>; farm?: boolean }[];
  biomes: { name: string; placements: string[]; palettes: string[][] }[];
  styles: { name: string; palette: string[] }[];
  hooks: string[];
  builders: string[];
  reasons: string[];
  futures: string[];
}

let recipes: Recipes | null = null;
export async function loadRecipes(): Promise<Recipes> {
  if (recipes) return recipes;
  const r = await fetch(dataUrl('recipes.json', 'public'));
  recipes = (await r.json()) as Recipes;
  return recipes;
}

/** mulberry32: small seeded PRNG so a seed reproduces an idea. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

export function searchUrl(q: string) {
  return `https://www.planetminecraft.com/projects/?keywords=${encodeURIComponent(q)}`;
}

export async function generateOffline(opts: GenerateOptions): Promise<Draft & { seed: number }> {
  const R = await loadRecipes();
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const r = rng(seed);
  const exclude = new Set(opts.exclude.map((t) => t.toLowerCase()));
  const ofKind = R.archetypes.filter((a) => !!a.farm === (opts.kind === 'farm'));
  const pool = ofKind.filter((a) => ![...exclude].some((t) => t.includes(a.name.toLowerCase())));
  const arche = pick(r, pool.length ? pool : ofKind);
  const biome = pick(r, R.biomes);
  const palette = pick(r, biome.palettes);
  const builder = pick(r, R.builders);
  const reason = pick(r, R.reasons);
  const future = pick(r, R.futures);
  const hook = pick(r, R.hooks);
  const vars = { build: arche.name.toLowerCase(), biome: biome.name.toLowerCase(), builder, reason, future };
  const lore = [fill(hook, vars), fill(reason, vars), fill(future, vars)].map((s) => s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith('.') ? '' : '.')).join(' ');
  const adjective = pick(r, ['Forgotten', 'Lantern', 'Hollow', 'Quiet', 'Last', 'Crooked', 'Sunken', 'Copper', 'Moss', 'Ember', 'Salt', 'Wandering']);
  const title = `The ${adjective} ${arche.name}`;
  const q = `${arche.name} ${biome.name}`;
  return {
    seed,
    title,
    concept: `A ${arche.name.toLowerCase()} in the ${biome.name.toLowerCase()}.`,
    buildType: arche.type,
    biome: biome.name,
    placement: pick(r, biome.placements),
    lore,
    palette,
    scale: arche.sizes[opts.size],
    sourceLinks: [
      { title: `Planet Minecraft: ${q}`, url: searchUrl(q) },
      { title: `r/Minecraftbuilds: ${arche.name}`, url: `https://www.reddit.com/r/Minecraftbuilds/search/?q=${encodeURIComponent(arche.name + ' ' + biome.name)}` },
    ],
    imageUrls: [],
    buildsOn: 0,
  };
}
