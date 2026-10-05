import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Emblem, Pips, SkillIcon, TierBadge } from './bits';
import { launchKeySkills, launchName, RATINGS, TIERS } from './labels';
import type { Archetype, ClassicBuild, ClassicDoc, RatingKey, SkillInfo } from './types';

const CLASSES: Archetype[] = ['Warrior', 'Magician', 'Bowman', 'Thief'];

/** Big class tiles that filter the builds; Pirate is shown greyed out, since Classic World has no Pirates yet. */
export function ClassPicker({ builds, value, onChange }: { builds: ClassicBuild[]; value: Archetype | 'All'; onChange: (a: Archetype | 'All') => void }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" role="group" aria-label="Filter by class">
      <button type="button" aria-pressed={value === 'All'} onClick={() => onChange('All')} className={`card flex items-center gap-3 p-3 text-left transition-colors cursor-pointer ${value === 'All' ? 'border-accent ring-2 ring-accent/25' : 'hover:border-ink-3'}`}>
        <span className="grid grid-cols-2 gap-0.5" aria-hidden>
          {CLASSES.map((a) => (
            <Emblem key={a} archetype={a} size={24} />
          ))}
        </span>
        <span>
          <span className="block font-semibold text-ink">All classes</span>
          <span className="block text-xs text-ink-3">{builds.length} builds</span>
        </span>
      </button>
      {CLASSES.map((a) => {
        const list = builds.filter((b) => b.archetype === a);
        const best = TIERS.find((t) => list.some((b) => b.tier === t));
        return (
          <button key={a} type="button" aria-pressed={value === a} onClick={() => onChange(value === a ? 'All' : a)} className={`@container card flex items-center gap-3 p-3 text-left transition-colors cursor-pointer ${value === a ? 'border-accent ring-2 ring-accent/25' : 'hover:border-ink-3'}`}>
            <Emblem archetype={a} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{a}</span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-3">
                {list.length} branches
                {/* A narrow tile (phones, or six in a row at 1366 and below) has no room beside the name, so the badge moves under it. */}
                {best && (
                  <span className="@min-[10.5rem]:hidden" title={`Best launch tier: ${best}`}>
                    <TierBadge tier={best} size="xs" />
                  </span>
                )}
              </span>
            </span>
            {best && (
              <span className="hidden shrink-0 @min-[10.5rem]:block" title={`Best launch tier: ${best}`}>
                <TierBadge tier={best} />
              </span>
            )}
          </button>
        );
      })}
      {/* Unavailable, not faded: a dashed outline and a grey emblem, with text kept at full contrast. */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-2 p-3" title="Pirates aren't in Classic World. There are no guides for them until Nexon adds the class.">
        <span className="opacity-50 grayscale">
          <Emblem archetype="Pirate" size={48} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink-3">Pirate</span>
          <span className="block text-xs text-ink-3">Not in Classic World yet</span>
        </span>
      </div>
    </div>
  );
}

type SortKey = 'tier' | 'tier3' | 'name' | RatingKey;
const SHORT: Record<RatingKey, string> = { mobbing: 'Mob', bossing: 'Boss', mobility: 'Move', survival: 'Survive', funding: 'Budget', party: 'Party' };

/** Every build in one sortable table: launch and 3rd-job tiers, the six ratings, stats and signature skills. */
export function CompareTable({ builds, world }: { builds: ClassicBuild[]; world: ClassicDoc['world'] }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'tier', desc: false });
  const rows = useMemo(() => {
    const tier = (b: ClassicBuild) => TIERS.indexOf(b.tier);
    const value = (b: ClassicBuild): number | string =>
      sort.key === 'tier' ? tier(b) : sort.key === 'tier3' ? TIERS.indexOf(b.tier3) : sort.key === 'name' ? launchName(b, world) : b.ratings[sort.key].score;
    return [...builds].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return (sort.desc ? -c : c) || tier(a) - tier(b);
    });
  }, [builds, sort, world]);
  // Tiers sort best-first ascending; ratings and names start from the top score / A.
  const by = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'tier' && key !== 'tier3' && key !== 'name' }));
  const aria = (key: SortKey) => (sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none');
  const head = (key: SortKey, label: string, title?: string) => (
    <th key={key} scope="col" aria-sort={aria(key)} className="px-1.5 pb-2 text-left font-medium">
      <button type="button" onClick={() => by(key)} title={title} className={`inline-flex items-center gap-0.5 text-[11px] uppercase tracking-wider cursor-pointer hover:text-ink ${sort.key === key ? 'text-ink' : 'text-ink-3'}`}>
        {label}
        <span aria-hidden className="text-[9px]">
          {sort.key === key ? (sort.desc ? '▼' : '▲') : ''}
        </span>
      </button>
    </th>
  );
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {head('name', 'Build')}
            {head('tier', 'Launch', 'Consensus tier for the launch job (2nd job)')}
            {head('tier3', '3rd job', 'Consensus tier for the 3rd job, which only the second test had')}
            {RATINGS.map((r) => head(r.key, SHORT[r.key], r.hint))}
            <th scope="col" className="px-1.5 pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-3">
              Stats
            </th>
            <th scope="col" className="px-1.5 pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-3">
              Signature skills
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const keys = launchKeySkills(b, world, true)
              .slice(0, 3)
              .map((k) => b.skillInfo.find((x) => x.skill === k))
              .filter((x): x is SkillInfo => !!x);
            return (
              <tr key={b.id} onClick={() => navigate(`/classic/builds/${b.id}`)} className="group cursor-pointer">
                <td className="border-t border-border px-1.5 py-2 group-hover:bg-surface-2">
                  <Link to={`/classic/builds/${b.id}`} className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                    <Emblem archetype={b.archetype} size={32} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink group-hover:text-accent">{launchName(b, world)}</span>
                      <span className="block text-[11px] text-ink-3">{b.archetype}</span>
                    </span>
                  </Link>
                </td>
                <td className="border-t border-border px-1.5 py-2 group-hover:bg-surface-2">
                  <TierBadge tier={b.tier} />
                </td>
                <td className="border-t border-border px-1.5 py-2 group-hover:bg-surface-2" title={`${b.name} (second test only): ${b.tier3} tier`}>
                  <span className="inline-flex items-center gap-1.5">
                    <TierBadge tier={b.tier3} size="xs" />
                    <span className="text-[11px] text-ink-3">{b.name}</span>
                  </span>
                </td>
                {RATINGS.map((r) => (
                  <td key={r.key} className="border-t border-border px-1.5 py-2 group-hover:bg-surface-2" title={b.ratings[r.key].why}>
                    <span className="flex items-center gap-1.5">
                      <Pips score={b.ratings[r.key].score} className="w-12" />
                      <span className="w-2 text-xs font-semibold tabular text-ink">{b.ratings[r.key].score}</span>
                    </span>
                  </td>
                ))}
                <td className="border-t border-border px-1.5 py-2 text-xs group-hover:bg-surface-2">
                  <span className="font-semibold text-ink">{b.stats.primary}</span>
                  {b.stats.secondary && <span className="text-ink-3"> › {b.stats.secondary}</span>}
                  <span className="block text-ink-3">{(b.weapons.find((w) => w.preferred) ?? b.weapons[0])?.type}</span>
                </td>
                <td className="border-t border-border px-1.5 py-2 group-hover:bg-surface-2">
                  <span className="flex gap-1">
                    {keys.map((k) => (
                      <span key={k.skill} title={`${k.skill}: ${k.what}`}>
                        <SkillIcon skill={k} size={32} />
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
