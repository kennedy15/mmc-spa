/**
 * AI mode: one Messages API request from the browser with the user's own key
 * (bring-your-own-key pattern; the SDK requires dangerouslyAllowBrowser).
 * Web search finds 2–4 reference pages; the answer is constrained to JSON.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Draft, GenerateOptions } from './types';

const MODEL = 'claude-opus-5';

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

export async function generateAI(apiKey: string, opts: GenerateOptions): Promise<Draft> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
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

  const base: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
    messages: [{ role: 'user', content: user }],
  };

  let text = '';
  try {
    const res = await client.messages.create({ ...base, output_config: { format: { type: 'json_schema', schema: SCHEMA } } });
    text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    // Structured output may not combine with server tools everywhere; fall back to plain JSON in text.
    const res = await client.messages.create({ ...base, system: SYSTEM + ' Output a single JSON object and nothing else.' });
    text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(json) as Partial<Draft>;
  const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);
  return {
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
}

export function describeAiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check it in Settings.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the API; try again in a minute.';
  if (e instanceof Anthropic.APIError) return `API error ${e.status ?? ''}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
