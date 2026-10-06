import { useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CharacterAvatar, Empty, PageHeader, Progress, Spinner, Stat } from '../../app/ui';
import { fmtDate, fmtInt, formatBig, pct, relTime } from '../../app/format';
import { useMeasure } from '../../app/useMeasure';
import { useClassic, useClassicExp } from './data';
import { atTotal, expToNext, expUntil, gainedBetween, levelShare, totalExp } from './classicExp';
import { keyOf, readBook, withLookup, withoutCharacter, type LookBook, type Looked, type Lookup } from './lookupHistory';
import { lookupCharacter, rankingsOpen } from './rankings';
import { ordinal } from './labels';
import { Emblem } from './bits';
import type { Archetype, ClassicDoc, ClassicExpDoc } from './types';

const DAY = 86_400_000;

type Status = { kind: 'idle' } | { kind: 'busy'; name: string } | { kind: 'closed' } | { kind: 'not-found'; name: string } | { kind: 'failed'; message: string };

export function CharacterLookupPage() {
  const classic = useClassic();
  const exp = useClassicExp();
  const error = classic.error ?? exp.error;
  if (error) return <Empty title="Classic World data missing">The Classic World data could not be loaded ({error}).</Empty>;
  if (!classic.doc || !exp.doc) return <Spinner label="Loading…" />;
  return <CharacterLookup doc={classic.doc} table={exp.doc} />;
}

function CharacterLookup({ doc, table }: { doc: ClassicDoc; table: ClassicExpDoc }) {
  // ?name= opens a looked-up character, ?sample shows the made-up one.
  const [params, setParams] = useSearchParams();
  const selected = params.get('name');
  const sample = params.has('sample');
  const [book, setBook] = useState<LookBook>(readBook);
  const [query, setQuery] = useState(selected ?? '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const run = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    pending.current?.abort();
    const ctl = new AbortController();
    pending.current = ctl;
    setStatus({ kind: 'busy', name });
    try {
      const r = await lookupCharacter(name, ctl.signal);
      if (ctl.signal.aborted) return;
      if (r.kind !== 'found') {
        setStatus(r.kind === 'closed' ? { kind: 'closed' } : { kind: 'not-found', name });
        return;
      }
      const at = new Date().toISOString();
      setBook((b) => withLookup(b, r.character, at));
      setStatus({ kind: 'idle' });
      setQuery(r.character.name);
      setParams({ name: r.character.name });
    } catch (e) {
      if (!ctl.signal.aborted) setStatus({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
  };

  // Opening ?name= for someone not looked up here yet looks them up, once. Only a new name triggers it (an effect
  // event reads the book without depending on it), so forgetting the open character doesn't look it straight back up.
  const autoRan = useRef<string | null>(null);
  const autoLookup = useEffectEvent((name: string) => {
    if (book[keyOf(name)] || autoRan.current === keyOf(name)) return;
    autoRan.current = keyOf(name);
    void run(name);
  });
  useEffect(() => {
    if (selected) autoLookup(selected);
  }, [selected]);

  const looked = sample ? null : selected ? (book[keyOf(selected)] ?? null) : null;
  const demo = useMemo(() => (sample ? sampleCharacter(table) : null), [sample, table]);
  const shown = demo ?? looked;
  const list = Object.values(book).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  const open = (name: string) => {
    setStatus({ kind: 'idle' });
    setQuery(name);
    setParams({ name });
  };
  const forget = (name: string) => {
    setBook((b) => withoutCharacter(b, name));
    if (selected && keyOf(selected) === keyOf(name)) setParams({});
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(query);
  };

  return (
    <>
      <PageHeader title="Character lookup" subtitle="A Classic World character's level and EXP, by name. Each lookup is kept in this browser, so the next one shows what was gained." />

      {!rankingsOpen && (
        <div className="card mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-dashed border-border-2 p-4">
          <div className="min-w-0 flex-1 basis-80 text-sm">
            <div className="font-semibold text-ink">Classic World rankings aren't out yet</div>
            <p className="mt-0.5 text-ink-2">Nexon hasn't opened rankings for Classic World, so there's nothing to look up yet. The page is ready for when they do; until then, the sample shows what a lookup will look like.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setParams(sample ? {} : { sample: '' })} aria-pressed={sample}>
            {sample ? 'Hide the sample' : 'Show a sample'}
          </button>
        </div>
      )}

      <form className="card mb-4 p-4" onSubmit={submit} role="search">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1 basis-64">
            <span className="label mb-1 block">Character name</span>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Exactly as in game" autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" className="btn border-accent bg-accent text-on-accent hover:border-accent-2 hover:bg-accent-2" disabled={!query.trim() || status.kind === 'busy'}>
            {status.kind === 'busy' ? 'Looking up…' : 'Look up'}
          </button>
        </div>
        {status.kind !== 'idle' && status.kind !== 'busy' && (
          <p className={`mt-2 text-sm ${status.kind === 'failed' ? 'text-bad' : 'text-ink-2'}`} role="status">
            {status.kind === 'closed'
              ? "Classic World rankings aren't out yet, so the lookup can't run."
              : status.kind === 'not-found'
                ? `No Classic World character called ${status.name} in the rankings. The name has to match exactly; characters show up once the rankings have counted them.`
                : `The lookup failed: ${status.message}.`}
          </p>
        )}
        {list.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="label mr-1">Looked up here</span>
            {list.map((c) => {
              const last = c.lookups[c.lookups.length - 1];
              const on = !sample && !!selected && keyOf(selected) === keyOf(c.name);
              return (
                <span key={c.name} className={`inline-flex items-center rounded-lg border text-sm ${on ? 'border-accent bg-accent/10' : 'border-border-2 bg-surface-2'}`}>
                  <button type="button" onClick={() => open(c.name)} className="flex cursor-pointer items-center gap-1.5 py-1 pl-2 pr-1.5 hover:text-accent" aria-current={on || undefined} title={`Looked up ${relTime(c.checkedAt)}`}>
                    <span className="font-medium text-ink">{c.name}</span>
                    <span className="text-xs text-ink-3 tabular">Lv {last.level}</span>
                  </button>
                  <button type="button" onClick={() => forget(c.name)} className="cursor-pointer rounded-r-lg border-l border-border px-1.5 py-1 text-xs text-ink-3 hover:text-bad" aria-label={`Forget ${c.name}`} title="Forget this character and its lookups">
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </form>

      {shown ? (
        <CharacterExp
          key={shown.name}
          looked={shown}
          doc={doc}
          table={table}
          sample={!!demo}
          busy={status.kind === 'busy'}
          onRefresh={rankingsOpen && !demo ? () => void run(shown.name) : null}
          onForget={demo ? null : () => forget(shown.name)}
        />
      ) : (
        !selected && <div className="card border-dashed px-6 py-10 text-center text-sm text-ink-2">Look up a character to see its level, EXP and what it gained since the last lookup.</div>
      )}
    </>
  );
}

/** How fast EXP came in: from the oldest lookup in the week up to the latest one (or the one before it), per day. */
function paceOf(table: ClassicExpDoc, lookups: Lookup[]): { perDay: number; days: number } | null {
  if (lookups.length < 2) return null;
  const last = lookups[lookups.length - 1];
  const end = Date.parse(last.at);
  let base = lookups.find((l) => end - Date.parse(l.at) <= 7 * DAY) ?? lookups[0];
  if (base === last) base = lookups[lookups.length - 2];
  const days = (end - Date.parse(base.at)) / DAY;
  // Lookups under an hour apart say little about a pace.
  if (days < 1 / 24) return null;
  const gain = gainedBetween(table, base, last);
  return gain == null ? null : { perDay: gain / days, days };
}

/** The class a job name belongs to (a class, or any job on a build's path), for the emblem when there's no character image. */
const classOf = (doc: ClassicDoc, job: string | null): Archetype | null => (job ? (doc.builds.find((b) => b.archetype === job || b.path.includes(job))?.archetype ?? null) : null);

const span = (days: number) => (days < 1 ? `${Math.max(1, Math.round(days * 24))} hours` : `${days.toFixed(days < 10 ? 1 : 0)} days`);
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** A character's EXP: where it is in its level, what it gained since the last lookup, its pace, the road to the cap and every lookup. */
function CharacterExp({
  looked: c,
  doc,
  table,
  sample,
  busy,
  onRefresh,
  onForget,
}: {
  looked: Looked;
  doc: ClassicDoc;
  table: ClassicExpDoc;
  sample: boolean;
  busy: boolean;
  onRefresh: (() => void) | null;
  onForget: (() => void) | null;
}) {
  const cap = doc.world.levelCap;
  const last = c.lookups[c.lookups.length - 1];
  const prev = c.lookups.length > 1 ? c.lookups[c.lookups.length - 2] : null;
  const need = expToNext(table, last.level);
  const atCap = last.level >= cap || need == null;
  const share = levelShare(table, last.level, last.exp);
  const gain = prev ? gainedBetween(table, prev, last) : null;
  const pace = paceOf(table, c.lookups);
  const toCap = expUntil(table, last.level, last.exp, cap);
  const capTotal = totalExp(table, cap, 0);
  const total = totalExp(table, last.level, last.exp);
  // The year shows unless it's this one: from Lv 90 the table climbs 2.1x a level, so Lv 100 can be generations away.
  const eta = (exp: number | null) => {
    if (!pace || pace.perDay <= 0 || exp == null) return null;
    const at = new Date(Date.parse(last.at) + (exp / pace.perDay) * DAY);
    if (Number.isNaN(at.getTime())) return null; // past the last date JS can hold
    return fmtDate(at.toISOString(), at.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Milestones ahead: the next level, the next round ten, job advancements and the cap.
  const advancements = [...new Set(doc.builds.flatMap((b) => b.jobLevels))].sort((a, b) => a - b);
  const marks = new Map<number, string>();
  if (!atCap) marks.set(last.level + 1, 'next level');
  const ten = Math.ceil((last.level + 1) / 10) * 10;
  if (ten < cap && !marks.has(ten)) marks.set(ten, '');
  advancements.forEach((lv, i) => lv > last.level && marks.set(lv, `${ordinal(i + 1)} job${i + 1 > doc.world.launchJobs ? ' (test only)' : ''}`));
  if (cap > last.level) marks.set(cap, 'level cap');
  const milestones = [...marks].sort((a, b) => a[0] - b[0]);
  const unconfirmed = last.level > table.confirmedTo || milestones.some(([lv]) => lv > table.confirmedTo + 1);

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5" aria-label={`${c.name}'s EXP`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
          {!c.imageUrl && classOf(doc, c.job) ? (
            <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2" title={`${c.job}: no character image`}>
              <Emblem archetype={classOf(doc, c.job)!} size={64} />
            </div>
          ) : (
            <CharacterAvatar src={c.imageUrl} size={96} alt={c.name} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {/* text-2xl! outranks the Classic theme's h2 size (index.css). */}
                  <h2 className="text-2xl! font-semibold text-ink">{c.name}</h2>
                  {c.job && <span className="text-ink-2">{c.job}</span>}
                  <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-on-accent tabular">Lv {last.level}</span>
                  {sample && <span className="rounded-md border border-dashed border-warn px-1.5 text-xs font-medium text-warn">sample, not a real character</span>}
                </div>
                <div className="mt-1 text-xs text-ink-3">
                  {[c.world, last.rank != null ? `#${fmtInt(last.rank)} overall` : null, `looked up ${relTime(c.checkedAt)}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="btn btn-sm" onClick={onRefresh ?? undefined} disabled={!onRefresh || busy} title={onRefresh ? undefined : sample ? 'The sample is made up' : "The rankings aren't out yet"}>
                  {busy ? 'Looking up…' : 'Look up again'}
                </button>
                {onForget && (
                  <button type="button" className="btn-ghost btn-sm" onClick={onForget}>
                    Forget
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between gap-3 text-xs text-ink-2">
                <span>{atCap ? `Lv ${cap}, the level cap` : `${pct(share, 2)} to Lv ${last.level + 1}`}</span>
                <span className="tabular">
                  {fmtInt(last.exp)} / {need != null ? fmtInt(need) : '—'} EXP
                </span>
              </div>
              <Progress value={share} className="h-2" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label={atCap ? 'To next level' : `To Lv ${last.level + 1}`} value={atCap || need == null ? '—' : fmtInt(need - last.exp)} sub="EXP to go" />
              <Stat
                label="Since last lookup"
                value={gain == null ? '—' : `+${fmtInt(gain)}`}
                tone={gain ? 'good' : undefined}
                sub={prev ? `${relTime(prev.at)}${last.level > prev.level ? ` · +${last.level - prev.level} Lv` : ''}` : 'first lookup'}
              />
              <Stat label="Pace" value={pace ? `${formatBig(pace.perDay)} a day` : '—'} sub={pace ? `over ${span(pace.days)}` : 'needs a lookup hours later'} />
              <Stat label={`To Lv ${cap}`} value={toCap == null ? '—' : fmtInt(toCap)} sub={total != null && capTotal ? `${pct(total / capTotal, 1)} of the way` : undefined} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Total EXP by lookup" action={<span className="text-xs text-ink-3">level-ups marked</span>}>
          {c.lookups.length < 2 ? <p className="py-10 text-center text-sm text-ink-3">Look this character up again later to see its EXP over time.</p> : <ExpChart lookups={c.lookups} table={table} />}
        </Card>

        <Card title="Road to the cap" action={pace ? <span className="text-xs text-ink-3">dates at {formatBig(pace.perDay)} a day</span> : undefined}>
          {milestones.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">At the level cap.</p>
          ) : (
            <ul className="divide-y divide-border">
              {milestones.map(([lv, label]) => {
                const togo = expUntil(table, last.level, last.exp, lv);
                const date = eta(togo);
                return (
                  <li key={lv} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-2 py-2 text-sm">
                    <span className="font-semibold text-ink tabular">Lv {lv}</span>
                    <span className="truncate text-xs text-ink-3">{label}</span>
                    <span className="text-right tabular">
                      <span className="text-ink">{togo == null ? '—' : fmtInt(togo)}</span>
                      <span className="block text-[11px] text-ink-3">{date ? `around ${date}` : 'EXP to go'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {unconfirmed && (
            <p className="mt-2 border-t border-border pt-2 text-[11px] text-ink-3">
              EXP needed past Lv {table.confirmedTo} is the original game's table; Classic World hasn't confirmed it yet.
            </p>
          )}
        </Card>
      </div>

      <Card title="Lookups" action={<span className="text-xs text-ink-3">kept in this browser</span>}>
        <div className="-mx-4 max-h-96 overflow-auto px-4">
          <table className="w-full text-sm">
            <thead className="label sticky top-0 bg-surface text-left">
              <tr>
                <th className="py-2 pr-2 font-medium">Looked up</th>
                <th className="px-2 py-2 text-right font-medium">Level</th>
                <th className="px-2 py-2 text-right font-medium">EXP</th>
                <th className="px-2 py-2 text-right font-medium">Gained</th>
                <th className="py-2 pl-2 text-right font-medium">Rank</th>
              </tr>
            </thead>
            <tbody>
              {[...c.lookups].reverse().map((l, i, rows) => {
                const before = rows[i + 1];
                const g = before ? gainedBetween(table, before, l) : null;
                return (
                  <tr key={l.at} className="border-t border-border">
                    <td className="whitespace-nowrap py-1.5 pr-2 text-ink">{when(l.at)}</td>
                    <td className="px-2 py-1.5 text-right tabular text-ink">
                      {l.level}
                      {before && l.level > before.level && <span className="ml-1 text-xs text-good">▲{l.level - before.level}</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular text-ink-2">
                      {fmtInt(l.exp)} <span className="text-xs text-ink-3">({pct(levelShare(table, l.level, l.exp), 2)})</span>
                    </td>
                    <td className={`whitespace-nowrap px-2 py-1.5 text-right tabular ${g ? 'text-good' : 'text-ink-3'}`}>{g == null ? '—' : `+${fmtInt(g)}`}</td>
                    <td className="py-1.5 pl-2 text-right tabular text-ink-2">{l.rank != null ? `#${fmtInt(l.rank)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Total EXP at each lookup on a time axis, with a dashed line at each level-up. Drawn at the card's real width, so the text stays its size. */
function ExpChart({ lookups, table }: { lookups: Lookup[]; table: ClassicExpDoc }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const H = 200;
  const pad = { l: 56, r: 14, t: 16, b: 26 };
  const pts = lookups.map((l) => ({ t: Date.parse(l.at), v: totalExp(table, l.level, l.exp) ?? 0, l }));
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const lo0 = Math.min(...pts.map((p) => p.v));
  const hi0 = Math.max(...pts.map((p) => p.v));
  const padV = (hi0 - lo0) * 0.08 || Math.max(1, hi0 * 0.05);
  const lo = Math.max(0, lo0 - padV);
  const hi = hi0 + padV;
  const x = (t: number) => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(t1).toFixed(1)},${H - pad.b}L${x(t0).toFixed(1)},${H - pad.b}Z`;
  const ups = pts.filter((p, i) => i > 0 && p.l.level > pts[i - 1].l.level);
  const ticks = [lo, (lo + hi) / 2, hi];
  const dates = t1 - t0 > 2 * DAY ? [t0, (t0 + t1) / 2, t1] : [t0, t1];
  // Lookups all on one day are told apart by the time.
  const oneDay = new Date(t0).toDateString() === new Date(t1).toDateString();
  const day = (t: number) => (oneDay ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  return (
    <div ref={ref} className="h-[200px]">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Total EXP at each lookup" className="block overflow-visible">
          {ticks.map((v, i) => (
            <g key={i}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} className="stroke-border" />
              <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                {formatBig(v)}
              </text>
            </g>
          ))}
          {dates.map((t, i) => (
            <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'} className="fill-ink-3 text-[11px]">
              {day(t)}
            </text>
          ))}
          {ups.map((p) => (
            <g key={p.t}>
              <line x1={x(p.t)} x2={x(p.t)} y1={pad.t} y2={H - pad.b} strokeDasharray="3 3" className="stroke-accent/60" />
              <text x={x(p.t)} y={pad.t - 4} textAnchor="middle" className="fill-accent text-[10px] font-semibold tabular">
                {p.l.level}
              </text>
            </g>
          ))}
          <path d={area} className="fill-accent/15" />
          <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-accent" />
          {pts.map((p) => (
            <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={3.5} className="fill-surface stroke-accent" strokeWidth={2}>
              <title>{`${when(p.l.at)} · Lv ${p.l.level}, ${pct(levelShare(table, p.l.level, p.l.exp), 2)} · ${fmtInt(p.v)} EXP in all`}</title>
            </circle>
          ))}
        </svg>
      )}
    </div>
  );
}

/** A made-up Assassin's last nine evenings, so the page can be seen before the rankings open. Never stored. */
function sampleCharacter(table: ClassicExpDoc): Looked {
  const now = Date.now();
  // EXP each evening's session added; a 0 is a night off.
  const sessions = [0, 380_000, 0, 520_000, 410_000, 600_000, 0, 470_000, 350_000];
  const ranks = [15_420, 14_980, 15_010, 13_210, 12_020, 10_560, 10_610, 9_870, 9_240];
  let total = totalExp(table, 31, 21_500) ?? 0;
  const lookups = sessions.map((g, i) => {
    total += g;
    const at = new Date(now - (sessions.length - 1 - i) * DAY - 45 * 60_000).toISOString();
    return { at, ...atTotal(table, total), rank: ranks[i] };
  });
  return { name: 'Sample', job: 'Assassin', world: null, imageUrl: null, lookups, checkedAt: lookups[lookups.length - 1].at };
}
