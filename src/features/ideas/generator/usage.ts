/**
 * The model the AI generator runs on, what it costs, and how a generation's
 * cost reads on the page. Kept out of ai.ts so the board can show prices and
 * past costs without loading the SDK.
 */
import { fmtInt } from '../../../app/format';
import type { AiUsage, Idea } from '../../../lib/types';

export const AI_MODEL = 'claude-opus-5-5';
// Claude Opus 5.5's default, stated so a change to the default can't quietly change what a run costs.
export const AI_EFFORT = 'medium';

/** List prices in USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, September 2026). */
interface Rates {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
}
const OPUS_5: Rates = { input: 5, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5, output: 25 };
const RATES: Record<string, Rates> = {
  'claude-opus-5-5': { input: 4, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2, output: 20 },
  // Where a refusal fallback is likely to land.
  'claude-opus-5': OPUS_5,
  'claude-opus-4-8': OPUS_5,
};
/** A model not listed is priced like Claude Opus 5, the dearest a fallback is likely to be. */
export const ratesFor = (model: string | null | undefined): Rates => RATES[model ?? AI_MODEL] ?? OPUS_5;
export const SEARCH_USD = 0.01;

const MODEL_NAMES: Record<string, string> = { 'claude-opus-5-5': 'Opus 5.5', 'claude-opus-5': 'Opus 5', 'claude-opus-4-8': 'Opus 4.8' };
const modelName = (id: string) => MODEL_NAMES[id] ?? id;

export const emptyUsage = (): AiUsage => ({ usd: 0, model: AI_MODEL, effort: AI_EFFORT, models: [], inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, thinkingTokens: 0, searches: 0, steps: 0, requests: 0 });

/** Visual tokens for an image Claude reads at full size: one per 28×28 patch. Prompt images stay under the size where it scales them down. */
export const imageTokens = (width: number, height: number) => Math.ceil(width / 28) * Math.ceil(height / 28);

/** 0.0164 → "1.6¢", 0.14 → "14¢", 1.2 → "$1.20". */
export function fmtUsd(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  const cents = usd * 100;
  if (cents < 0.1) return 'under 0.1¢';
  return cents < 9.95 ? `${cents.toFixed(1)}¢` : `${Math.round(cents)}¢`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

/** "about 14¢" and the breakdown behind it. Tolerates records from older or imported boards. */
export function describeUsage(u: AiUsage): { cost: string; detail: string } {
  const models = u.models?.length ? u.models : [u.model];
  const cache = [u.cacheReadTokens > 0 && `${fmtInt(u.cacheReadTokens)} from cache`, u.cacheWriteTokens > 0 && `${fmtInt(u.cacheWriteTokens)} written to cache`].filter(Boolean).join(', ');
  const detail = [
    `${models.map(modelName).join(' → ')}${models.length > 1 ? ' (refusal fallback)' : ''}, ${u.effort} effort`,
    `${plural(u.searches, 'search', 'searches')} in ${plural(u.steps, 'step')}${u.requests > 1 ? `, resumed ${u.requests - 1}×` : ''}`,
    `${fmtInt(u.inputTokens)} tokens in${cache ? ` (${cache})` : ''}`,
    `${fmtInt(u.outputTokens)} out (${fmtInt(u.thinkingTokens)} thinking)`,
    u.output === 'prompt' ? 'JSON by prompt' : 'structured output',
  ].join(' · ');
  return { cost: `about ${fmtUsd(u.usd)}`, detail };
}

/** The newest cards generated at the current model and effort, whose costs predict the next one. */
export function recentUsage(ideas: Idea[], limit = 10): AiUsage[] {
  return ideas
    .filter((i) => i.aiUsage?.model === AI_MODEL && i.aiUsage.effort === AI_EFFORT)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((i) => i.aiUsage!);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** What a run is likely to cost, from what recent ones did. */
export function costHint(recent: AiUsage[]): string {
  if (!recent.length) return 'Uses your API key: a few web searches plus the write-up, roughly 10–30¢ until your cards record real costs.';
  if (recent.length === 1) return `Uses your API key. Your last AI idea cost ${fmtUsd(recent[0].usd)}.`;
  const usd = recent.map((u) => u.usd);
  return `Uses your API key. Your last ${recent.length} AI ideas cost ${fmtUsd(Math.min(...usd))}–${fmtUsd(Math.max(...usd))}, ${fmtUsd(mean(usd))} on average.`;
}

/**
 * What attached images add. Without prompt caching every step of the search
 * loop reads the whole prompt again, images included, at the full input price.
 */
export function imageHint(images: { width: number; height: number }[], recent: AiUsage[]): string {
  if (!images.length) return "Screenshots of the spot, or builds you like. They're added to the card too.";
  const tokens = images.reduce((sum, im) => sum + imageTokens(im.width, im.height), 0);
  const perRead = (tokens * ratesFor(AI_MODEL).input) / 1e6;
  const steps = recent.length ? Math.round(mean(recent.map((u) => u.steps))) : 0;
  const total = steps ? ` (${steps} per idea lately: about ${fmtUsd(perRead * steps)} in all)` : '';
  return `About ${fmtInt(tokens)} tokens, ${fmtUsd(perRead)} each time Claude reads them, which it does at every search step${total}. They're added to the card too.`;
}
