/**
 * AI mode: one Messages API request from the browser with the user's own key
 * (bring-your-own-key pattern; the SDK requires dangerouslyAllowBrowser).
 * The player's images ride along in the prompt, web search finds reference
 * pages, and the answer is constrained to JSON.
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
  required: ['title', 'concept', 'buildType', 'biome', 'placement', 'lore', 'palette', 'scale', 'sourceLinks'],
  properties: {
    title: { type: 'string', description: 'Evocative name, 2–5 words' },
    concept: { type: 'string', description: 'One sentence saying what to build; for a farm + build, the farm and the build around it' },
    buildType: { type: 'string', description: 'Short category for filtering, 1–3 words, e.g. Tree farm, Witch farm, Castle, Shrine' },
    biome: { type: 'string' },
    placement: { type: 'string', description: 'Where to build it: biome, terrain and what to look for; 1–2 sentences' },
    lore: { type: 'string', description: '3–5 sentences' },
    palette: { type: 'array', items: { type: 'string' }, description: 'Exactly 6 Minecraft block IDs, main block first, e.g. stripped_mangrove_log' },
    scale: { type: 'string', description: 'Rough footprint, e.g. 40×40, 30 tall' },
    sourceLinks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } } },
  },
};

const SYSTEM = `You come up with Minecraft survival build ideas for a small private server where two friends play. Each idea should make them want to build it and feel like part of their world.

An idea is one of two kinds:
- Farm + build: a working farm they will use, plus a build that houses, hides or decorates it, e.g. a mangrove tree farm covered by pixel art of a stripped mangrove log. Choose a proven farm design and link a tutorial for it.
- Build: a build with a story and no farm, e.g. a vampire castle on the snowy peaks.

Size sets the scope. Small is an evening or two (a witch farm; a wayside shrine), medium a weekend (a mangrove tree farm with its pixel-art cover; a watermill), large a long project (draining an ocean monument, a perimeter witch farm; a castle town).

Write lore that gives the place a history and ties it to the world around it, ending on a hook for a future build. Suggest where to build it. Give a palette of exactly 6 blocks as Minecraft block IDs, main block first, in the spirit of blockpalettes.com. Use web search (1–3 searches) for real reference pages, such as a tutorial for the farm or similar builds on Planet Minecraft or r/Minecraftbuilds, and cite their real URLs. Never invent URLs. If the player attached images or a note, build the idea around them.`;

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
  const images = opts.images ?? [];
  const brief = [
    `Kind: ${opts.kind === 'farm' ? 'farm + build' : 'build (no farm)'}.`,
    `Size: ${opts.size}.`,
    images.length ? `The ${images.length === 1 ? 'image above is' : `${images.length} images above are`} from the player: their world or builds they like.` : '',
    opts.note?.trim() ? `Player's note: ${opts.note.trim()}` : '',
    opts.exclude.length ? `Avoid anything close to these existing ideas: ${opts.exclude.slice(0, 40).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...images.map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: `Generate one new build idea.\n${brief}` },
  ];

  const base: Params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
    messages: [{ role: 'user', content }],
  };

  let res: Anthropic.Beta.Messages.BetaMessage;
  try {
    // If a safety classifier declines, the API re-runs the request on its recommended fallback model.
    res = await complete(client, { ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { format: { type: 'json_schema', schema: SCHEMA } } }, usage, signal);
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    // Structured output may not combine with server tools everywhere; fall back to plain JSON in text.
    res = await complete(client, { ...base, system: `${SYSTEM}\n\nReply with a single JSON object matching this JSON schema and nothing else: ${JSON.stringify(SCHEMA)}` }, usage, signal);
  }
  const text = answerText(res.content);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return an idea. Try again.');
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<Draft>;
  const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);
  // Block IDs (stripped_mangrove_log) are shown as names (stripped mangrove log); the card turns them back into IDs for links.
  const blockName = (id: string) => id.replace(/^minecraft:/, '').replace(/_/g, ' ').trim();
  const draft: Draft = {
    title: parsed.title ?? 'Untitled build',
    concept: parsed.concept ?? '',
    buildType: parsed.buildType ?? (opts.kind === 'farm' ? 'Farm' : 'Build'),
    biome: parsed.biome ?? '',
    placement: parsed.placement ?? '',
    lore: parsed.lore ?? '',
    palette: Array.isArray(parsed.palette) ? parsed.palette.filter((b) => typeof b === 'string').map(blockName).filter(Boolean).slice(0, 8) : [],
    scale: parsed.scale ?? '',
    sourceLinks: Array.isArray(parsed.sourceLinks) ? parsed.sourceLinks.filter((l) => l && isHttp(l.url)).slice(0, 4) : [],
    imageUrls: [],
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
