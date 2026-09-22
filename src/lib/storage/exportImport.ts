import JSZip from 'jszip';
import type { Assignment, Clear, Idea, PhotoMeta, PriceOverrides, Settings } from '../types';
import { loadPhoto } from './persist';

export interface Bundle {
  ideas: Idea[];
  photos: PhotoMeta[];
  assignments: Assignment[];
  clears: Clear[];
  prices: PriceOverrides;
  settings: Settings;
}

export async function buildExportZip(b: Bundle): Promise<Blob> {
  const zip = new JSZip();
  zip.file('ideas.json', JSON.stringify(b.ideas, null, 2));
  zip.file('photos.json', JSON.stringify(b.photos, null, 2));
  zip.file('bossing/assignments.json', JSON.stringify(b.assignments, null, 2));
  zip.file('bossing/clears.json', JSON.stringify(b.clears, null, 2));
  zip.file('bossing/prices.json', JSON.stringify(b.prices, null, 2));
  zip.file('settings.json', JSON.stringify(b.settings, null, 2));
  zip.file('README.txt', 'MapleTracker export. Import from Settings > Import. Photos are in photos/.\n');
  for (const p of b.photos) {
    const blob = await loadPhoto(p.id);
    if (blob) zip.file(`photos/${p.id}.png`, blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

export interface ImportResult {
  bundle: Partial<Bundle>;
  photoBlobs: Map<string, Blob>;
}

export async function readImportZip(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);
  const json = async <T>(name: string): Promise<T | undefined> => {
    const f = zip.file(name);
    if (!f) return undefined;
    try {
      return JSON.parse(await f.async('string')) as T;
    } catch {
      return undefined;
    }
  };
  const bundle: Partial<Bundle> = {
    ideas: await json<Idea[]>('ideas.json'),
    photos: await json<PhotoMeta[]>('photos.json'),
    assignments: await json<Assignment[]>('bossing/assignments.json'),
    clears: await json<Clear[]>('bossing/clears.json'),
    prices: await json<PriceOverrides>('bossing/prices.json'),
  };
  const photoBlobs = new Map<string, Blob>();
  for (const [name, entry] of Object.entries(zip.files)) {
    const m = name.match(/^photos\/([^/]+)\.png$/);
    if (m && !entry.dir) photoBlobs.set(m[1], await entry.async('blob'));
  }
  return { bundle, photoBlobs };
}

/** Merge by id; the newer updatedAt wins for ideas, existing wins otherwise. */
export function mergeById<T extends { id: string; updatedAt?: string }>(existing: T[], incoming: T[] | undefined): T[] {
  if (!incoming) return existing;
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const item of incoming) {
    const cur = map.get(item.id);
    if (!cur) map.set(item.id, item);
    else if (item.updatedAt && cur.updatedAt && item.updatedAt > cur.updatedAt) map.set(item.id, item);
  }
  return [...map.values()];
}
