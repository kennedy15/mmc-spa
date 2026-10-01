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
  | 'bossing/presets.json'
  | 'bossing/applied-presets.json'
  | 'goals.json'
  | 'settings.json';

let folder: FileSystemDirectoryHandle | null = null;

export function setFolder(handle: FileSystemDirectoryHandle | null) {
  folder = handle;
}
export function hasFolder() {
  return folder != null;
}

/** A doc as the folder holds it: undefined when missing or unreadable, null when saved as null. */
async function readFolderDoc<T>(dir: FileSystemDirectoryHandle, name: DocName): Promise<T | null | undefined> {
  const text = await fs.readText(dir, name);
  if (text == null) return undefined;
  try {
    return JSON.parse(text) as T | null;
  } catch {
    return undefined;
  }
}

/**
 * The folder's copy, else IndexedDB's, else `fallback`. A doc saved as null
 * counts as missing unless `keepNull` (the presets doc, where null means "back
 * to the defaults" and must beat an older list kept elsewhere).
 */
export async function loadDoc<T>(name: DocName, fallback: T, keepNull = false): Promise<T> {
  const found = (v: T | null | undefined): v is T => v !== undefined && (keepNull || v !== null);
  if (folder) {
    const fromFolder = await readFolderDoc<T>(folder, name);
    if (found(fromFolder)) {
      await docs.set(name, fromFolder);
      return fromFolder;
    }
  }
  const fromIdb = await docs.get<T | null>(name);
  if (found(fromIdb)) {
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
