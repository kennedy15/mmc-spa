import { scaleThreshold } from 'd3-scale';

// Thresholds for "share of a level per day". Each theme's ramp (Palette.heat in
// src/app/theme.ts) is one hue, validated as an ordinal ramp against its card
// surface: monotone lightness, first step >= 2:1.
export const HEAT_LABEL = ['<0.5%', '0.5–1.5%', '1.5–3%', '3–6%', '6%+'];
export const heatScale = (ramp: readonly string[]) => scaleThreshold<number, string>([0.005, 0.015, 0.03, 0.06], [...ramp]);
