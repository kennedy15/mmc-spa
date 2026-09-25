/**
 * Real places in a Minecraft Java world from its seed: the nearest spot of each
 * surface biome and of each structure within a radius of the base. Runs the
 * game's own worldgen data through deepslate (misode's port of the Java
 * world generator), so it needs no server. Structures are the chunk the game
 * would try, checked against the biome at the chunk centre; the real building
 * can sit a few blocks off, and /locate in game gives the exact spot.
 *
 * Pure: no DOM, so it runs in the scan worker and in Node tests alike.
 */
import { Climate, DensityFunction, Holder, Identifier, LegacyRandom, MultiNoiseBiomeSource, NoiseGeneratorSettings, NormalNoise, RandomState, StructurePlacement, StructureSet, WorldgenRegistries } from 'deepslate';

interface StructureJson {
  biomes: string | string[];
  start_height?: { absolute?: number; type?: string; min_inclusive?: { absolute: number }; max_inclusive?: { absolute: number } };
  project_start_to_heightmap?: string;
}
interface StructureSetJson {
  placement: unknown;
  structures: { structure: string; weight: number }[];
}

/** One version's worldgen files, as published by misode/mcmeta and the game's biome report. */
export interface WorldgenData {
  noises: Record<string, unknown>;
  densityFunctions: Record<string, unknown>;
  /** The overworld noise settings. */
  noiseSettings: unknown;
  /** The overworld multi-noise biome list ({ biomes: [...] }). */
  biomeParameters: unknown;
  structures: Record<string, StructureJson>;
  structureSets: Record<string, StructureSetJson>;
  biomeTags: Record<string, { values: (string | { id: string })[] }>;
}

export interface WorldPlace {
  kind: 'biome' | 'structure';
  /** Game ID without the namespace, e.g. mangrove_swamp or swamp_hut. */
  id: string;
  x: number;
  z: number;
  /** Blocks from the base, straight line. */
  distance: number;
}

// Structures worth building at or around; nether and end sets, strongholds and mineshafts are left out.
const STRUCTURE_SETS = ['villages', 'swamp_huts', 'ocean_monuments', 'pillager_outposts', 'woodland_mansions', 'desert_pyramids', 'jungle_temples', 'igloos', 'trail_ruins', 'ancient_cities', 'trial_chambers', 'abandoned_camp', 'shipwrecks', 'ocean_ruins', 'ruined_portals'];
const BIOME_STEP = 64;
const FAMILY = /^(abandoned_camp|ruined_portal|ocean_ruin|shipwreck)/;

/** Java's rule for level-seed: a whole number in long range as-is, anything else by String.hashCode(). */
export function parseSeed(text: string): bigint {
  const s = text.trim();
  if (/^[+-]?\d+$/.test(s)) {
    const n = BigInt(s);
    if (n >= -(2n ** 63n) && n < 2n ** 63n) return n;
  }
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return BigInt(h);
}

const bare = (id: string) => id.replace(/^#?minecraft:/, '');

export function scanWorld(data: WorldgenData, seedText: string, baseX: number, baseZ: number, radius: number): WorldPlace[] {
  WorldgenRegistries.NOISE.clear();
  WorldgenRegistries.DENSITY_FUNCTION.clear();
  StructureSet.REGISTRY.clear();
  for (const [id, json] of Object.entries(data.noises)) WorldgenRegistries.NOISE.register(Identifier.create(id), NormalNoise.fromJson(json));
  for (const [id, json] of Object.entries(data.densityFunctions)) {
    WorldgenRegistries.DENSITY_FUNCTION.register(Identifier.create(id), new DensityFunction.HolderHolder(Holder.parser(WorldgenRegistries.DENSITY_FUNCTION, DensityFunction.fromJson)(json)));
  }
  // Placement exclusion zones (outposts keep away from villages) look other sets up here.
  for (const [id, json] of Object.entries(data.structureSets)) StructureSet.REGISTRY.register(Identifier.create(id), StructureSet.fromJson(json));

  const settings = NoiseGeneratorSettings.fromJson(data.noiseSettings);
  const seed = parseSeed(seedText);
  const state = new RandomState(settings, seed);
  const sampler = Climate.Sampler.fromRouter(state.router);
  const biomeSource = MultiNoiseBiomeSource.fromJson(data.biomeParameters);
  const offset = new DensityFunction.HolderHolder(Holder.reference(WorldgenRegistries.DENSITY_FUNCTION, Identifier.create('overworld/offset'))).mapAll(state.createVisitor(settings.legacyRandomSource));
  // Terrain height estimate, as in jacobsjo's datapack map: biomes are read at the surface, not in caves below it.
  const surfaceY = (x: number, z: number) => Math.round(128 + 128 * offset.compute(DensityFunction.context(x, 0, z)));
  const biomeAt = (x: number, y: number, z: number) => biomeSource.getBiome(x >> 2, y >> 2, z >> 2, sampler).path;
  // Data this deepslate cannot read (another version's noise format) leaves the terrain flat at y 128.
  if ([[0, 0], [1000, -700], [-2300, 1900]].every(([x, z]) => offset.compute(DensityFunction.context(x, 0, z)) === 0)) {
    throw new Error("This Minecraft version's world data could not be read.");
  }

  const nearest = new Map<string, WorldPlace>();
  const keep = (kind: WorldPlace['kind'], id: string, x: number, z: number) => {
    const distance = Math.round(Math.hypot(x - baseX, z - baseZ));
    if (distance > radius) return;
    // One entry per family (the nearest ruined portal of any kind); villages stay one per type.
    const key = `${kind}:${kind === 'structure' ? (id.match(FAMILY)?.[0] ?? id) : id}`;
    const cur = nearest.get(key);
    if (!cur || distance < cur.distance) nearest.set(key, { kind, id, x, z, distance });
  };

  for (let dx = -radius; dx <= radius; dx += BIOME_STEP) {
    for (let dz = -radius; dz <= radius; dz += BIOME_STEP) {
      const x = baseX + dx;
      const z = baseZ + dz;
      keep('biome', biomeAt(x, surfaceY(x, z), z), x, z);
    }
  }

  const tagCache = new Map<string, Set<string>>();
  const resolveTag = (name: string, seen = new Set<string>()): Set<string> => {
    const hit = tagCache.get(name);
    if (hit) return hit;
    const out = new Set<string>();
    for (const v of data.biomeTags[name]?.values ?? []) {
      const id = typeof v === 'string' ? v : v.id;
      if (!id.startsWith('#')) out.add(bare(id));
      else if (!seen.has(bare(id))) for (const b of resolveTag(bare(id), seen.add(bare(id)))) out.add(b);
    }
    tagCache.set(name, out);
    return out;
  };
  const validBiomes = (s: StructureJson) => (Array.isArray(s.biomes) ? new Set(s.biomes.map(bare)) : s.biomes.startsWith('#') ? resolveTag(bare(s.biomes)) : new Set([bare(s.biomes)]));
  // Where the game checks the biome: fixed-depth structures (ancient city, trial chambers) underground, the rest at the surface.
  const checkY = (s: StructureJson, x: number, z: number) => {
    const h = s.start_height;
    if (h?.absolute !== undefined && !s.project_start_to_heightmap) return h.absolute;
    if (h?.min_inclusive && h.max_inclusive && !s.project_start_to_heightmap) return Math.round((h.min_inclusive.absolute + h.max_inclusive.absolute) / 2);
    return surfaceY(x, z);
  };

  const minChunk = (v: number) => (v - radius) >> 4;
  const maxChunk = (v: number) => (v + radius) >> 4;
  for (const setId of STRUCTURE_SETS) {
    const set = data.structureSets[setId];
    if (!set) continue;
    const placement = StructurePlacement.fromJson(set.placement);
    for (const [cx, cz] of placement.getPotentialStructureChunks(seed, minChunk(baseX), minChunk(baseZ), maxChunk(baseX), maxChunk(baseZ))) {
      if (!placement.isStructureChunk(seed, cx, cz)) continue;
      const x = cx * 16 + 8;
      const z = cz * 16 + 8;
      // Sets with several structures pick one by weight and fall back to the next when its biome is wrong, as the game does.
      const options = set.structures.map((e) => ({ id: bare(e.structure), weight: e.weight }));
      const random = LegacyRandom.fromLargeFeatureSeed(seed, cx, cz);
      let total = options.reduce((sum, e) => sum + e.weight, 0);
      while (options.length) {
        let i = 0;
        if (options.length > 1) {
          let w = random.nextInt(total);
          while (i < options.length - 1 && (w -= options[i].weight) >= 0) i++;
        }
        const pick = options[i];
        const s = data.structures[pick.id];
        if (s && validBiomes(s).has(biomeAt(x, checkY(s, x, z), z))) {
          keep('structure', pick.id, x, z);
          break;
        }
        options.splice(i, 1);
        total -= pick.weight;
      }
    }
  }
  return [...nearest.values()].sort((a, b) => a.distance - b.distance);
}
