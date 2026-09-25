import { kv } from '../../../lib/storage/idb';
import type { WorldSettings } from '../../../lib/types';
import type { WorldgenData, WorldPlace } from './worldgen';
import type { WorldScan } from './places';

/** Versions whose worldgen data deepslate reads (26.3 changed the noise format, so older data needs an older deepslate). */
export const WORLD_VERSIONS = ['26.3'];
export const SCAN_RADIUS = 3000;

const MCMETA = (v: string) => `https://raw.githubusercontent.com/misode/mcmeta/${v}-summary/data`;
const BIOME_PARAMETERS = (v: string) => `https://raw.githubusercontent.com/Ersatz77/mcdata/refs/tags/${v}/generated/reports/biome_parameters/minecraft/overworld.json`;

/** One version's worldgen files (about 4 MB), downloaded once and kept in IndexedDB. */
async function loadWorldgen(version: string): Promise<WorldgenData> {
  const key = `worldgen:${version}`;
  const cached = await kv.get<WorldgenData>(key);
  if (cached) return cached;
  const get = async <T>(url: string): Promise<T> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Could not download the Minecraft ${version} world data (HTTP ${r.status}).`);
    return (await r.json()) as T;
  };
  const m = MCMETA(version);
  const [noises, densityFunctions, noiseSettings, structures, structureSets, biomeTags, biomeParameters] = await Promise.all([
    get<WorldgenData['noises']>(`${m}/worldgen/noise/data.min.json`),
    get<WorldgenData['densityFunctions']>(`${m}/worldgen/density_function/data.min.json`),
    get<Record<string, unknown>>(`${m}/worldgen/noise_settings/data.min.json`),
    get<WorldgenData['structures']>(`${m}/worldgen/structure/data.min.json`),
    get<WorldgenData['structureSets']>(`${m}/worldgen/structure_set/data.min.json`),
    get<WorldgenData['biomeTags']>(`${m}/tag/worldgen/biome/data.min.json`),
    get<unknown>(BIOME_PARAMETERS(version)),
  ]);
  const data: WorldgenData = { noises, densityFunctions, noiseSettings: noiseSettings.overworld, structures, structureSets, biomeTags, biomeParameters };
  await kv.set(key, data);
  return data;
}

const scanKey = (w: WorldSettings) => `worldScan:${w.version}:${w.seed.trim()}:${w.baseX}:${w.baseZ}:${SCAN_RADIUS}`;

/** The scan for these settings, from IndexedDB if it ran before; otherwise downloads the data and scans in a worker (under a second). */
export async function getWorldScan(world: WorldSettings, onStatus?: (status: string) => void): Promise<WorldScan> {
  const cached = await kv.get<WorldScan>(scanKey(world));
  if (cached) return cached;
  onStatus?.('Downloading Minecraft world data…');
  const data = await loadWorldgen(world.version);
  onStatus?.('Scanning your world…');
  const places = await new Promise<WorldPlace[]>((resolve, reject) => {
    const worker = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ places?: WorldPlace[]; error?: string }>) => {
      worker.terminate();
      if (e.data.places) resolve(e.data.places);
      else reject(new Error(e.data.error ?? 'The world scan failed.'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'The world scan failed.'));
    };
    worker.postMessage({ data, seed: world.seed, baseX: world.baseX, baseZ: world.baseZ, radius: SCAN_RADIUS });
  });
  const scan: WorldScan = { ...world, seed: world.seed.trim(), radius: SCAN_RADIUS, places, scannedAt: new Date().toISOString() };
  await kv.set(scanKey(world), scan);
  return scan;
}
