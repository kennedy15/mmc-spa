import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Empty, PageHeader, Segmented, Spinner } from '../../app/ui';
import { dataUrl } from '../../lib/paths';
import { useAtlas } from './data';
import { fmtLevels, foldRooms, hiddenFrom, hiddenGroups, indexAtlas, isHidden, levelRange, markerOf, mobsAcross, mobsOn, type AtlasIndex } from './atlasIndex';
import { mapThumb, useAtlasNav, useOpenMob } from './atlasNav';
import { MobSheetHost } from './MobSheet';
import { MapThumb, MobIcon, Tag } from './AtlasParts';
import type { AtlasIsland, AtlasMap, AtlasMarker, AtlasMob } from './types';

const LS_ISLAND = 'mt.classic.island';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the island just isn't remembered.
  }
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export function WorldMapPage() {
  const { doc, error } = useAtlas();
  const ix = useMemo(() => (doc ? indexAtlas(doc) : null), [doc]);
  if (error) return <Empty title="Map data missing">public/classic/atlas.json could not be loaded ({error}).</Empty>;
  if (!ix) return <Spinner label="Loading the world map…" />;
  return (
    <MobSheetHost ix={ix}>
      <WorldMap ix={ix} />
    </MobSheetHost>
  );
}

/** The maps a marker stands for. */
const mapsAt = (mk: AtlasMarker, ix: AtlasIndex) => mk.maps.map((id) => ix.map.get(id)).filter((m): m is AtlasMap => !!m);

/**
 * The in-game world map of an island with every marker live: hover one for its map, monsters and hidden maps,
 * click it to open the map. Beside it: search, one monster's spawn maps, or the island's hidden maps.
 */
function WorldMap({ ix }: { ix: AtlasIndex }) {
  const [params, setParams] = useSearchParams();
  const islands = ix.doc.islands;
  const island = ix.island.get(params.get('island') ?? readLocal(LS_ISLAND) ?? '') ?? islands.find((i) => i.id === 'victoria-island') ?? islands[0];
  const mob = ix.mob.get(Number(params.get('mob'))) ?? null;
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<number | null>(null);
  // A marker lit from the side list (the map under the pointer there).
  const [peek, setPeek] = useState<number | null>(null);
  const { go } = useAtlasNav();

  const setIsland = (id: string) => {
    writeLocal(LS_ISLAND, id);
    setHover(null);
    setParams(
      (p) => {
        p.set('island', id);
        return p;
      },
      { replace: true },
    );
  };
  const setMob = (id: number | null) => {
    setQuery('');
    setParams(
      (p) => {
        if (id == null) p.delete('mob');
        else p.set('mob', String(id));
        return p;
      },
      { replace: true },
    );
  };

  // Markers holding the picked monster: a map's own marker, or for a map the world map leaves out, the nearest one's.
  const lit = useMemo(() => {
    if (!mob) return null;
    const out = new Set<number>();
    for (const { map } of ix.homes.get(mob.id) ?? []) {
      const at = markerOf(map, ix);
      if (at && at.island.id === island.id) out.add(at.index);
    }
    return out;
  }, [mob, ix, island.id]);

  // Fetch the markers' preview thumbnails once the page is idle, so hovering shows them straight away.
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const mk of island.markers) if (mk.main != null) new Image().src = dataUrl(mapThumb(mk.main), 'public');
    }, 800);
    return () => window.clearTimeout(t);
  }, [island]);

  const counts = useMemo(() => {
    const maps = ix.doc.maps.filter((m) => m.island === island.id);
    return { maps: maps.length, hidden: maps.filter(isHidden).length };
  }, [ix, island.id]);

  return (
    <>
      <PageHeader
        title="World map"
        subtitle={<>Every map on Maple Island and Victoria Island, from the launch client. Hover a marker to see its map and monsters; click it to open the map.</>}
        action={<Segmented value={island.id} options={islands.map((i) => ({ value: i.id, label: i.name }))} onChange={setIsland} label="Island" />}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="card min-w-0 p-3">
          {/* The whole island stays on screen: no wider than the window's height (less the header) allows. */}
          <div className="relative mx-auto select-none" style={{ width: `min(100%, calc((100vh - 11rem) * ${(island.width / island.height).toFixed(4)}))` }} onMouseLeave={() => setHover(null)}>
            <figure className="overflow-hidden rounded-xl border border-border-2">
              <img src={dataUrl(island.image, 'public')} width={island.width} height={island.height} alt={`${island.name} world map`} className="block h-auto w-full" draggable={false} />
            </figure>
            {island.markers.map((mk, i) => (
              <Marker key={i} ix={ix} island={island} marker={mk} hovered={hover === i} lit={lit ? lit.has(i) : peek === i} dim={!!lit && !lit.has(i)} onHover={(on) => setHover(on ? i : null)} onOpen={() => mk.main != null && go(mk.main)} />
            ))}
            {hover != null && island.markers[hover] && <MarkerCard ix={ix} island={island} marker={island.markers[hover]} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-full border-2 border-[#2a1a0c] bg-[#fff6dc]" /> Town
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-2 border-[#2a1a0c] bg-[#fff6dc]" /> Hunting ground
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-2 border-dashed border-ink-3" /> Not out yet
            </span>
            {mob && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border-2 border-[#2a1a0c] bg-accent" /> {mob.name} spawns here
              </span>
            )}
            <span className="ml-auto text-ink-3 tabular">
              {counts.maps} maps · {counts.hidden} hidden
            </span>
          </div>
          <p className="mt-2 px-1 text-[11px] text-ink-3">
            Maps, spawns, portals and monsters are the launch client's (
            <a href={ix.doc.source.url} target="_blank" rel="noreferrer" className="hover:text-accent">
              OSMS Data Explorer
            </a>
            ). The world-map art and marker spots are the second test's (
            <a href={ix.doc.artSource.url} target="_blank" rel="noreferrer" className="hover:text-accent">
              maplestory.io
            </a>
            ): nobody has datamined the launch world map yet, which drops the Forgotten Hollow tree.
            {ix.doc.dropSource && (
              <>
                {' '}
                Drops come from{' '}
                <a href={ix.doc.dropSource.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                  {ix.doc.dropSource.title}
                </a>{' '}
                kill logs.
              </>
            )}
          </p>
        </section>

        <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a map or monster…"
            aria-label="Find a map or monster"
            className="w-full rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {query.trim() ? (
            <SearchResults ix={ix} island={island} query={query.trim()} onMob={(id) => setMob(id)} onIsland={setIsland} />
          ) : mob ? (
            <MobPlaces ix={ix} island={island} mob={mob} onClear={() => setMob(null)} onIsland={setIsland} onPeek={setPeek} />
          ) : (
            <HiddenMaps ix={ix} island={island} onPeek={setPeek} />
          )}
        </aside>
      </div>
    </>
  );
}

function Marker({ ix, island, marker: mk, hovered, lit, dim, onHover, onOpen }: { ix: AtlasIndex; island: AtlasIsland; marker: AtlasMarker; hovered: boolean; lit: boolean; dim: boolean; onHover: (on: boolean) => void; onOpen: () => void }) {
  const main = mk.main != null ? ix.map.get(mk.main) : undefined;
  const town = mk.type === 0;
  const label = main ? `${main.name}${mk.maps.length > 1 ? ` and ${mk.maps.length - 1} more maps` : ''}` : `${mk.label}: not out yet`;
  return (
    <button
      type="button"
      aria-label={label}
      title={mk.unreleased ? `${mk.label}: not out at launch` : undefined}
      className={`absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${mk.unreleased ? 'cursor-help' : 'cursor-pointer'} focus-visible:outline-2 focus-visible:outline-accent`}
      style={{ left: pct(mk.x, island.width), top: pct(mk.y, island.height) }}
      onMouseEnter={() => !mk.unreleased && onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => !mk.unreleased && onHover(true)}
      onBlur={() => onHover(false)}
      onClick={() => !mk.unreleased && onOpen()}
    >
      {lit && <span className="absolute inline-flex size-5 animate-ping rounded-full bg-accent opacity-60" />}
      <span
        className={`relative block rounded-full border-2 shadow transition-transform ${town || lit ? 'size-3.5' : 'size-2.5'} ${
          mk.unreleased ? 'border-dashed border-[#6b5a48] bg-[#e9dcc0]/60' : lit ? 'border-white bg-accent ring-2 ring-[#2a1a0c]' : 'border-[#2a1a0c] bg-[#fff6dc]'
        } ${hovered ? 'scale-150 ring-2 ring-white' : ''} ${dim ? 'opacity-40' : ''}`}
      />
    </button>
  );
}

/** What hovering a marker shows: the map's preview, its monsters (all of the marker's maps for a group) and hidden maps nearby. */
function MarkerCard({ ix, island, marker: mk }: { ix: AtlasIndex; island: AtlasIsland; marker: AtlasMarker }) {
  const main = mk.main != null ? ix.map.get(mk.main) : undefined;
  if (!main) return null;
  const maps = mapsAt(mk, ix);
  const rows = maps.length > 1 ? mobsAcross(maps, ix) : mobsOn(main, ix);
  const range = fmtLevels(levelRange(rows));
  // Hidden maps a portal on one of the marker's ordinary maps leads straight to (not the rooms past them, nor jump-quest steps).
  const hidden = [...new Map(maps.filter((m) => !isHidden(m)).flatMap((m) => hiddenFrom(m, ix).filter((h) => h.depth === 1)).map((h) => [h.map.id, h.map])).values()];
  const right = mk.x / island.width > 0.55;
  const below = mk.y / island.height < 0.45;
  const MAX = 8;
  return (
    <div
      className="pointer-events-none absolute z-20 w-[19rem] rounded-xl border border-border-2 bg-surface-2 p-3 shadow-2xl"
      style={{ left: pct(mk.x, island.width), top: pct(mk.y, island.height), transform: `translate(${right ? 'calc(-100% - 18px)' : '18px'}, ${below ? '-12px' : 'calc(-100% + 12px)'})` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate font-semibold text-ink">{main.name}</div>
        {range && <span className="shrink-0 text-xs text-ink-2 tabular">{range}</span>}
      </div>
      {maps.length > 1 && (
        <div className="text-[11px] text-ink-3">
          {maps.length} maps at this marker{rows.length ? ', monsters across all of them' : ''}
        </div>
      )}
      <MapThumb map={main} className="mt-2 h-32 w-full" />
      {rows.length ? (
        <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
          {rows.slice(0, MAX).map((r) => (
            <li key={r.mob.id} className="flex min-w-0 items-center gap-1.5 text-xs">
              <MobIcon mob={r.mob} box={24} />
              <span className="min-w-0 truncate text-ink">{r.mob.name}</span>
              <span className="ml-auto shrink-0 text-ink-3 tabular">Lv {r.mob.level}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-2">No monsters here.</p>
      )}
      {rows.length > MAX && <p className="mt-1 text-[11px] text-ink-3">+{rows.length - MAX} more monsters</p>}
      {hidden.length > 0 && (
        <p className="mt-2 text-xs text-ink-2">
          <span className="font-semibold text-accent">Hidden maps: </span>
          {hidden
            .slice(0, 3)
            .map((m) => m.name)
            .join(', ')}
          {hidden.length > 3 && ` +${hidden.length - 3} more`}
        </p>
      )}
      <p className="mt-2 border-t border-border pt-1.5 text-[11px] text-ink-3">Click to open {main.name}</p>
    </div>
  );
}

/** Maps and monsters whose name has the query in it, from both islands. */
function SearchResults({ ix, island, query, onMob, onIsland }: { ix: AtlasIndex; island: AtlasIsland; query: string; onMob: (id: number) => void; onIsland: (id: string) => void }) {
  const { go } = useAtlasNav();
  const q = query.toLowerCase();
  const rank = (name: string) => (name.toLowerCase().startsWith(q) ? 0 : 1);
  const maps = ix.doc.maps
    .filter((m) => m.name.toLowerCase().includes(q))
    .sort((a, b) => rank(a.name) - rank(b.name) || Number(a.island !== island.id) - Number(b.island !== island.id) || a.name.localeCompare(b.name));
  const mobs = ix.doc.mobs.filter((m) => m.name.toLowerCase().includes(q) && ix.homes.has(m.id)).sort((a, b) => rank(a.name) - rank(b.name) || a.level - b.level);
  if (!maps.length && !mobs.length) return <p className="card p-4 text-sm text-ink-2">No map or monster is called that.</p>;
  return (
    <div className="card divide-y divide-border">
      {mobs.length > 0 && (
        <div className="p-3">
          <div className="label mb-1.5">Monsters</div>
          <ul className="space-y-0.5">
            {mobs.slice(0, 8).map((m) => (
              <li key={m.id}>
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2 cursor-pointer" onClick={() => onMob(m.id)}>
                  <MobIcon mob={m} box={28} />
                  <span className="min-w-0 flex-1 truncate text-ink">{m.name}</span>
                  {m.special && <Tag>{m.special === 'Job Advancement' ? 'job test' : m.special}</Tag>}
                  <span className="shrink-0 text-xs text-ink-3 tabular">Lv {m.level}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {maps.length > 0 && (
        <div className="p-3">
          <div className="label mb-1.5">Maps</div>
          <ul className="space-y-0.5">
            {maps.slice(0, 14).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2 cursor-pointer"
                  onClick={() => {
                    if (m.island !== island.id) onIsland(m.island);
                    go(m.id);
                  }}
                >
                  <MapThumb map={m} className="h-7 w-11 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-ink">{m.name}</span>
                  {isHidden(m) && <Tag>hidden</Tag>}
                  {m.island !== island.id && <span className="shrink-0 text-[11px] text-ink-3">{ix.island.get(m.island)?.name}</span>}
                </button>
              </li>
            ))}
          </ul>
          {maps.length > 14 && <p className="mt-1 px-1.5 text-[11px] text-ink-3">+{maps.length - 14} more: type more of the name</p>}
        </div>
      )}
    </div>
  );
}

/** Where one monster spawns: its maps on this island (lit on the world map too), and how many on the other. */
function MobPlaces({ ix, island, mob, onClear, onIsland, onPeek }: { ix: AtlasIndex; island: AtlasIsland; mob: AtlasMob; onClear: () => void; onIsland: (id: string) => void; onPeek: (i: number | null) => void }) {
  const { go } = useAtlasNav();
  const openMob = useOpenMob();
  const homes = ix.homes.get(mob.id) ?? [];
  const here = homes.filter((h) => h.map.island === island.id);
  const elsewhere = ix.doc.islands.filter((i) => i.id !== island.id).map((i) => ({ island: i, n: homes.filter((h) => h.map.island === i.id).length }));
  return (
    <div className="card p-3">
      <div className="flex items-start gap-3">
        <MobIcon mob={mob} box={48} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">{mob.name}</div>
          <div className="text-xs text-ink-2 tabular">
            Lv {mob.level} · {mob.hp.toLocaleString('en-US')} HP · {mob.exp.toLocaleString('en-US')} EXP
          </div>
          <button type="button" className="mt-1 text-xs font-medium text-accent hover:underline cursor-pointer" onClick={() => openMob(mob.id)}>
            Monster details
          </button>
        </div>
        <button type="button" className="btn-ghost btn-sm text-base leading-none" onClick={onClear} aria-label={`Stop showing where ${mob.name} spawns`}>
          ✕
        </button>
      </div>
      <div className="label mt-3 mb-1.5">
        On {island.name} · {here.length} map{here.length === 1 ? '' : 's'}
      </div>
      {here.length ? (
        <ul className="space-y-0.5" onMouseLeave={() => onPeek(null)}>
          {here.map(({ map, count }) => (
            <li key={map.id}>
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2 cursor-pointer" onMouseEnter={() => onPeek(markerOf(map, ix)?.index ?? null)} onClick={() => go(map.id)}>
                <MapThumb map={map} className="h-7 w-11 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-ink">{map.name}</span>
                {isHidden(map) && <Tag>hidden</Tag>}
                <span className="shrink-0 text-xs text-ink-3 tabular">×{count}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">None on this island.</p>
      )}
      {elsewhere
        .filter((e) => e.n > 0)
        .map((e) => (
          <button key={e.island.id} type="button" className="mt-2 text-xs font-medium text-accent hover:underline cursor-pointer" onClick={() => onIsland(e.island.id)}>
            Also on {e.n} map{e.n === 1 ? '' : 's'} on {e.island.name} →
          </button>
        ))}
    </div>
  );
}

/** The island's hidden maps, grouped under the map you find each from; hovering one lights its world-map marker. */
function HiddenMaps({ ix, island, onPeek }: { ix: AtlasIndex; island: AtlasIsland; onPeek: (i: number | null) => void }) {
  const { go } = useAtlasNav();
  const groups = useMemo(() => hiddenGroups(island, ix), [island, ix]);
  const total = groups.reduce((n, g) => n + g.maps.length, 0);
  return (
    <div className="card p-3" onMouseLeave={() => onPeek(null)}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-ink">Hidden maps</h2>
        <span className="text-xs text-ink-3 tabular">{total}</span>
      </div>
      <p className="mt-0.5 mb-3 text-xs text-ink-2">Maps the world map doesn't mark, or the game files under Hidden Street, by where you find them.</p>
      {!groups.length && <p className="text-sm text-ink-2">{island.name} has none: every map is on its world map.</p>}
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.from?.id ?? 'none'}>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-3">
              {g.from ? (
                <>
                  From{' '}
                  <button type="button" className="font-semibold normal-case tracking-normal text-ink-2 hover:text-accent cursor-pointer" onMouseEnter={() => onPeek(markerOf(g.from!, ix)?.index ?? null)} onClick={() => go(g.from!.id)}>
                    {g.from.name}
                  </button>
                </>
              ) : (
                'No portal in: an NPC, quest or party quest takes you'
              )}
            </div>
            <ul className="space-y-0.5">
              {foldRooms(g.maps).map(({ map, depth, more }) => {
                const range = fmtLevels(levelRange(mobsOn(map, ix)));
                return (
                  <li key={map.id} style={{ paddingLeft: Math.max(0, depth - 1) * 14 }}>
                    <button type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2 cursor-pointer" onMouseEnter={() => onPeek(markerOf(map, ix)?.index ?? null)} onClick={() => go(map.id)}>
                      {depth > 1 && (
                        <span aria-hidden className="text-ink-3">
                          ↳
                        </span>
                      )}
                      <MapThumb map={map} className="h-7 w-11 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-ink">{more ? `${map.name} to ${more[more.length - 1].name.match(/<\d+>$/)?.[0]}` : map.name}</span>
                      {more ? <span className="shrink-0 text-[11px] text-ink-3 tabular">{more.length + 1} rooms</span> : range && <span className="shrink-0 text-[11px] text-ink-3 tabular">{range}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
