import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../store';
import { useActivity, useLegionHistory } from './hooks';
import { Card, Empty, PageHeader, Stat, Badge, Progress } from '../../app/ui';
import { fmtInt, formatBig, fmtDate, fmtRankDelta, pct } from '../../app/format';
import { ACCENT, SERIES, ChartTip, axisProps, shortDate, dateLabel } from '../../app/charts';
import { averageGain, projectDate, type LegionPoint } from '../../lib/nexon/snapshots';
import { expRemaining, pctToNext, MAX_LEVEL } from '../../lib/nexon/exp';
import { legionRank, nextLegionTier } from '../../lib/nexon/legion';

function delta(now: number | null | undefined, before: number | null | undefined): number | null {
  return now != null && before != null ? now - before : null;
}

export function Legion() {
  const snapshots = useStore((s) => s.snapshots);
  const { names, series, gains, today } = useActivity();
  const history = useLegionHistory();
  const latest = history[history.length - 1] ?? null;
  const before = history[history.length - 2] ?? null;

  // Each level on a character in the legion is +1 legion level, so the cheapest
  // legion levels are the characters with the least EXP left in their level.
  const roster = useMemo(
    () =>
      names
        .map((name) => {
          const s = series[name];
          const last = s[s.length - 1];
          if (!last || (last.row.owner ?? 'me') !== 'me') return null;
          const remaining = expRemaining(last.level, last.exp);
          const first = s[0].date;
          const avg = today ? averageGain(gains[name], 7, today, first) : 0n;
          return {
            name,
            row: last.row,
            remaining,
            projected: remaining != null && today ? projectDate(remaining, avg, today) : null,
            block: legionRank(last.level, last.row.job),
            next: nextLegionTier(last.level, last.row.job),
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => (a.remaining == null ? 1 : b.remaining == null ? -1 : a.remaining < b.remaining ? -1 : a.remaining > b.remaining ? 1 : 0)),
    [names, series, gains, today],
  );

  if (!roster.length) return <Empty title="No legion data yet">The roster fills in from the daily snapshots.</Empty>;

  const cheapest = roster.find((r) => r.remaining != null && r.remaining > 0n)?.remaining ?? null;
  const tracked = roster.filter((r) => !latest || r.row.worldId === latest.worldId).reduce((n, r) => n + r.row.level, 0);
  const untracked = latest ? Math.max(0, latest.legionLevel - tracked) : null;
  const trackedShare = latest && latest.legionLevel > 0 ? Math.min(1, tracked / latest.legionLevel) : 0;
  const belowSss = roster.some((r) => r.next);
  const lvlDelta = delta(latest?.legionLevel, before?.legionLevel);
  const raidDelta = delta(latest?.raidPower, before?.raidPower);
  const rankMove = latest?.legionRank != null && before?.legionRank != null ? before.legionRank - latest.legionRank : null;

  return (
    <>
      <PageHeader
        title="Legion"
        subtitle={
          <>
            Legion level is the total level of the characters in your legion. The rankings file it under your highest-level character
            {latest ? (
              <>
                {' '}
                (now <span className="text-ink">{latest.reporter}</span>)
              </>
            ) : null}
            ; on a level tie, whoever got there first keeps it.
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Legion level" value={fmtInt(latest?.legionLevel)} tone="accent" sub={lvlDelta ? `${lvlDelta > 0 ? '+' : ''}${fmtInt(lvlDelta)} since last snapshot` : latest ? `as of ${fmtDate(latest.date)}` : 'not reported yet'} />
        </Card>
        <Card>
          <Stat label="Raid power" value={formatBig(latest?.raidPower)} sub={raidDelta ? `${raidDelta > 0 ? '+' : '-'}${formatBig(Math.abs(raidDelta))} since last snapshot` : undefined} />
        </Card>
        <Card>
          <Stat label="Legion rank" value={latest?.legionRank ? `#${fmtInt(latest.legionRank)}` : '—'} sub={rankMove ? `${fmtRankDelta(rankMove)} since last snapshot` : 'in your world'} />
        </Card>
        <Card>
          <Stat label="Tracked levels" value={fmtInt(tracked)} sub={latest ? `of ${fmtInt(latest.legionLevel)} legion levels` : `${roster.length} characters`} />
          {latest && <Progress value={trackedShare} className="mt-2" />}
        </Card>
      </div>
      {untracked != null && untracked > 0 && (
        <p className="text-xs text-ink-3 mt-3">
          About {fmtInt(untracked)} legion levels are on characters that aren't in <code className="font-mono">data/characters.json</code>. Add them in{' '}
          <Link to="/settings" className="text-ink-2 hover:text-ink underline">
            Settings
          </Link>{' '}
          to see every character here.
        </p>
      )}

      <Card title="Cheapest next legion level" className="mt-4" action={<span className="text-xs text-ink-3">sorted by EXP left in the current level</span>}>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead className="text-left label">
              <tr>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Character</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Job</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Level</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium w-32">Progress</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">EXP to next</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right" title="EXP to next level relative to the cheapest character">Cost</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">At 7-day pace</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Block</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => {
                const cost = r.remaining != null && cheapest ? Number((r.remaining * 1000n) / cheapest) / 1000 : null;
                return (
                  <tr key={r.name} className="border-t border-border hover:bg-surface-2/50">
                    <td className="py-2 px-2 first:pl-0 last:pr-0">
                      <Link to={`/character/${encodeURIComponent(r.name)}`} className="font-medium hover:text-accent">
                        {r.name}
                      </Link>
                      {latest?.reporter === r.name && (
                        <span className="ml-2">
                          <Badge>reports legion</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 first:pl-0 last:pr-0 text-ink-2">{r.row.job}</td>
                    <td className="py-2 px-2 first:pl-0 last:pr-0 text-right tabular">{r.row.level}</td>
                    <td className="py-2 px-2 first:pl-0 last:pr-0">
                      <div className="flex items-center gap-2">
                        <Progress value={pctToNext(r.row.level, r.row.exp)} />
                        <span className="text-[11px] text-ink-3 tabular w-10 text-right">{pct(pctToNext(r.row.level, r.row.exp), 0)}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 first:pl-0 last:pr-0 text-right tabular">{r.row.level >= MAX_LEVEL ? 'Max' : formatBig(r.remaining)}</td>
                    <td className={`py-2 px-2 first:pl-0 last:pr-0 text-right tabular ${cost != null && cost <= 1.5 ? 'text-accent' : 'text-ink-2'}`}>{cost == null ? '—' : `×${cost < 10 ? cost.toFixed(1) : Math.round(cost)}`}</td>
                    <td className="py-2 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">{r.row.level >= MAX_LEVEL ? '—' : r.projected ? fmtDate(r.projected) : <span className="text-ink-3">idle</span>}</td>
                    <td className="py-2 px-2 first:pl-0 last:pr-0">
                      {r.block ? <Badge tone={r.block === 'SSS' ? 'good' : 'accent'}>{r.block}</Badge> : <span className="text-ink-3">—</span>}
                      {belowSss && r.next && (
                        <span className="text-[11px] text-ink-3 ml-2">
                          {r.next.rank} at {r.next.level} ({r.next.remaining} lv)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <LegionChart title="Legion level" data={history} pick={(p) => p.legionLevel} format={(v) => fmtInt(v)} color={ACCENT} step />
        <LegionChart title="Raid power" data={history} pick={(p) => (p.raidPower == null ? null : p.raidPower / 1e6)} format={(v) => `${v.toFixed(0)}M`} tipFormat={(v) => `${v.toFixed(1)}M`} color={SERIES[0]} />
        <LegionChart title="Legion rank in world" data={history} pick={(p) => p.legionRank} format={(v) => `#${fmtInt(v)}`} color={SERIES[2]} reversed />
      </div>
      {snapshots.length > 0 && history.length === 0 && <p className="text-xs text-ink-3 mt-3">No snapshot carries legion data yet. The collector finds it under your highest-level character.</p>}
    </>
  );
}

function LegionChart({ title, data, pick, format, tipFormat, color, step, reversed }: { title: string; data: LegionPoint[]; pick: (p: LegionPoint) => number | null; format: (v: number) => string; tipFormat?: (v: number) => string; color: string; step?: boolean; reversed?: boolean }) {
  const rows = data.map((p) => ({ date: p.date, value: pick(p), reporter: p.reporter })).filter((r) => r.value != null);
  return (
    <Card title={`${title} over time`}>
      {rows.length < 2 ? (
        <div className="text-sm text-ink-3 py-10 text-center">Need at least two snapshots.</div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
              <YAxis {...axisProps} width={64} reversed={reversed} domain={['auto', 'auto']} allowDecimals={false} tickFormatter={(v: number) => format(v)} />
              <Tooltip content={<ChartTip format={(v, _n, row) => `${(tipFormat ?? format)(Number(v))} · via ${(row as { reporter: string }).reporter}`} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
              <Line type={step ? 'stepAfter' : 'monotone'} dataKey="value" name={title} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
