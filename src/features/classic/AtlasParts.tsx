import type { CSSProperties, ReactNode } from 'react';
import { dataUrl } from '../../lib/paths';
import { mapThumb } from './atlasNav';
import type { AtlasItem, AtlasMap, AtlasMob } from './types';

/** The frame colour behind every map render (the renders are flattened onto it). */
export const MAP_BG = '#1c140e';

/** An item's in-game icon (pixel art, kept sharp), or a lettered tile when there's no icon. */
export function ItemIcon({ item, size = 32 }: { item: AtlasItem; size?: number }) {
  if (!item.icon)
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-border-2 bg-surface-3 text-[9px] font-semibold text-ink-3" style={{ width: size, height: size }}>
        {item.name.slice(0, 2)}
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <img src={dataUrl(item.icon, 'public')} alt="" loading="lazy" className="max-h-full max-w-full" style={{ imageRendering: size % 32 === 0 ? 'pixelated' : undefined }} />
    </span>
  );
}

/** A monster's sprite fitted into a `box` px square, never scaled up. */
export function MobIcon({ mob, box = 32 }: { mob: AtlasMob; box?: number }) {
  return (
    <span className="inline-flex shrink-0 items-end justify-center" style={{ width: box, height: box }}>
      <img src={dataUrl(mob.icon, 'public')} alt="" loading="lazy" className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
    </span>
  );
}

/** A map's render, shrunk, in the dark map frame. */
export function MapThumb({ map, className = '', style }: { map: AtlasMap; className?: string; style?: CSSProperties }) {
  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-lg border border-border-2 ${className}`} style={{ background: MAP_BG, ...style }}>
      <img src={dataUrl(mapThumb(map.id), 'public')} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
    </span>
  );
}

/** A small outlined tag beside a map's name. */
export function Tag({ children, tone = 'muted', title }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn'; title?: string }) {
  const cls = tone === 'accent' ? 'border-accent/60 bg-surface-2 text-accent' : tone === 'warn' ? 'border-warn/50 bg-warn/10 text-warn' : 'border-border-2 text-ink-2';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none ${cls}`} title={title}>
      {children}
    </span>
  );
}
