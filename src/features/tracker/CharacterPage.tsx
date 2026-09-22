import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useStore } from '../../store';
import { useCharacterStats, useTrackedNames } from './hooks';
import { Card, Stat, Empty, PageHeader, Progress, CharacterAvatar, Badge } from '../../app/ui';
import { formatBig, formatFull, fmtInt, fmtDate, fmtDateLong, pct } from '../../app/format';
import { ACCENT, SERIES, ChartTip, axisProps, shortDate, dateLabel, fmtBillions } from '../../app/charts';
import { pctToNext, toBillions, cumulativeExp, expRemaining } from '../../lib/nexon/exp';
import { latestRow } from '../../lib/nexon/snapshots';
import { legionRank } from '../../lib/nexon/legion';

export function CharacterList() {
  const names = useTrackedNames();
  const snapshots = useStore((s) => s.snapshots);
  const looks = useStore((s) => s.looks);
  if (!names.length) return <Empty title="No characters tracked yet">Snapshots will list every character from data/characters.json that appears in the rankings.</Empty>;
  return (
    <>
      <PageHeader title="Characters" subtitle="Every character seen in the snapshots. Open one for its full history." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {names.map((name) => {
          const row = latestRow(snapshots, name);
          const hash = row?.lookHash ?? looks[name]?.[looks[name].length - 1]?.hash;
          const src = hash ? `${import.meta.env.BASE_URL}data/looks/${encodeURIComponent(name)}/${hash}.png` : (row?.imgUrl ?? null);
          return (
            <Link key={name} to={`/character/${encodeURIComponent(name)}`} className="card p-4 flex gap-4 hover:border-ink-3 transition-colors">
              <CharacterAvatar src={src} size={64} alt={name} />
              <div className="min-w-0">
                <div className="font-semibold truncate">{name}</div>
                <div className="text-xs text-ink-2">{row?.job ?? '—'}</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Badge tone="accent">Lv. {row?.level ?? '—'}</Badge>
                  {row && <span className="text-xs text-ink-3 tabular">{pct(pctToNext(row.level, row.exp))}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function CharacterPage() {
  const { name = '' } = useParams();
  const stats = useCharacterStats(name);
  const looks = useStore((s) => s.looks)[name] ?? [];

  const expData = useMemo(() => (stats ? stats.series.map((p) => ({ date: p.date, total: toBillions(cumulativeExp(p.level, p.exp) ?? p.exp), level: p.level, rank: p.rank })) : []), [stats]);
  const gainData = useMemo(() => (stats ? stats.gains.slice(-60).map((g) => ({ date: g.date, gain: toBillions(g.gain), levelUp: g.levelUp, spanDays: g.spanDays })) : []), [stats]);
  const levelUps = useMemo(() => (stats ? stats.series.filter((p, i) => i > 0 && p.level > stats.series[i - 1].level) : []), [stats]);

  if (!stats || !stats.latest) {
    return (
      <>
        <PageHeader title={name} />
        <Empty title="No data for this character">It has not appeared in any snapshot yet.</Empty>
      </>
    );
  }
  const L = stats.latest;
  const remaining = expRemaining(L.level, L.exp);
  const rank = legionRank(L.level, L.job);

  return (
    <>
      <div className="mb-5">
        <Link to="/characters" className="text-xs text-ink-3 hover:text-ink">
          ← Characters
        </Link>
      </div>
      <Card>
        <div className="flex gap-5">
          <CharacterAvatar src={stats.imageUrl} size={110} alt={name} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold">{name}</h1>
              <span className="text-ink-2">{L.job}</span>
              <Badge tone="accent">Lv. {L.level}</Badge>
              {rank && <Badge>Legion {rank}</Badge>}
              <span className="text-ink-3 text-xs">
                {L.world} · #{fmtInt(L.rank)} overall{L.legionRank ? ` · #${fmtInt(L.legionRank)} legion` : ''}
              </span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-ink-2 mb-1">
                <span>{pct(pctToNext(L.level, L.exp), 2)} to {L.level + 1}</span>
                <span className="tabular" title={formatFull(BigInt(L.exp))}>
                  {formatBig(BigInt(L.exp))} / {remaining != null ? formatBig(BigInt(L.exp) + remaining) : '—'}
                </span>
              </div>
              <Progress value={pctToNext(L.level, L.exp)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              <Stat label="Today" value={stats.gainToday == null ? '—' : `+${formatBig(stats.gainToday)}`} tone={stats.gainToday && stats.gainToday > 0n ? 'good' : undefined} />
              <Stat label="7-day avg" value={`${formatBig(stats.avg7)}/d`} sub={`+${formatBig(stats.gain7)} total`} />
              <Stat label="30-day avg" value={`${formatBig(stats.avg30)}/d`} sub={`+${formatBig(stats.gain30)} total`} />
              <Stat label="Remaining" value={remaining == null ? '—' : formatBig(remaining)} sub="to next level" />
              <Stat label="Projected" value={stats.projected ? fmtDate(stats.projected) : '—'} sub={stats.projected ? `Lv. ${L.level + 1} at 7-day pace` : 'no recent gain'} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="Total EXP" action={<span className="text-xs text-ink-3">{stats.series.length} days · level-ups marked</span>}>
          {expData.length < 2 ? (
            <NeedMore />
          ) : (
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={expData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
                  <YAxis {...axisProps} width={60} tickFormatter={(v: number) => fmtBillions(v)} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTip format={(v, _n, row) => `${fmtBillions(v, 2)} (Lv. ${(row as { level: number }).level})`} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
                  {levelUps.map((p) => (
                    <ReferenceLine key={p.date} x={p.date} stroke={SERIES[0]} strokeDasharray="3 3" label={{ value: `${p.level}`, fill: SERIES[0], fontSize: 10, position: 'top' }} />
                  ))}
                  <Line type="monotone" dataKey="total" name="Total EXP" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Daily gain" action={<span className="text-xs text-ink-3">last 60 observations</span>}>
          {gainData.length < 1 ? (
            <NeedMore />
          ) : (
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart data={gainData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                  <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
                  <YAxis {...axisProps} width={60} tickFormatter={(v: number) => fmtBillions(v)} />
                  <Tooltip
                    content={<ChartTip format={(v, _n, row) => `${fmtBillions(v, 2)}${(row as { levelUp: boolean }).levelUp ? ' · level up' : ''}${(row as { spanDays: number }).spanDays > 1 ? ` · over ${(row as { spanDays: number }).spanDays} days` : ''}`} labelFormat={dateLabel} />}
                    cursor={{ fill: '#1b1e24' }}
                  />
                  <Bar dataKey="gain" name="Gain" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {gainData.map((g) => (
                      <Cell key={g.date} fill={g.levelUp ? SERIES[0] : ACCENT} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Overall rank">
          {expData.length < 2 ? (
            <NeedMore />
          ) : (
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={expData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
                  <YAxis {...axisProps} width={64} reversed tickFormatter={(v: number) => `#${fmtInt(v)}`} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTip format={(v) => `#${fmtInt(Number(v))}`} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
                  <Line type="monotone" dataKey="rank" name="Rank" stroke={SERIES[2]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Looks" action={<Link to="/fashion" className="text-xs text-ink-3 hover:text-ink">Fashion timeline →</Link>}>
          {looks.length === 0 ? (
            <div className="text-sm text-ink-3 py-6 text-center">No archived looks yet.</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[...looks].reverse().map((l) => (
                <div key={l.hash} className="shrink-0 text-center">
                  <CharacterAvatar src={`${import.meta.env.BASE_URL}data/looks/${encodeURIComponent(name)}/${l.hash}.png`} size={72} alt={`${name} look`} />
                  <div className="text-[10px] text-ink-3 mt-1">{fmtDate(l.firstSeen)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="History" className="mt-4">
        <div className="overflow-x-auto -mx-4 px-4 max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left label sticky top-0 bg-surface">
              <tr>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Date</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Level</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">EXP</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Gain</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Rank</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Legion</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.series].reverse().map((p) => {
                const g = stats.gains.find((x) => x.date === p.date);
                return (
                  <tr key={p.date} className="border-t border-border">
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0">{fmtDateLong(p.date)}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular">{p.level}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2" title={formatFull(p.exp)}>
                      {formatBig(p.exp)}
                    </td>
                    <td className={`py-1.5 text-right tabular ${g && g.gain > 0n ? 'text-good' : 'text-ink-3'}`}>{g ? `+${formatBig(g.gain)}` : '—'}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">#{fmtInt(p.rank)}</td>
                    <td className="py-1.5 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">{fmtInt(p.legionLevel)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function NeedMore() {
  return <div className="text-sm text-ink-3 py-10 text-center">Need at least two snapshots.</div>;
}
