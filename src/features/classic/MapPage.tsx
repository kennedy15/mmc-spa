import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Empty, Spinner } from '../../app/ui';
import { fmtInt } from '../../app/format';
import { dataUrl } from '../../lib/paths';
import { useAtlas } from './data';
import { ancestorsOf, dropsOn, exitsOf, fmtLevels, fmtRate, hiddenFrom, indexAtlas, isHidden, levelRange, markerOf, mobsOn, PORTAL_LABEL, spawnTimer, TIMER_HINT, type AtlasIndex } from './atlasIndex';
import { mapImage, rightClickGoesBack, useAtlasNav, useOpenMob } from './atlasNav';
import { MobSheetHost } from './MobSheet';
import { ItemIcon, MAP_BG, MapThumb, MobIcon, Tag } from './AtlasParts';
import { DOTS, OTHER } from './labels';
import type { AtlasMap, AtlasMob, AtlasPortal } from './types';

const pct = (v: number, total: number) => `${Math.min(100, Math.max(0, (v / total) * 100))}%`;

export function MapPage() {
  const { id = '' } = useParams();
  const { doc, error } = useAtlas();
  const ix = useMemo(() => (doc ? indexAtlas(doc) : null), [doc]);
  if (error) return <Empty title="Map data missing">public/classic/atlas.json could not be loaded ({error}).</Empty>;
  if (!ix) return <Spinner label="Loading the map…" />;
  const map = ix.map.get(Number(id));
  if (!map)
    return (
      <Empty title="No such map">
        <Link to="/classic/map" className="text-accent hover:underline">
          Back to the world map
        </Link>
      </Empty>
    );
  return (
    <MobSheetHost key={map.id} ix={ix}>
      <MapScreen ix={ix} map={map} />
    </MobSheetHost>
  );
}

type Rows = { mob: AtlasMob; count: number }[];

/** One map in full: the render with its spawn points, portals and NPCs, its monsters and drops, hidden maps and ways in and out. */
function MapScreen({ ix, map: m }: { ix: AtlasIndex; map: AtlasMap }) {
  const { back, go, depth } = useAtlasNav();
  const rows = useMemo(() => mobsOn(m, ix), [m, ix]);
  // The three most common monsters get colors, the rest share grey: hovering any monster picks out its own spawns.
  const colors = useMemo(() => new Map(rows.slice(0, DOTS.length).map((r, i) => [r.mob.id, DOTS[i]])), [rows]);
  const [focus, setFocus] = useState<number | null>(null);
  const [portalTo, setPortalTo] = useState<number | null>(null);
  const [layers, setLayers] = useState({ portals: true, npcs: true });
  const [zoom, setZoom] = useState(false);
  const island = ix.island.get(m.island);
  const at = markerOf(m, ix);
  const host = at ? ix.map.get(at.marker.main ?? -1) : undefined;
  const near = m.near != null ? ix.map.get(m.near) : undefined;
  const range = fmtLevels(levelRange(rows));

  const onContextMenu = (e: MouseEvent) => {
    if (!rightClickGoesBack(e.target)) return;
    e.preventDefault();
    back(m.island);
  };

  return (
    <div onContextMenu={onContextMenu}>
      <header className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2">
        <button type="button" className="btn gap-2 px-3.5 py-2 text-[15px]" onClick={() => back(m.island)} title="Back one map (right-click anywhere on the page does the same)">
          <span aria-hidden>←</span> {depth > 0 ? 'Back' : 'World map'}
        </button>
        <div className="min-w-0 flex-1">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-ink-3" aria-label="Where this map is">
            <Link to={`/classic/map?island=${m.island}`} className="hover:text-accent">
              {island?.name ?? 'World map'}
            </Link>
            {host && host.id !== m.id && (
              <>
                <span aria-hidden>›</span>
                {at?.own ? 'At the ' : 'Off the '}
                <button type="button" className="font-medium text-ink-2 hover:text-accent cursor-pointer" onClick={() => go(host.id)}>
                  {host.name}
                </button>
                marker
              </>
            )}
            {near && !at?.own && near.id !== host?.id && (
              <>
                <span aria-hidden>·</span> nearest marked map:{' '}
                <button type="button" className="font-medium text-ink-2 hover:text-accent cursor-pointer" onClick={() => go(near.id)}>
                  {near.name}
                </button>
              </>
            )}
          </nav>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{m.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-ink-2">{m.street}</span>
            {m.town && !m.spawns?.length && <Tag>Town</Tag>}
            {isHidden(m) && (
              <Tag tone="accent" title={m.hidden ? 'The game files this map under Hidden Street' : 'No world-map marker lists this map'}>
                Hidden map
              </Tag>
            )}
            {m.marker == null && <Tag title="No world-map marker lists this map">Not on the world map</Tag>}
            {range && <Tag>{range}</Tag>}
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="card min-w-0 p-3">
          <MapCanvas ix={ix} map={m} colors={colors} focus={focus} onFocus={setFocus} portalTo={portalTo} layers={layers} zoom={zoom} />
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
            {rows.map((r) => (
              <MobChip key={r.mob.id} row={r} color={colors.get(r.mob.id) ?? OTHER} on={focus === r.mob.id} onFocus={setFocus} />
            ))}
            <span className="ml-auto flex items-center gap-3 pl-2 text-ink-2">
              <button type="button" className="btn-ghost btn-sm border-border-2!" aria-pressed={zoom} onClick={() => setZoom((z) => !z)} title={zoom ? 'Fit the whole map in view' : 'Twice the size: scroll to look around'}>
                {zoom ? 'Fit whole map' : 'Zoom in'}
              </button>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="accent-accent" checked={layers.portals} onChange={(e) => setLayers((l) => ({ ...l, portals: e.target.checked }))} /> Portals
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="accent-accent" checked={layers.npcs} onChange={(e) => setLayers((l) => ({ ...l, npcs: e.target.checked }))} /> NPCs
              </label>
            </span>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Dots are spawn points: click a monster or its dot for its details. <span className="font-semibold">↑</span> portals lead to the map named on hover, dashed ones show nothing in game (press ↑ at the spot). Right-click anywhere to go back one map.
          </p>
        </section>

        <div className="min-w-0 space-y-4">
          <Monsters map={m} rows={rows} colors={colors} focus={focus} onFocus={setFocus} />
          <Drops ix={ix} rows={rows} onFocus={setFocus} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <HiddenHere ix={ix} map={m} onPortal={setPortalTo} />
        <Ways ix={ix} map={m} onPortal={setPortalTo} />
        <OnThisMap ix={ix} map={m} />
      </div>
    </div>
  );
}

/**
 * The map's full render with everything placed on it in the render's own pixels (as percentages, so it scales).
 * It opens with the whole map in view; zoomed, it doubles and scrolls.
 */
function MapCanvas({ ix, map: m, colors, focus, onFocus, portalTo, layers, zoom }: { ix: AtlasIndex; map: AtlasMap; colors: Map<number, string>; focus: number | null; onFocus: (id: number | null) => void; portalTo: number | null; layers: { portals: boolean; npcs: boolean }; zoom: boolean }) {
  const { go } = useAtlasNav();
  const openMob = useOpenMob();
  const [W, H] = m.size;
  const aspect = W / H;
  const [tip, setTip] = useState<{ x: number; y: number; text: ReactNode } | null>(null);
  // Whole map in view: as wide as the card, but no taller than 72% of the window. Zoomed: twice that (at least 40rem wide), scrolling.
  const fit = `min(100%, ${(72 * aspect).toFixed(2)}vh)`;
  const width = zoom ? `max(calc(2 * ${fit}), min(100%, 40rem))` : fit;
  const below = (y: number) => y / H < 0.14;
  const tipX = (x: number) => (x / W < 0.12 ? '-8%' : x / W > 0.88 ? '-92%' : '-50%');

  return (
    <div className="relative max-h-[72vh] overflow-auto rounded-xl border border-border-2" style={{ background: MAP_BG }}>
      {/* A size container, so portal markers shrink on a map drawn small (cqw: 1% of the drawn map's width). */}
      <div className="@container relative mx-auto select-none" style={{ width, aspectRatio: `${W} / ${H}` }} onMouseLeave={() => setTip(null)}>
        <img src={dataUrl(mapImage(m.id), 'public')} alt={`${m.name}: the whole map`} className="block size-full" draggable={false} />
        {/* Each monster drawn in the render is a button the size of its sprite, standing on its spawn point (the dot). */}
        {m.spawns?.map(([x, y, id], k) => {
          const mob = ix.mob.get(id);
          if (!mob) return null;
          const on = focus === id;
          const [bw, bh] = mob.box ?? [40, 40];
          return (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              aria-hidden
              className={`absolute z-10 -translate-x-1/2 -translate-y-full rounded-md cursor-pointer ${on ? 'ring-2 ring-white/80' : 'hover:ring-2 hover:ring-white/60'}`}
              style={{ left: pct(x, W), top: pct(y, H), width: `max(14px, ${(bw / W) * 100}%)`, height: `max(14px, ${(bh / H) * 100}%)` }}
              onMouseEnter={() => {
                onFocus(id);
                setTip({ x, y: y - bh, text: `${mob.name} · Lv ${mob.level}` });
              }}
              onMouseLeave={() => onFocus(null)}
              onClick={() => openMob(id)}
            >
              <span className={`absolute bottom-0 left-1/2 block -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-[#1c140e] transition-[width,height] ${on ? 'size-3' : 'size-2'} ${focus != null && !on ? 'opacity-25' : ''}`} style={{ background: colors.get(id) ?? OTHER }} />
            </button>
          );
        })}
        {layers.npcs &&
          m.npcs?.map(([x, y, id], k) => (
            <span
              key={`n${k}`}
              aria-hidden
              className="absolute z-10 size-2.5 -translate-x-1/2 -translate-y-full rotate-45 border border-[#1c140e] bg-[#ffe9a8]"
              style={{ left: pct(x, W), top: pct(y, H) }}
              onMouseEnter={() => setTip({ x, y, text: <>NPC · {ix.doc.npcs[String(id)] ?? `#${id}`}</> })}
            />
          ))}
        {layers.portals &&
          m.portals?.map((p, k) => (
            <PortalMark key={`p${k}`} ix={ix} map={m} portal={p} lit={portalTo != null && p.to === portalTo} onTip={(text) => setTip(text ? { x: p.x, y: p.y, text } : null)} onGo={go} />
          ))}
        {tip && (
          <div
            className="pointer-events-none absolute z-30 max-w-64 rounded-lg border border-border-2 bg-surface-2/95 px-2.5 py-1.5 text-xs text-ink shadow-xl"
            style={{ left: pct(tip.x, W), top: pct(tip.y, H), transform: `translate(${tipX(tip.x)}, ${below(tip.y) ? '18px' : 'calc(-100% - 22px)'})` }}
          >
            {tip.text}
          </div>
        )}
      </div>
    </div>
  );
}

/** A portal on the map: where it leads on hover, a click goes through it. Ones with nowhere listed (quest spots, scripts) only explain themselves. */
function PortalMark({ ix, map: m, portal: p, lit, onTip, onGo }: { ix: AtlasIndex; map: AtlasMap; portal: AtlasPortal; lit: boolean; onTip: (text: ReactNode | null) => void; onGo: (id: number) => void }) {
  const [W, H] = m.size;
  const dest = p.to != null ? ix.map.get(p.to) : undefined;
  const dashed = p.kind === 'invisible' || p.kind === 'quest' || (p.kind === 'script' && !p.to);
  const text = dest ? (
    <>
      <span className="font-semibold">→ {dest.name}</span>
      {isHidden(dest) && <span className="text-accent"> · hidden map</span>}
      <span className="block text-ink-3">{p.note ?? (p.kind === 'stage' ? 'Opens when the stage is cleared' : p.script ? 'scripted portal' : PORTAL_LABEL[p.kind])}</span>
    </>
  ) : p.to != null ? (
    <>Leads to a map that isn't in the launch data</>
  ) : p.quest ? (
    <>
      <span className="font-semibold">Event quest spot</span>
      <span className="block text-ink-3">For {p.quest}, part of the Mark of Beta event due at Grand Launch</span>
    </>
  ) : p.kind === 'stage' ? (
    <>Opens when the stage is cleared</>
  ) : (
    <>
      <span className="font-semibold">Scripted portal</span>
      <span className="block text-ink-3">{p.note ?? 'The game decides where it goes'}</span>
    </>
  );
  return (
    <button
      type="button"
      aria-label={dest ? `Portal to ${dest.name}` : 'Portal'}
      className={`absolute z-20 flex size-[clamp(15px,2.5cqw,24px)] -translate-x-1/2 -translate-y-[80%] items-center justify-center rounded-full border-2 text-[clamp(9px,1.35cqw,13px)] font-bold leading-none shadow-md ${dest ? 'cursor-pointer hover:scale-125' : 'cursor-help'} ${
        dashed ? 'border-dashed border-white bg-[#1c140e]/85 text-white' : dest ? 'border-white bg-accent text-white' : 'border-[#9a8b78] bg-[#3a2c20] text-[#d8c8b0]'
      } ${lit ? 'scale-125 ring-4 ring-accent/70' : ''} transition-transform`}
      style={{ left: pct(p.x, W), top: pct(p.y, H) }}
      onMouseEnter={() => onTip(text)}
      onMouseLeave={() => onTip(null)}
      onFocus={() => onTip(text)}
      onBlur={() => onTip(null)}
      onClick={() => dest && onGo(dest.id)}
    >
      {p.kind === 'quest' ? '!' : p.kind === 'walk' ? '→' : '↑'}
    </button>
  );
}

function MobChip({ row: r, color, on, onFocus }: { row: Rows[number]; color: string; on: boolean; onFocus: (id: number | null) => void }) {
  const openMob = useOpenMob();
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 cursor-pointer ${on ? 'border-accent bg-accent/10 text-ink' : 'border-border-2 text-ink-2 hover:border-ink-3'}`}
      onMouseEnter={() => onFocus(r.mob.id)}
      onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(r.mob.id)}
      onBlur={() => onFocus(null)}
      onClick={() => openMob(r.mob.id)}
    >
      <span className="size-2 rounded-full ring-1 ring-black/30" style={{ background: color }} />
      {r.mob.name} <span className="text-ink-3 tabular">×{r.count}</span>
    </button>
  );
}

function Monsters({ map: m, rows, colors, focus, onFocus }: { map: AtlasMap; rows: Rows; colors: Map<number, string>; focus: number | null; onFocus: (id: number | null) => void }) {
  const openMob = useOpenMob();
  return (
    <Card title="Monsters" action={m.spawns?.length ? <span className="text-xs text-ink-3 tabular">{m.spawns.length} spawn points</span> : null}>
      {rows.length ? (
        <ul className="-mx-1.5 space-y-0.5">
          {rows.map((r) => (
            <li key={r.mob.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left cursor-pointer ${focus === r.mob.id ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                onMouseEnter={() => onFocus(r.mob.id)}
                onMouseLeave={() => onFocus(null)}
                onClick={() => openMob(r.mob.id)}
              >
                <MobIcon mob={r.mob} box={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span className="size-2 shrink-0 rounded-full ring-1 ring-black/30" style={{ background: colors.get(r.mob.id) ?? OTHER }} />
                    <span className="truncate">{r.mob.name}</span>
                    {r.mob.boss && <Tag tone="accent">Boss</Tag>}
                    <span className="ml-auto shrink-0 text-xs font-normal text-ink-3 tabular">×{r.count}</span>
                  </span>
                  <span className="block text-[11px] text-ink-3 tabular">
                    Lv {r.mob.level} · {fmtInt(r.mob.hp)} HP · {r.mob.exp ? `${fmtInt(r.mob.exp)} EXP` : 'no EXP'}
                    {spawnTimer(m, r.mob.id) && (
                      <span className="text-ink-2" title={TIMER_HINT}>
                        {' '}
                        · ⏱ {spawnTimer(m, r.mob.id)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">No monsters spawn here.</p>
      )}
      {m.cap != null && rows.length > 0 && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-ink-2">
          Its {m.spawns?.length} spawn points share a cap of <span className="font-semibold text-ink tabular">{m.cap}</span> monsters alive at once when you're alone; a crowded map gets a few more. Empty points refill about every 7 s.
        </p>
      )}
    </Card>
  );
}

/**
 * A preview of everything the map's monsters drop: hovering an item names it with each monster's rate and picks out that
 * monster on the map; clicking opens the monster. Monsters with no drop data yet are named, so a short list reads as unknown, not empty.
 */
function Drops({ ix, rows, onFocus }: { ix: AtlasIndex; rows: Rows; onFocus: (id: number | null) => void }) {
  const openMob = useOpenMob();
  const drops = useMemo(() => dropsOn(rows, ix), [rows, ix]);
  const [hover, setHover] = useState<(typeof drops)[number] | null>(null);
  const unknown = rows.filter((r) => !r.mob.drops?.length && r.mob.exp > 0).map((r) => r.mob.name);
  const src = ix.doc.dropSource;
  return (
    <Card title="Drops" action={drops.length ? <span className="text-xs text-ink-3 tabular">{drops.length} items</span> : null}>
      {drops.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-1.5" onMouseLeave={() => setHover(null)}>
            {drops.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-label={`${d.item.name}: ${d.from.map((f) => `${f.mob.name} ${fmtRate(f.drop)}`).join(', ')}`}
                  className={`relative flex size-11 items-center justify-center rounded-lg border bg-surface-2 cursor-pointer ${hover?.id === d.id ? 'border-accent' : 'border-border hover:border-ink-3'}`}
                  onMouseEnter={() => {
                    setHover(d);
                    onFocus(d.from[0].mob.id);
                  }}
                  onMouseLeave={() => onFocus(null)}
                  onClick={() => openMob(d.from[0].mob.id)}
                >
                  <ItemIcon item={d.item} size={32} />
                  {d.quest && <span className="absolute -top-1 -right-1 rounded bg-surface px-0.5 text-[9px] font-bold leading-3 text-accent">Q</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 min-h-10 text-xs text-ink-2">
            {hover ? (
              <>
                <span className="font-semibold text-ink">{hover.item.name}</span>
                <span className="text-ink-3"> · {hover.quest ? 'quest item' : hover.item.type}</span>
                {hover.from.map((f) => (
                  <span key={f.mob.id} className="block tabular">
                    {f.mob.name}: {fmtRate(f.drop)}
                    {f.drop.q && ` (${f.drop.q[0] === f.drop.q[1] ? f.drop.q[0] : `${f.drop.q[0]}–${f.drop.q[1]}`} at once)`}
                    {f.drop.rate != null && f.mob.dropKills ? <span className="text-ink-3"> of {fmtInt(f.mob.dropKills)} kills</span> : null}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-ink-3">Hover an item for who drops it and how often.</span>
            )}
          </div>
        </>
      )}
      {!rows.length ? (
        <p className="text-sm text-ink-2">No monsters, so no drops.</p>
      ) : (
        unknown.length > 0 && (
          <p className={`text-xs text-ink-2 ${drops.length ? 'mt-2 border-t border-border pt-2' : ''}`}>
            {drops.length ? 'No drop records yet for ' : 'No drop records yet for any monster here: '}
            {unknown.join(', ')}. Drop tables live on the game server, so they come from players' kill logs.
          </p>
        )
      )}
      {src && drops.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-3">
          Rates from{' '}
          <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-accent">
            {src.title}
          </a>{' '}
          kill logs on the launch build (CC BY-NC-SA 4.0).
        </p>
      )}
    </Card>
  );
}

/** Hidden maps you can reach from here, nearest first, each with its preview and monsters; hovering one picks out its portal. */
function HiddenHere({ ix, map: m, onPortal }: { ix: AtlasIndex; map: AtlasMap; onPortal: (to: number | null) => void }) {
  const { go } = useAtlasNav();
  const found = useMemo(() => hiddenFrom(m, ix, ancestorsOf(m, ix)), [m, ix]);
  return (
    <Card title="Hidden maps found here" action={found.length ? <span className="text-xs text-ink-3 tabular">{found.length}</span> : null}>
      {found.length ? (
        <ul className="space-y-1.5" onMouseLeave={() => onPortal(null)}>
          {found.map((h) => {
            const mobs = mobsOn(h.map, ix);
            const range = fmtLevels(levelRange(mobs));
            return (
              <li key={h.map.id} style={{ paddingLeft: (h.depth - 1) * 16 }}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-1.5 text-left hover:border-accent hover:bg-surface-2 cursor-pointer"
                  onMouseEnter={() => onPortal(h.depth === 1 ? h.map.id : h.from.id)}
                  onClick={() => go(h.map.id)}
                >
                  <MapThumb map={h.map} className="h-14 w-24 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{h.map.name}</span>
                    <span className="block text-[11px] text-ink-3">
                      {h.depth > 1 ? `Through ${h.from.name}` : h.kind === 'invisible' ? 'Unmarked portal: press ↑ at the spot' : h.kind === 'walk' ? 'Walk into the portal' : 'Through a portal'}
                      {range && ` · ${range}`}
                    </span>
                    {mobs.length > 0 && (
                      <span className="mt-0.5 flex items-center gap-0.5">
                        {mobs.slice(0, 5).map((r) => (
                          <MobIcon key={r.mob.id} mob={r.mob} box={22} />
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">No hidden maps lead off this one.</p>
      )}
    </Card>
  );
}

/** Where the map's portals go, and how you get in (portals in from other maps, or what sends you when none do). */
function Ways({ ix, map: m, onPortal }: { ix: AtlasIndex; map: AtlasMap; onPortal: (to: number | null) => void }) {
  const { go } = useAtlasNav();
  const exits = exitsOf(m, ix);
  const exitIds = new Set(exits.map((e) => e.map.id));
  const ins = (ix.into.get(m.id) ?? []).map((e) => ({ map: ix.map.get(e.from)!, kind: e.kind })).filter((e) => e.map && !exitIds.has(e.map.id));
  const back = m.back != null ? ix.map.get(m.back) : undefined;
  const row = (target: AtlasMap, note: string, key: string) => (
    <li key={key}>
      <button type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2 cursor-pointer" onMouseEnter={() => onPortal(target.id)} onClick={() => go(target.id)}>
        <span className="min-w-0 flex-1 truncate text-ink">{target.name}</span>
        {isHidden(target) && <Tag>hidden</Tag>}
        <span className="shrink-0 text-[11px] text-ink-3">{note}</span>
      </button>
    </li>
  );
  return (
    <Card title="Ways in and out">
      {exits.length ? (
        <>
          <div className="label mb-1">Portals lead to</div>
          <ul className="-mx-1.5 space-y-0.5" onMouseLeave={() => onPortal(null)}>
            {exits.map((e) => row(e.map, e.script ? 'scripted' : e.kind === 'invisible' ? 'unmarked' : e.kind === 'walk' ? 'walk in' : '', `x${e.map.id}`))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-ink-2">No portal leads anywhere from here.</p>
      )}
      {ins.length > 0 && (
        <>
          <div className="label mt-3 mb-1">Also reached from</div>
          <ul className="-mx-1.5 space-y-0.5">{ins.map((e) => row(e.map, e.kind === 'invisible' ? 'unmarked portal' : 'one-way', `i${e.map.id}`))}</ul>
        </>
      )}
      {!exits.length && !ins.length && !(ix.into.get(m.id) ?? []).length && <p className="mt-2 text-sm text-ink-2">No portal leads in either: an NPC, a quest or a party quest sends you.</p>}
      {m.note && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
          {m.note.how}
          {m.note.source && (
            <>
              {' '}
              <a href={m.note.source.url} target="_blank" rel="noreferrer" className="text-[11px] text-ink-3 hover:text-accent">
                ({m.note.source.title})
              </a>
            </>
          )}
        </p>
      )}
      {back && back.id !== m.id && (
        <p className="mt-3 border-t border-border pt-2 text-xs text-ink-2">
          Dying or a return scroll takes you to{' '}
          <button type="button" className="font-medium text-accent hover:underline cursor-pointer" onClick={() => go(back.id)}>
            {back.name}
          </button>
          .
        </p>
      )}
    </Card>
  );
}

/** NPCs, the other maps under the same world-map marker, and where the data comes from. */
function OnThisMap({ ix, map: m }: { ix: AtlasIndex; map: AtlasMap }) {
  const { go } = useAtlasNav();
  const npcs = [...new Set((m.npcs ?? []).map(([, , id]) => ix.doc.npcs[String(id)] ?? `NPC #${id}`))];
  const at = markerOf(m, ix);
  const siblings = at?.own ? at.marker.maps.filter((id) => id !== m.id).map((id) => ix.map.get(id)!).filter(Boolean) : [];
  return (
    <Card title="On this map">
      <div className="label mb-1">NPCs</div>
      {npcs.length ? <p className="text-sm text-ink">{npcs.join(', ')}</p> : <p className="text-sm text-ink-2">None.</p>}
      {siblings.length > 0 && (
        <>
          <div className="label mt-3 mb-1">Same world-map marker</div>
          <ul className="flex flex-wrap gap-1">
            {siblings.map((s) => (
              <li key={s.id}>
                <button type="button" className="chip" onClick={() => go(s.id)}>
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 border-t border-border pt-2 text-[11px] text-ink-3">
        Map, spawns, portals and NPCs from the launch client (
        <a href={ix.doc.source.url} target="_blank" rel="noreferrer" className="hover:text-accent">
          OSMS Data Explorer
        </a>
        ), map ID <span className="tabular">{m.id}</span>.
      </p>
    </Card>
  );
}
