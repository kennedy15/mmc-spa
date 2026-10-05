import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, PageHeader, Segmented, Spinner, Stat } from '../../app/ui';
import { fmtDate } from '../../app/format';
import { useNow } from '../../app/useNow';
import { useClassic } from './data';
import { Emblem, Pips, SkillIcon, TierBadge } from './bits';
import { ClassPicker, CompareTable } from './Compare';
import { ARCHETYPES, launchKeySkills, launchName, RATINGS, siteOf, tierFor, TIERS } from './labels';
import type { Archetype, ClassicBuild, ClassicDoc, SkillInfo } from './types';

const tierRank = (b: ClassicBuild) => TIERS.indexOf(b.tier);

/** Time left until `iso`: days ("in 2 days"), hours and minutes on the last day ("in 3 h 20 min"), then "open now". */
function countdown(iso: string, now: Date): string {
  const min = Math.ceil((Date.parse(iso) - now.getTime()) / 60_000);
  if (min <= 0) return 'open now';
  if (min < 60) return `in ${min} min`;
  if (min < 24 * 60) return `in ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
  const days = Math.round(min / (24 * 60));
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export function ClassicBuilds() {
  const { doc, error } = useClassic();
  if (error) return <Empty title="Classic World data missing">public/classic.json could not be loaded ({error}).</Empty>;
  if (!doc) return <Spinner label="Loading Classic World builds…" />;
  return <BuildsIndex doc={doc} />;
}

function BuildsIndex({ doc }: { doc: ClassicDoc }) {
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Archetype | 'All'>('All');
  // The tier list ranks the launch job (2nd job) or the 3rd job the second test previewed.
  const [tierJob, setTierJob] = useState<2 | 3>(2);
  const archetypes = ARCHETYPES.filter((a) => doc.builds.some((b) => b.archetype === a));
  const shown = useMemo(() => doc.builds.filter((b) => filter === 'All' || b.archetype === filter), [doc.builds, filter]);
  const byTier = TIERS.map((t) => ({ tier: t, builds: doc.builds.filter((b) => tierFor(b, tierJob) === t) })).filter((r) => r.builds.length);

  return (
    <>
      <PageHeader
        title="Class builds"
        subtitle={<>MapleStory Classic World: the builds that came out on top in the closed online tests, set up for the launch. Researched {fmtDate(doc.asOf, { month: 'short', day: 'numeric', year: 'numeric' })}.</>}
      />

      <div className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Founder's Access" value={fmtDate(doc.world.foundersAccess, { month: 'short', day: 'numeric' })} sub={countdown(doc.world.foundersAccess, now)} tone="accent" />
        <Stat label="Grand Launch" value={fmtDate(doc.world.launch, { month: 'short', day: 'numeric' })} sub={countdown(doc.world.launch, now)} />
        <Stat label="Level cap" value={doc.world.levelCap} sub={doc.world.launchJobs >= 3 ? '1st to 3rd job' : '1st and 2nd job only'} />
        <Stat label="Builds" value={doc.builds.length} sub={`${archetypes.length} classes · no Pirates`} />
      </div>

      <ClassPicker builds={doc.builds} value={filter} onChange={setFilter} />

      <Card title="Compare at a glance" className="mb-4 hidden md:block" action={<span className="text-xs text-ink-3">ratings at launch (1st and 2nd job) · click a heading to sort</span>}>
        <CompareTable builds={shown} world={doc.world} />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden mb-4">
        {[...shown]
          .sort((a, b) => tierRank(a) - tierRank(b) || ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype))
          .map((b) => (
            <BuildCard key={b.id} build={b} world={doc.world} />
          ))}
      </div>

      <Card
        title="Tier list"
        className="mb-4"
        action={
          <Segmented
            label="Which job to rank"
            value={tierJob}
            onChange={setTierJob}
            options={[
              { value: 2, label: 'Launch · 2nd job' },
              { value: 3, label: '3rd job · 2nd test' },
            ]}
          />
        }
      >
        <p className="mb-1 text-xs text-ink-3">
          {tierJob === 2
            ? 'Consensus of the 2nd-job tier lists: the jobs you play at launch. The small badge is the 3rd job each one leads to.'
            : "3rd job was only in the second test and isn't in the launch, so this is for planning ahead. The small badge is the launch job's tier."}{' '}
          Open a build to see each list.
        </p>
        <div className="divide-y divide-border">
          {byTier.map(({ tier, builds }) => (
            <div key={tier} className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1">
              <TierBadge tier={tier} size="lg" />
              <div className="flex flex-wrap gap-2 min-w-0">
                {builds.map((b) => (
                  <Link key={b.id} to={`/classic/builds/${b.id}`} className="flex items-center gap-2 rounded-xl border border-border-2 bg-surface-2 py-1.5 pl-1.5 pr-2 text-sm hover:border-ink-3 transition-colors">
                    <Emblem archetype={b.archetype} size={32} />
                    <span className="font-medium">{tierJob === 2 ? b.path[1] : b.name}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-3" title={tierJob === 2 ? `${b.name} (3rd job): ${b.tier3} tier` : `${b.path[1]} (launch): ${b.tier} tier`}>
                      <span className="max-sm:hidden">{tierJob === 2 ? `→ ${b.name}` : `from ${b.path[1]}`}</span>
                      <TierBadge tier={tierJob === 2 ? b.tier3 : b.tier} size="xs" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 mt-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        <Card title="Ground rules">
          <ul className="space-y-2">
            {doc.world.rules.notes.map((n, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-2">
                <span className="text-accent shrink-0" aria-hidden>
                  ◆
                </span>
                <span>
                  {n.text}
                  {n.source && (
                    <a href={n.source.url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-ink-3 hover:text-accent whitespace-nowrap">
                      ↗ {siteOf(n.source.url)}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Test timeline">
          <div className="space-y-3">
            {doc.world.tests.map((t) => (
              <div key={t.name} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">
                      {t.name}
                    </a>
                  ) : (
                    <span className="font-medium text-ink">{t.name}</span>
                  )}
                  <span className="text-xs text-ink-3 tabular shrink-0">{t.dates}</span>
                </div>
                <div className="text-xs text-ink-2 mt-0.5">{t.notes}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function BuildCard({ build: b, world }: { build: ClassicBuild; world: ClassicDoc['world'] }) {
  const weapon = b.weapons.find((w) => w.preferred) ?? b.weapons[0];
  return (
    <Link to={`/classic/builds/${b.id}`} className="card p-4 flex flex-col gap-3 hover:border-ink-3 transition-colors">
      <div className="flex items-start gap-3">
        <Emblem archetype={b.archetype} size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{launchName(b, world)}</div>
          <div className="text-xs text-ink-3 truncate">{b.path.join(' → ')}</div>
        </div>
        <span className="flex flex-col items-center gap-1" title={`Launch: ${b.tier} tier · ${b.name} (3rd job, second test): ${b.tier3} tier`}>
          <TierBadge tier={b.tier} />
          <span className="flex items-center gap-1 text-[10px] text-ink-3">
            3rd <TierBadge tier={b.tier3} size="xs" />
          </span>
        </span>
      </div>
      <p className="text-sm text-ink-2 line-clamp-3">{b.summary}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-auto">
        {RATINGS.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-[11px] text-ink-3">
            <span className="w-16 shrink-0">{r.label}</span>
            <Pips score={b.ratings[r.key].score} className="flex-1" />
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-2.5 text-xs">
        <div className="text-ink-2">
          <span className="font-medium text-ink">{b.stats.primary}</span>
          {b.stats.secondary && <span className="text-ink-3"> / {b.stats.secondary}</span>}
          {weapon && <span className="text-ink-3"> · {weapon.type}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {launchKeySkills(b, world, true)
            .slice(0, 3)
            .map((k) => b.skillInfo.find((x) => x.skill === k))
            .filter((x): x is SkillInfo => !!x)
            .map((x) => (
              <span key={x.skill} className="flex items-center gap-1 rounded-md border border-border bg-surface-2 py-0.5 pl-0.5 pr-1.5" title={x.what}>
                <SkillIcon skill={x} size={16} />
                <span className="text-ink-3">{x.skill}</span>
              </span>
            ))}
        </div>
      </div>
    </Link>
  );
}
