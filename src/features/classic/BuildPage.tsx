import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Empty, Spinner } from '../../app/ui';
import { useClassic } from './data';
import { Emblem, Pips, SectionLabel, SkillIcon, SourceList, TierBadge } from './bits';
import { launchKeySkills, launchName, ordinal, RATINGS, skillTypeLabel } from './labels';
import { finalPoints, isPreview, jobEnd, spBy, timeSteps, type World } from './skillPlan';
import type { ClassicBuild, ClassicDoc, JobSkills, SkillInfo, StatName } from './types';

const STATS: StatName[] = ['STR', 'DEX', 'INT', 'LUK'];

export function BuildPage() {
  const { id = '' } = useParams();
  const { doc, error } = useClassic();
  if (error) return <Empty title="Classic World data missing">public/classic.json could not be loaded ({error}).</Empty>;
  if (!doc) return <Spinner label="Loading build…" />;
  const i = doc.builds.findIndex((b) => b.id === id);
  if (i < 0)
    return (
      <Empty title="No such build">
        <Link to="/classic/builds" className="text-accent hover:underline">
          Back to all class builds
        </Link>
      </Empty>
    );
  return <Build doc={doc} build={doc.builds[i]} prev={doc.builds[i - 1] ?? null} next={doc.builds[i + 1] ?? null} />;
}

function Build({ doc, build: b, prev, next }: { doc: ClassicDoc; build: ClassicBuild; prev: ClassicBuild | null; next: ClassicBuild | null }) {
  const info = useMemo(() => new Map(b.skillInfo.map((s) => [s.skill, s])), [b.skillInfo]);
  // Hash routes keep the scroll position; a build opened from far down the list starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [b.id]);
  const keyInfo = launchKeySkills(b, doc.world)
    .map((k) => info.get(k))
    .filter((s): s is SkillInfo => !!s);

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between gap-3 text-sm">
        <Link to="/classic/builds" className="text-ink-3 hover:text-ink">
          ← Class builds
        </Link>
        <div className="flex gap-1.5">
          {prev && (
            <Link to={`/classic/builds/${prev.id}`} className="btn-ghost btn-sm">
              ‹ {launchName(prev, doc.world)}
            </Link>
          )}
          {next && (
            <Link to={`/classic/builds/${next.id}`} className="btn-ghost btn-sm">
              {launchName(next, doc.world)} ›
            </Link>
          )}
        </div>
      </nav>

      <Hero build={b} world={doc.world} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Ratings" action={<span className="text-xs text-ink-3">at launch, 1st and 2nd job</span>}>
          <div className="space-y-3">
            {RATINGS.map((r) => (
              <div key={r.key}>
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-ink" title={r.hint}>
                    {r.label}
                  </span>
                  <Pips score={b.ratings[r.key].score} className="flex-1 [&>span]:h-2" />
                  <span className="w-4 text-right text-sm font-semibold tabular">{b.ratings[r.key].score}</span>
                </div>
                <p className="text-xs text-ink-3 mt-1">{b.ratings[r.key].why}</p>
              </div>
            ))}
          </div>
        </Card>
        <StatBuild build={b} />
        <Milestones build={b} world={doc.world} />
      </div>

      {b.stats.variants.length > 0 && (
        <Card title="Variants" action={<span className="text-xs text-ink-3">other ways testers built it</span>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {b.stats.variants.map((v) => (
              <div key={v.name} className="rounded-xl border border-border bg-surface-2/40 px-3.5 py-3 text-sm">
                <div className="font-medium text-ink">{v.name}</div>
                <p className="text-ink-2 text-xs mt-1">{v.how}</p>
                <p className="text-ink-3 text-xs mt-2 border-t border-border pt-2">
                  <span className="text-ink-2">Trade-off:</span> {v.tradeoff}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SkillBuild build={b} info={info} world={doc.world} />

      {keyInfo.length > 0 && (
        <Card title="Key skills">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {keyInfo.map((s) => (
              <div key={s.skill} className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg border border-border-2 bg-bg p-1">
                    <SkillIcon skill={s} size={32} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{s.skill}</div>
                    <div className="text-[11px] text-ink-3 mt-0.5">
                      {skillTypeLabel(s.type)} · max {s.max}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] ${s.tier > doc.world.launchJobs ? 'border-warn/40 text-warn' : 'border-border-2 text-ink-2'}`}>
                    {ordinal(s.tier)} job{s.tier > doc.world.launchJobs && ' · test only'}
                  </span>
                </div>
                <p className="text-sm text-ink-2 mt-2">{s.what}</p>
                {s.classicChange && (
                  <p className="text-xs mt-2 border-t border-border pt-2 text-ink-2">
                    <span className="text-accent font-medium">Classic: </span>
                    {s.classicChange}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Strengths">
          <Bullets items={b.strengths} mark="+" tone="text-good" />
        </Card>
        <Card title="Weaknesses">
          <Bullets items={b.weaknesses} mark="−" tone="text-bad" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Tips from the tests">
          <ol className="space-y-2.5">
            {b.tips.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Weapons and gear">
          <div className="space-y-2 mb-3">
            {b.weapons.map((w) => (
              <div key={w.type} className="flex gap-3 text-sm">
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium h-fit ${w.preferred ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border-2 text-ink-2'}`}>{w.type}</span>
                <span className="text-ink-2">{w.why}</span>
              </div>
            ))}
          </div>
          <Bullets items={b.gear} mark="•" tone="text-ink-3" />
        </Card>
      </div>

      {b.classicChanges.length > 0 && (
        <Card title="What Classic World changed">
          <Bullets items={b.classicChanges} mark="◆" tone="text-accent" />
        </Card>
      )}

      <Card title="Sources">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SourceList sources={b.sources} />
          <div className="text-sm">
            <SectionLabel>How sure is this</SectionLabel>
            <p className="text-ink-2">{b.confidence}</p>
            {b.tierSources.length > 0 && (
              <>
                <SectionLabel className="mt-3">Tier by source</SectionLabel>
                <ul className="space-y-1">
                  {b.tierSources.map((t) => (
                    <li key={t.url + t.source} className="flex items-center gap-2 text-ink-2">
                      <span className="w-6 font-semibold text-ink">{t.tier}</span>
                      <a href={t.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-accent truncate" title={t.source}>
                        {t.source}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Hero({ build: b, world }: { build: ClassicBuild; world: World }) {
  const weapon = b.weapons.find((w) => w.preferred) ?? b.weapons[0];
  const agree = b.tierSources.filter((t) => t.tier.startsWith(b.tier)).length;
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-start gap-5">
        <Emblem archetype={b.archetype} size={72} />
        <div className="min-w-0 flex-1 basis-72">
          <div className="label">{b.archetype} · Classic World build</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{launchName(b, world)}</h1>
          <p className="text-sm text-ink-2 mt-2 max-w-3xl">{b.summary}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TierBadge tier={b.tier} size="lg" />
          <span className="text-[11px] text-ink-3">{b.tierSources.length ? `${agree} of ${b.tierSources.length} lists` : 'tier'}</span>
        </div>
      </div>

      <ol className="relative mt-6 grid grid-cols-3">
        {b.path.map((job, i) => {
          const later = i + 1 > world.launchJobs;
          return (
            <li key={job} className="min-w-0">
              <div className="flex items-center">
                <span className={`size-3 shrink-0 rounded-full ring-4 ring-surface ${later ? 'border border-dashed border-ink-3 bg-surface' : 'bg-accent'}`} />
                {i < 2 && <span className={`h-px flex-1 ${i + 2 > world.launchJobs ? 'border-t border-dashed border-border-2' : 'bg-accent/50'}`} />}
              </div>
              <div className={`mt-2 pr-3 text-sm font-medium truncate ${later ? 'text-ink-3' : 'text-ink'}`}>{job}</div>
              <div className="text-xs text-ink-3">
                {ordinal(i + 1)} job · Lv {b.jobLevels[i]}
                {later && <span className="text-warn"> · test only</span>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Fact label="Main stat" value={b.stats.primary} />
        <Fact label="Secondary" value={b.stats.secondary ?? '—'} />
        <Fact label="Weapon" value={weapon?.type ?? '—'} />
        <Fact label="Defined by" value={launchKeySkills(b, world).slice(0, 2).join(' + ')} />
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/70 px-3 py-2 min-w-0">
      <div className="label">{label}</div>
      <div className="text-sm font-semibold text-ink truncate mt-0.5" title={value}>
        {value}
      </div>
    </div>
  );
}

function StatBuild({ build: b }: { build: ClassicBuild }) {
  const role = (s: StatName) => (s === b.stats.primary ? 'main' : s === b.stats.secondary ? 'secondary' : 'base');
  return (
    <Card title="Stat build">
      <div className="grid grid-cols-4 gap-2">
        {STATS.map((s) => {
          const r = role(s);
          return (
            <div key={s} className={`rounded-xl border px-2 py-2.5 text-center ${r === 'main' ? 'border-accent bg-accent/10' : r === 'secondary' ? 'border-accent/40' : 'border-border'}`}>
              <div className={`text-lg font-bold ${r === 'main' ? 'text-accent' : r === 'secondary' ? 'text-ink' : 'text-ink-3'}`}>{s}</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-3">{r}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">{b.stats.rule}</p>
      {b.stats.creation && <p className="mt-2 text-xs text-ink-3">At creation: {b.stats.creation}</p>}
      {b.stats.plan.length > 0 && (
        <ol className="mt-3 space-y-2">
          {b.stats.plan.map((p) => (
            <li key={p.levels} className="flex gap-3 text-sm">
              <span className="w-16 shrink-0 text-xs font-medium text-ink tabular pt-0.5">{/^\d/.test(p.levels) ? `Lv ${p.levels}` : p.levels}</span>
              <span className="text-ink-2">{p.do}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Job advancements and the level each key skill is finished by, on one vertical line. Jobs the launch doesn't have are faded. */
function Milestones({ build: b, world }: { build: ClassicBuild; world: World }) {
  const items = useMemo(() => {
    const out: { level: number; text: string; kind: 'job' | 'skill'; preview: boolean; skill?: SkillInfo }[] = b.path.map((job, i) => ({ level: b.jobLevels[i], text: `${ordinal(i + 1)} job: ${job}`, kind: 'job', preview: i + 1 > world.launchJobs }));
    for (const job of b.skills) {
      const done = new Map(timeSteps(job, world.rules).map((s) => [s.skill, s.level]));
      for (const f of finalPoints(job)) {
        const lvl = done.get(f.skill);
        if (lvl != null && b.keySkills.includes(f.skill)) out.push({ level: lvl, text: `${f.skill} ${f.points}`, kind: 'skill', preview: isPreview(job, world), skill: b.skillInfo.find((x) => x.skill === f.skill) });
      }
    }
    return out.sort((x, y) => x.level - y.level || (x.kind === 'job' ? -1 : 1));
  }, [b, world]);
  return (
    <Card title="Milestones" action={<span className="text-xs text-ink-3">key skills, at {world.rules.spPerLevel} SP a level</span>}>
      <ol className="relative ml-1.5 border-l border-border-2">
        {items.map((m, i) => (
          <li key={i} className={`relative pl-5 pb-3 last:pb-0 ${m.preview ? 'opacity-50' : ''}`}>
            <span className={`absolute -left-[5px] top-[5px] size-2.5 rounded-full ring-2 ring-surface ${m.kind === 'job' ? 'bg-accent' : 'bg-ink-3'}`} />
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs font-semibold text-ink tabular">Lv {m.level}</span>
              {m.kind === 'skill' && <SkillIcon skill={m.skill} name={m.text} size={20} />}
              <span className={`text-sm ${m.kind === 'job' ? 'text-ink font-medium' : 'text-ink-2'}`}>{m.text}</span>
            </div>
          </li>
        ))}
      </ol>
      {items.some((m) => m.preview) && <p className="text-xs text-ink-3 mt-3">Faded: 3rd job, which was only in the second test and isn't in the launch.</p>}
    </Card>
  );
}

function SkillBuild({ build: b, info, world }: { build: ClassicBuild; info: Map<string, SkillInfo>; world: World }) {
  return (
    <Card title="Skill build" action={<span className="text-xs text-ink-3">Top to bottom · “by Lv” is the earliest level with enough SP</span>}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {b.skills.map((job) => (
          <JobColumn key={job.tier} build={b} job={job} info={info} world={world} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-3">
        Icons are from the Classic World test data on{' '}
        <a href="https://maplestory.io/" target="_blank" rel="noreferrer" className="hover:text-accent">
          maplestory.io
        </a>
        ; lettered tiles mark skills the data has no icon for yet.
      </p>
    </Card>
  );
}

function JobColumn({ build: b, job, info, world }: { build: ClassicBuild; job: JobSkills; info: Map<string, SkillInfo>; world: World }) {
  const steps = timeSteps(job, world.rules);
  const points = finalPoints(job);
  const end = jobEnd(b, job, world);
  const sp = spBy(job, world.rules, end);
  const spent = steps[steps.length - 1]?.spent ?? 0;
  const preview = isPreview(job, world);
  const key = new Set(b.keySkills);
  const tree = b.skillInfo.filter((x) => x.tier === job.tier);
  const allMaxed = tree.length > 0 && tree.every((x) => points.some((p) => p.skill === x.skill && p.points >= x.max));
  const last = steps[steps.length - 1];
  return (
    <section className={`min-w-0 rounded-xl border p-3.5 ${preview ? 'border-dashed border-border-2' : 'border-border bg-surface-2/40'}`}>
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="label">
            {ordinal(job.tier)} job{preview && <span className="normal-case tracking-normal text-warn"> · test preview</span>}
          </div>
          <div className="font-semibold text-ink truncate">{job.job}</div>
        </div>
        <div className="text-right text-xs text-ink-3 tabular shrink-0">
          Lv {job.from}–{end}
          <div>
            <span className="text-ink font-medium">{sp}</span> SP{spent > sp && <span className="text-warn"> · plan uses {spent}</span>}
          </div>
        </div>
      </header>
      {preview && <p className="mt-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-xs text-ink-2">Only in the second closed test. Nexon pulled 3rd job from the launch to rework it, so this is how it played in August, not a launch plan.</p>}
      {!preview && job.tier + 1 > world.launchJobs && end < world.levelCap && (
        <p className="mt-2 rounded-lg bg-surface-3/60 px-2.5 py-1.5 text-xs text-ink-2">
          {ordinal(job.tier)}-job SP stops at Lv {end}, though the launch keeps you in {ordinal(job.tier)} job up to Lv {world.levelCap}.
        </p>
      )}

      <SectionLabel className="mt-3">Points</SectionLabel>
      <ul className="space-y-1.5">
        {points.map((p) => {
          const max = info.get(p.skill)?.max ?? p.points;
          const isKey = key.has(p.skill);
          return (
            <li key={p.skill} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_2.75rem] items-center gap-2 text-sm">
              <SkillIcon skill={info.get(p.skill)} name={p.skill} />
              <span className={`truncate ${isKey ? 'text-ink font-medium' : 'text-ink-2'}`} title={info.get(p.skill)?.what}>
                {p.skill}
              </span>
              <span className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <span className={`block h-full rounded-full ${isKey ? 'bg-accent' : 'bg-ink-3'}`} style={{ width: `${Math.min(100, (p.points / max) * 100)}%` }} />
              </span>
              <span className="text-right text-xs tabular text-ink-2">
                {p.points}/{max}
              </span>
            </li>
          );
        })}
      </ul>

      <SectionLabel className="mt-4">Order</SectionLabel>
      <ol className="space-y-1">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-2.5 text-sm">
            <span className="relative mt-0.5 shrink-0">
              <SkillIcon skill={info.get(s.skill)} name={s.skill} />
              <span className="absolute -left-1.5 -top-1.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-surface-3 px-0.5 text-[9px] font-semibold text-ink tabular ring-2 ring-surface">{s.n}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink">{s.skill}</span> <span className="text-ink-3">→ {s.to}</span>
              {s.note && <span className="block text-xs text-ink-3">{s.note}</span>}
            </span>
            <span className="shrink-0 pt-0.5 text-[11px] text-ink-3 tabular">by Lv {s.level}</span>
          </li>
        ))}
      </ol>
      {last && allMaxed && spent < sp && (
        <p className="mt-2 text-xs text-ink-3">
          Every {ordinal(job.tier)}-job skill is maxed by Lv {last.level}. The last {sp - spent} SP before Lv {end} have no {ordinal(job.tier)}-job skill left to go into.
        </p>
      )}

      {job.skip.length > 0 && (
        <>
          <SectionLabel className="mt-4">Skip or leave low</SectionLabel>
          <ul className="space-y-1">
            {job.skip.map((s) => {
              const named = skillsIn(s.skill, info);
              return (
                <li key={s.skill} className="flex gap-2 text-xs text-ink-3">
                  {named.length > 0 && (
                    <span className="flex shrink-0 gap-0.5 pt-px">
                      {named.map((k) => (
                        <SkillIcon key={k.skill} skill={k} size={16} />
                      ))}
                    </span>
                  )}
                  <span>
                    <span className="text-ink-2">{s.skill}</span> — {s.why}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {job.note && <p className="mt-3 text-xs text-ink-3 border-t border-border pt-2">{job.note}</p>}
    </section>
  );
}

/** Skills a skip label names, e.g. "Bow Booster (past 10) / Soul Arrow: Bow (past 11)": the longest skill name each "/" part starts with. */
function skillsIn(label: string, info: Map<string, SkillInfo>): SkillInfo[] {
  const names = [...info.keys()].sort((a, b) => b.length - a.length);
  return label
    .split(' / ')
    .map((part) => names.find((n) => part.startsWith(n)))
    .filter((n): n is string => !!n)
    .map((n) => info.get(n)!);
}

function Bullets({ items, mark, tone }: { items: string[]; mark: string; tone: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-ink-2">
          <span className={`shrink-0 font-semibold ${tone}`} aria-hidden>
            {mark}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

