import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Empty, Modal, PageHeader, Spinner, Toggle } from '../../app/ui';
import { HoverTip } from '../../app/HoverTip';
import { anchorOf, type Tip } from '../../app/tip';
import { fmtInt } from '../../app/format';
import { useClassic } from './data';
import { ARCHETYPES, siteOf } from './labels';
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
  const [cls, setClsState] = useState<Archetype | 'All'>(() => {
    const v = readLocal(LS_CLASS);
    return v && (ARCHETYPES as string[]).includes(v) ? (v as Archetype) : 'All';
  });
  const [branch, setBranchState] = useState<string | null>(() => readLocal(LS_BRANCH));
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
  useEffect(() => {
    if (jump) document.getElementById(jump.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jump]);
  const reveal = (id: string) => {
    setOpen(id);
    setJump({ id: `spot-${id}` });
  };
  const mapped = spots.filter(shown);
  const now = spots.filter(fits);
  const hidden = spots.filter((s) => !shown(s)).length;
  const quests = doc.partyQuests.filter((q) => level >= q.levels[0] && level <= q.levels[1]);
  // Level boxes 5 apart (1, 5, 10 … the cap); the lit box is the highest one at or below the level.
  const steps = [1, ...Array.from({ length: Math.floor(top / 5) }, (_, i) => (i + 1) * 5)];
  const step = steps.filter((v) => v <= level).pop() ?? 1;

  return (
    <>
      <PageHeader title="Grinding spots" subtitle="MapleStory Classic World: where testers trained in the closed online tests, set against the Lv 100 launch. Pick your level and class." />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <span className="label w-12">Level</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Pick a level">
          {steps.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === step}
              onClick={() => setLevel(v)}
              className={`h-8 min-w-9 rounded-md border px-1.5 text-xs font-semibold tabular transition-colors cursor-pointer ${v === step ? 'border-accent bg-accent text-black' : 'border-border-2 bg-surface-2 text-ink-2 hover:border-ink-3 hover:text-ink'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <input type="number" min={1} max={top} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="input w-18 h-8 tabular" aria-label="Your exact level" />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by class">
          <span className="label w-12">Class</span>
          {(['All', ...archetypes] as const).map((a) => (
            <button key={a} type="button" className={cls === a ? 'chip-on' : 'chip'} aria-pressed={cls === a} onClick={() => setCls(a)}>
              {a}
            </button>
          ))}
        </div>
        <Toggle checked={later} onChange={setLater} label={<span className="text-ink-2">Areas not at launch</span>} />
      </div>
      {builds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 -mt-1 mb-4" role="group" aria-label={`${cls} branch`}>
          <span className="label mr-1">Branch</span>
          <button type="button" className={branch == null ? 'chip-on' : 'chip'} aria-pressed={branch == null} onClick={() => setBranch(null)}>
            Any {cls}
          </button>
          {builds.map((b) => (
            <button key={b.id} type="button" className={branch === b.path[1] ? 'chip-on' : 'chip'} aria-pressed={branch === b.path[1]} onClick={() => setBranch(b.path[1])}>
              {b.path[1]}
            </button>
          ))}
        </div>
      )}

      <LevelMap spots={mapped} level={level} top={top} fits={fits} onPick={setLevel} onOpen={reveal} hidden={hidden} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] mt-4">
        <div className="space-y-3 min-w-0">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              At Lv {level}
              {cls !== 'All' && <span className="text-ink-3 font-normal"> · {branch ?? cls}</span>}
            </h2>
            <span className="text-xs text-ink-3">
              {now.length} spot{now.length === 1 ? '' : 's'}
            </span>
          </div>
          {now.length === 0 && <Empty title="No listed spot for this level and class">Try “Any” for the branch or class, or a level a little higher or lower.</Empty>}
          {now.map((s) => (
            <SpotCard key={s.id} spot={s} onMap={setMapFor} />
          ))}
        </div>
        <div className="space-y-4 min-w-0">
          <Card
            title={`Quests at Lv ${level}`}
            action={
              <button type="button" className="text-xs text-ink-3 hover:text-accent cursor-pointer" onClick={() => setJump({ id: 'quests' })}>
                All quests ↓
              </button>
            }
          >
            {quests.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing listed for this level.</p>
            ) : (
              <ul className="space-y-2.5">
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
          <Card title="Leveling tips">
            <ul className="space-y-2.5">
              {doc.tips.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-ink-2">
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
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-1">Every spot</h2>
      <p className="text-sm text-ink-3 mb-4">Monster numbers are from the second test's game data; the launch build may differ.</p>
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
            <div className="card divide-y divide-border">
              {list.map((s) => (
                <SpotRow key={s.id} spot={s} on={fits(s)} open={open === s.id} onToggle={(o) => setOpen(o ? s.id : open === s.id ? null : open)} onMap={setMapFor} />
              ))}
            </div>
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
          {doc.partyQuests.map((q) => (
            <div key={q.id} className={`card p-4 ${level >= q.levels[0] && level <= q.levels[1] ? '' : 'opacity-60 hover:opacity-100 transition-opacity'}`}>
              <Quest quest={q} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Quest({ quest: q }: { quest: PartyQuest }) {
  return (
    <div className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-ink">{q.name}</span>
        <span className="text-xs text-ink-3 tabular shrink-0">
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
      ...s.monsters.slice(0, 3).map((m) => ({ value: m.name, label: [`Lv ${m.level}`, m.hp != null && `${fmtInt(m.hp)} HP`, m.exp != null && `${fmtInt(m.exp)} EXP`].filter(Boolean).join(' · ') })),
    ];
    setTip({ ...anchorOf(el, box.current), rows, width: box.current.clientWidth });
  };
  return (
    <Card
      title="Level map"
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
                  <span
                    className={`block h-2.5 w-full rounded-full transition-colors ${
                      later ? `border border-dashed ${on ? 'border-accent bg-accent/20' : 'border-ink-3 group-hover:border-ink-2'}` : on ? 'bg-accent group-hover:bg-accent-2' : 'bg-border-2 group-hover:bg-ink-3'
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
            <span className={`absolute -top-1 left-1/2 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-black tabular shadow ${dragging ? 'ring-2 ring-accent/40' : 'group-focus-visible:ring-2 group-focus-visible:ring-accent/40'}`}>
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

function SpotCard({ spot: s, onMap }: { spot: GrindSpot; onMap: (s: GrindSpot) => void }) {
  return (
    <article className="card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{s.map}</h3>
          <div className="text-xs text-ink-3">
            {s.area} · {s.region} · {s.style === 'both' ? 'solo or party' : s.style}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {s.place && (
              <button type="button" className="btn btn-sm" onClick={() => onMap(s)}>
                <PinIcon /> Show on map
              </button>
            )}
            <LevelBadge spot={s} />
          </div>
          <AvailBadge spot={s} />
        </div>
      </header>
      <SpotBody spot={s} />
    </article>
  );
}

/** A collapsed spot in the full list; opens to the same details as a card. */
function SpotRow({ spot: s, on, open, onToggle, onMap }: { spot: GrindSpot; on: boolean; open: boolean; onToggle: (open: boolean) => void; onMap: (s: GrindSpot) => void }) {
  return (
    <details id={`spot-${s.id}`} open={open} onToggle={(e) => e.currentTarget.open !== open && onToggle(e.currentTarget.open)} className="group scroll-mt-4">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
        <span className={`size-1.5 shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-border-2'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-ink">{s.map}</span>
          <span className="text-xs text-ink-3"> · {s.area}</span>
        </span>
        <span className="hidden sm:flex flex-wrap justify-end gap-1">
          {s.bestFor.slice(0, 3).map((f) => (
            <span key={f} className="rounded-md border border-border-2 px-1.5 py-0.5 text-[11px] text-ink-3">
              {f === 'All' ? 'Any class' : f}
            </span>
          ))}
        </span>
        {s.place && (
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
        )}
        <LevelBadge spot={s} />
        <span className="text-ink-3 transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="px-4 pb-4 pl-[2.375rem]">
        <div className="text-xs text-ink-3">
          {s.region} · {s.style === 'both' ? 'solo or party' : s.style}
          {s.available !== 'launch' && (
            <span className="ml-2">
              <AvailBadge spot={s} />
            </span>
          )}
        </div>
        <SpotBody spot={s} />
      </div>
    </details>
  );
}

function LevelBadge({ spot: s }: { spot: GrindSpot }) {
  return (
    <span className="shrink-0 rounded-lg bg-surface-2 border border-border-2 px-2 py-1 text-xs font-semibold text-ink tabular">
      Lv {s.levels[0]}–{s.levels[1]}
    </span>
  );
}

function AvailBadge({ spot: s }: { spot: GrindSpot }) {
  if (s.available === 'launch') return null;
  return <span className="rounded-md border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] font-medium text-warn">{s.available === 'cot2' ? 'Second test only' : 'Not at launch yet'}</span>;
}

function SpotBody({ spot: s }: { spot: GrindSpot }) {
  return (
    <>
      <p className="text-sm text-ink-2 mt-2">{s.why}</p>
      {s.monsters.length > 0 && (
        <table className="w-full mt-3 text-xs tabular">
          <thead>
            <tr className="text-ink-3 text-left">
              <th className="font-medium pb-1">Monster</th>
              <th className="font-medium pb-1 text-right">Lv</th>
              <th className="font-medium pb-1 text-right">HP</th>
              <th className="font-medium pb-1 text-right">EXP</th>
            </tr>
          </thead>
          <tbody>
            {s.monsters.map((m) => (
              <tr key={m.name} className="border-t border-border">
                <td className="py-1 text-ink">{m.name}</td>
                <td className="py-1 text-right text-ink-2">{m.level}</td>
                <td className="py-1 text-right text-ink-2">{fmtInt(m.hp)}</td>
                <td className="py-1 text-right text-ink-2">{fmtInt(m.exp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {s.bestFor.map((f) => (
          <span key={f} className="rounded-md border border-border-2 px-1.5 py-0.5 text-[11px] text-ink-2">
            {f === 'All' ? 'Any class' : f}
          </span>
        ))}
      </div>
      {s.tips.length > 0 && (
        <ul className="mt-3 space-y-1">
          {s.tips.map((t, i) => (
            <li key={i} className="text-xs text-ink-2 flex gap-2">
              <span className="text-ink-3">•</span>
              {t}
            </li>
          ))}
        </ul>
      )}
      {s.classicNote && (
        <p className="text-xs mt-3 border-t border-border pt-2 text-ink-2">
          <span className="text-accent font-medium">Classic: </span>
          {s.classicNote}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
        {s.sources.map((src) => (
          <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="hover:text-accent" title={src.title}>
            ↗ {siteOf(src.url)}
          </a>
        ))}
      </div>
      {s.confidence && <p className="mt-1 text-[11px] text-ink-3">{s.confidence}</p>}
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
