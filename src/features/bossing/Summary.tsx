import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../store';
import { Card, Empty, PageHeader, Stat } from '../../app/ui';
import { fmtMeso, fmtDate } from '../../app/format';
import { SERIES, ACCENT, MAX_BAR, ChartTip, axisProps, shortDate, Legend } from '../../app/charts';
import { useNow } from '../../app/useNow';
import { nextReset, periodKey, previousPeriod } from '../../lib/reset/period';
import { assignmentMeso, expectedWeekly, mesoByWeek } from './lib';
import { WeeklyMeso } from './WeeklyMeso';

export function Summary() {
  const bosses = useStore((s) => s.bosses);
  const clears = useStore((s) => s.clears);
  const assignments = useStore((s) => s.assignments);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const expected = expectedWeekly(assignments, bosses, prices, settings);
  const now = useNow(60_000);
  const current = periodKey('weekly', now);
  const weeks = useMemo(() => mesoByWeek(clears, now), [clears, now]);

  // Up to four reset weeks ending with the current one, never reaching back
  // before the ledger's first week (those weeks weren't missed, just untracked).
  const recent = useMemo(() => {
    const first = weeks[0]?.period ?? current;
    const out: { period: string; actual: number; expected: number; inProgress: boolean }[] = [];
    for (let p = current, i = 0; i < 4 && p >= first; i++, p = previousPeriod('weekly', p)) {
      out.unshift({ period: p, actual: weeks.find((w) => w.period === p)?.total ?? 0, expected: Math.round(expected), inProgress: p === current });
    }
    return out;
  }, [weeks, expected, current]);

  const total = clears.reduce((n, c) => n + c.meso, 0);
  // The week in progress would drag the average down right after every reset.
  const completed = recent.filter((w) => !w.inProgress);
  const avg = completed.length ? completed.reduce((n, w) => n + w.actual, 0) / completed.length : null;
  const firstFullWeekEnds = nextReset('weekly', now).toISOString().slice(0, 10);
  const perChar = useMemo(() => {
    const m = new Map<string, { expected: number; actual: number }>();
    for (const a of assignments) {
      const e = m.get(a.character) ?? { expected: 0, actual: 0 };
      e.expected += assignmentMeso(a, bosses, prices, settings) / (a.cadence === 'monthly' ? 4.345 : 1);
      m.set(a.character, e);
    }
    for (const c of clears) {
      const week = c.cadence === 'weekly' ? c.period : periodKey('weekly', new Date(c.clearedAt));
      if (week !== current) continue;
      const e = m.get(c.character) ?? { expected: 0, actual: 0 };
      e.actual += c.meso;
      m.set(c.character, e);
    }
    return [...m.entries()].sort((a, b) => b[1].expected - a[1].expected);
  }, [assignments, clears, bosses, prices, settings, current]);

  if (!assignments.length && !clears.length) return <Empty title="Nothing to summarise yet">Assign bosses and tick clears; this page compares what you could earn with what you did.</Empty>;

  return (
    <>
      <PageHeader title="Summary" subtitle="Expected weekly meso assumes every assigned boss is cleared at its default party size. Monthly bosses are spread over the month." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card><Stat label="Expected / week" value={fmtMeso(expected)} tone="accent" sub={`${assignments.length} assignments`} /></Card>
        <Card>
          <Stat
            label="Actual per week"
            value={avg == null ? '—' : fmtMeso(avg)}
            sub={avg == null ? `first full week ends ${fmtDate(firstFullWeekEnds)}` : `${completed.length} completed week${completed.length === 1 ? '' : 's'}${expected > 0 ? ` · ${Math.round((avg / expected) * 100)}% of expected` : ''}`}
          />
        </Card>
        <Card><Stat label="Total earned" value={fmtMeso(total)} sub={weeks.length ? `since ${fmtDate(weeks[0].period)}` : undefined} /></Card>
        <Card><Stat label="Clears logged" value={clears.length} sub={`${weeks.length} week${weeks.length === 1 ? '' : 's'} of history`} /></Card>
      </div>

      <div className="mb-4">
        <WeeklyMeso compact />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Expected vs actual · ${recent.length === 1 ? 'this week' : `last ${recent.length} weeks`}`} action={recent.length < 4 && <span className="text-xs text-ink-3">since the ledger started</span>}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={recent} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={12} barGap={2} maxBarSize={MAX_BAR}>
                <XAxis dataKey="period" {...axisProps} tickFormatter={(p: string) => (p === current ? 'This week' : shortDate(p))} />
                <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fmtMeso(v)} />
                <Tooltip content={<ChartTip format={(v) => fmtMeso(Number(v))} labelFormat={(l) => `Week of ${shortDate(l)}${l === current ? ' · in progress' : ''}`} />} cursor={{ fill: '#1b1e24' }} />
                <Bar dataKey="expected" name="Expected" fill={SERIES[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" name="Actual" fill={ACCENT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ name: 'Expected', color: SERIES[0] }, { name: 'Actual', color: ACCENT }]} />
        </Card>
        <Card title="This week by character">
          <table className="w-full text-sm">
            <thead className="text-left label">
              <tr>
                <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium">Character</th>
                <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">Expected</th>
                <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">Actual</th>
                <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">Done</th>
              </tr>
            </thead>
            <tbody>
              {perChar.map(([name, v]) => (
                <tr key={name} className="border-t border-border">
                  <td className="py-1.5 px-2 first:pl-0 last:pr-0">{name}</td>
                  <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">{fmtMeso(v.expected)}</td>
                  <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-good">{fmtMeso(v.actual)}</td>
                  <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">{v.expected ? `${Math.min(999, Math.round((v.actual / v.expected) * 100))}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
