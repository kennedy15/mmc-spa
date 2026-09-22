/**
 * Unified local persistence. IndexedDB is always the working copy; when a
 * data folder is connected and permitted, every write is mirrored to it and
 * on load the folder wins for personal data (ideas, clears, photos, settings).
 */
import { docs, photoStore, kv } from './idb';
import * as fs from './fs-access';

export type DocName =
  | 'ideas.json'
  | 'photos.json'
  | 'bossing/assignments.json'
  | 'bossing/clears.json'
  | 'bossing/prices.json'
  | 'settings.json';

let folder: FileSystemDirectoryHandle | null = null;

export function setFolder(handle: FileSystemDirectoryHandle | null) {
  folder = handle;
}
export function hasFolder() {
  return folder != null;
}

export async function loadDoc<T>(name: DocName, fallback: T): Promise<T> {
  if (folder) {
    const fromFolder = await fs.readJson<T>(folder, name);
    if (fromFolder != null) {
      await docs.set(name, fromFolder);
      return fromFolder;
    }
  }
  const fromIdb = await docs.get<T>(name);
  if (fromIdb != null) {
    if (folder) await fs.writeJson(folder, name, fromIdb).catch(() => {});
    return fromIdb;
  }
  return fallback;
}

export async function saveDoc(name: DocName, value: unknown): Promise<void> {
  await docs.set(name, value);
  if (folder) await fs.writeJson(folder, name, value);
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await photoStore.set(id, blob);
  if (folder) await fs.writeFile(folder, `photos/${id}.png`, blob);
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  const local = await photoStore.get(id);
  if (local) return local;
  if (folder) {
    const b = await fs.readBlob(folder, `photos/${id}.png`);
    if (b) {
      await photoStore.set(id, b);
      return b;
    }
  }
  return null;
}

export async function deletePhoto(id: string): Promise<void> {
  await photoStore.del(id);
  if (folder) await fs.removeFile(folder, `photos/${id}.png`);
}

/** Mirror a repo snapshot into the folder (idempotent). */
export async function mirrorSnapshot(date: string, json: unknown): Promise<void> {
  if (!folder) return;
  const rel = `snapshots/${date}.json`;
  if (await fs.exists(folder, rel)) return;
  await fs.writeJson(folder, rel, json).catch(() => {});
}

/** API key lives in IndexedDB only, never in the folder or repo. */
export const apiKey = {
  get: () => kv.get<string>('anthropicApiKey'),
  set: (k: string) => kv.set('anthropicApiKey', k),
  clear: () => kv.del('anthropicApiKey'),
};

/** GitHub token for dispatching workflows; IndexedDB only, like the API key. */
export const githubToken = {
  get: () => kv.get<string>('githubToken'),
  set: (k: string) => kv.set('githubToken', k),
  clear: () => kv.del('githubToken'),
};
