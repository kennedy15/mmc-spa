import { scaleThreshold } from 'd3-scale';

// One-hue ramp for "share of a level per day", validated as an ordinal ramp
// against the card surface (#131519): monotone lightness, first step >= 2:1.
export const HEAT = ['#713d19', '#a1521a', '#d0661a', '#ff7a1a', '#ff9e55'];
export const HEAT_LABEL = ['<0.5%', '0.5–1.5%', '1.5–3%', '3–6%', '6%+'];
export const heatColor = scaleThreshold<number, string>([0.005, 0.015, 0.03, 0.06], HEAT);

/** Color for the "Others" band when characters are folded together. */
export const OTHERS = '#4a4f5a';
