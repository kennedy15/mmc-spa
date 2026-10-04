import { useEffect, useState } from 'react';
import { dataUrl } from '../../lib/paths';
import type { ClassicDoc } from './types';

let doc: ClassicDoc | null = null;
let loading: Promise<ClassicDoc> | null = null;

/** Loads public/classic.json once; a failed load is retried on the next call. */
function loadClassic(): Promise<ClassicDoc> {
  if (doc) return Promise.resolve(doc);
  loading ??= fetch(dataUrl('classic.json', 'public'))
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<ClassicDoc>;
    })
    .then((d) => (doc = d))
    .finally(() => (loading = null));
  return loading;
}

/** The Classic World guide data, or null while it loads; `error` is set if it couldn't load. */
export function useClassic(): { doc: ClassicDoc | null; error: string | null } {
  const [state, setState] = useState<{ doc: ClassicDoc | null; error: string | null }>({ doc, error: null });
  useEffect(() => {
    if (state.doc) return;
    let live = true;
    loadClassic().then(
      (d) => live && setState({ doc: d, error: null }),
      (e: unknown) => live && setState({ doc: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [state.doc]);
  return state;
}
