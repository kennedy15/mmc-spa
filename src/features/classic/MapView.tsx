import { useState } from 'react';
import { Segmented } from '../../app/ui';
import { dataUrl } from '../../lib/paths';
import type { GrindSpot, WorldMap, WorldMapSpot } from './types';

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Keeps a label centred on its marker, but pulls it inward near the map's left and right edges. */
const shift = (x: number, width: number) => (x / width < 0.18 ? '-12%' : x / width > 0.82 ? '-88%' : '-50%');

/**
 * A grinding spot on the in-game world map (Classic World COT #2 art and markers).
 * Every marker is drawn; the spot's own marker pulses in the accent with its name.
 * Other world maps can be browsed with the tabs.
 */
export function MapView({ maps, spot }: { maps: WorldMap[]; spot: GrindSpot }) {
  const home = spot.place?.worldMap ?? maps[0]?.id;
  const [shown, setShown] = useState(home);
  const [hover, setHover] = useState<number | null>(null);
  const wm = maps.find((m) => m.id === shown) ?? maps[0];
  if (!wm) return null;
  const target = spot.place?.worldMap === wm.id ? spot.place.spot : null;
  const marker = target != null ? wm.spots[target] : null;
  const homeMap = maps.find((m) => m.id === home);
  const peek = hover != null && hover !== target ? wm.spots[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={wm.id}
          options={maps.map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => {
            setShown(id);
            setHover(null);
          }}
          label="World map"
        />
        {spot.available !== 'launch' && <span className="rounded-md border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] font-medium text-warn">{spot.available === 'cot2' ? 'Second test only' : 'Not at launch yet'}</span>}
      </div>

      <figure className="relative mx-auto max-w-[760px] overflow-hidden rounded-xl border border-border-2 bg-bg select-none" onMouseLeave={() => setHover(null)}>
        <img src={dataUrl(wm.image, 'public')} width={wm.width} height={wm.height} alt={`${wm.name} world map`} className="block h-auto w-full" draggable={false} />
        {wm.spots.map((s, i) =>
          i === target ? null : (
            <span key={i} className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ left: pct(s.x, wm.width), top: pct(s.y, wm.height) }} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <span className={`block rounded-full border border-black/70 bg-white/90 shadow ${s.type === 0 ? 'size-2.5' : 'size-2'} ${hover === i ? 'ring-2 ring-white/60' : ''}`} />
            </span>
          ),
        )}
        {marker && (
          <>
            <span className="pointer-events-none absolute flex size-5 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(marker.x, wm.width), top: pct(marker.y, wm.height) }}>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
              <span className="relative m-auto inline-flex size-3.5 rounded-full border-2 border-black/80 bg-accent" />
            </span>
            <Label spot={marker} wm={wm} text={spot.map} accent />
          </>
        )}
        {peek && <Label spot={peek} wm={wm} text={peek.names.length > 3 ? `${peek.names.slice(0, 3).join(', ')} +${peek.names.length - 3}` : peek.names.join(', ')} />}
      </figure>

      {marker ? (
        <div className="mt-3 text-sm text-ink-2">
          {marker.names.length > 1 ? (
            <>
              This marker stands for {marker.names.length} maps in game:
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {marker.names.map((n) => (
                  <span key={n} className={`rounded-md border px-1.5 py-0.5 text-xs ${n === spot.map ? 'border-accent/60 bg-accent/10 text-accent font-medium' : 'border-border-2 text-ink-3'}`}>
                    {n}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>The marker is {spot.map} itself.</>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          {spot.map} is on the {homeMap?.name ?? 'other'} map.{' '}
          {homeMap && (
            <button type="button" className="text-accent hover:underline cursor-pointer" onClick={() => setShown(homeMap.id)}>
              Show it
            </button>
          )}
        </p>
      )}
      <p className="mt-3 text-[11px] text-ink-3">
        Hover a marker for the maps it covers. Map art and markers are from the Classic World test data on{' '}
        <a href="https://maplestory.io/" target="_blank" rel="noreferrer" className="hover:text-accent">
          maplestory.io
        </a>
        .
      </p>
    </div>
  );
}

/** A name tag over a marker; flips below it near the top edge. */
function Label({ spot, wm, text, accent = false }: { spot: WorldMapSpot; wm: WorldMap; text: string; accent?: boolean }) {
  const below = spot.y / wm.height < 0.14;
  return (
    <span
      className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-md px-2 py-1 text-xs shadow-lg ${accent ? 'bg-accent font-semibold text-black' : 'border border-border-2 bg-surface-2/95 text-ink'}`}
      style={{ left: pct(spot.x, wm.width), top: pct(spot.y, wm.height), transform: `translate(${shift(spot.x, wm.width)}, ${below ? '14px' : 'calc(-100% - 14px)'})` }}
    >
      {text}
    </span>
  );
}
