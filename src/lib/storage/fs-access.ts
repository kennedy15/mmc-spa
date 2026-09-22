/**
 * File System Access API wrapper. Chrome/Edge support writable directory
 * handles; Firefox/Safari do not, in which case `supported` is false and the
 * app falls back to IndexedDB + export/import.
 */
import { kv } from './idb';

const HANDLE_KEY = 'dataFolderHandle';

type DirHandle = FileSystemDirectoryHandle;

interface PermissionCapable {
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickFolder(): Promise<DirHandle> {
  const picker = (window as unknown as { showDirectoryPicker: (o: { mode: 'readwrite'; id: string }) => Promise<DirHandle> }).showDirectoryPicker;
  const handle = await picker({ mode: 'readwrite', id: 'maple-tracker' });
  await kv.set(HANDLE_KEY, handle);
  return handle;
}

export async function storedHandle(): Promise<DirHandle | undefined> {
  return kv.get<DirHandle>(HANDLE_KEY);
}

export async function forgetFolder() {
  await kv.del(HANDLE_KEY);
}

/** 'granted' | 'prompt' | 'denied'. With `request`, asks the user (needs a user gesture). */
export async function permissionState(handle: DirHandle, request = false): Promise<PermissionState> {
  const h = handle as unknown as PermissionCapable;
  const opts = { mode: 'readwrite' as const };
  const q = (await h.queryPermission?.(opts)) ?? 'prompt';
  if (q === 'granted' || !request) return q;
  return (await h.requestPermission?.(opts)) ?? 'denied';
}

async function dirFor(root: DirHandle, relPath: string, create: boolean): Promise<{ dir: DirHandle; file: string } | null> {
  const parts = relPath.split('/').filter(Boolean);
  const file = parts.pop()!;
  let dir = root;
  for (const p of parts) {
    try {
      dir = await dir.getDirectoryHandle(p, { create });
    } catch {
      return null;
    }
  }
  return { dir, file };
}

export async function readText(root: DirHandle, relPath: string): Promise<string | null> {
  const r = await dirFor(root, relPath, false);
  if (!r) return null;
  try {
    const fh = await r.dir.getFileHandle(r.file);
    return await (await fh.getFile()).text();
  } catch {
    return null;
  }
}

export async function readJson<T>(root: DirHandle, relPath: string): Promise<T | null> {
  const t = await readText(root, relPath);
  if (t == null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export async function readBlob(root: DirHandle, relPath: string): Promise<Blob | null> {
  const r = await dirFor(root, relPath, false);
  if (!r) return null;
  try {
    return await (await r.dir.getFileHandle(r.file)).getFile();
  } catch {
    return null;
  }
}

export async function writeFile(root: DirHandle, relPath: string, data: string | Blob): Promise<void> {
  const r = await dirFor(root, relPath, true);
  if (!r) throw new Error(`Cannot create folder for ${relPath}`);
  const fh = await r.dir.getFileHandle(r.file, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

export async function writeJson(root: DirHandle, relPath: string, value: unknown): Promise<void> {
  await writeFile(root, relPath, JSON.stringify(value, null, 2) + '\n');
}

export async function exists(root: DirHandle, relPath: string): Promise<boolean> {
  const r = await dirFor(root, relPath, false);
  if (!r) return false;
  try {
    await r.dir.getFileHandle(r.file);
    return true;
  } catch {
    return false;
  }
}

export async function removeFile(root: DirHandle, relPath: string): Promise<void> {
  const r = await dirFor(root, relPath, false);
  if (!r) return;
  try {
    await r.dir.removeEntry(r.file);
  } catch {
    /* already gone */
  }
}
