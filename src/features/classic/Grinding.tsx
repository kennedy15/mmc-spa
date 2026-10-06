import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Empty, Modal, NumberInput, PageHeader, Spinner, Toggle } from '../../app/ui';
import { HoverTip } from '../../app/HoverTip';
import { anchorOf, type Tip } from '../../app/tip';
import { fmtInt } from '../../app/format';
import { useClassic } from './data';
import { ARCHETYPES, bySpawns, expPerHp, mainMonster, MISS_GAP, MISS_SOURCE, missGap, siteOf } from './labels';
import { Emblem } from './bits';
import { MISS_TAG, MissTag, MobRow, MobSprite, SpotLayout } from './SpotParts';
import { MapView } from './MapView';
import type { Archetype, Availability, ClassicDoc, GrindSpot, PartyQuest } from './types';

const LS_LEVEL = 'mt.classic.level';
const LS_CLASS = 'mt.classic.class';
const LS_BRANCH = 'mt.classic.branch';
const LS_LATER = 'mt.classic.later';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

const GROUPS: { key: Availability; title: string; note: string }[] = [
  { key: 'launch', title: 'Open at launch', note: 'Maple Island and Victoria Island' },
  { key: 'soon', title: 'Coming later', note: "Forgotten Hollow: in the first test, held back from Founder's Access" },
  { key: 'cot2', title: 'Second test only', note: 'Orbis and El Nath, held back for rework' },
];

export function GrindingSpots() {
  const { doc, error } = useClassic();
  if (error) return <Empty title="Classic World data missing">public/classic.json could not be loaded ({error}).</Empty>;
  if (!doc) return <Spinner label="Loading grinding spots…" />;
  return <Grinding doc={doc} />;
}

function Grinding({ doc }: { doc: ClassicDoc }) {
  const top = Math.max(doc.world.levelCap, ...doc.spots.map((s) => s.levels[1]));
  const [level, setLevelState] = useState(() => {
    const n = Number(readLocal(LS_LEVEL));
    return Number.isInteger(n) && n >= 1 && n <= top ? n : 30;
  });
  // A build page's "Where to train" link presets the class and branch (?class=&branch=).
  const [params, setParams] = useSearchParams();
  const [cls, setClsState] = useState<Archetype | 'All'>(() => {
    const v = params.get('class') ?? readLocal(LS_CLASS);
    return v && (ARCHETYPES as string[]).includes(v) ? (v as Archetype) : 'All';
  });
  const [branch, setBranchState] = useState<string | null>(() => (params.has('class') ? params.get('branch') : readLocal(LS_BRANCH)));
  // After the preset, the picks are remembered like any other and the query comes off the URL.
  useEffect(() => {
    if (!params.has('class')) return;
    writeLocal(LS_CLASS, cls);
    writeLocal(LS_BRANCH, branch);
    setParams({}, { replace: true });
    window.scrollTo(0, 0);
  }, [params, cls, branch, setParams]);
  const [later, setLaterState] = useState(() => readLocal(LS_LATER) === '1');
  const setLevel = (n: number) => {
    const v = Math.min(top, Math.max(1, Math.round(n) || 1));
    setLevelState(v);
    writeLocal(LS_LEVEL, String(v));
  };
  const setCls = (a: Archetype | 'All') => {
    setClsState(a);
    setBranchState(null);
    writeLocal(LS_CLASS, a);
    writeLocal(LS_BRANCH, null);
  };
  const setBranch = (b: string | null) => {
    setBranchState(b);
    writeLocal(LS_BRANCH, b);
  };
  const setLater = (on: boolean) => {
    setLaterState(on);
    writeLocal(LS_LATER, on ? '1' : null);
  };

  const archetypes = ARCHETYPES.filter((a) => doc.builds.some((b) => b.archetype === a));
  const builds = useMemo(() => doc.builds.filter((b) => b.archetype === cls), [doc.builds, cls]);
  const picked = builds.find((b) => b.path[1] === branch) ?? null;
  // Names a spot's bestFor can use for the chosen class: the archetype and its 2nd and 3rd jobs.
  const names = useMemo(() => new Set((picked ? [picked] : builds).flatMap((b) => [b.archetype, b.path[1], b.name])), [picked, builds]);
  const suits = (s: GrindSpot) => cls === 'All' || s.bestFor.some((f) => f === 'All' || names.has(f));
  const inRange = (s: GrindSpot) => level >= s.levels[0] && level <= s.levels[1];
  const shown = (s: GrindSpot) => s.available === 'launch' || later;
  const fits = (s: GrindSpot) => shown(s) && inRange(s) && suits(s);

  const spots = useMemo(() => [...doc.spots].sort((a, b) => a.levels[0] - b.levels[0] || a.levels[1] - b.levels[1]), [doc.spots]);
  // Hash routing owns the URL fragment, so in-page jumps scroll by element id instead of #anchors.
  const [open, setOpen] = useState<string | null>(null);
  const [jump, setJump] = useState<{ id: string } | null>(null);
  // The spot whose world-map location is open.
  const [mapFor, setMapFor] = useState<GrindSpot | null>(null);
  // The "At Lv N" list: its sort and its open row.
  const [nowSort, setNowSort] = useState<SpotSort>({ key: 'levels', desc: false });
  const [openNow, setOpenNow] = useState<string | null>(null);
  useEffect(() => {
    if (jump) document.getElementById(jump.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jump]);
  const reveal = (id: string) => {
    setOpen(id);
    setJump({ id: `spot-${id}` });
  };
  const mapped = spots.filter(shown);
  const now = spots.filter(fits);
  // Any monster on a listed spot far enough above your level to miss: the list then explains its "+N Lv" tags.
  const flagged = now.some((s) => s.monsters.some((m) => missGap(m, level) > 0));
  const hidden = spots.filter((s) => !shown(s)).length;
  const quests = doc.partyQuests.filter((q) => level >= q.levels[0] && level <= q.levels[1]);
  // bestFor names a spot can use: archetypes and the 2nd/3rd jobs of each build.
  const classOf = useMemo(() => {
    const m = new Map<string, Archetype>();
    for (const b of doc.builds) for (const n of [b.archetype, ...b.path, b.name]) m.set(n, b.archetype);
    return (name: string) => m.get(name) ?? null;
  }, [doc.builds]);
  // Level boxes 5 apart (1, 5, 10 … the cap); the lit box is the highest one at or below the level.
  const steps = [1, ...Array.from({ length: Math.floor(top / 5) }, (_, i) => (i + 1) * 5)];
  const step = steps.filter((v) => v <= level).pop() ?? 1;
  // Keep the lit box in view when the boxes are a scrolling strip (phones); scrollLeft leaves the page alone.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const lit = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && lit && el.scrollWidth > el.clientWidth) el.scrollLeft = lit.offsetLeft - el.offsetLeft - (el.clientWidth - lit.offsetWidth) / 2;
  }, [step]);

  return (
    <>
      <PageHeader title="Grinding spots" subtitle="MapleStory Classic World: where testers trained in the closed online tests, set against the Lv 100 launch. Pick your level and class." />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <span className="label w-12">Level</span>
        {/* On phones the boxes are one scrolling strip under the number, kept on the lit box. */}
        <div ref={strip} className="flex gap-1 sm:flex-wrap max-sm:order-last max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1" role="group" aria-label="Pick a level">
          {steps.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === step}
              onClick={() => setLevel(v)}
              className={`h-8 min-w-9 shrink-0 rounded-md border px-1.5 text-xs font-semibold tabular transition-colors cursor-pointer ${v === step ? 'border-accent bg-accent text-on-accent' : 'border-border-2 bg-surface-2 text-ink-2 hover:border-ink-3 hover:text-ink'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1">
          <button type="button" className="btn h-8 w-8 justify-center px-0 sm:hidden" onClick={() => setLevel(level - 1)} disabled={level <= 1} aria-label="One level down">
            −
          </button>
          <NumberInput value={level} min={1} max={top} onChange={setLevel} className="input w-18 h-8 tabular" label="Your exact level" />
          <button type="button" className="btn h-8 w-8 justify-center px-0 sm:hidden" onClick={() => setLevel(level + 1)} disabled={level >= top} aria-label="One level up">
            +
          </button>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by class">
          <span className="label w-12">Class</span>
          {/* As tall as the level boxes, so the two filter rows line up and are easy to tap. */}
          {(['All', ...archetypes] as const).map((a) => (
            <button key={a} type="button" className={`${cls === a ? 'chip-on' : 'chip'} h-8 gap-1.5 text-sm ${a === 'All' ? 'px-3.5' : 'pl-2 pr-3'}`} aria-pressed={cls === a} onClick={() => setCls(a)}>
              {a !== 'All' && <Emblem archetype={a} size={16} />}
              {a}
            </button>
          ))}
        </div>
        <Toggle checked={later} onChange={setLater} label={<span className="text-ink-2">Areas not at launch</span>} />
      </div>
      {builds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 -mt-1 mb-4" role="group" aria-label={`${cls} branch`}>
          <span className="label w-12">Branch</span>
          <button type="button" className={`${branch == null ? 'chip-on' : 'chip'} h-8 px-3 text-sm`} aria-pressed={branch == null} onClick={() => setBranch(null)}>
            Any {cls}
          </button>
          {builds.map((b) => (
            <button key={b.id} type="button" className={`${branch === b.path[1] ? 'chip-on' : 'chip'} h-8 px-3 text-sm`} aria-pressed={branch === b.path[1]} onClick={() => setBranch(b.path[1])}>
              {b.path[1]}
            </button>
          ))}
        </div>
      )}

      {/* The answer to "where do I train?" comes straight after the filters; the overviews follow it. */}
      <section aria-label={`Spots at level ${level}`}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">
            At Lv {level}
            {cls !== 'All' && <span className="text-ink-3 font-normal"> · {branch ?? cls}</span>}
          </h2>
          <span className="text-xs text-ink-3">
            {now.length} spot{now.length === 1 ? '' : 's'} · open a row for its minimap, monsters and tips
          </span>
        </div>
        {flagged && (
          <p className="-mt-1 mb-2 text-xs text-ink-3">
            <span className={MISS_TAG}>+N Lv</span> a monster that many levels above you. From {MISS_GAP} up, your attacks and spells miss it more often.{' '}
            <a href={MISS_SOURCE.url} target="_blank" rel="noreferrer" className="whitespace-nowrap hover:text-accent" title={MISS_SOURCE.title}>
              ↗ henesys.gg
            </a>
          </p>
        )}
        {now.length === 0 ? (
          <Empty title="No listed spot for this level and class">Try “Any” for the branch or class, or a level a little higher or lower.</Empty>
        ) : (
          <SpotList spots={now} level={level} sort={nowSort} onSort={setNowSort} open={openNow} onOpen={setOpenNow} onMap={setMapFor} classOf={classOf} idPrefix="now" />
        )}
      </section>

      <Card
        title={`Quests at Lv ${level}`}
        className="mt-4"
        action={
          <button type="button" className="text-xs text-ink-3 hover:text-accent cursor-pointer" onClick={() => setJump({ id: 'quests' })}>
            All quests ↓
          </button>
        }
      >
        {quests.length === 0 ? (
          <p className="text-sm text-ink-3">Nothing listed for this level.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
            {quests.map((q) => (
              <li key={q.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{q.name}</span>
                  <span className="text-xs text-ink-3 tabular shrink-0">
                    Lv {q.levels[0]}–{q.levels[1]}
                  </span>
                </div>
                <div className="text-xs text-ink-3">
                  {q.where} · {q.party}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Route spots={spots.filter((x) => shown(x) && suits(x))} level={level} top={top} onLevel={setLevel} onOpen={reveal} />

      <LevelMap spots={mapped} level={level} top={top} fits={fits} onPick={setLevel} onOpen={reveal} hidden={hidden} />

      {/* Full width, two columns from md up, so the long list stays short. */}
      <Card title="Leveling tips" className="mt-4">
        <ul className="gap-x-8 md:columns-2">
          {doc.tips.map((t, i) => (
            <li key={i} className="mb-2.5 flex break-inside-avoid gap-2.5 text-sm text-ink-2">
              <span className="text-accent shrink-0" aria-hidden>
                ◆
              </span>
              <span>
                {t.text}
                {t.source && (
                  <a href={t.source.url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-ink-3 hover:text-accent whitespace-nowrap" title={t.source.title}>
                    ↗ {siteOf(t.source.url)}
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="text-lg font-semibold mt-8 mb-1">Every spot</h2>
      <p className="text-sm text-ink-3 mb-4">Monster numbers and spawns are from the launch client's data (Founder's Access, October 6); areas not out yet keep the second test's numbers.</p>
      {GROUPS.map((g) => {
        const list = spots.filter((s) => s.available === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="mb-6">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="font-semibold">{g.title}</h3>
              <span className="text-xs text-ink-3">
                {g.note} · {list.length}
              </span>
            </div>
            <SpotList spots={list} level={level} open={open} onOpen={setOpen} fits={fits} onMap={setMapFor} classOf={classOf} idPrefix="spot" />
          </section>
        );
      })}

      <Modal open={!!mapFor} onClose={() => setMapFor(null)} wide title={mapFor && <>{mapFor.map} <span className="text-ink-3 font-normal text-sm">· {mapFor.area} · Lv {mapFor.levels[0]}–{mapFor.levels[1]}</span></>}>
        {mapFor && <MapView maps={doc.worldMaps} spot={mapFor} />}
      </Modal>

      <section id="quests" className="scroll-mt-4">
        <h2 className="text-lg font-semibold mt-8 mb-1">Quests and party quests</h2>
        <p className="text-sm text-ink-3 mb-4">Worth doing alongside grinding. KPQ is the only party quest in the launch.</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Quests at your level get an accent outline and level tag; the others keep full-contrast text. */}
          {doc.partyQuests.map((q) => {
            const here = level >= q.levels[0] && level <= q.levels[1];
            return (
              <div key={q.id} className={`card p-4 ${here ? 'border-accent' : ''}`}>
                <Quest quest={q} here={here} />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Quest({ quest: q, here }: { quest: PartyQuest; here: boolean }) {
  return (
    <div className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-ink">{q.name}</span>
        <span className={`shrink-0 text-xs tabular ${here ? 'rounded-md bg-accent px-1.5 py-0.5 font-semibold text-on-accent' : 'text-ink-3'}`} title={here ? 'At your level' : undefined}>
          Lv {q.levels[0]}–{q.levels[1]}
        </span>
      </div>
      <div className="text-xs text-ink-3">
        {q.where} · {q.party}
      </div>
      <p className="text-ink-2 mt-1">{q.why}</p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
        <span>{q.available}</span>
        {q.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="hover:text-accent" title={s.title}>
            ↗ {siteOf(s.url)}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * The whole climb at a glance: for every ten levels, the spots that cover most of that bracket for the
 * chosen class (up to three, each with its main monster). The bracket you're in is lit; a spot opens its
 * card below, a bracket heading jumps your level there. Spots the launch doesn't have carry a "later" tag.
 */
function Route({ spots, level, top, onLevel, onOpen }: { spots: GrindSpot[]; level: number; top: number; onLevel: (n: number) => void; onOpen: (id: string) => void }) {
  const brackets = Array.from({ length: Math.ceil(top / 10) }, (_, i) => [i * 10 + 1, Math.min(top, i * 10 + 10)] as const);
  const overlap = (s: GrindSpot, [a, z]: readonly [number, number]) => Math.max(0, Math.min(z, s.levels[1]) - Math.max(a, s.levels[0]) + 1);
  return (
    <Card title="Route" className="mt-4" action={<span className="text-xs text-ink-3">best-covering spots for every 10 levels · click one to open it</span>}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {brackets.map((br) => {
          const picks = spots
            .map((s) => ({ s, o: overlap(s, br) }))
            .filter((x) => x.o >= 3)
            .sort((x, y) => y.o - x.o || x.s.levels[0] - y.s.levels[0])
            .slice(0, 3);
          const here = level >= br[0] && level <= br[1];
          return (
            <li key={br[0]} className={`rounded-xl border p-2 ${here ? 'border-accent bg-accent/10' : 'border-border bg-surface-2/50'}`}>
              <button type="button" onClick={() => onLevel(br[0])} className={`mb-1.5 text-xs font-semibold tabular cursor-pointer hover:text-accent ${here ? 'text-accent' : 'text-ink'}`}>
                Lv {br[0]}–{br[1]}
              </button>
              {picks.length === 0 && <p className="text-[11px] text-ink-3">No listed spot</p>}
              <ul className="space-y-1">
                {picks.map(({ s }) => {
                  const main = mainMonster(s);
                  const later = s.available !== 'launch';
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-surface cursor-pointer" title={`${s.map} · Lv ${s.levels[0]}–${s.levels[1]}${later ? ` · ${availLabel(s.available)}` : ''}`}>
                        {main ? <MobSprite monster={main} box={24} /> : <span className="size-6 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">{s.map}</span>
                        {later && <span className="shrink-0 rounded border border-dashed border-warn/60 px-1 text-[10px] font-medium leading-4 text-warn">later</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * Every shown spot as a level range on one axis, sorted by entry level. Spots that fit
 * the chosen level and class are the accent and the rest stay grey; spots the launch
 * doesn't have are outlined. Clicking a bar jumps to its card; the orange level line can be
 * dragged (or moved with the arrow keys), and clicking the axis jumps it there.
 */
function LevelMap({ spots, level, top, fits, onPick, onOpen, hidden }: { spots: GrindSpot[]; level: number; top: number; fits: (s: GrindSpot) => boolean; onPick: (n: number) => void; onOpen: (id: string) => void; hidden: number }) {
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const levelAt = (clientX: number) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r || !r.width) return level;
    return 1 + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (top - 1);
  };
  const keys = (e: KeyboardEvent) => {
    const to = { ArrowLeft: level - 1, ArrowDown: level - 1, ArrowRight: level + 1, ArrowUp: level + 1, PageDown: level - 5, PageUp: level + 5, Home: 1, End: top }[e.key];
    if (to == null) return;
    e.preventDefault();
    onPick(to);
  };
  // The box width rides along with the tip, read when it opens, so HoverTip can keep it inside the card.
  const [tip, setTip] = useState<(Tip & { width: number }) | null>(null);
  const x = (lvl: number) => `${((lvl - 1) / (top - 1)) * 100}%`;
  const ticks = [1, ...Array.from({ length: Math.floor(top / 10) }, (_, i) => (i + 1) * 10)];
  const show = (el: Element, s: GrindSpot) => {
    if (!box.current) return;
    const rows = [
      { value: s.map },
      { value: `Lv ${s.levels[0]}–${s.levels[1]}`, label: s.available === 'launch' ? s.area : `${s.area} · not at launch` },
      ...s.monsters.slice(0, 3).map((m) => {
        // The same "+N Lv" warning as the spot rows, for spots whose range includes your level.
        const gap = level >= s.levels[0] && level <= s.levels[1] ? missGap(m, level) : 0;
        return { value: m.name, label: [`Lv ${m.level}${gap ? ` (+${gap}, expect misses)` : ''}`, m.hp != null && `${fmtInt(m.hp)} HP`, m.exp != null && `${fmtInt(m.exp)} EXP`].filter(Boolean).join(' · ') };
      }),
    ];
    setTip({ ...anchorOf(el, box.current), rows, width: box.current.clientWidth });
  };
  return (
    <Card
      title="Level map"
      className="mt-4 max-sm:hidden"
      action={
        <span className="text-xs text-ink-3">
          Bars span each spot's levels · click one to open it{hidden > 0 && ` · ${hidden} spots not at launch hidden`}
        </span>
      }
    >
      <div ref={box} className="relative flex gap-3 pt-6" onMouseLeave={() => setTip(null)}>
        <ul className="w-44 max-sm:w-28 shrink-0">
          {spots.map((s) => (
            <li key={s.id} className="h-[22px] flex items-center">
              <button type="button" onClick={() => onOpen(s.id)} className={`truncate text-left text-xs cursor-pointer hover:text-accent ${fits(s) ? 'text-ink font-medium' : 'text-ink-3'}`} title={s.map}>
                {s.map}
              </button>
            </li>
          ))}
        </ul>
        <div ref={plot} className="relative min-w-0 flex-1">
          {spots.map((s) => {
            const on = fits(s);
            const later = s.available !== 'launch';
            return (
              <div key={s.id} className="relative h-[22px]">
                <button
                  type="button"
                  onClick={() => onOpen(s.id)}
                  aria-label={`${s.map}, levels ${s.levels[0]} to ${s.levels[1]}${later ? ', not at launch' : ''}`}
                  className="group absolute inset-y-0 flex items-center cursor-pointer"
                  style={{ left: x(s.levels[0]), width: `max(${x(s.levels[1])} - ${x(s.levels[0])}, 8px)` }}
                  onMouseEnter={(e) => show(e.currentTarget, s)}
                  onFocus={(e) => show(e.currentTarget, s)}
                  onBlur={() => setTip(null)}
                >
                  {/* Matches are thick and dark, the rest thin and pale, so they separate by lightness and size as well as hue
                      (full-strength border-2 is only 1.5:1 against the accent, 1.4:1 for deuteranopes). */}
                  <span
                    className={`block w-full rounded-full transition-colors ${on ? 'h-3' : 'h-2'} ${
                      later ? `border border-dashed ${on ? 'border-accent bg-accent/20' : 'border-ink-3/70 group-hover:border-ink-2'}` : on ? 'bg-accent group-hover:bg-accent-2' : 'bg-border-2/50 group-hover:bg-border-2'
                    }`}
                  />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="relative block h-6 w-full mt-1 border-t border-border cursor-pointer"
            aria-label="Set your level from the axis"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onPick(1 + ((e.clientX - r.left) / r.width) * (top - 1));
            }}
          >
            {ticks.map((t) => (
              <span key={t} className="absolute top-1 -translate-x-1/2 text-[11px] text-ink-3 tabular" style={{ left: x(t) }}>
                {t}
              </span>
            ))}
          </button>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Your level"
            aria-valuemin={1}
            aria-valuemax={top}
            aria-valuenow={level}
            title="Drag to change your level"
            className={`group absolute top-0 bottom-7 z-10 w-5 -translate-x-1/2 touch-none focus:outline-none ${dragging ? 'cursor-grabbing' : 'cursor-ew-resize'}`}
            style={{ left: x(level) }}
            onKeyDown={keys}
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // No capture (e.g. a synthetic event): the drag still follows moves over the handle.
              }
              e.currentTarget.focus();
              setDragging(true);
              setTip(null);
            }}
            onPointerMove={(e) => dragging && onPick(levelAt(e.clientX))}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <span className={`absolute inset-y-0 left-1/2 -translate-x-1/2 bg-accent transition-[width] ${dragging ? 'w-[3px]' : 'w-0.5 group-hover:w-[3px] group-focus-visible:w-[3px]'}`} />
            <span className={`absolute -top-1 left-1/2 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-on-accent tabular shadow ${dragging ? 'ring-2 ring-accent/40' : 'group-focus-visible:ring-2 group-focus-visible:ring-accent/40'}`}>
              <span aria-hidden>‹</span>
              {level}
              <span aria-hidden>›</span>
            </span>
          </div>
        </div>
        <HoverTip tip={tip} width={tip?.width} />
      </div>
    </Card>
  );
}

type SpotSort = { key: 'levels' | 'exp' | 'spawns'; desc: boolean };

/** Columns from md up: spot, levels, EXP/HP, spawns, best for, map pin, chevron. Phones get a wrapped row. */
const GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_5.5rem_4.5rem_3.75rem_6rem_1.75rem_0.75rem] md:gap-x-3';

/** EXP/HP as the plain ratio Classic guides use (mapleclassic.wiki, maplestory.quest: "0.091"); a percent read like a share of the EXP bar. */
const ratioText = (r: number) => r.toFixed(3);

function sortSpots(list: GrindSpot[], sort: SpotSort): GrindSpot[] {
  const v = (s: GrindSpot) => (sort.key === 'exp' ? (expPerHp(s) ?? 0) : sort.key === 'spawns' ? s.spawns : s.levels[0] + s.levels[1] / 1000);
  return [...list].sort((a, b) => (sort.desc ? v(b) - v(a) : v(a) - v(b)));
}

const EXP_HP_HINT = "EXP per point of monster HP, averaged over the map's spawn points: 0.075 is 75 EXP for every 1,000 HP you deal. Compare maps you kill in the same number of hits.";

/**
 * Spot rows under a column header; with `sort`, the level, EXP/HP and spawn headings sort the list. A row opens to its details.
 * Rows whose range includes your `level` tag monsters MISS_GAP or more levels above it; other rows aren't spots for you yet.
 */
function SpotList({ spots, level, sort, onSort, open, onOpen, fits, onMap, classOf, idPrefix }: { spots: GrindSpot[]; level: number; sort?: SpotSort; onSort?: (s: SpotSort) => void; open: string | null; onOpen: (id: string | null) => void; fits?: (s: GrindSpot) => boolean; onMap: (s: GrindSpot) => void; classOf: ClassOf; idPrefix: string }) {
  const list = sort ? sortSpots(spots, sort) : spots;
  // Levels sort low-first; EXP/HP and spawns start from the top.
  const head = (key: SpotSort['key'], label: string, title?: string) => {
    if (!sort || !onSort) return <span title={title}>{label}</span>;
    const on = sort.key === key;
    return (
      <button type="button" title={title} aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : 'none'} onClick={() => onSort(on ? { key, desc: !sort.desc } : { key, desc: key !== 'levels' })} className={`inline-flex items-center gap-0.5 uppercase tracking-wider cursor-pointer hover:text-ink ${on ? 'text-ink' : ''}`}>
        {label}
        <span aria-hidden className="text-[9px]">
          {on ? (sort.desc ? '▼' : '▲') : ''}
        </span>
      </button>
    );
  };
  return (
    <div className="card divide-y divide-border">
      <div className={`hidden items-end px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-ink-3 ${GRID}`} aria-hidden={!sort}>
        <span>Spot · main monster</span>
        {head('levels', 'Levels')}
        {head('exp', 'EXP/HP', EXP_HP_HINT)}
        {head('spawns', 'Spawns', 'Spawn points on the map (launch data; COT #2 data for areas not out yet)')}
        <span>Best for</span>
        <span />
        <span />
      </div>
      {list.map((s) => (
        <SpotRow key={s.id} id={`${idPrefix}-${s.id}`} spot={s} level={level >= s.levels[0] && level <= s.levels[1] ? level : null} on={fits?.(s)} open={open === s.id} onToggle={(o) => (o ? onOpen(s.id) : open === s.id && onOpen(null))} onMap={onMap} classOf={classOf} />
      ))}
    </div>
  );
}

/** One spot: its main monster, levels and numbers in columns; opens to the minimap, monsters, tips and sources. */
function SpotRow({ spot: s, id, level, on, open, onToggle, onMap, classOf }: { spot: GrindSpot; id: string; level: number | null; on?: boolean; open: boolean; onToggle: (open: boolean) => void; onMap: (s: GrindSpot) => void; classOf: ClassOf }) {
  const main = mainMonster(s);
  const gap = main ? missGap(main, level) : 0;
  const ratio = expPerHp(s);
  const any = s.bestFor.includes('All');
  const classes = ARCHETYPES.filter((a) => s.bestFor.some((f) => classOf(f) === a));
  return (
    <details id={id} open={open} onToggle={(e) => e.currentTarget.open !== open && onToggle(e.currentTarget.open)} className="group scroll-mt-4">
      <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden ${GRID} md:items-center`}>
        <span className="flex min-w-0 flex-1 items-center gap-3">
          {/* Only matches get a dot (the space stays so rows line up); their level badge is lit too. */}
          {on != null && <span className={`size-2 shrink-0 rounded-full ${on ? 'bg-accent' : ''}`} title={on ? 'Fits your level and class' : undefined} aria-hidden />}
          {main ? <MobSprite monster={main} box={32} /> : <span className="size-8 shrink-0" />}
          <span className="min-w-0">
            {/* Not-at-launch spots are tagged on the row itself, not only inside it or in a group heading. */}
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="min-w-0 font-medium text-ink md:truncate">{s.map}</span>
              <AvailBadge spot={s} />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-ink-3 md:flex-nowrap">
              <span className="min-w-0 md:truncate">
                {s.area}
                {main && ` · ${main.name}, Lv ${main.level}`}
              </span>
              {main && gap > 0 && <MissTag monster={main} gap={gap} />}
            </span>
            <span className="block text-[11px] text-ink-3 tabular md:hidden">
              {ratio != null && `${ratioText(ratio)} EXP/HP · `}
              {s.spawns} spawns
            </span>
          </span>
        </span>
        <LevelBadge spot={s} lit={on === true} />
        <span className="hidden text-sm text-ink tabular md:block" title={EXP_HP_HINT}>
          {ratio != null ? ratioText(ratio) : '—'}
        </span>
        <span className="hidden text-sm text-ink tabular md:block">{s.spawns}</span>
        <span className="hidden flex-wrap items-center gap-1 md:flex" title={s.bestFor.map((f) => (f === 'All' ? 'Any class' : f)).join(', ')}>
          {any ? <span className="text-xs text-ink-2">Any class</span> : classes.map((a) => <Emblem key={a} archetype={a} size={16} />)}
        </span>
        {s.place ? (
          <button
            type="button"
            className="btn-ghost btn-sm px-1.5"
            title="Show on the in-game map"
            aria-label={`Show ${s.map} on the in-game map`}
            onClick={(e) => {
              // A button inside <summary> would also toggle the row.
              e.preventDefault();
              onMap(s);
            }}
          >
            <PinIcon />
          </button>
        ) : (
          <span className="hidden md:block" />
        )}
        <span className="text-ink-3 transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className={`px-4 pb-4 ${on != null ? 'md:pl-[4.1rem]' : 'md:pl-[3.75rem]'}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          {s.region} · {s.style === 'both' ? 'solo or party' : s.style}
          {s.place && (
            <button type="button" className="btn btn-sm ml-auto" onClick={() => onMap(s)}>
              <PinIcon /> Show on the world map
            </button>
          )}
        </div>
        <SpotBody spot={s} level={level} classOf={classOf} />
      </div>
    </details>
  );
}

/** A spot's level range; `lit` (it fits your level and class) fills it with the accent. */
function LevelBadge({ spot: s, lit = false }: { spot: GrindSpot; lit?: boolean }) {
  return (
    <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold tabular ${lit ? 'border-accent bg-accent text-on-accent' : 'border-border-2 bg-surface-2 text-ink'}`}>
      Lv {s.levels[0]}–{s.levels[1]}
    </span>
  );
}

const availLabel = (a: Availability) => (a === 'cot2' ? 'Second test only' : a === 'soon' ? 'Not at launch yet' : 'Open at launch');

function AvailBadge({ spot: s }: { spot: GrindSpot }) {
  if (s.available === 'launch') return null;
  return <span className="shrink-0 rounded-md border border-dashed border-warn/60 bg-warn/10 px-1.5 py-px text-[11px] font-medium text-warn">{availLabel(s.available)}</span>;
}

/** Which archetype a bestFor name belongs to ("Ice/Lightning Wizard" -> Magician), for its class icon. */
type ClassOf = (name: string) => Archetype | null;

function SpotBody({ spot: s, level, classOf }: { spot: GrindSpot; level: number | null; classOf: ClassOf }) {
  const ranked = bySpawns(s);
  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SpotLayout spot={s} />
        <div className="space-y-2.5">
          {ranked.map((r) => (
            <MobRow key={r.monster.name} monster={r.monster} count={r.count} level={level} />
          ))}
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px] text-ink-3 tabular">
            <span>
              <span className="font-semibold text-ink-2">{s.spawns}</span> spawn points
            </span>
            <span title="The map's mob-rate flag in the game data; whether the game applies it is unconfirmed">
              mob rate <span className="font-semibold text-ink-2">{s.mobRate}×</span>
            </span>
          </div>
        </div>
      </div>
      <p className="text-sm text-ink-2 mt-3">{s.why}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {s.bestFor.map((f) => {
          const a = f === 'All' ? null : classOf(f);
          return (
            <span key={f} className="inline-flex items-center gap-1 rounded-md border border-border-2 bg-surface-2/60 py-0.5 pl-0.5 pr-1.5 text-[11px] text-ink-2">
              {a ? <Emblem archetype={a} size={16} /> : <span className="px-0.5">★</span>}
              {f === 'All' ? 'Any class' : f}
            </span>
          );
        })}
      </div>
      {(s.tips.length > 0 || s.classicNote) && (
        <details className="group/tips mt-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            {/* A named group: the row around it is a <details> group too, and its open state must not turn this chevron. */}
            <span className="inline-block transition-transform group-open/tips:rotate-90">›</span> Tips{s.classicNote ? ' and Classic notes' : ''}
          </summary>
          {s.tips.length > 0 && (
            <ul className="mt-2 space-y-1">
              {s.tips.map((t, i) => (
                <li key={i} className="text-xs text-ink-2 flex gap-2">
                  <span className="text-ink-3">•</span>
                  {t}
                </li>
              ))}
            </ul>
          )}
          {s.classicNote && (
            <p className="text-xs mt-2 border-t border-border pt-2 text-ink-2">
              <span className="text-accent font-medium">Classic: </span>
              {s.classicNote}
            </p>
          )}
        </details>
      )}
      {s.sources.length > 0 && (
        <details className="group/src mt-2.5 text-[11px] text-ink-3">
          <summary className="cursor-pointer list-none font-medium hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform group-open/src:rotate-90">›</span> Sources ({s.sources.length})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {s.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                  ↗ <span className="text-ink-2">{src.title}</span> · {siteOf(src.url)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.25" />
    </svg>
  );
}
