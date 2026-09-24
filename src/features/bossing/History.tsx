import { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { Card, Empty, PageHeader, Badge } from '../../app/ui';
import { fmtMeso, fmtDate } from '../../app/format';
import { SERIES, MAX_BAR, ChartTip, axisProps, shortDate, Legend } from '../../app/charts';
import { periodLabel } from '../../lib/reset/period';
import { bossLabel, mesoByWeek, streak, weekOfClear } from './lib';

export function History() {
  const bosses = useStore((s) => s.bosses);
  const clears = useStore((s) => s.clears);
  const assignments = useStore((s) => s.assignments);
  const removeClear = useStore((s) => s.removeClear);
  const names = useCharacterNames();
  const weeks = useMemo(() => mesoByWeek(clears), [clears]);
  const [selected, setSelected] = useState<string | null>(null);
  const period = selected ?? weeks[weeks.length - 1]?.period ?? null;

  const chars = useMemo(() => {
    const seen = new Set(clears.map((c) => c.character));
    const ordered = names.filter((n) => seen.has(n));
    for (const n of seen) if (!ordered.includes(n)) ordered.push(n);
    return ordered.slice(0, 8);
  }, [clears, names]);
  const other = useMemo(() => new Set([...new Set(clears.map((c) => c.character))].filter((n) => !chars.includes(n))), [clears, chars]);

  const chartData = useMemo(
    () =>
      weeks.slice(-26).map((w) => {
        const row: Record<string, number | string> = { period: w.period, total: w.total };
        for (const c of chars) row[c] = w.byCharacter[c] ?? 0;
        if (other.size) row.Other = [...other].reduce((n, c) => n + (w.byCharacter[c] ?? 0), 0);
        return row;
      }),
    [weeks, chars, other],
  );

  const inPeriod = useMemo(() => clears.filter((c) => weekOfClear(c) === period).sort((a, b) => b.clearedAt.localeCompare(a.clearedAt)), [clears, period]);

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

  const keys = [...chars, ...(other.size ? ['Other'] : [])];
  return (
    <>
      <PageHeader title="History" subtitle={`${clears.length} clears · ${fmtMeso(clears.reduce((n, c) => n + c.meso, 0))} total since ${fmtDate(weeks[0]?.period)}`} />
      <Card title="Meso per reset week · stacked by character" action={<span className="text-xs text-ink-3">click a bar to inspect that week</span>}>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={3} maxBarSize={MAX_BAR} onClick={(e) => e && e.activeLabel != null && setSelected(String(e.activeLabel))}>
              <XAxis dataKey="period" {...axisProps} tickFormatter={shortDate} minTickGap={30} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fmtMeso(v)} />
              <Tooltip content={<ChartTip format={(v) => fmtMeso(Number(v))} labelFormat={(l) => `Week of ${shortDate(l)}`} />} cursor={{ fill: '#1b1e24' }} />
              {keys.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="m" fill={SERIES[i % SERIES.length]} stroke="#131519" strokeWidth={1} isAnimationActive={false} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} className="cursor-pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend items={keys.map((k, i) => ({ name: k, color: SERIES[i % SERIES.length] }))} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] mt-4">
        <Card
          title={period ? `Clears · week of ${periodLabel('weekly', period)}` : 'Clears'}
          action={
            <select className="input w-auto py-0.5 text-xs" value={period ?? ''} onChange={(e) => setSelected(e.target.value)}>
              {[...weeks].reverse().map((w) => (
                <option key={w.period} value={w.period}>
                  {periodLabel('weekly', w.period)} · {fmtMeso(w.total)}
                </option>
              ))}
            </select>
          }
        >
          {inPeriod.length === 0 ? (
            <div className="text-sm text-ink-3 py-6 text-center">No clears that week.</div>
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
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0">
                      {bossLabel(bosses, c.bossId, c.difficulty)} {c.cadence === 'monthly' && <Badge>monthly</Badge>}
                    </td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-ink-2">{c.character}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular">{c.partySize}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-good">{fmtMeso(c.meso)}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right text-ink-3 text-xs">{fmtDate(c.clearedAt)}</td>
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
