import { useEffect, useState } from 'react';
import { dataUrl } from '../../lib/paths';
import type { ClassicDoc, ClassicExpDoc, SkillLevelsDoc } from './types';

/** A hook for a JSON file under public/, fetched once and shared by every caller; a failed load is retried on the next call. */
function jsonFile<T>(file: string): () => { doc: T | null; error: string | null } {
  let doc: T | null = null;
  let loading: Promise<T> | null = null;
  const load = (): Promise<T> => {
    if (doc) return Promise.resolve(doc);
    loading ??= fetch(dataUrl(file, 'public'))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((d) => (doc = d))
      .finally(() => (loading = null));
    return loading;
  };
  return function useFile() {
    const [state, setState] = useState<{ doc: T | null; error: string | null }>({ doc, error: null });
    useEffect(() => {
      if (state.doc) return;
      let live = true;
      load().then(
        (d) => live && setState({ doc: d, error: null }),
        (e: unknown) => live && setState({ doc: null, error: e instanceof Error ? e.message : String(e) }),
      );
      return () => {
        live = false;
      };
    }, [state.doc]);
    return state;
  };
}

/** The Classic World guide data, or null while it loads; `error` is set if it couldn't load. */
export const useClassic = jsonFile<ClassicDoc>('classic.json');

/** Every build skill's per-level game text; only fetched once a skill sheet opens. */
export const useSkillLevels = jsonFile<SkillLevelsDoc>('classic/skill-levels.json');

/** Classic World's EXP table, for the character lookup. */
export const useClassicExp = jsonFile<ClassicExpDoc>('classic/exp-table.json');
