import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Empty, PageHeader, Spinner } from '../../app/ui';
import { useMediaQuery } from '../../app/useMediaQuery';
import { useClassic, useSkillLevels } from './data';
import { Emblem, LevelText, SkillIcon } from './bits';
import { launchName, ordinal, skillTypeLabel } from './labels';
import { changesByLevel, splitLine } from './skillLevels';
import { isPreview, type World } from './skillPlan';
import { dependentsOf, holderOf, levelFor, missingFor, pointsIn, poolsOf, roomFor, spentIn, type Alloc, type Pool } from './skillAlloc';
import type { Archetype, ClassicBuild, ClassicDoc, SkillInfo } from './types';

/** Kept for the browser session only (cleared when the browser closes): the job, each job's points and the open skill. */
const SESSION_KEY = 'mt.classic.skillBuilder';

interface Saved {
  build: string | null;
  /** Points per skill ID, by build ID, so switching jobs and back keeps each job's build. */
  alloc: Record<string, Alloc>;
  /** The skill whose levels are showing. */
  focus: number | null;
}

const EMPTY: Saved = { build: null, alloc: {}, focus: null };

function readSaved(): Saved {
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Partial<Saved> | null;
    if (!v || typeof v !== 'object') return EMPTY;
    const alloc: Record<string, Alloc> = {};
    for (const [build, points] of Object.entries(v.alloc ?? {})) {
      if (!points || typeof points !== 'object') continue;
      alloc[build] = Object.fromEntries(Object.entries(points).filter(([, n]) => Number.isInteger(n) && n > 0));
    }
    return { build: typeof v.build === 'string' ? v.build : null, alloc, focus: typeof v.focus === 'number' ? v.focus : null };
  } catch {
    return EMPTY;
  }
}

function writeSaved(s: Saved) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the build just won't survive a reload.
  }
}

const CLASSES: Archetype[] = ['Warrior', 'Magician', 'Bowman', 'Thief'];

/** The +1 / Max / − buttons; disabled ones get the Classic theme's dashed look (index.css) and say why in their title. */
const STEP = 'btn btn-sm justify-center tabular';

export function SkillBuilderPage() {
  const { doc, error } = useClassic();
  if (error) return <Empty title="Classic World data missing">public/classic.json could not be loaded ({error}).</Empty>;
  if (!doc) return <Spinner label="Loading skills…" />;
  return <SkillBuilder doc={doc} />;
}

function SkillBuilder({ doc }: { doc: ClassicDoc }) {
  const [saved, setSaved] = useState(readSaved);
  useEffect(() => {
    writeSaved(saved);
  }, [saved]);
  const build = doc.builds.find((b) => b.id === saved.build) ?? null;
  const pools = useMemo(() => (build ? poolsOf(build, doc.world) : []), [build, doc.world]);
  const alloc = useMemo(() => (build ? (saved.alloc[build.id] ?? {}) : {}), [build, saved.alloc]);
  const focus = build?.skillInfo.find((s) => s.id === saved.focus) ?? null;
  const focusPool = focus ? (pools.find((p) => p.job.tier === focus.tier) ?? null) : null;
  // The per-level text starts loading with the page, so the first +1 shows it straight away.
  const levels = useSkillLevels();
  const wide = useMediaQuery('(min-width: 1024px)');

  const pick = (id: string) => setSaved((s) => ({ ...s, build: id, focus: s.build === id ? s.focus : null }));
  const setFocus = (id: number) => setSaved((s) => ({ ...s, focus: id }));
  /** Changes one skill's points by `delta`, within what the rules allow at that moment (`Infinity` = as far as it goes), and shows its levels. */
  const change = (pool: Pool, skill: SkillInfo, delta: number) =>
    setSaved((s) => {
      if (!build) return s;
      const cur = s.alloc[build.id] ?? {};
      const step = delta > 0 ? Math.min(delta, roomFor(skill, pool, cur)) : pointsIn(skill, cur) > 0 && !holderOf(skill, pool, cur) ? -1 : 0;
      if (!step) return { ...s, focus: skill.id };
      const next = { ...cur };
      const n = pointsIn(skill, cur) + step;
      if (n > 0) next[skill.id] = n;
      else delete next[skill.id];
      return { ...s, alloc: { ...s.alloc, [build.id]: next }, focus: skill.id };
    });
  const reset = () =>
    setSaved((s) => {
      if (!build) return s;
      const rest = { ...s.alloc };
      delete rest[build.id];
      return { ...s, alloc: rest, focus: null };
    });

  const total = pools.reduce((n, p) => n + spentIn(p, alloc), 0);
  const totalSp = pools.reduce((n, p) => n + p.sp, 0);
  // The level the whole build needs: the latest job with points, at the level that job has earned them by.
  const needs = pools.reduce<number | null>((lv, p) => {
    const spent = spentIn(p, alloc);
    return spent ? levelFor(p, spent, doc.world.rules) : lv;
  }, null);
  const controls = (pool: Pool, skill: SkillInfo) => ({ onLower: () => change(pool, skill, -1), onRaise: () => change(pool, skill, 1), onMax: () => change(pool, skill, Infinity) });

  return (
    <>
      <PageHeader title="Skill builder" subtitle="Try out a skill build: pick a job, spend each job's skill points and see what every level of a skill gives. Nothing is saved; closing the browser clears it." />

      <JobPicker builds={doc.builds} world={doc.world} value={build?.id ?? null} onChange={pick} />

      {!build ? (
        <div className="card border-dashed px-6 py-10 text-center text-sm text-ink-2">Pick a job above to get its 1st, 2nd and 3rd job skills.</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div className="min-w-0 space-y-4">
            <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Emblem archetype={build.archetype} size={32} />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold leading-tight text-ink">{build.path.join(' › ')}</h2>
                <p className="text-sm text-ink-2">
                  <span className="font-semibold text-ink tabular">{total}</span> of {totalSp} SP spent
                  {needs != null && (
                    <>
                      {' '}
                      · needs <span className="font-semibold text-ink">Lv {needs}</span>
                    </>
                  )}
                  <Link to={`/classic/builds/${build.id}`} className="ml-3 whitespace-nowrap text-xs text-ink-3 hover:text-accent">
                    Guide build ›
                  </Link>
                </p>
              </div>
              <button type="button" className="btn" onClick={reset} disabled={!total} title={`Take back every point in this ${build.path[1]} build (other jobs you tried keep theirs)`}>
                Reset
              </button>
            </div>

            {pools.map((pool) => (
              <JobSection key={pool.job.tier} pool={pool} world={doc.world} alloc={alloc} focus={focus?.id ?? null} onFocus={setFocus} controls={(s) => controls(pool, s)}>
                {/* Phones: the open skill's levels sit right under its row instead of in a side panel. */}
                {!wide && focus && focusPool === pool && <SkillDetail skill={focus} pool={pool} world={doc.world} alloc={alloc} levels={levels} inline {...controls(pool, focus)} />}
              </JobSection>
            ))}

            <p className="text-xs text-ink-3">
              Each job earns {doc.world.rules.spAtAdvancement} SP at its advancement and {doc.world.rules.spPerLevel} a level, and its SP only goes into its own skills:{' '}
              {pools.map((p, i) => (
                <span key={p.job.tier}>
                  {i > 0 && (i === pools.length - 1 ? ' and ' : ', ')}
                  {p.sp} for {ordinal(p.job.tier)} job (Lv {p.from}–{p.to})
                </span>
              ))}
              . A locked skill needs points in another skill first, as in game. 3rd job was only in the second test.
            </p>
          </div>

          {wide && (
            <aside className="card sticky top-4 flex max-h-[calc(100vh-2rem)] min-h-0 flex-col overflow-hidden" aria-label="Skill levels">
              {focus && focusPool ? (
                <SkillDetail skill={focus} pool={focusPool} world={doc.world} alloc={alloc} levels={levels} {...controls(focusPool, focus)} />
              ) : (
                <div className="p-5 text-sm text-ink-2">
                  <h2 className="font-semibold text-ink">Every level of a skill</h2>
                  <p className="mt-1.5">
                    Raise a skill with <span className="font-semibold text-ink">+1</span> and all its levels show here, with the level you're at in bold. Click a skill's name to look without spending points.
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </>
  );
}

/** The ten launch branches by class; the 2nd job names the branch, the tooltip has the whole path. */
function JobPicker({ builds, world, value, onChange }: { builds: ClassicBuild[]; world: World; value: string | null; onChange: (id: string) => void }) {
  return (
    <section className="card mb-4 p-4" aria-label="Job">
      {/* One row from 1366 wide up: tight paddings keep all ten branches on it. */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {CLASSES.map((a) => {
          const list = builds.filter((b) => b.archetype === a);
          if (!list.length) return null;
          return (
            <div key={a} role="group" aria-label={a}>
              <div className="label mb-1.5 flex items-center gap-1.5">
                <Emblem archetype={a} size={16} />
                {a}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={b.id === value}
                    onClick={() => onChange(b.id)}
                    title={b.path.join(' → ')}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${b.id === value ? 'border-accent bg-accent text-on-accent' : 'border-border-2 bg-surface-2 text-ink hover:border-ink-3 hover:bg-surface-3'}`}
                  >
                    {launchName(b, world)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface Handlers {
  onLower: () => void;
  onRaise: () => void;
  onMax: () => void;
}

/** One job: its SP (spent, left, and the level that pays for it) and its skills in skill-book order. */
function JobSection({
  pool,
  world,
  alloc,
  focus,
  onFocus,
  controls,
  children,
}: {
  pool: Pool;
  world: World;
  alloc: Alloc;
  focus: number | null;
  onFocus: (id: number) => void;
  controls: (s: SkillInfo) => Handlers;
  children?: ReactNode;
}) {
  const spent = spentIn(pool, alloc);
  const left = pool.sp - spent;
  const preview = isPreview(pool.job, world);
  const tier = pool.job.tier;
  return (
    <section className={`card overflow-hidden ${preview ? 'border-dashed border-border-2' : ''}`} aria-labelledby={`job-${tier}`}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="label">
            {ordinal(tier)} job · Lv {pool.from}–{pool.to}
            {preview && <span className="normal-case tracking-normal text-warn"> · test preview</span>}
          </div>
          <h2 id={`job-${tier}`} className="font-semibold leading-tight text-ink">
            {pool.job.job}
          </h2>
        </div>
        <div className="w-full sm:w-72">
          <div className="flex items-baseline justify-between gap-2 text-xs text-ink-2">
            <span>
              <span className="text-base font-semibold text-ink tabular">{spent}</span> / {pool.sp} SP
            </span>
            <span className="tabular">
              {left > 0 ? `${left} left` : 'all spent'}
              {spent > 0 && <span className="text-ink-3"> · by Lv {levelFor(pool, spent, world.rules)}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={`${ordinal(tier)} job SP spent`} aria-valuemin={0} aria-valuemax={pool.sp} aria-valuenow={spent}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (spent / pool.sp) * 100)}%` }} />
          </div>
        </div>
      </header>
      {preview && <p className="border-b border-border bg-warn/10 px-4 py-1.5 text-xs text-ink-2">Only in the second closed test. Nexon pulled 3rd job from the launch to rework it, so this is how it played in August.</p>}
      <ul className="divide-y divide-border">
        {pool.skills.map((s) => (
          <SkillRow key={s.id} skill={s} pool={pool} alloc={alloc} focused={focus === s.id} onFocus={() => onFocus(s.id)} {...controls(s)}>
            {focus === s.id ? children : null}
          </SkillRow>
        ))}
      </ul>
    </section>
  );
}

function SkillRow({ skill: s, pool, alloc, focused, onFocus, children, ...handlers }: { skill: SkillInfo; pool: Pool; alloc: Alloc; focused: boolean; onFocus: () => void; children?: ReactNode } & Handlers) {
  const cur = pointsIn(s, alloc);
  const missing = missingFor(s, pool, alloc);
  return (
    <li className={focused ? 'bg-accent/10' : undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <button type="button" onClick={onFocus} className="group/s flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" aria-current={focused || undefined} title="Every level of this skill">
          <span className={`shrink-0 rounded-md border bg-bg p-0.5 transition-colors ${focused ? 'border-accent' : 'border-border-2 group-hover/s:border-accent'}`}>
            {/* A locked skill's icon is greyed like the game's; its text stays at full contrast. */}
            <span className={missing.length ? 'block opacity-50 grayscale' : 'block'}>
              <SkillIcon skill={s} size={32} />
            </span>
          </span>
          <span className="min-w-0">
            {/* Phones wrap long names; wider screens keep one line. */}
            <span className={`block font-medium leading-snug group-hover/s:text-accent sm:truncate ${focused ? 'text-accent' : 'text-ink'}`}>{s.skill}</span>
            <span className="block text-xs text-ink-3 sm:truncate">
              {missing.length ? (
                <span className="text-warn">
                  <LockIcon /> Needs {missing.map((m) => `${m.skill.skill} Lv ${m.level}`).join(' and ')}
                </span>
              ) : (
                skillTypeLabel(s.type)
              )}
            </span>
          </span>
        </button>
        <LevelBar points={cur} max={s.max} className="w-20 max-sm:hidden" />
        <Steps skill={s} pool={pool} alloc={alloc} {...handlers} />
      </div>
      {children}
    </li>
  );
}

function LevelBar({ points, max, className = '' }: { points: number; max: number; className?: string }) {
  return (
    <span className={`h-1.5 overflow-hidden rounded-full bg-surface-3 ${className}`} aria-hidden>
      <span className={`block h-full rounded-full ${points >= max ? 'bg-accent' : 'bg-ink-3'}`} style={{ width: `${(points / max) * 100}%` }} />
    </span>
  );
}

/** − level/max +1 Max, with the reason a button is off in its tooltip. */
function Steps({ skill: s, pool, alloc, onLower, onRaise, onMax }: { skill: SkillInfo; pool: Pool; alloc: Alloc } & Handlers) {
  const cur = pointsIn(s, alloc);
  const room = roomFor(s, pool, alloc);
  const holder = holderOf(s, pool, alloc);
  const missing = missingFor(s, pool, alloc);
  const left = pool.sp - spentIn(pool, alloc);
  const why = cur >= s.max ? 'Maxed' : missing.length ? `Needs ${missing.map((m) => `${m.skill.skill} Lv ${m.level}`).join(' and ')}` : left <= 0 ? `No ${ordinal(s.tier)}-job SP left` : null;
  const toMax = Math.min(s.max, cur + room);
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" className={`${STEP} w-7 px-0`} onClick={onLower} disabled={cur === 0 || !!holder} aria-label={`Lower ${s.skill} to ${cur - 1}`} title={holder ? `${holder.skill.skill} needs it at Lv ${holder.level}` : cur === 0 ? 'No points to take back' : `Take a point back (Lv ${cur - 1})`}>
        −
      </button>
      <span className="w-12 text-center text-sm tabular" aria-label={`Level ${cur} of ${s.max}`}>
        <span className={cur >= s.max ? 'font-semibold text-accent' : cur > 0 ? 'font-semibold text-ink' : 'text-ink-3'}>{cur}</span>
        <span className="text-ink-3">/{s.max}</span>
      </span>
      <button type="button" className={`${STEP} w-9 px-0`} onClick={onRaise} disabled={room === 0} aria-label={`Raise ${s.skill} to ${cur + 1}`} title={why ?? `Raise to Lv ${cur + 1}`}>
        +1
      </button>
      <button type="button" className={`${STEP} w-11 px-0`} onClick={onMax} disabled={room === 0} aria-label={`Raise ${s.skill} as far as it goes`} title={why ?? (toMax < s.max ? `Raise to Lv ${toMax}, all the SP left` : `Max it (Lv ${s.max})`)}>
        Max
      </button>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mb-px inline size-3 align-middle" fill="currentColor" aria-hidden>
      <path d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5v2H4a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.5V5A3.5 3.5 0 0 0 8 1.5zM6 5a2 2 0 1 1 4 0v2H6V5z" />
    </svg>
  );
}

/**
 * The open skill: what it does, what it needs and unlocks, and its game text at every level, the level you're at
 * in bold. Stepping it up or down keeps that level in view; scrolling only moves the list, never the page.
 */
function SkillDetail({
  skill,
  pool,
  world,
  alloc,
  levels,
  inline = false,
  ...handlers
}: { skill: SkillInfo; pool: Pool; world: World; alloc: Alloc; levels: ReturnType<typeof useSkillLevels>; inline?: boolean } & Handlers) {
  const { doc, error } = levels;
  const texts = doc?.skills[String(skill.id)];
  const notes = doc?.notes?.[String(skill.id)] ?? {};
  const lines = useMemo(() => (texts ?? []).map(splitLine), [texts]);
  const changes = useMemo(() => changesByLevel(lines), [lines]);
  const cur = pointsIn(skill, alloc);
  const deps = dependentsOf(skill, pool);
  const preview = skill.tier > world.launchJobs;

  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const row = el.querySelector<HTMLElement>('[data-now]');
    el.scrollTop = row ? Math.max(0, row.offsetTop - (el.clientHeight - row.offsetHeight) / 2) : 0;
  }, [skill.id, cur, lines.length]);

  return (
    <div className={inline ? 'mx-4 mb-3 overflow-hidden rounded-xl border border-border-2 bg-surface' : 'flex min-h-0 flex-1 flex-col'}>
      <header className="flex items-start gap-3 border-b border-border p-4">
        <span className="shrink-0 rounded-lg border border-border-2 bg-bg p-1">
          <SkillIcon skill={skill} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight text-ink">{skill.skill}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-3">
            {ordinal(skill.tier)} job · {skillTypeLabel(skill.type)} · max {skill.max}
            {preview && <span className="rounded-md border border-warn/40 px-1.5 text-warn">test only</span>}
          </div>
        </div>
      </header>

      <div className="space-y-2 border-b border-border px-4 py-3 text-sm">
        {/* On phones the row right above already has the buttons. */}
        {!inline && <Steps skill={skill} pool={pool} alloc={alloc} {...handlers} />}
        <p className="text-ink-2">{skill.what}</p>
        {(skill.req ?? []).map((r) => {
          const have = pool.skills.find((s) => s.skill === r.skill);
          const met = !!have && pointsIn(have, alloc) >= r.level;
          return (
            <p key={r.skill} className={`text-xs ${met ? 'text-good' : 'text-warn'}`}>
              {met ? '✓' : <LockIcon />} Needs {r.skill} Lv {r.level}
              {have && !met && <span className="text-ink-3"> (has {pointsIn(have, alloc)})</span>}
            </p>
          );
        })}
        {skill.reqNote && <p className="text-xs text-ink-3">{skill.reqNote}</p>}
        {deps.length > 0 && (
          <p className="text-xs text-ink-3">
            Unlocks{' '}
            {deps.map((d, i) => (
              <span key={d.skill.id}>
                {i > 0 && (i === deps.length - 1 ? ' and ' : ', ')}
                <span className="text-ink-2">{d.skill.skill}</span> at Lv {d.level}
              </span>
            ))}
          </p>
        )}
      </div>

      {error ? (
        <p className="p-4 text-sm text-bad">The per-level numbers couldn't load ({error}).</p>
      ) : !doc ? (
        <p className="p-4 text-sm text-ink-3">Loading the per-level numbers…</p>
      ) : !lines.length ? (
        <p className="p-4 text-sm text-ink-3">The game data has no per-level text for this skill.</p>
      ) : (
        <ol ref={list} className={`relative min-h-0 overflow-y-auto py-1 ${inline ? 'max-h-80' : 'flex-1'}`} aria-label={`${skill.skill} by level`}>
          {lines.map((l, i) => {
            const lv = i + 1;
            const now = lv === cur;
            return (
              <li key={lv} data-now={now || undefined} aria-current={now ? 'step' : undefined} className={`grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2 border-l-[3px] py-1.5 pl-[13px] pr-4 text-[13px] ${now ? 'border-accent bg-accent/10 font-semibold text-ink' : lv < cur ? 'border-accent/40 text-ink-2' : 'border-transparent text-ink-2'}`}>
                <span className={`pt-px text-xs tabular ${now ? 'font-bold text-accent' : 'text-ink-3'}`}>Lv {lv}</span>
                <span className="min-w-0">
                  <LevelText line={l} change={changes[i]} strong={false} />
                  {now && <span className="ml-2 inline-block rounded bg-accent px-1 align-middle text-[10px] font-bold uppercase leading-4 tracking-wide text-on-accent">now</span>}
                  {lv === cur + 1 && <span className="ml-2 inline-block rounded border border-border-2 px-1 align-middle text-[10px] font-medium leading-4 text-ink-3">+1</span>}
                  {notes[lv] && <span className="mt-0.5 block text-[11px] font-normal text-warn">{notes[lv]}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {doc && lines.length > 0 && <p className="border-t border-border px-4 py-2 text-[11px] text-ink-3">The game's own text for each level, {preview ? 'from the second closed test (COT #2, August 2026)' : "from the launch client (Founder's Access, October 6, 2026)"}. Small numbers after a value are its change from the level before.</p>}
    </div>
  );
}
