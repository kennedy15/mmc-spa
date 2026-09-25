/**
 * AI mode: one Messages API request from the browser with the user's own key
 * (bring-your-own-key pattern; the SDK requires dangerouslyAllowBrowser).
 * Web search finds 2–4 reference pages; the answer is constrained to JSON.
 */
import Anthropic, { type APIError } from '@anthropic-ai/sdk';
import type { AiUsage, Draft, GenerateOptions } from './types';

const MODEL = 'claude-opus-5';
// Claude Opus 5 thinks by default and max_tokens caps thinking plus the answer,
// so leave room; only tokens actually generated are billed.
const MAX_TOKENS = 16000;
// Server-side web search can pause a long turn; resume it this many times at most.
const MAX_CONTINUATIONS = 3;
// List prices for the cost shown after a run: USD per million tokens, and per
// search. Claude Opus 4.8, the usual refusal fallback, is priced the same.
const PRICE = { input: 5, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5, output: 25, search: 0.01 };

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'buildType', 'biome', 'placement', 'lore', 'palette', 'scale', 'sourceLinks', 'imageUrls'],
  properties: {
    title: { type: 'string', description: 'Evocative name, 2–5 words' },
    buildType: { type: 'string', description: 'e.g. decorative point of interest, ruin, shrine, outpost, bridge, farm' },
    biome: { type: 'string' },
    placement: { type: 'string', description: 'Where in a survival world to put it, one sentence' },
    lore: { type: 'string', description: '3–5 sentences: who built it, why it was abandoned, one hook for a future build' },
    palette: { type: 'array', items: { type: 'string' }, description: '4–6 block names' },
    scale: { type: 'string', description: 'Rough footprint, e.g. 12×18, two storeys' },
    sourceLinks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } } },
    imageUrls: { type: 'array', items: { type: 'string' }, description: 'Direct image URLs found on those pages, if any; otherwise empty' },
  },
};

const SYSTEM = `You invent Minecraft survival build ideas for a small private server. Each idea is a single structure with a short backstory. Prefer decorative points of interest (ruins, shrines, outposts, bridges, docks, wayshrines, follies) over farms unless farms are allowed. Use web search (2–4 searches) on Planet Minecraft, r/Minecraftbuilds or GrabCraft to find real reference pages for the build type and cite them as sourceLinks with their real URLs; only list imageUrls that are direct image files you actually saw on those pages. Never invent URLs. Respond only with the JSON object.`;

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** Adds one response's billed usage to the running total for this generation. */
function addUsage(total: AiUsage, u: Anthropic.Beta.Messages.BetaUsage) {
  const write5m = u.cache_creation?.ephemeral_5m_input_tokens ?? u.cache_creation_input_tokens ?? 0;
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  total.inputTokens += u.input_tokens + write5m + write1h + read;
  total.outputTokens += u.output_tokens;
  total.searches += searches;
  total.usd += (u.input_tokens * PRICE.input + write5m * PRICE.cacheWrite5m + write1h * PRICE.cacheWrite1h + read * PRICE.cacheRead + u.output_tokens * PRICE.output) / 1e6 + searches * PRICE.search;
}

/** Runs one request, resuming if server-side web search pauses the turn; returns the final message. */
async function complete(client: Anthropic, params: Params, used: AiUsage, signal?: AbortSignal): Promise<Anthropic.Beta.Messages.BetaMessage> {
  let res = await client.beta.messages.create(params, { signal });
  addUsage(used, res.usage);
  for (let i = 0; res.stop_reason === 'pause_turn' && i < MAX_CONTINUATIONS; i++) {
    res = await client.beta.messages.create({ ...params, messages: [...params.messages, { role: 'assistant', content: res.content as Anthropic.Beta.Messages.BetaContentBlockParam[] }] }, { signal });
    addUsage(used, res.usage);
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this request. Try different options.');
  if (res.stop_reason === 'max_tokens') throw new Error('The answer was cut off before it finished. Try again.');
  if (res.stop_reason === 'pause_turn') throw new Error('The web search took too long to finish. Try again.');
  return res;
}

/** The answer text: text blocks after the last search step, so a preamble before the searches is left out. */
function answerText(content: Anthropic.Beta.Messages.BetaContentBlock[]): string {
  const lastStep = content.findLastIndex((b) => b.type !== 'text' && b.type !== 'thinking' && b.type !== 'redacted_thinking');
  const text = (blocks: Anthropic.Beta.Messages.BetaContentBlock[]) => blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return text(content.slice(lastStep + 1)) || text(content);
}

/** Aborting `signal` cancels the request in flight; the promise then rejects with APIUserAbortError. */
export async function generateAI(apiKey: string, opts: GenerateOptions, signal?: AbortSignal): Promise<{ draft: Draft; usage: AiUsage }> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0, searches: 0, usd: 0 };
  const constraints = [
    opts.biome ? `Biome: ${opts.biome}.` : 'Any biome.',
    opts.size ? `Size: ${opts.size}.` : '',
    opts.style ? `Style: ${opts.style}.` : '',
    opts.allowFarms ? 'Farms are allowed.' : 'No farms.',
    opts.exclude.length ? `Avoid anything close to these existing ideas: ${opts.exclude.slice(0, 40).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const user = `Generate one new build idea. ${constraints}`;

  const base: Params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
    messages: [{ role: 'user', content: user }],
  };

  let res: Anthropic.Beta.Messages.BetaMessage;
  try {
    // If a safety classifier declines, the API re-runs the request on its recommended fallback model.
    res = await complete(client, { ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { format: { type: 'json_schema', schema: SCHEMA } } }, usage, signal);
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    // Structured output may not combine with server tools everywhere; fall back to plain JSON in text.
    res = await complete(client, { ...base, system: SYSTEM + ' Output a single JSON object and nothing else.' }, usage, signal);
  }
  const text = answerText(res.content);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return an idea. Try again.');
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<Draft>;
  const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);
  const draft: Draft = {
    title: parsed.title ?? 'Untitled build',
    buildType: parsed.buildType ?? 'Decorative point of interest',
    biome: parsed.biome ?? opts.biome ?? '',
    placement: parsed.placement ?? '',
    lore: parsed.lore ?? '',
    palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 8) : [],
    scale: parsed.scale ?? '',
    sourceLinks: Array.isArray(parsed.sourceLinks) ? parsed.sourceLinks.filter((l) => l && isHttp(l.url)).slice(0, 4) : [],
    imageUrls: Array.isArray(parsed.imageUrls) ? parsed.imageUrls.filter(isHttp).slice(0, 6) : [],
  };
  return { draft, usage };
}

export function describeAiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check it in Settings.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the API; try again in a minute.';
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the Claude API. Check your connection and try again.';
  if (e instanceof Anthropic.InternalServerError) return `The Claude API is having trouble (error ${e.status}); try again in a minute.`;
  if (e instanceof Anthropic.APIError) return `API error ${e.status}: ${apiMessage(e)}`;
  if (e instanceof SyntaxError) return 'Claude returned an idea that could not be read. Try again.';
  return e instanceof Error ? e.message : String(e);
}

/** The API's own explanation (e.g. a low credit balance), without the status and raw JSON the SDK wraps it in. */
function apiMessage(e: APIError): string {
  const body = e.error as { error?: { message?: unknown } } | undefined;
  return typeof body?.error?.message === 'string' ? body.error.message : e.message;
}
