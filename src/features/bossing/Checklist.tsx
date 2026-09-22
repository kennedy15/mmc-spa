import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { Card, Empty, PageHeader, Stat, Stepper, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { formatCountdown, nextReset, periodLabel, previousPeriod } from '../../lib/reset/period';
import { uid, type Clear } from '../../lib/types';
import { assignmentMeso, bossLabel, clearFor, crystalValue, currentPeriods, mesoPerClear, visibleCharacters } from './lib';

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Checklist() {
  const now = useNow();
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const clears = useStore((s) => s.clears);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const addClear = useStore((s) => s.addClear);
  const removeClear = useStore((s) => s.removeClear);
  const updateClear = useStore((s) => s.updateClear);
  const names = visibleCharacters(useCharacterNames(), settings);
  const periods = useMemo(() => currentPeriods(now), [now]);

  const byChar = useMemo(() => {
    const m = new Map<string, typeof assignments>();
    for (const a of [...assignments].sort((x, y) => x.order - y.order)) {
      if (!names.includes(a.character) && !m.has(a.character)) m.set(a.character, []);
      m.set(a.character, [...(m.get(a.character) ?? []), a]);
    }
    return [...m.entries()].filter(([c]) => names.includes(c) || true).sort((a, b) => names.indexOf(a[0]) - names.indexOf(b[0]));
  }, [assignments, names]);

  const weekClears = clears.filter((c) => c.cadence === 'weekly' && c.period === periods.weekly);
  const monthClears = clears.filter((c) => c.cadence === 'monthly' && c.period === periods.monthly);
  const weekMeso = weekClears.reduce((n, c) => n + c.meso, 0) + monthClears.reduce((n, c) => n + c.meso, 0);
  const expectedNow = assignments.reduce((n, a) => n + assignmentMeso(a, bosses, prices, settings), 0);
  const crystalsByChar = new Map<string, number>();
  for (const c of weekClears) crystalsByChar.set(c.character, (crystalsByChar.get(c.character) ?? 0) + 1);
  const anyAtCap = [...crystalsByChar.values()].some((n) => n >= settings.crystalCap);
  const totalCrystals = weekClears.length;

  if (!assignments.length) {
    return (
      <>
        <PageHeader title="Weekly checklist" />
        <Empty title="No bosses assigned yet">
          <Link to="/bossing/assignments" className="btn-accent mt-3">
            Assign bosses
          </Link>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Weekly checklist"
        subtitle={
          <>
            Week of {periodLabel('weekly', periods.weekly)} · month {periodLabel('monthly', periods.monthly)} · resets in UTC
          </>
        }
        action={
          <Link to="/bossing/assignments" className="btn">
            Edit assignments
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card><Stat label="Weekly reset" value={formatCountdown(nextReset('weekly', now), now)} sub="Thursday 00:00 UTC" /></Card>
        <Card><Stat label="Monthly reset" value={formatCountdown(nextReset('monthly', now), now)} sub="1st 00:00 UTC" /></Card>
        <Card>
          <Stat label="Crystals this week" value={`${totalCrystals}`} tone={anyAtCap ? 'warn' : undefined} sub={anyAtCap ? `a character is at the ${settings.crystalCap}/week cap` : `cap ${settings.crystalCap} per character`} />
        </Card>
        <Card><Stat label="Meso this period" value={fmtMeso(weekMeso)} tone="accent" sub={`of ${fmtMeso(expectedNow)} if everything is cleared`} /></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {byChar.map(([character, list]) => {
          const used = crystalsByChar.get(character) ?? 0;
          const charMeso = list.reduce((n, a) => {
            const c = clearFor(clears, a, periods[a.cadence]);
            return n + (c?.meso ?? 0);
          }, 0);
          return (
            <Card
              key={character}
              title={
                <span className="flex items-center gap-2">
                  {character}
                  <Badge tone={used >= settings.crystalCap ? 'warn' : 'muted'}>
                    {used}/{settings.crystalCap} crystals
                  </Badge>
                </span>
              }
              action={<span className="text-xs text-ink-2 tabular">{fmtMeso(charMeso)} this period</span>}
            >
              <ul className="divide-y divide-border -mx-4">
                {list.map((a) => {
                  const period = periods[a.cadence];
                  const clear = clearFor(clears, a, period);
                  const missedLast = !clear && !clearFor(clears, a, previousPeriod(a.cadence, period)) && clears.some((c) => c.character === a.character && c.bossId === a.bossId && c.difficulty === a.difficulty);
                  const party = clear?.partySize ?? a.defaultPartySize;
                  const crystal = crystalValue(bosses, prices, settings, a.bossId, a.difficulty);
                  const meso = clear?.meso ?? mesoPerClear(crystal, party);
                  const toggle = () => {
                    if (clear) void removeClear(clear.id);
                    else {
                      const c: Clear = { id: uid(), character: a.character, bossId: a.bossId, difficulty: a.difficulty, cadence: a.cadence, period, clearedAt: new Date().toISOString(), partySize: party, meso: mesoPerClear(crystal, party) };
                      void addClear(c);
                    }
                  };
                  return (
                    <li key={a.id} className={`flex items-center gap-3 px-4 py-2 ${clear ? 'bg-good/5' : ''}`}>
                      <input type="checkbox" checked={!!clear} onChange={toggle} className="size-4 accent-[#ff7a1a] cursor-pointer" aria-label={`Cleared ${bossLabel(bosses, a.bossId, a.difficulty)}`} />
                      <button className={`flex-1 text-left text-sm ${clear ? 'text-ink-2 line-through decoration-ink-3' : ''}`} onClick={toggle}>
                        {bossLabel(bosses, a.bossId, a.difficulty)}
                        {a.cadence === 'monthly' && <Badge>monthly</Badge>}
                        {missedLast && (
                          <span className="ml-2">
                            <Badge tone="warn">missed last {a.cadence === 'monthly' ? 'month' : 'week'}</Badge>
                          </span>
                        )}
                      </button>
                      <Stepper
                        value={party}
                        onChange={(v) => {
                          if (clear) void updateClear(clear.id, { partySize: v, meso: mesoPerClear(crystal, v) });
                          else void useStore.getState().setAssignments(assignments.map((x) => (x.id === a.id ? { ...x, defaultPartySize: v } : x)));
                        }}
                      />
                      <span className={`w-20 text-right text-sm tabular ${clear ? 'text-good' : 'text-ink-2'}`}>{fmtMeso(meso)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
