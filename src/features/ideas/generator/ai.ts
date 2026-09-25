/**
 * AI mode: one Messages API request from the browser with the user's own key
 * (bring-your-own-key pattern; the SDK requires dangerouslyAllowBrowser).
 * The player's images ride along in the prompt, web search finds reference
 * pages, and the answer is constrained to JSON.
 */
import Anthropic, { type APIError } from '@anthropic-ai/sdk';
import { kv } from '../../../lib/storage/idb';
import type { AiUsage } from '../../../lib/types';
import type { Draft, GenerateOptions } from './types';
import { AI_EFFORT, AI_MODEL, SEARCH_USD, ratesFor } from './usage';

// Claude Opus 5.5 always thinks and max_tokens caps thinking plus the answer,
// so leave room; only tokens actually generated are billed.
const MAX_TOKENS = 16000;
// Server-side web search can pause a long turn; resume it this many times at most.
const MAX_CONTINUATIONS = 3;
const WEB_SEARCH = 'web_search_20260209';
// Anthropic's docs don't say whether structured output works alongside web search.
// The first run that gets through settles it for this model and tool, and is remembered.
const JSON_MODE_KEY = `aiJsonMode:${AI_MODEL}:${WEB_SEARCH}`;
type JsonMode = NonNullable<AiUsage['output']>;

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'concept', 'buildType', 'biome', 'placement', 'lore', 'palette', 'scale', 'sourceLinks', 'buildsOn', 'location'],
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
    buildsOn: { type: 'integer', description: 'Number of the listed build this follows up on, or 0' },
    location: {
      anyOf: [{ type: 'object', additionalProperties: false, required: ['x', 'z'], properties: { x: { type: 'integer' }, z: { type: 'integer' } } }, { type: 'null' }],
      description: 'x and z of the real place chosen from their world, or null when none were listed',
    },
  },
};

const SYSTEM = `You come up with Minecraft survival build ideas for a small private Java Edition server where two friends play, so farm designs and tutorials must work on Java. Each idea should make them want to build it and feel like part of their world.

An idea is one of two kinds:
- Farm + build: a working farm they will use, plus a build that houses, hides or decorates it, e.g. a mangrove tree farm covered by pixel art of a stripped mangrove log. Choose a proven farm design and link a tutorial for it.
- Build: a build with a story and no farm, e.g. a vampire castle on the snowy peaks.

Size sets the scope. Small is an evening or two (a witch farm; a wayside shrine), medium a weekend (a mangrove tree farm with its pixel-art cover; a watermill), large a long project (draining an ocean monument, a perimeter witch farm; a castle town).

Write lore that gives the place a history and ties it to the world around it, ending on a hook for a future build. Suggest where to build it. Give a palette of exactly 6 blocks as Minecraft block IDs, main block first, in the spirit of blockpalettes.com. Use web search (1–3 searches) for real reference pages, such as a tutorial for the farm or similar builds on Planet Minecraft or r/Minecraftbuilds, and cite their real URLs. Never invent URLs. If the player attached images or a note, build the idea around them.

When the request lists their builds and asks for a follow-up, make the idea extend, protect, supply or connect one of them (a witch farm gets a perimeter; a castle gets a village and walls), carry its story on in the lore, place it close by, and set buildsOn to that build's number; otherwise set buildsOn to 0. When the request lists real places in their world, pick the one that suits the idea, set location to its x and z, and mention them in placement. Never make up coordinates; use null when no places are listed.`;

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/**
 * Adds one reply's billed usage to the generation's total. `usage.iterations` has an
 * entry per model pass (each step of the search loop, and an attempt a model declined
 * before a refusal fallback took over), so each pass is priced at its own model's rates;
 * one that doesn't name its model is priced as `model`, the model that answered.
 */
function addUsage(total: AiUsage, u: Anthropic.Beta.Messages.BetaUsage, model: string) {
  const passes = u.iterations?.length ? u.iterations : [{ ...u, model }];
  for (const p of passes) {
    const ran = ('model' in p && p.model) || model;
    const r = ratesFor(ran);
    const write5m = p.cache_creation?.ephemeral_5m_input_tokens ?? p.cache_creation_input_tokens ?? 0;
    const write1h = p.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const read = p.cache_read_input_tokens ?? 0;
    total.inputTokens += p.input_tokens + write5m + write1h + read;
    total.cacheWriteTokens += write5m + write1h;
    total.cacheReadTokens += read;
    total.outputTokens += p.output_tokens;
    total.usd += (p.input_tokens * r.input + write5m * r.cacheWrite5m + write1h * r.cacheWrite1h + read * r.cacheRead + p.output_tokens * r.output) / 1e6;
    if (total.models.at(-1) !== ran) total.models.push(ran);
  }
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  total.searches += searches;
  total.usd += searches * SEARCH_USD;
  total.thinkingTokens += u.output_tokens_details?.thinking_tokens ?? 0;
  total.steps += passes.length;
  total.requests += 1;
}

/** Runs one request, resuming if server-side web search pauses the turn; returns the final message. */
async function complete(client: Anthropic, params: Params, used: AiUsage, signal?: AbortSignal): Promise<Anthropic.Beta.Messages.BetaMessage> {
  let res = await client.beta.messages.create(params, { signal });
  addUsage(used, res.usage, res.model);
  for (let i = 0; res.stop_reason === 'pause_turn' && i < MAX_CONTINUATIONS; i++) {
    res = await client.beta.messages.create({ ...params, messages: [...params.messages, { role: 'assistant', content: res.content as Anthropic.Beta.Messages.BetaContentBlockParam[] }] }, { signal });
    addUsage(used, res.usage, res.model);
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

/**
 * Adds to `usage` as each reply arrives, so a run that fails after one still shows what it cost.
 * Aborting `signal` cancels the request in flight; the promise then rejects with APIUserAbortError.
 */
export async function generateAI(apiKey: string, opts: GenerateOptions, usage: AiUsage, signal?: AbortSignal): Promise<Draft> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const images = opts.images ?? [];
  const followUp = opts.followUp ?? [];
  const builds = followUp.map((b, i) => `${i + 1}. ${b.title} (${b.status}${b.coords ? `, at ${b.coords.x}, ${b.coords.z}` : ''}): ${[b.concept, b.lore.slice(0, 400)].filter(Boolean).join(' ')}`).join('\n');
  const brief = [
    `Kind: ${opts.kind === 'farm' ? 'farm + build' : 'build (no farm)'}.`,
    `Size: ${opts.size}.`,
    images.length ? `The ${images.length === 1 ? 'image above is' : `${images.length} images above are`} from the player: their world or builds they like.` : '',
    opts.note?.trim() ? `Player's note: ${opts.note.trim()}` : '',
    followUp.length ? `Make it a follow-up to ${followUp.length === 1 ? 'this build of theirs' : 'whichever of these builds of theirs it fits best'}:\n${builds}` : '',
    opts.world ?? '',
    opts.exclude.length ? `Avoid anything close to these existing ideas: ${opts.exclude.slice(0, 40).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...images.map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: `Generate one new build idea.\n${brief}` },
  ];

  const params = (json: JsonMode): Params => ({
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    // If a safety classifier declines, the API re-runs the request on the model it recommends for that kind of refusal.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: json === 'structured' ? SYSTEM : `${SYSTEM}\n\nReply with a single JSON object matching this JSON schema and nothing else: ${JSON.stringify(SCHEMA)}`,
    tools: [{ type: WEB_SEARCH, name: 'web_search', max_uses: 4 }],
    output_config: json === 'structured' ? { effort: AI_EFFORT, format: { type: 'json_schema', schema: SCHEMA } } : { effort: AI_EFFORT },
    messages: [{ role: 'user', content }],
  });

  const known = await kv.get<JsonMode>(JSON_MODE_KEY).catch(() => undefined);
  let json: JsonMode = known ?? 'structured';
  let res: Anthropic.Beta.Messages.BetaMessage;
  try {
    res = await complete(client, params(json), usage, signal);
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    if (known) {
      // Something else is wrong (a low credit balance, an unreadable image). Check structured output again next time, in case the API changed.
      if (known === 'structured') await kv.del(JSON_MODE_KEY).catch(() => {});
      throw e;
    }
    // Structured output may not combine with web search, or something else is wrong with the
    // request. The same request with the schema in the prompt tells them apart: if it goes
    // through, structured output was the problem; if it fails too, the first error is the one to show.
    json = 'prompt';
    try {
      res = await complete(client, params(json), usage, signal);
    } catch (e2) {
      throw e2 instanceof Anthropic.BadRequestError ? e : e2;
    }
  }
  usage.output = json;
  if (!known) await kv.set(JSON_MODE_KEY, json).catch(() => {});
  const text = answerText(res.content);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return an idea. Try again.');
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<Omit<Draft, 'coords'>> & { location?: { x?: unknown; z?: unknown } | null };
  const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);
  const loc = parsed.location;
  const buildsOn = parsed.buildsOn;
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
    buildsOn: Number.isInteger(buildsOn) && buildsOn! >= 1 && buildsOn! <= followUp.length ? buildsOn! : 0,
    // Only coordinates the player's world actually listed; without a scan there is nothing real to point at.
    coords: opts.world && loc && Number.isInteger(loc.x) && Number.isInteger(loc.z) ? { x: loc.x as number, z: loc.z as number } : undefined,
  };
  return draft;
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
