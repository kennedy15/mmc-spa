import { dataUrl } from '../../lib/paths';
import { fmtInt } from '../../app/format';
import { bySpawns, missGap } from './labels';
import type { GrindSpot, Monster } from './types';

/**
 * Spawn-dot colors for a spot's three most common monsters, validated as a categorical set on the
 * dark minimap frame (dataviz validator: lightness band, CVD and contrast all pass); the rest are grey.
 */
const DOTS = ['#d95926', '#3987e5', '#199e70'];
const OTHER = '#8a7d70';

/** A monster's in-game sprite (COT #2 data), scaled down to fit `box` px but never up. */
export function MobSprite({ monster, box = 40 }: { monster: Monster; box?: number }) {
  if (!monster.icon) return <span className="inline-block shrink-0" style={{ width: box, height: box }} />;
  return (
    <span className="inline-flex shrink-0 items-end justify-center" style={{ width: box, height: box }}>
      <img src={dataUrl(monster.icon, 'public')} alt="" loading="lazy" className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
    </span>
  );
}

/**
 * The in-game minimap with every spawn point: the three most common monsters in color, the rest grey,
 * and a legend with their counts. Scales with its column (up to 2x, pixel art kept sharp), dots placed by percent.
 */
export function SpotLayout({ spot, legend = true }: { spot: GrindSpot; legend?: boolean }) {
  const L = spot.layout;
  if (!L) return null;
  const ranked = bySpawns(spot);
  const color = new Map(ranked.slice(0, DOTS.length).map((r, i) => [r.index, DOTS[i]]));
  const others = ranked.slice(DOTS.length).filter((r) => r.count > 0);
  return (
    <figure className="min-w-0">
      {/* Up to 2x, and no taller than 260px, so tall maps don't push the card down. */}
      <div className="mx-auto rounded-lg border border-border-2 bg-[#1c140e] p-1.5" style={{ maxWidth: Math.min(L.width * 2, (260 * L.width) / L.height) + 14 }}>
        <div className="relative" style={{ aspectRatio: `${L.width} / ${L.height}` }}>
          <img src={dataUrl(L.image, 'public')} alt={`${spot.map} minimap`} width={L.width} height={L.height} loading="lazy" className="block h-full w-full" style={{ imageRendering: 'pixelated' }} />
          {L.spawns.map(([x, y, i], k) => (
            <span
              key={k}
              className="absolute size-[7px] -translate-x-1/2 -translate-y-full rounded-full ring-2 ring-[#1c140e]"
              style={{ left: `${Math.min(100, (x / L.width) * 100)}%`, top: `${Math.min(100, (y / L.height) * 100)}%`, background: color.get(i) ?? OTHER }}
            />
          ))}
        </div>
      </div>
      {legend && (
        <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-2">
          {ranked.slice(0, DOTS.length).map((r, i) =>
            r.count ? (
              <span key={r.index} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: DOTS[i] }} />
                {r.monster.name} <span className="text-ink-3 tabular">×{r.count}</span>
              </span>
            ) : null,
          )}
          {others.length > 0 && (
            <span className="inline-flex items-center gap-1" title={others.map((o) => `${o.monster.name} ×${o.count}`).join(', ')}>
              <span className="size-2 rounded-full" style={{ background: OTHER }} />
              {others.length} other <span className="text-ink-3 tabular">×{others.reduce((a, o) => a + o.count, 0)}</span>
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** The "+N Lv" tag's look, shared with the legend that explains it. */
export const MISS_TAG = 'inline-block shrink-0 rounded border border-warn/50 bg-warn/10 px-1 align-middle text-[10px] font-semibold leading-4 text-warn tabular';

/** "+N Lv" in the warn color: the monster is N levels above you (MISS_GAP or more), so your hits and spells will miss it more often. */
export function MissTag({ monster, gap }: { monster: Monster; gap: number }) {
  return (
    <span className={MISS_TAG} title={`${monster.name} is ${gap} levels above you: expect to miss it more often (accuracy drops against higher-level monsters, spells included)`}>
      +{gap} Lv<span className="sr-only"> above you, expect misses</span>
    </span>
  );
}

/** A compact monster line: sprite, name, level, HP and EXP; with your `level`, a monster MISS_GAP or more above you is tagged. */
export function MobRow({ monster, count, level }: { monster: Monster; count?: number; level?: number | null }) {
  const gap = missGap(monster, level);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <MobSprite monster={monster} box={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">
          {monster.name}
          {count != null && count > 0 && <span className="ml-1 text-xs font-normal text-ink-3 tabular">×{count}</span>}
        </div>
        <div className="text-[11px] text-ink-3 tabular">
          Lv {monster.level}
          {gap > 0 && (
            <>
              {' '}
              <MissTag monster={monster} gap={gap} />
            </>
          )}{' '}
          · {fmtInt(monster.hp)} HP · {monster.exp == null ? 'no EXP' : `${fmtInt(monster.exp)} EXP`}
        </div>
      </div>
    </div>
  );
}
