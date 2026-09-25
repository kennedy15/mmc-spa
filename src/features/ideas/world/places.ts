// Pure helpers for showing scan results: names, the prompt text, and links out.
import type { WorldSettings } from '../../../lib/types';
import type { WorldPlace } from './worldgen';

export interface WorldScan {
  version: string;
  seed: string;
  baseX: number;
  baseZ: number;
  radius: number;
  places: WorldPlace[];
  scannedAt: string;
}

const STRUCTURE_NAMES: Record<string, string> = {
  monument: 'ocean monument',
  mansion: 'woodland mansion',
  jungle_pyramid: 'jungle temple',
  swamp_hut: 'swamp hut (witch hut)',
  shipwreck_beached: 'beached shipwreck',
  trial_chambers: 'trial chambers',
};

/** "mangrove swamp", "plains village", "ocean monument", "ruined portal (desert)". */
export function placeName(kind: WorldPlace['kind'], id: string): string {
  if (kind === 'structure') {
    if (STRUCTURE_NAMES[id]) return STRUCTURE_NAMES[id];
    if (id.startsWith('village_')) return `${id.slice(8)} village`;
    const variant = id.match(/^(ruined_portal|ocean_ruin|abandoned_camp)_(.+)$/);
    if (variant) return `${variant[1].replace(/_/g, ' ')} (${variant[2].replace(/_/g, ' ')})`;
  }
  return id.replace(/_/g, ' ');
}

/** Minecraft compass: -Z is north, +X is east. */
function compass(dx: number, dz: number): string {
  if (Math.hypot(dx, dz) < 32) return 'at the base';
  const deg = (Math.atan2(dz, dx) * 180) / Math.PI;
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(((deg + 360) % 360) / 45) % 8];
}

function describePlace(scan: WorldScan, p: WorldPlace): string {
  const where = compass(p.x - scan.baseX, p.z - scan.baseZ);
  return `${placeName(p.kind, p.id)} ${p.x}, ${p.z} (${where === 'at the base' ? where : `${p.distance} blocks ${where}`})`;
}

/** The scan as prompt text: every biome and structure found, nearest first. */
export function describeWorld(scan: WorldScan): string {
  const list = (kind: WorldPlace['kind']) => scan.places.filter((p) => p.kind === kind).map((p) => describePlace(scan, p)).join('; ');
  return [
    `Their world: Minecraft Java ${scan.version}, base at ${scan.baseX}, ${scan.baseZ}. Real places within ${scan.radius} blocks, worked out from the seed (x, z, distance from base):`,
    `Biomes: ${list('biome')}.`,
    `Structures: ${list('structure')}.`,
  ].join('\n');
}

/** The seed map on Chunkbase, centred on a spot. */
export const chunkbaseUrl = (world: WorldSettings, x: number, z: number) =>
  `https://www.chunkbase.com/apps/seed-map#seed=${encodeURIComponent(world.seed.trim())}&platform=java_${world.version.replace(/\./g, '_')}&dimension=overworld&x=${x}&z=${z}&zoom=1`;

/** The command that finds the nearest one in game, e.g. /locate structure minecraft:swamp_hut. */
export const locateCommand = (kind: WorldPlace['kind'], id: string) => `/locate ${kind} minecraft:${id}`;
