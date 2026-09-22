import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, mainCharacterName } from '../../store';
import { useTrackedNames } from './hooks';
import { Card, Empty, PageHeader, Stat, Badge } from '../../app/ui';
import { fmtInt, formatBig } from '../../app/format';
import { ACCENT, SERIES, ChartTip, axisProps, shortDate, dateLabel } from '../../app/charts';
import { latestRow, seriesFor } from '../../lib/nexon/snapshots';
import { legionRank, nextLegionTier, LEGION_TIERS } from '../../lib/nexon/legion';

export function Legion() {
  const snapshots = useStore((s) => s.snapshots);
  const characters = useStore((s) => s.characters);
  const names = useTrackedNames();
  const mainName = mainCharacterName({ characters, snapshots });

  const roster = useMemo(
    () =>
      names
        .map((name) => {
          const row = latestRow(snapshots, name);
          if (!row) return null;
          return { name, row, rank: legionRank(row.level, row.job), next: nextLegionTier(row.level, row.job) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => (a.next?.remaining ?? 999) - (b.next?.remaining ?? 999) || b.row.level - a.row.level),
    [names, snapshots],
  );

  const history = useMemo(() => {
    const src = mainName ? seriesFor(mainName, snapshots) : [];
    return src.filter((p) => p.legionLevel != null).map((p) => ({ date: p.date, legion: p.legionLevel, raid: p.raidPower ? p.raidPower / 1e6 : null }));
  }, [mainName, snapshots]);

  if (!roster.length) return <Empty title="No legion data yet">The roster fills in from the daily snapshots.</Empty>;

  const legionLevel = roster.find((r) => r.row.legionLevel)?.row.legionLevel ?? null;
  const raidPower = roster.find((r) => r.row.raidPower)?.row.raidPower ?? null;
  const total = roster.reduce((n, r) => n + r.row.level, 0);
  const byRank = LEGION_TIERS.map((t) => ({ rank: t.rank, count: roster.filter((r) => r.rank === t.rank).length }));

  return (
    <>
      <PageHeader title="Legion" subtitle="Every character's level counts toward the legion level; block rank rises at 60 / 100 / 140 / 200 / 250 (Zero: 130 / 160 / 180 / 200 / 250)." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Legion level" value={fmtInt(legionLevel)} tone="accent" sub="from the legion ranking" /></Card>
        <Card><Stat label="Raid power" value={formatBig(raidPower)} /></Card>
        <Card><Stat label="Tracked levels" value={fmtInt(total)} sub={`${roster.length} characters in rankings`} /></Card>
        <Card>
          <div className="label mb-1">Block ranks</div>
          <div className="flex gap-2 flex-wrap">
            {byRank.map((b) => (
              <Badge key={b.rank} tone={b.count ? 'accent' : 'muted'}>
                {b.rank} × {b.count}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Roster · sorted by distance to next tier" className="mt-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead className="text-left label">
              <tr>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Character</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Job</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Level</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Rank</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Next tier</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">To go</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.name} className="border-t border-border hover:bg-surface-2/50">
                  <td className="py-2 px-2 first:pl-0 last:pr-0">
                    <Link to={`/character/${encodeURIComponent(r.name)}`} className="font-medium hover:text-accent">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0 text-ink-2">{r.row.job}</td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0 text-right tabular">{r.row.level}</td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0">{r.rank ? <Badge tone={r.rank === 'SSS' ? 'good' : 'accent'}>{r.rank}</Badge> : <span className="text-ink-3">—</span>}</td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0 text-ink-2">{r.next ? `${r.next.rank} at ${r.next.level}` : 'Max'}</td>
                  <td className={`py-2 text-right tabular ${r.next && r.next.remaining <= 5 ? 'text-accent' : 'text-ink-2'}`}>{r.next ? `${r.next.remaining} lv` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="Legion level over time">
          {history.length < 2 ? (
            <div className="text-sm text-ink-3 py-10 text-center">Need at least two snapshots.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer>
                <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
                  <YAxis {...axisProps} width={56} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtInt(v)} />
                  <Tooltip content={<ChartTip format={(v) => fmtInt(Number(v))} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
                  <Line type="stepAfter" dataKey="legion" name="Legion level" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Raid power over time">
          {history.length < 2 ? (
            <div className="text-sm text-ink-3 py-10 text-center">Need at least two snapshots.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer>
                <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
                  <YAxis {...axisProps} width={56} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(0)}M`} />
                  <Tooltip content={<ChartTip format={(v) => `${Number(v).toFixed(1)}M`} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
                  <Line type="monotone" dataKey="raid" name="Raid power" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
