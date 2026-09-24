import { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { Card, Empty, PageHeader, Badge } from '../../app/ui';
import { fmtMeso, fmtDate } from '../../app/format';
import { SERIES, MAX_BAR, ChartTip, axisProps, shortDate, Legend } from '../../app/charts';
import { periodLabel, type Cadence } from '../../lib/reset/period';
import { bossLabel, clearsIn, mesoByPeriod, streak, type PeriodMeso } from './lib';

interface Shown {
  cadence: Cadence;
  period: string;
}
type ChartRow = Record<string, number | string>;

/** "Sep 2026" for a month key. */
function monthTick(key: unknown): string {
  const [y, m] = String(key).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function History() {
  const bosses = useStore((s) => s.bosses);
  const clears = useStore((s) => s.clears);
  const assignments = useStore((s) => s.assignments);
  const removeClear = useStore((s) => s.removeClear);
  const names = useCharacterNames();
  // Weekly bosses are charted per reset week and monthly bosses per month, so a monthly clear never inflates a week.
  const weeks = useMemo(() => mesoByPeriod(clears, 'weekly'), [clears]);
  const months = useMemo(() => mesoByPeriod(clears, 'monthly'), [clears]);
  const [selected, setSelected] = useState<Shown | null>(null);
  const lastWeek = weeks[weeks.length - 1]?.period;
  const lastMonth = months[months.length - 1]?.period;
  const shown: Shown | null = selected ?? (lastWeek ? { cadence: 'weekly', period: lastWeek } : lastMonth ? { cadence: 'monthly', period: lastMonth } : null);

  const chars = useMemo(() => {
    const seen = new Set(clears.map((c) => c.character));
    const ordered = names.filter((n) => seen.has(n));
    for (const n of seen) if (!ordered.includes(n)) ordered.push(n);
    return ordered.slice(0, 8);
  }, [clears, names]);
  const other = useMemo(() => new Set([...new Set(clears.map((c) => c.character))].filter((n) => !chars.includes(n))), [clears, chars]);
  // One color per character across both charts.
  const keys = useMemo(() => [...chars, ...(other.size ? ['Other'] : [])], [chars, other]);
  const color = (k: string) => SERIES[keys.indexOf(k) % SERIES.length];

  const { weekData, monthData } = useMemo(() => {
    const toRows = (rows: PeriodMeso[]): ChartRow[] =>
      rows.map((w) => {
        const row: ChartRow = { period: w.period, total: w.total };
        for (const c of chars) row[c] = w.byCharacter[c] ?? 0;
        if (other.size) row.Other = [...other].reduce((n, c) => n + (w.byCharacter[c] ?? 0), 0);
        return row;
      });
    return { weekData: toRows(weeks.slice(-26)), monthData: toRows(months.slice(-12)) };
  }, [weeks, months, chars, other]);

  const shownCadence = shown?.cadence;
  const shownPeriod = shown?.period;
  const inPeriod = useMemo(() => (shownCadence && shownPeriod ? clearsIn(clears, shownCadence, shownPeriod).sort((a, b) => b.clearedAt.localeCompare(a.clearedAt)) : []), [clears, shownCadence, shownPeriod]);

  const streaks = useMemo(
    () =>
      assignments
        .map((a) => ({ a, n: streak(clears, a) }))
        .filter((x) => x.n > 0)
        .sort((x, y) => y.n - x.n)
        .slice(0, 12),
    [assignments, clears],
  );

  if (!clears.length) return <Empty title="No clears recorded yet">Tick bosses on the checklist and they will show up here week by week.</Empty>;

  const weeklyTotal = weeks.reduce((n, w) => n + w.total, 0);
  const monthlyTotal = months.reduce((n, m) => n + m.total, 0);
  const firstClear = clears.reduce((a, c) => (c.clearedAt < a ? c.clearedAt : a), clears[0].clearedAt);
  const present = (data: ChartRow[]) => keys.filter((k) => data.some((r) => Number(r[k]) > 0));
  return (
    <>
      <PageHeader
        title="History"
        subtitle={`${clears.length} clears · ${fmtMeso(weeklyTotal + monthlyTotal)} since ${fmtDate(firstClear)}${monthlyTotal ? ` · ${fmtMeso(weeklyTotal)} from weekly bosses, ${fmtMeso(monthlyTotal)} from monthly` : ''}`}
      />
      <div className={`grid gap-4 ${weeks.length && months.length ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
        {weeks.length > 0 && <MesoChart title="Weekly bosses · meso per reset week" hint="click a bar for its clears" data={weekData} keys={present(weekData)} color={color} tick={shortDate} label={(l) => `Week of ${shortDate(l)}`} onPick={(period) => setSelected({ cadence: 'weekly', period })} />}
        {months.length > 0 && <MesoChart title="Monthly bosses · per month" data={monthData} keys={present(monthData)} color={color} tick={monthTick} label={(l) => periodLabel('monthly', String(l))} onPick={(period) => setSelected({ cadence: 'monthly', period })} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] mt-4">
        <Card
          title={!shown ? 'Clears' : shown.cadence === 'weekly' ? `Clears · week of ${periodLabel('weekly', shown.period)}` : `Monthly clears · ${periodLabel('monthly', shown.period)}`}
          action={
            <select
              className="input w-auto py-0.5 text-xs"
              value={shown ? `${shown.cadence}|${shown.period}` : ''}
              onChange={(e) => {
                const [cadence, period] = e.target.value.split('|');
                setSelected({ cadence: cadence as Cadence, period });
              }}
              aria-label="Period"
            >
              {weeks.length > 0 && (
                <optgroup label="Reset weeks · weekly bosses">
                  {[...weeks].reverse().map((w) => (
                    <option key={w.period} value={`weekly|${w.period}`}>
                      {periodLabel('weekly', w.period)} · {fmtMeso(w.total)}
                    </option>
                  ))}
                </optgroup>
              )}
              {months.length > 0 && (
                <optgroup label="Months · monthly bosses">
                  {[...months].reverse().map((m) => (
                    <option key={m.period} value={`monthly|${m.period}`}>
                      {periodLabel('monthly', m.period)} · {fmtMeso(m.total)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          }
        >
          {inPeriod.length === 0 ? (
            <div className="text-sm text-ink-3 py-6 text-center">No clears that {shown?.cadence === 'monthly' ? 'month' : 'week'}.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left label">
                <tr>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium">Boss</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium">Character</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">Party</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">Meso</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inPeriod.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0">{bossLabel(bosses, c.bossId, c.difficulty)}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-ink-2">{c.character}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular">{c.partySize}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-good">{fmtMeso(c.meso)}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right text-ink-3 text-xs whitespace-nowrap" title={`${new Date(c.clearedAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} your time`}>
                      {fmtDate(c.clearedAt)}
                    </td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right">
                      <button className="btn-ghost btn-sm" onClick={() => confirm('Delete this clear record?') && void removeClear(c.id)} aria-label="Delete">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Streaks · consecutive periods cleared">
          {streaks.length === 0 ? (
            <div className="text-sm text-ink-3 py-6 text-center">No streaks yet.</div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {streaks.map(({ a, n }) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>
                    {bossLabel(bosses, a.bossId, a.difficulty)} <span className="text-ink-3">· {a.character}</span>
                  </span>
                  <Badge tone={n >= 4 ? 'good' : 'accent'}>
                    {n} {a.cadence === 'monthly' ? 'mo' : 'wk'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/** Stacked bars of meso per period and character; clicking a bar shows that period's clears. */
function MesoChart({ title, hint, data, keys, color, tick, label, onPick }: { title: string; hint?: string; data: ChartRow[]; keys: string[]; color: (k: string) => string; tick: (v: unknown) => string; label: (l: unknown) => string; onPick: (period: string) => void }) {
  return (
    <Card title={title} action={hint && <span className="text-xs text-ink-3">{hint}</span>}>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={3} maxBarSize={MAX_BAR} onClick={(e) => e && e.activeLabel != null && onPick(String(e.activeLabel))}>
            <XAxis dataKey="period" {...axisProps} tickFormatter={tick} minTickGap={30} />
            <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fmtMeso(v)} />
            <Tooltip content={<ChartTip format={(v) => fmtMeso(Number(v))} labelFormat={label} />} cursor={{ fill: '#1b1e24' }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="m" fill={color(k)} stroke="#131519" strokeWidth={1} isAnimationActive={false} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} className="cursor-pointer" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={keys.map((k) => ({ name: k, color: color(k) }))} />
    </Card>
  );
}
