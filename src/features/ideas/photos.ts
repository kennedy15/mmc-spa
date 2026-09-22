import { useEffect, useState } from 'react';
import { loadPhoto } from '../../lib/storage/persist';

const cache = new Map<string, string>();

/** Object URL for a locally stored photo, or null while loading / missing. */
export function usePhotoUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(id ? (cache.get(id) ?? null) : null);
  useEffect(() => {
    if (!id) return;
    const hit = cache.get(id);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    void loadPhoto(id).then((blob) => {
      if (!alive || !blob) return;
      const u = URL.createObjectURL(blob);
      cache.set(id, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function forgetPhotoUrl(id: string) {
  const u = cache.get(id);
  if (u) URL.revokeObjectURL(u);
  cache.delete(id);
}
