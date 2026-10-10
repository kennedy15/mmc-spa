import { createContext, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Full render and hover thumbnail of a map (public/classic/maps). */
export const mapImage = (id: number) => `classic/maps/${id}.webp`;
export const mapThumb = (id: number) => `classic/maps/t/${id}.webp`;

/** Set by MobSheetHost; opens the monster sheet for a monster ID. Does nothing outside a host. */
export const OpenMob = createContext<(id: number) => void>(() => {});
export const useOpenMob = () => useContext(OpenMob);

/**
 * Moving between explorer pages. Each map opened from the explorer counts one step deeper (router state), so Back
 * (the button, a right-click, or the browser's) returns one map at a time, then to the world map; a map opened
 * from a link or a reload has nothing behind it and goes back to its island's world map.
 */
export function useAtlasNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const depth = (location.state as { atlas?: number } | null)?.atlas ?? 0;
  return {
    depth,
    go: (id: number) => navigate(`/classic/map/${id}`, { state: { atlas: depth + 1 } }),
    back: (island: string) => {
      if (depth > 0) navigate(-1);
      else navigate(`/classic/map?island=${island}`);
    },
  };
}

/** Whether a right-click on `target` should go back rather than open the browser's menu: not on links, fields or selected text. */
export function rightClickGoesBack(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (el?.closest('a[href], input, textarea, select, [contenteditable="true"]')) return false;
  const sel = window.getSelection();
  return !sel || sel.isCollapsed;
}
