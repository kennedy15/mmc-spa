import type { AtlasDoc, AtlasDrop, AtlasIsland, AtlasItem, AtlasMap, AtlasMarker, AtlasMob, PortalKind } from './types';

/** Lookups built once per atlas.json: maps, monsters and islands by ID, and the portal graph both ways. */
export interface AtlasIndex {
  doc: AtlasDoc;
  map: Map<number, AtlasMap>;
  mob: Map<number, AtlasMob>;
  island: Map<string, AtlasIsland>;
  /** Portals leading into each map from another map. */
  into: Map<number, { from: number; kind: PortalKind }[]>;
  /** The maps each monster spawns on, most spawn points first. */
  homes: Map<number, { map: AtlasMap; count: number }[]>;
}

const built = new WeakMap<AtlasDoc, AtlasIndex>();

export function indexAtlas(doc: AtlasDoc): AtlasIndex {
  const hit = built.get(doc);
  if (hit) return hit;
  const map = new Map(doc.maps.map((m) => [m.id, m]));
  const into = new Map<number, { from: number; kind: PortalKind }[]>();
  const homes = new Map<number, { map: AtlasMap; count: number }[]>();
  for (const m of doc.maps) {
    for (const p of m.portals ?? []) {
      if (p.to == null || p.to === m.id || !map.has(p.to)) continue;
      const list = into.get(p.to) ?? [];
      if (!list.some((e) => e.from === m.id)) list.push({ from: m.id, kind: p.kind });
      into.set(p.to, list);
    }
    const counts = new Map<number, number>();
    for (const [, , id] of m.spawns ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) homes.set(id, [...(homes.get(id) ?? []), { map: m, count }]);
  }
  for (const list of homes.values()) list.sort((a, b) => b.count - a.count);
  const ix: AtlasIndex = { doc, map, mob: new Map(doc.mobs.map((m) => [m.id, m])), island: new Map(doc.islands.map((i) => [i.id, i])), into, homes };
  built.set(doc, ix);
  return ix;
}

/** A hidden map: one the game files under "Hidden Street", or one no world-map marker lists. */
export const isHidden = (m: AtlasMap) => !!m.hidden || m.marker == null;

/** The world-map marker a map sits under: its own, or for a map no marker lists, the nearest listed map's (`own` false). */
export function markerOf(m: AtlasMap, ix: AtlasIndex): { island: AtlasIsland; index: number; marker: AtlasMarker; own: boolean } | null {
  const island = ix.island.get(m.island);
  const host = m.marker != null ? m : m.near != null ? ix.map.get(m.near) : undefined;
  if (!island || host?.marker == null) return null;
  return { island, index: host.marker, marker: island.markers[host.marker], own: host === m };
}

/** The monsters on a map with their spawn-point counts, most spawns first. */
export function mobsOn(m: AtlasMap, ix: AtlasIndex): { mob: AtlasMob; count: number }[] {
  const counts = new Map<number, number>();
  for (const [, , id] of m.spawns ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => ({ mob: ix.mob.get(id)!, count }))
    .filter((r) => r.mob)
    .sort((a, b) => b.count - a.count || a.mob.level - b.mob.level);
}

/** Monsters across several maps (a world-map marker's), with their total spawn points, most first. */
export function mobsAcross(maps: AtlasMap[], ix: AtlasIndex): { mob: AtlasMob; count: number }[] {
  const total = new Map<number, number>();
  for (const m of maps) for (const r of mobsOn(m, ix)) total.set(r.mob.id, (total.get(r.mob.id) ?? 0) + r.count);
  return [...total].map(([id, count]) => ({ mob: ix.mob.get(id)!, count })).sort((a, b) => b.count - a.count || a.mob.level - b.mob.level);
}

/** Lowest and highest level of the monsters worth EXP on the map (jump-quest obstacles give none), or null. */
export function levelRange(rows: { mob: AtlasMob }[]): [number, number] | null {
  const levels = rows.filter((r) => r.mob.exp > 0).map((r) => r.mob.level);
  return levels.length ? [Math.min(...levels), Math.max(...levels)] : null;
}

export const fmtLevels = (r: [number, number] | null) => (r ? (r[0] === r[1] ? `Lv ${r[0]}` : `Lv ${r[0]}–${r[1]}`) : null);

/** Maps a map's portals lead to (first portal of each), in the order the data lists them. */
export function exitsOf(m: AtlasMap, ix: AtlasIndex): { map: AtlasMap; kind: PortalKind; script?: boolean }[] {
  const seen = new Set<number>();
  const out: { map: AtlasMap; kind: PortalKind; script?: boolean }[] = [];
  for (const p of m.portals ?? []) {
    const to = p.to != null ? ix.map.get(p.to) : undefined;
    if (!to || to.id === m.id || seen.has(to.id)) continue;
    seen.add(to.id);
    out.push({ map: to, kind: p.kind, script: p.script });
  }
  return out;
}

/**
 * Hidden maps you can reach from `m`: the ones its portals lead to, then on through further hidden maps. Each map
 * comes once, under the map it is nearest through, in tree order (a map, then what lies past it).
 */
export function hiddenFrom(m: AtlasMap, ix: AtlasIndex, skip: Iterable<number> = []): { map: AtlasMap; depth: number; from: AtlasMap; kind: PortalKind }[] {
  const found = new Map<number, { map: AtlasMap; depth: number; from: AtlasMap; kind: PortalKind }>();
  const kids = new Map<number, number[]>();
  const seen = new Set([m.id, ...skip]);
  let level = [m];
  for (let depth = 1; level.length && depth < 8; depth++) {
    const next: AtlasMap[] = [];
    for (const at of level)
      for (const e of exitsOf(at, ix)) {
        if (seen.has(e.map.id) || !isHidden(e.map)) continue;
        seen.add(e.map.id);
        found.set(e.map.id, { map: e.map, depth, from: at, kind: e.kind });
        kids.set(at.id, [...(kids.get(at.id) ?? []), e.map.id]);
        next.push(e.map);
      }
    level = next;
  }
  const out: { map: AtlasMap; depth: number; from: AtlasMap; kind: PortalKind }[] = [];
  const walk = (id: number) => {
    for (const k of kids.get(id) ?? []) {
      out.push(found.get(k)!);
      walk(k);
    }
  };
  walk(m.id);
  return out;
}

/**
 * An island's hidden maps, grouped under the ordinary map you find each chain from (null: no portal leads in, so an
 * NPC, a quest or a party quest sends you). Groups follow the world-map marker order.
 */
export function hiddenGroups(island: AtlasIsland, ix: AtlasIndex): { from: AtlasMap | null; maps: { map: AtlasMap; depth: number; from: AtlasMap }[] }[] {
  const maps = ix.doc.maps.filter((m) => m.island === island.id);
  const placed = new Set<number>();
  const groups: { from: AtlasMap | null; maps: { map: AtlasMap; depth: number; from: AtlasMap }[] }[] = [];
  const order = (m: AtlasMap) => markerOf(m, ix)?.index ?? 999;
  for (const m of [...maps].filter((x) => !isHidden(x)).sort((a, b) => order(a) - order(b) || a.id - b.id)) {
    const found = hiddenFrom(m, ix).filter((h) => !placed.has(h.map.id));
    if (!found.length) continue;
    for (const h of found) placed.add(h.map.id);
    groups.push({ from: m, maps: found });
  }
  // What's left has no way in from an ordinary map: start from the ones nothing leads into.
  const rest = maps.filter((m) => isHidden(m) && !placed.has(m.id));
  const orphans: { map: AtlasMap; depth: number; from: AtlasMap }[] = [];
  for (const root of rest.filter((m) => !(ix.into.get(m.id) ?? []).some((e) => rest.some((r) => r.id === e.from))).sort((a, b) => a.id - b.id)) {
    if (placed.has(root.id)) continue;
    placed.add(root.id);
    orphans.push({ map: root, depth: 0, from: root });
    for (const h of hiddenFrom(root, ix))
      if (!placed.has(h.map.id)) {
        placed.add(h.map.id);
        orphans.push({ map: h.map, depth: h.depth, from: h.from });
      }
  }
  for (const m of rest) if (!placed.has(m.id)) orphans.push({ map: m, depth: 0, from: m });
  if (orphans.length) groups.push({ from: null, maps: orphans });
  return groups;
}

/** Every item the map's monsters drop, with each monster that drops it and its rate there (most spawns first). */
export function dropsOn(rows: { mob: AtlasMob }[], ix: AtlasIndex): { id: number; item: AtlasItem; from: { mob: AtlasMob; drop: AtlasDrop }[]; quest: boolean }[] {
  const out = new Map<number, { id: number; item: AtlasItem; from: { mob: AtlasMob; drop: AtlasDrop }[]; quest: boolean }>();
  for (const { mob } of rows)
    for (const d of mob.drops ?? []) {
      const item = ix.doc.items?.[String(d.id)];
      if (!item) continue;
      const row = out.get(d.id) ?? { id: d.id, item, from: [], quest: !!d.quest };
      row.from.push({ mob, drop: d });
      row.quest &&= !!d.quest;
      out.set(d.id, row);
    }
  const rank: Record<string, number> = { Equip: 0, Use: 1, Setup: 2, Etc: 3 };
  return [...out.values()].sort((a, b) => Number(a.quest) - Number(b.quest) || (rank[a.item.type] ?? 9) - (rank[b.item.type] ?? 9) || a.item.name.localeCompare(b.item.name));
}

/** A drop rate as text: "45.8%", "0.5%", or "no count yet". */
export const fmtRate = (d: { rate?: number }) => (d.rate == null ? 'no count yet' : `${d.rate < 1 ? d.rate.toFixed(1) : d.rate >= 10 ? Math.round(d.rate) : d.rate.toFixed(1)}%`);

/** Share of a physical (weapon DEF) or magic (magic DEF) hit that gets through: the client's Damage × 100 / (DEF + 100). */
export const throughDef = (def: number | undefined) => 100 / ((def ?? 0) + 100);

/**
 * Accuracy for every hit to land on `mob` when you are `below` levels under it (0 at its level or above), from the
 * launch client's hit check (OSMS formulas): BaseChance = Acc × 100 / ((2 × LevelDiff + 51) × 5), a roll of
 * BaseChance × U(1 − Spread, 1 + Spread) must reach Avoid, Spread = 0.15 + 0.2 / (1 + e^((BaseChance − Avoid) / 12)).
 * So every roll lands once (1 − Spread) × BaseChance ≥ Avoid. 0 for a monster with no avoid.
 */
export function accToAlwaysHit(eva: number, below = 0): number {
  if (eva <= 0) return 0;
  const spread = (bc: number) => 0.15 + 0.2 / (1 + Math.exp((bc - eva) / 12));
  let lo = eva;
  let hi = eva * 3 + 60;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if ((1 - spread(mid)) * mid >= eva) hi = mid;
    else lo = mid;
  }
  return Math.ceil((hi * ((2 * Math.max(0, below) + 51) * 5)) / 100);
}

/** Readable portal kinds, for tooltips and lists. */
export const PORTAL_LABEL: Record<PortalKind, string> = {
  visible: 'portal',
  invisible: 'unmarked portal: press ↑ at the spot',
  walk: 'walk into it',
  script: 'scripted portal',
  quest: 'quest spot',
  stage: 'stage exit',
};

/** Runs of numbered rooms side by side ("Free Market <1>" to "<11>") folded into their first, the rest in `more`. */
export function foldRooms<T extends { map: AtlasMap; depth: number }>(list: T[]): (T & { more?: AtlasMap[] })[] {
  const stem = (name: string) => name.match(/^(.*) <\d+>$/)?.[1];
  const out: (T & { more?: AtlasMap[] })[] = [];
  for (const item of list) {
    const last = out[out.length - 1];
    const s = stem(item.map.name);
    if (last && s && last.depth === item.depth && stem(last.map.name) === s) (last.more ??= []).push(item.map);
    else out.push({ ...item });
  }
  return out;
}

/** Seconds as a short duration: "45 s", "5 min", "1 h", "1 h 30 min". */
function dur(s: number): string {
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A monster's spawn timer on a map ("1 h", "3–30 min"), or null when its points refill with the map (about every 7 s). */
export function spawnTimer(m: AtlasMap, mob: number): string | null {
  const t = m.timers?.[String(mob)];
  if (!t) return null;
  if (t[0] === t[1]) return dur(t[0]);
  return t[1] < 3600 && t[0] >= 60 ? `${Math.round(t[0] / 60)}–${Math.round(t[1] / 60)} min` : `${dur(t[0])} to ${dur(t[1])}`;
}

export const TIMER_HINT = 'A timed spawn point: it waits this long before it spawns again (the map data’s timer; real timing can differ)';

const parents = new WeakMap<AtlasIndex, Map<number, number>>();

/**
 * The maps you pass through to reach hidden map `m` from an ordinary one (its parent, that map's parent, and so on), so a
 * hidden map's own list doesn't offer the way back as somewhere hidden to find. Empty for an ordinary map.
 */
export function ancestorsOf(m: AtlasMap, ix: AtlasIndex): number[] {
  let parent = parents.get(ix);
  if (!parent) {
    parent = new Map();
    for (const island of ix.doc.islands)
      for (const g of hiddenGroups(island, ix))
        for (const h of g.maps) {
          if (h.depth > 0) parent.set(h.map.id, h.from.id);
        }
    parents.set(ix, parent);
  }
  const out: number[] = [];
  for (let at = parent.get(m.id); at != null && !out.includes(at); at = parent.get(at)) out.push(at);
  return out;
}
