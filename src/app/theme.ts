import { useSyncExternalStore } from 'react';

/**
 * Two color themes. Ember is the original look (dark greys, orange accent);
 * Aurora is true black with a purple accent and greens for gains and activity.
 * CSS colors come from the tokens in index.css (html[data-theme] swaps them);
 * the values below are for places that need a color as a value: SVG attributes
 * in recharts, d3 scales and per-series palettes.
 */
export type ThemeId = 'ember' | 'aurora';

export interface Palette {
  accent: string;
  /** Categorical series colors, fixed order, never cycled. */
  series: readonly string[];
  axis: string;
  /** Hover cursor line and bar-hover fill in recharts. */
  cursor: string;
  cursorFill: string;
  /** Card surface, used as the gap stroke between stacked bars. */
  surface: string;
  /** The folded "Others" band or node. */
  others: string;
  /** Ordinal activity ramp, low to high (see heat.ts). */
  heat: readonly string[];
}

export const PALETTES: Record<ThemeId, Palette> = {
  ember: {
    accent: '#ff7a1a',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    axis: '#6b717d',
    cursor: '#343945',
    cursorFill: '#1b1e24',
    surface: '#131519',
    others: '#4a4f5a',
    // One-hue ramp validated against the card surface: monotone lightness, first step >= 2:1.
    heat: ['#713d19', '#a1521a', '#d0661a', '#ff7a1a', '#ff9e55'],
  },
  aurora: {
    accent: '#9c83d4',
    // Muted (chroma ×0.82, floor 0.105) and validated on #0b0b0c: worst adjacent CVD ΔE 13.9, normal-vision 16.2, all >= 3:1. Green first so it never sits next to the purple accent.
    series: ['#539963', '#8a78c0', '#ab3865', '#c66bbf', '#698237', '#5f86c6', '#b08d3d', '#af74d8'],
    axis: '#6f6f79',
    cursor: '#2e2e34',
    cursorFill: '#141416',
    surface: '#0b0b0c',
    others: '#3a3a42',
    heat: ['#265133', '#397049', '#508f62', '#6baf7e', '#8dce9e'],
  },
};

export const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'ember', name: 'Ember' },
  { id: 'aurora', name: 'Aurora' },
];

const KEY = 'mt.theme';
const listeners = new Set<() => void>();

function stored(): ThemeId {
  try {
    return localStorage.getItem(KEY) === 'aurora' ? 'aurora' : 'ember';
  } catch {
    return 'ember';
  }
}

let current: ThemeId = stored();
// index.html sets this before first paint; repeat it in case storage was blocked there.
document.documentElement.dataset.theme = current;

export function setTheme(id: ThemeId) {
  current = id;
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Private windows can refuse storage; the theme still applies for this visit.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme(): ThemeId {
  return useSyncExternalStore(subscribe, () => current);
}

export function usePalette(): Palette {
  return PALETTES[useTheme()];
}
