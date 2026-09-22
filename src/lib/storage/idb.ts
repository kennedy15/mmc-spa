import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface TrackerDB extends DBSchema {
  kv: { key: string; value: unknown };
  docs: { key: string; value: unknown };
  photos: { key: string; value: Blob };
}

let dbp: Promise<IDBPDatabase<TrackerDB>> | null = null;

export function db(): Promise<IDBPDatabase<TrackerDB>> {
  if (!dbp) {
    dbp = openDB<TrackerDB>('maple-tracker', 1, {
      upgrade(d) {
        d.createObjectStore('kv');
        d.createObjectStore('docs');
        d.createObjectStore('photos');
      },
    });
  }
  return dbp;
}

export const kv = {
  async get<T>(key: string): Promise<T | undefined> { return (await (await db()).get('kv', key)) as T | undefined; },
  async set(key: string, value: unknown) { await (await db()).put('kv', value, key); },
  async del(key: string) { await (await db()).delete('kv', key); },
};

export const docs = {
  async get<T>(key: string): Promise<T | undefined> { return (await (await db()).get('docs', key)) as T | undefined; },
  async set(key: string, value: unknown) { await (await db()).put('docs', value, key); },
  async del(key: string) { await (await db()).delete('docs', key); },
};

export const photoStore = {
  async get(id: string): Promise<Blob | undefined> { return (await db()).get('photos', id); },
  async set(id: string, blob: Blob) { await (await db()).put('photos', blob, id); },
  async del(id: string) { await (await db()).delete('photos', id); },
};
