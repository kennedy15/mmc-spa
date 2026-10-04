import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Empty, Spinner, Toggle } from '../../app/ui';
import { useClassic } from './data';
import { Emblem, Pips, SectionLabel, SkillIcon, SourceList, TierBadge } from './bits';
import { launchKeySkills, launchName, ordinal, RATINGS, skillTypeLabel, tierLists } from './labels';
import { finalPoints, isPreview, jobEnd, spBy, timeSteps, type World } from './skillPlan';
import type { ClassicBuild, ClassicDoc, JobSkills, RatingKey, SkillInfo, StatName } from './types';

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
      {/* One row on every width: phones keep the emblems and arrows, wider screens add a Previous/Next caption and the name. */}
      <nav className="flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/classic/builds" className="btn gap-2 px-3 py-2 text-[15px] sm:px-4 sm:py-2.5">
          <span aria-hidden>←</span> Class builds
        </Link>
        <div className="flex gap-2">
          {prev && (
            <Link to={`/classic/builds/${prev.id}`} className="btn gap-2.5 py-1.5 pl-2.5 pr-2.5 text-[15px] sm:pr-4" aria-label={`Previous build: ${launchName(prev, doc.world)}`}>
              <span aria-hidden className="text-ink-3">‹</span>
              <Emblem archetype={prev.archetype} size={32} />
              <span className="text-left leading-tight max-sm:hidden">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-ink-3">Previous</span>
                {launchName(prev, doc.world)}
              </span>
            </Link>
          )}
          {next && (
            <Link to={`/classic/builds/${next.id}`} className="btn gap-2.5 py-1.5 pl-2.5 pr-2.5 text-[15px] sm:pl-4" aria-label={`Next build: ${launchName(next, doc.world)}`}>
              <span className="text-right leading-tight max-sm:hidden">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-ink-3">Next</span>
                {launchName(next, doc.world)}
              </span>
              <Emblem archetype={next.archetype} size={32} />
              <span aria-hidden className="text-ink-3">›</span>
            </Link>
          )}
        </div>
      </nav>

      <Hero build={b} world={doc.world} />

      <AtAGlance build={b} info={info} world={doc.world} />

      <SectionNav />

      <div id="skills" className="scroll-mt-16">
        <SkillBuild build={b} info={info} world={doc.world} />
      </div>

      <div id="ratings" className="grid grid-cols-1 gap-4 lg:grid-cols-3 scroll-mt-16">
        <Card title="Ratings" action={<span className="text-xs text-ink-3">at launch, 1st and 2nd job</span>}>
          <div className="space-y-2.5">
            {RATINGS.map((r) => (
              <div key={r.key} className="flex items-center gap-3" title={b.ratings[r.key].why}>
                <span className="w-20 shrink-0 text-sm text-ink">{r.label}</span>
                <Pips score={b.ratings[r.key].score} className="flex-1 [&>span]:h-2" />
                <span className="w-4 text-right text-sm font-semibold tabular">{b.ratings[r.key].score}</span>
              </div>
            ))}
          </div>
          <details className="group mt-3 border-t border-border pt-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform group-open:rotate-90">›</span> Why these scores
            </summary>
            <dl className="mt-2 space-y-2">
              {RATINGS.map((r) => (
                <div key={r.key}>
                  <dt className="text-xs font-semibold text-ink">{r.label}</dt>
                  <dd className="text-xs text-ink-2">{b.ratings[r.key].why}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Card>
        <StatBuild build={b} />
        <Milestones build={b} world={doc.world} />
      </div>

      {keyInfo.length > 0 && (
        <Card title="Key skills">
          {/* Every build lists five: 3 + 2 on laptops, one row on wide screens. The job tag sits under the name so long names don't wrap. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {keyInfo.map((s) => (
              <div key={s.skill} className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg border border-border-2 bg-bg p-1">
                    <SkillIcon skill={s} size={32} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{s.skill}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-3">
                      {skillTypeLabel(s.type)} · max {s.max}
                      <span className={`rounded-md border px-1.5 ${s.tier > doc.world.launchJobs ? 'border-warn/40 text-warn' : 'border-border-2 text-ink-2'}`}>
                        {ordinal(s.tier)} job{s.tier > doc.world.launchJobs && ' · test only'}
                      </span>
                    </div>
                  </div>
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

      <div id="details" className="grid grid-cols-1 gap-4 lg:grid-cols-2 scroll-mt-16">
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

      {b.classicChanges.length > 0 && (
        <Card title="What Classic World changed">
          <Bullets items={b.classicChanges} mark="◆" tone="text-accent" />
        </Card>
      )}

      <div id="sources" className="scroll-mt-16" />
      <Card title="Sources">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SourceList sources={b.sources} />
          <div className="text-sm">
            <SectionLabel>How sure is this</SectionLabel>
            <p className="text-ink-2">{b.confidence}</p>
            {([2, 3] as const).map((job) => {
              const list = b.tierSources.filter((t) => t.jobs.includes(job));
              if (!list.length) return null;
              return (
                <div key={job}>
                  <SectionLabel className="mt-3">
                    Tier by source · {job === 2 ? `${b.path[1]}, launch` : `${b.name}, 2nd test`}
                  </SectionLabel>
                  <ul className="space-y-1">
                    {list.map((t) => (
                      <li key={t.url + t.source} className="flex items-center gap-2 text-ink-2">
                        <span className="w-6 shrink-0 font-semibold text-ink" title={t.tier === '—' ? 'Grades single columns (damage, range…), not the class' : undefined}>
                          {t.tier}
                        </span>
                        <a href={t.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-accent truncate" title={t.source}>
                          {t.source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

const SECTIONS = [
  { id: 'skills', label: 'Skill build' },
  { id: 'ratings', label: 'Ratings & stats' },
  { id: 'details', label: 'Strengths & tips' },
  { id: 'sources', label: 'Sources' },
];

/** In-page jumps (hash routing owns the URL fragment, so these scroll by element id); the section on screen is lit. */
function SectionNav() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => {
      // The last section whose top has passed under the sticky bar, or the last one at the bottom of the page.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string | null = null;
      for (const s of SECTIONS) {
        const top = document.getElementById(s.id)?.getBoundingClientRect().top;
        if (top != null && top <= 96) current = s.id;
      }
      setActive(atEnd && current ? SECTIONS[SECTIONS.length - 1].id : current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    // One scrolling line on phones, so the sticky bar covers 40px of the page instead of two wrapped rows.
    <nav aria-label="On this page" className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface/95 px-1.5 py-1.5 shadow-sm backdrop-blur sm:flex-wrap [&>button]:shrink-0">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-current={active === s.id ? 'location' : undefined}
          className={`btn-ghost btn-sm ${active === s.id ? 'bg-surface-3 text-ink' : ''}`}
          onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

const GOOD: Record<RatingKey, string> = { mobbing: 'Mobbing', bossing: 'Bossing', mobility: 'Mobility', survival: 'Survival', funding: 'Cheap to run', party: 'Party support' };
const WEAK: Record<RatingKey, string> = { mobbing: 'Mobbing', bossing: 'Bossing', mobility: 'Mobility', survival: 'Survival', funding: 'Costly to run', party: 'Party support' };

/**
 * The build in one card: stat priority, weapon, what it is good and weak at (from the ratings: 4+ and 2-),
 * and the 1st and 2nd job skill order as icon strips.
 */
function AtAGlance({ build: b, info, world }: { build: ClassicBuild; info: Map<string, SkillInfo>; world: World }) {
  const weapon = b.weapons.find((w) => w.preferred) ?? b.weapons[0];
  const good = RATINGS.filter((r) => b.ratings[r.key].score >= 4).map((r) => GOOD[r.key]);
  const weak = RATINGS.filter((r) => b.ratings[r.key].score <= 2).map((r) => WEAK[r.key]);
  const launchJobs = b.skills.filter((j) => !isPreview(j, world));
  return (
    <section className="card p-4 sm:p-5" aria-label="At a glance">
      {/* Phones keep the title and a short link on one row, so the stats start a line higher. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-ink">At a glance</h2>
          <span className="text-xs text-ink-3 max-sm:hidden">the launch build, 1st and 2nd job</span>
        </div>
        <Link to={`/classic/grinding?class=${encodeURIComponent(b.archetype)}&branch=${encodeURIComponent(b.path[1])}`} className="btn btn-sm gap-1.5" aria-label={`Where to train as a ${b.path[1]}`}>
          <Emblem archetype={b.archetype} size={16} />
          {/* One flex item, so the button's gap doesn't open up between "train" and "as". */}
          <span>
            Where to train<span className="max-sm:hidden"> as a {b.path[1]}</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)]">
          <dt className="label pt-0.5">Stats</dt>
          <dd>
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs text-on-accent">{b.stats.primary}</span>
              {b.stats.secondary && (
                <>
                  <span className="text-ink-3">›</span>
                  <span className="rounded-md border border-border-2 px-1.5 py-0.5 text-xs">{b.stats.secondary}</span>
                </>
              )}
            </span>
            <p className="mt-1 text-xs text-ink-2">{b.stats.rule}</p>
          </dd>
          {weapon && (
            <>
              <dt className="label pt-0.5">Weapon</dt>
              <dd className="font-medium text-ink">{weapon.type}</dd>
            </>
          )}
          <dt className="label pt-0.5">Good at</dt>
          <dd className="flex flex-wrap gap-1">{good.length ? good.map((g) => <Chip key={g} tone="good">{g}</Chip>) : <span className="text-ink-3">—</span>}</dd>
          <dt className="label pt-0.5">Weak at</dt>
          <dd className="flex flex-wrap gap-1">{weak.length ? weak.map((w) => <Chip key={w} tone="bad">{w}</Chip>) : <span className="text-ink-3">—</span>}</dd>
        </dl>
        <div className="space-y-4 min-w-0">
          {launchJobs.map((job) => (
            <SkillPath key={job.tier} build={b} job={job} info={info} world={world} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({ tone, children }: { tone: 'good' | 'bad'; children: string }) {
  return <span className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${tone === 'good' ? 'border-good/40 bg-good/10 text-good' : 'border-bad/40 bg-bad/10 text-bad'}`}>{children}</span>;
}

/** One job's skill order as icons in sequence; each badge is the level that step takes the skill to. */
function SkillPath({ build: b, job, info, world }: { build: ClassicBuild; job: JobSkills; info: Map<string, SkillInfo>; world: World }) {
  const steps = timeSteps(job, world.rules);
  const end = jobEnd(b, job, world);
  // Skills in the order they reach max level (the "Max: A > B > C" line).
  const maxed = steps.filter((st) => st.to === info.get(st.skill)?.max).map((st) => st.skill);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          {ordinal(job.tier)} job · {job.job}
        </span>
        <span className="text-xs text-ink-3 tabular">
          Lv {job.from}–{end} · {spBy(job, world.rules, end)} SP
        </span>
      </div>
      {maxed.length > 0 && (
        <p className="mt-0.5 text-xs text-ink-2">
          <span className="font-semibold text-ink">Max:</span> {maxed.join(' › ')}
        </p>
      )}
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2.5">
        {steps.map((s, i) => (
          <li key={s.n} className="flex items-center gap-1">
            {i > 0 && (
              <span aria-hidden className="text-xs text-ink-3">
                ›
              </span>
            )}
            <span className="relative" title={`${s.n}. ${s.skill} to ${s.to} (by Lv ${s.level})`}>
              <SkillIcon skill={info.get(s.skill)} name={s.skill} size={32} />
              <span className="absolute -bottom-2 -right-1.5 rounded bg-ink px-1 text-[10px] font-bold leading-4 text-surface tabular">{s.to}</span>
              <span className="sr-only">
                {s.skill} to {s.to}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The summary's opening as a tagline, the rest behind "More". The tagline runs to the first sentence end past
 * 60 characters, so a short opener ("The bow branch.") brings the sentence that says what the build does.
 * Phones clamp it to two lines until "More" is open, which keeps the At a glance facts on the first screen.
 */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ends = [...text.matchAll(/[.!?](?=\s|$)/g)].map((m) => m.index + 1);
  const cut = ends.find((i) => i >= 60) ?? text.length;
  const head = text.slice(0, cut);
  const rest = text.slice(cut).trim();
  return (
    <div className="mt-2 max-w-3xl text-sm text-ink-2">
      <p className={`text-[15px] text-ink ${open ? '' : 'max-sm:line-clamp-2'}`}>{head}</p>
      {open && rest && <p className="mt-1">{rest}</p>}
      {rest && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-1 cursor-pointer text-xs font-medium text-ink-3 hover:text-ink">
          <span aria-hidden className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>
            ›
          </span>{' '}
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
  );
}

/** Name, job path, tier and tagline, kept short so the At a glance card below is on the first screen. */
function Hero({ build: b, world }: { build: ClassicBuild; world: World }) {
  const launch = tierLists(b, 2);
  return (
    <section className="card relative overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      {/* Phones: emblem, name and tier on one row, then the job path and tagline at full width. From sm up the emblem
          and tier box flank a middle column of name, path and tagline. */}
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 sm:gap-x-5">
        <div className="sm:row-span-3">
          <Emblem archetype={b.archetype} size={64} className="max-sm:hidden" />
          <Emblem archetype={b.archetype} size={48} className="sm:hidden" />
        </div>
        <h1 className="min-w-0 text-[26px] font-semibold leading-tight tracking-tight max-sm:self-center sm:text-3xl">{launchName(b, world)}</h1>
        <div className="sm:row-span-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/70 p-2.5 pr-4 max-sm:hidden">
            <TierBadge tier={b.tier} size="lg" />
            <div className="text-xs">
              <div className="font-semibold text-ink">Launch tier</div>
              <div className="text-ink-3">{launch.lists.length ? `${launch.agree} of ${launch.lists.length} lists agree` : 'no list yet'}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-ink-2" title={`${b.name} was only in the second test`}>
                <TierBadge tier={b.tier3} size="xs" />
                {b.name} (3rd job, test)
              </div>
            </div>
          </div>
          {/* Phones: the build card's compact tier, launch on top and the 3rd job under it. */}
          <div className="flex flex-col items-center gap-1 sm:hidden" title={`Launch: ${b.tier} tier${launch.lists.length ? ` (${launch.agree} of ${launch.lists.length} lists agree)` : ''} · ${b.name} (3rd job, second test): ${b.tier3} tier`}>
            <TierBadge tier={b.tier} />
            <span className="flex items-center gap-1 text-[10px] text-ink-3">
              3rd <TierBadge tier={b.tier3} size="xs" />
            </span>
          </div>
        </div>
        <div className="col-span-3 max-sm:mt-2 sm:col-span-1 sm:col-start-2">
          <JobPath build={b} world={world} />
        </div>
        <div className="col-span-3 sm:col-span-1 sm:col-start-2">
          <Summary key={b.id} text={b.summary} />
        </div>
      </div>
    </section>
  );
}

/** The three jobs on one line with their advancement levels; jobs the launch doesn't open are muted and marked. */
function JobPath({ build: b, world }: { build: ClassicBuild; world: World }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] sm:mt-1 sm:text-sm" aria-label="Job advancements">
      {b.path.map((job, i) => {
        const later = i + 1 > world.launchJobs;
        return (
          <li key={job} className="flex items-center gap-1.5 whitespace-nowrap" title={`${ordinal(i + 1)} job at Lv ${b.jobLevels[i]}${later ? ', only in the second test' : ''}`}>
            {i > 0 && (
              <span aria-hidden className="text-ink-3">
                ›
              </span>
            )}
            <span className={later ? 'text-ink-3' : 'font-medium text-ink'}>{job}</span>
            <span className="text-xs text-ink-3 tabular">
              Lv {b.jobLevels[i]}
              {later && <span className="text-warn"> · test only</span>}
            </span>
          </li>
        );
      })}
    </ol>
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
          // Test-only steps are muted with the lightest text color rather than opacity, so they stay readable (WCAG AA).
          <li key={i} className="relative pl-5 pb-3 last:pb-0">
            <span className={`absolute -left-[5px] top-[5px] size-2.5 rounded-full ring-2 ring-surface ${m.preview ? 'border border-dashed border-ink-3 bg-surface' : m.kind === 'job' ? 'bg-accent' : 'bg-ink-3'}`} />
            <div className="flex items-center gap-2">
              <span className={`w-12 shrink-0 text-xs font-semibold tabular ${m.preview ? 'text-ink-3' : 'text-ink'}`}>Lv {m.level}</span>
              {m.kind === 'skill' && (
                <span className={m.preview ? 'opacity-50 grayscale' : undefined}>
                  <SkillIcon skill={m.skill} name={m.text} size={20} />
                </span>
              )}
              <span className={`text-sm ${m.preview ? 'text-ink-3' : m.kind === 'job' ? 'text-ink font-medium' : 'text-ink-2'}`}>{m.text}</span>
            </div>
          </li>
        ))}
      </ol>
      {items.some((m) => m.preview) && <p className="text-xs text-ink-3 mt-3">Dashed: 3rd job, which was only in the second test and isn't in the launch.</p>}
    </Card>
  );
}

function SkillBuild({ build: b, info, world }: { build: ClassicBuild; info: Map<string, SkillInfo>; world: World }) {
  // "What should I have at Lv N": null shows the finished build.
  const [at, setAt] = useState<number | null>(null);
  const [reasons, setReasons] = useState(false);
  const clamp = (n: number) => Math.min(world.levelCap, Math.max(b.jobLevels[0], Math.round(n) || b.jobLevels[0]));
  return (
    <Card
      title={<span className="whitespace-nowrap">Skill build</span>}
      action={
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5" role="group" aria-label="Show the build at a level">
            <span className="text-xs text-ink-3">At level</span>
            <button type="button" className="btn btn-sm px-2" aria-label="One level lower" onClick={() => setAt(clamp((at ?? world.levelCap) - 1))}>
              −
            </button>
            <input
              type="number"
              min={b.jobLevels[0]}
              max={world.levelCap}
              value={at ?? ''}
              placeholder="final"
              onChange={(e) => setAt(e.target.value === '' ? null : clamp(Number(e.target.value)))}
              className="input h-7 w-16 px-1 py-0 text-center tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Character level"
            />
            <button type="button" className="btn btn-sm px-2" aria-label="One level higher" onClick={() => setAt(clamp((at ?? b.jobLevels[0] - 1) + 1))}>
              +
            </button>
            {at != null && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setAt(null)}>
                Final
              </button>
            )}
          </div>
          <Toggle checked={reasons} onChange={setReasons} label={<span className="text-xs text-ink-2">Reasons</span>} />
        </div>
      }
    >
      <p className="mb-3 text-xs text-ink-3">{at == null ? 'The finished build. Set a level to see what you should have by then; “by Lv” is the earliest level with enough SP.' : `At Lv ${at}: done steps are ticked, the next one is ringed.`}</p>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {b.skills.map((job) => (
          <JobColumn key={job.tier} build={b} job={job} info={info} world={world} at={at} reasons={reasons} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-3">
        Icons are from the Classic World test data on{' '}
        <a href="https://maplestory.io/" target="_blank" rel="noreferrer" className="hover:text-accent">
          maplestory.io
        </a>
        .
      </p>
    </Card>
  );
}

function JobColumn({ build: b, job, info, world, at, reasons }: { build: ClassicBuild; job: JobSkills; info: Map<string, SkillInfo>; world: World; at: number | null; reasons: boolean }) {
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
  // Points each skill has at the chosen level, and the first step not yet affordable.
  const done = (st: { level: number }) => at == null || (at >= job.from && st.level <= at);
  const nowPoints = new Map<string, number>();
  for (const st of steps) if (done(st)) nowPoints.set(st.skill, Math.max(nowPoints.get(st.skill) ?? 0, st.to));
  const next = at == null ? null : steps.find((st) => !done(st));
  return (
    <section className={`min-w-0 rounded-xl border p-3.5 ${preview || (at != null && at < job.from) ? 'border-dashed border-border-2' : 'border-border bg-surface-2/40'}`}>
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
      {at != null && at < job.from && <p className="mt-2 text-xs text-ink-3">Starts at Lv {job.from}.</p>}

      <SectionLabel className="mt-3">Points</SectionLabel>
      <ul className="space-y-1.5">
        {points.map((p) => {
          const max = info.get(p.skill)?.max ?? p.points;
          const isKey = key.has(p.skill);
          const now = nowPoints.get(p.skill) ?? 0;
          return (
            <li key={p.skill} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_3.25rem] items-center gap-2 text-sm">
              <SkillIcon skill={info.get(p.skill)} name={p.skill} />
              <span className={`truncate ${isKey ? 'text-ink font-medium' : 'text-ink-2'}`} title={info.get(p.skill)?.what}>
                {p.skill}
              </span>
              <span className="relative h-1.5 rounded-full bg-surface-3 overflow-hidden">
                {/* The planned final level, faint, under the points you have at the chosen level. */}
                <span className={`absolute inset-y-0 left-0 rounded-full ${isKey ? 'bg-accent/25' : 'bg-ink-3/25'}`} style={{ width: `${Math.min(100, (p.points / max) * 100)}%` }} />
                <span className={`absolute inset-y-0 left-0 rounded-full ${isKey ? 'bg-accent' : 'bg-ink-3'}`} style={{ width: `${Math.min(100, (now / max) * 100)}%` }} />
              </span>
              <span className="text-right text-xs tabular text-ink-2">
                {now}/{max}
              </span>
            </li>
          );
        })}
      </ul>

      <SectionLabel className="mt-4">Order</SectionLabel>
      <ol className="space-y-1">
        {steps.map((s) => {
          const isDone = at != null && done(s);
          const isNext = next?.n === s.n;
          // Steps still ahead of the chosen level: faded icon, lightest text (opacity on text would drop it below WCAG AA).
          const ahead = at != null && !isDone && !isNext;
          return (
            <li key={s.n} className={`flex items-start gap-2.5 rounded-lg text-sm ${isNext ? '-mx-1.5 bg-accent/10 px-1.5 py-1 ring-1 ring-accent/50' : ''}`}>
              <span className="relative mt-0.5 shrink-0">
                <span className={ahead ? 'block opacity-45' : 'block'}>
                  <SkillIcon skill={info.get(s.skill)} name={s.skill} />
                </span>
                <span className={`absolute -left-1.5 -top-1.5 flex min-w-4 h-4 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold tabular ring-2 ring-surface ${isDone ? 'bg-good text-surface' : 'bg-surface-3 text-ink'}`}>{isDone ? '✓' : s.n}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={ahead ? 'text-ink-3' : 'text-ink'}>{s.skill}</span> <span className="text-ink-3">→ {s.to}</span>
                {isNext && <span className="ml-1.5 text-[11px] font-semibold text-accent">next</span>}
                {reasons && s.note && <span className="block text-xs text-ink-3">{s.note}</span>}
              </span>
              <span className="shrink-0 pt-0.5 text-[11px] text-ink-3 tabular">by Lv {s.level}</span>
            </li>
          );
        })}
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

