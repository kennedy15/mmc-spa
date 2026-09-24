import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { useNow } from '../../app/useNow';
import { useCharacterNames } from '../tracker/hooks';
import { Card, Empty, PageHeader, Stat, Stepper, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { formatCountdown, nextReset, periodLabel, previousPeriod } from '../../lib/reset/period';
import { uid, type Assignment, type Clear } from '../../lib/types';
import { bossLabel, clearFor, clearsIn, crystalValue, currentPeriods, maxParty, mesoPerClear, visibleCharacters } from './lib';
import { PeriodMeso } from './PeriodMeso';
import { usePeriodMeso } from './usePeriodMeso';
import { CharacterPicker } from './CharacterPicker';

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
  const bulkClears = useStore((s) => s.bulkClears);
  const names = visibleCharacters(useCharacterNames(), settings);
  const periods = useMemo(() => currentPeriods(now), [now]);
  const [focus, setFocus] = useState<string | null>(null);

  const byChar = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    for (const a of [...assignments].sort((x, y) => x.order - y.order)) m.set(a.character, [...(m.get(a.character) ?? []), a]);
    return [...m.entries()].filter(([c]) => !settings.hiddenCharacters.includes(c)).sort((a, b) => (names.indexOf(a[0]) + 1 || 999) - (names.indexOf(b[0]) + 1 || 999));
  }, [assignments, names, settings.hiddenCharacters]);

  // Weekly and monthly bosses are tracked apart: crystals and meso for the week count weekly bosses only.
  const weekClears = useMemo(() => clearsIn(clears, 'weekly', periods.weekly), [clears, periods.weekly]);
  const monthClears = useMemo(() => clearsIn(clears, 'monthly', periods.monthly), [clears, periods.monthly]);
  const month = usePeriodMeso('monthly', now);
  const crystalsByChar = new Map<string, number>();
  for (const c of weekClears) crystalsByChar.set(c.character, (crystalsByChar.get(c.character) ?? 0) + 1);
  const totalCrystals = weekClears.length;
  const charsAtCap = [...crystalsByChar.entries()].filter(([, n]) => n >= settings.crystalCap).map(([c]) => c);
  const worldAtCap = totalCrystals >= settings.worldCrystalCap;
  const mesoOf = (list: Clear[], character: string) => list.reduce((n, c) => n + (c.character === character ? c.meso : 0), 0);

  if (!assignments.length) {
    return (
      <>
        <PageHeader title="Checklist" />
        <Empty title="No bosses assigned yet">
          Apply the CTENE or GRANDIS preset to a character, or pick bosses one by one.
          <div className="mt-3">
            <Link to="/bossing/assignments" className="btn-accent">
              Assign bosses
            </Link>
          </div>
        </Empty>
      </>
    );
  }

  const newClear = (a: Assignment): Clear => {
    const period = periods[a.cadence];
    const crystal = crystalValue(bosses, prices, settings, a.bossId, a.difficulty);
    return { id: uid(), character: a.character, bossId: a.bossId, difficulty: a.difficulty, cadence: a.cadence, period, clearedAt: new Date().toISOString(), partySize: a.defaultPartySize, meso: mesoPerClear(crystal, a.defaultPartySize) };
  };
  const weeklyOf = (list: Assignment[]) => list.filter((a) => a.cadence === 'weekly');
  const allDone = (list: Assignment[]) => weeklyOf(list).length > 0 && weeklyOf(list).every((a) => clearFor(clears, a, periods.weekly));
  /** Check every unticked weekly boss in the list, or untick them all when all are checked. Monthly bosses are ticked on their own. */
  const toggleAll = (list: Assignment[]) => {
    const weekly = weeklyOf(list);
    if (allDone(list)) {
      void bulkClears({ add: [], remove: weekly.map((a) => clearFor(clears, a, periods.weekly)!.id) });
    } else {
      void bulkClears({ add: weekly.filter((a) => !clearFor(clears, a, periods.weekly)).map(newClear), remove: [] });
    }
  };
  const visibleAssignments = byChar.filter(([c]) => !focus || c === focus).flatMap(([, list]) => list);

  const renderRow = (a: Assignment) => {
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
      <li key={a.id} className={`flex items-center gap-3 px-4 py-1.5 ${clear ? 'bg-good/5' : ''}`}>
        <input type="checkbox" checked={!!clear} onChange={toggle} className="size-4 accent-[#ff7a1a] cursor-pointer" aria-label={`Cleared ${bossLabel(bosses, a.bossId, a.difficulty)}`} />
        <button className={`flex-1 text-left text-sm ${clear ? 'text-ink-2 line-through decoration-ink-3' : ''}`} onClick={toggle}>
          {bossLabel(bosses, a.bossId, a.difficulty)}
          {missedLast && (
            <span className="ml-2">
              <Badge tone="warn">missed last {a.cadence === 'monthly' ? 'month' : 'week'}</Badge>
            </span>
          )}
        </button>
        <Stepper
          value={party}
          max={maxParty(bosses, a.bossId, a.difficulty)}
          onChange={(v) => {
            if (clear) void updateClear(clear.id, { partySize: v, meso: mesoPerClear(crystal, v) });
            else void useStore.getState().setAssignments(assignments.map((x) => (x.id === a.id ? { ...x, defaultPartySize: v } : x)));
          }}
        />
        <span className={`w-20 text-right text-sm tabular ${clear ? 'text-good' : 'text-ink-2'}`}>{fmtMeso(meso)}</span>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Checklist"
        subtitle={
          <>
            Week of {periodLabel('weekly', periods.weekly)} · {periodLabel('monthly', periods.monthly)} · resets in UTC
          </>
        }
        action={
          <div className="flex gap-2">
            <button className="btn" onClick={() => toggleAll(visibleAssignments)} disabled={!weeklyOf(visibleAssignments).length}>
              {allDone(visibleAssignments) ? 'Uncheck all weekly' : 'Check all weekly'}
              {focus ? ` · ${focus}` : ''}
            </button>
            <Link to="/bossing/assignments" className="btn">
              Edit assignments
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card><Stat label="Weekly reset" value={formatCountdown(nextReset('weekly', now), now)} sub="Thursday 00:00 UTC" /></Card>
        <Card>
          <Stat
            label="Crystals this week"
            value={`${totalCrystals} / ${settings.worldCrystalCap}`}
            tone={worldAtCap ? 'bad' : charsAtCap.length ? 'warn' : undefined}
            sub={worldAtCap ? 'world cap reached: extra crystals cannot be sold' : charsAtCap.length ? `${charsAtCap.join(', ')} at the ${settings.crystalCap}/character cap` : `weekly bosses · ${settings.crystalCap} per character`}
          />
        </Card>
        <Card><Stat label="Monthly reset" value={formatCountdown(nextReset('monthly', now), now)} sub="1st 00:00 UTC" /></Card>
        <Card>
          <Stat label="Meso this month" value={fmtMeso(month.sold)} tone="accent" sub={month.total ? `${month.done}/${month.total} monthly bosses · ${fmtMeso(month.expected)} if all cleared` : 'no monthly bosses assigned'} />
        </Card>
      </div>

      <div className="mb-4">
        <PeriodMeso cadence="weekly" />
      </div>
      <div className="card p-3 mb-4">
        <CharacterPicker selected={focus} onSelect={setFocus} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {byChar.filter(([c]) => !focus || c === focus).map(([character, list]) => {
          const used = crystalsByChar.get(character) ?? 0;
          const weekly = list.filter((a) => a.cadence === 'weekly');
          const monthly = list.filter((a) => a.cadence === 'monthly');
          const weekMeso = mesoOf(weekClears, character);
          const monthMeso = mesoOf(monthClears, character);
          const weeklyDone = weekly.filter((a) => clearFor(clears, a, periods.weekly)).length;
          const monthlyDone = monthly.filter((a) => clearFor(clears, a, periods.monthly)).length;
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
              action={
                <span className="text-xs text-ink-2 tabular text-right">
                  {fmtMeso(weekMeso)} this week
                  {monthly.length > 0 || monthMeso > 0 ? ` · ${fmtMeso(monthMeso)} this month` : ''}
                </span>
              }
            >
              <div className="-mx-4">
                <div className="flex items-center justify-between px-4 pb-1">
                  <span className="label">Weekly</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-3 tabular">
                      {weeklyDone}/{weekly.length}
                    </span>
                    {weekly.length > 0 && (
                      <button className="btn btn-sm py-0.5" onClick={() => toggleAll(list)}>
                        {allDone(list) ? 'Uncheck all' : 'Check all'}
                      </button>
                    )}
                  </span>
                </div>
                <ul className="divide-y divide-border border-y border-border">{weekly.length ? weekly.map(renderRow) : <li className="px-4 py-2 text-xs text-ink-3">No weekly bosses.</li>}</ul>
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="label">Monthly</span>
                  <span className="text-[11px] text-ink-3 tabular">
                    {monthlyDone}/{monthly.length}
                  </span>
                </div>
                <ul className="divide-y divide-border border-y border-border">{monthly.length ? monthly.map(renderRow) : <li className="px-4 py-2 text-xs text-ink-3">No monthly bosses assigned.</li>}</ul>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
