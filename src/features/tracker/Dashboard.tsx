import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from 'recharts';
import { useStore, mainCharacterName } from '../../store';
import { useCharacterStats, useTrackedNames } from './hooks';
import { Card, Stat, Empty, PageHeader, Progress, CharacterAvatar, Badge } from '../../app/ui';
import { formatBig, fmtInt, fmtDate, relTime, pct } from '../../app/format';
import { ACCENT, SERIES, ChartTip, axisProps, shortDate, Legend, dateLabel, fmtBillions } from '../../app/charts';
import { pctToNext, toBillions, cumulativeExp } from '../../lib/nexon/exp';
import { seriesFor, dailyGains, addDays, lookImageUrl, latestRow } from '../../lib/nexon/snapshots';

function useLookChanges(days: number) {
  const looks = useStore((s) => s.looks);
  const snapshots = useStore((s) => s.snapshots);
  return useMemo(() => {
    const today = snapshots[snapshots.length - 1]?.date;
    if (!today) return [];
    const since = addDays(today, -days);
    const out: { name: string; hash: string; date: string }[] = [];
    for (const [name, list] of Object.entries(looks)) for (const l of list) if (l.firstSeen > since && list.length > 1) out.push({ name, hash: l.hash, date: l.firstSeen });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [looks, snapshots, days]);
}

export function Dashboard() {
  const snapshots = useStore((s) => s.snapshots);
  const characters = useStore((s) => s.characters);
  const index = useStore((s) => s.index);
  const settings = useStore((s) => s.settings);
  const mainName = mainCharacterName({ characters, snapshots });
  const main = useCharacterStats(mainName);
  const compare = useCharacterStats(settings.compareWith && settings.compareWith !== mainName ? settings.compareWith : null);
  const names = useTrackedNames();
  const lookChanges = useLookChanges(7);
  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];

  const sparkline = useMemo(() => {
    if (!main) return [];
    const since = main.today ? addDays(main.today, -30) : '';
    const rows = main.series.filter((p) => p.date > since);
    const cmp = compare ? new Map(compare.series.map((p) => [p.date, p])) : null;
    return rows.map((p) => {
      const c = cmp?.get(p.date);
      return {
        date: p.date,
        [main.name]: toBillions(cumulativeExp(p.level, p.exp) ?? p.exp),
        ...(compare && c ? { [compare.name]: toBillions(cumulativeExp(c.level, c.exp) ?? c.exp) } : {}),
      };
    });
  }, [main, compare]);

  const roster = useMemo(() => {
    return names
      .map((name) => {
        const row = latestRow(snapshots, name);
        const gains = dailyGains(seriesFor(name, snapshots));
        const last = gains[gains.length - 1];
        const todayGain = last && latest && last.date === latest.date ? last.gain : null;
        return { name, row, todayGain };
      })
      .filter((x) => x.row)
      .sort((a, b) => (b.row!.level - a.row!.level) || (Number(BigInt(b.row!.exp) - BigInt(a.row!.exp)) > 0 ? 1 : -1));
  }, [names, snapshots, latest]);

  const totalLevels = roster.reduce((n, r) => n + (r.row?.level ?? 0), 0);
  const prevTotal = prev ? prev.rows.reduce((n, r) => n + r.level, 0) : null;

  if (!snapshots.length) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Empty title="No snapshots yet">
          The daily GitHub Action writes one file per day into <code className="font-mono text-ink">data/snapshots/</code>. Add your characters to <code className="font-mono text-ink">data/characters.json</code>, push, and run the “Daily snapshot” workflow once from the Actions tab (or wait for 18:00 UTC).
          {characters && characters.characters.length > 0 && (
            <div className="mt-3 text-ink-3">
              Configured: {characters.characters.map((c) => c.name).join(', ')} on {characters.world}.
            </div>
          )}
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            {characters?.world ?? latest.rows[0]?.world} · {snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'} · last collected {relTime(index?.updatedAt ?? latest.fetchedAt)}
            {latest.missing.length > 0 && <span className="text-warn"> · not in rankings: {latest.missing.join(', ')}</span>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {main && main.latest && (
          <Card>
            <div className="flex gap-5">
              <Link to={`/character/${encodeURIComponent(main.name)}`}>
                <CharacterAvatar src={main.imageUrl} size={96} alt={main.name} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link to={`/character/${encodeURIComponent(main.name)}`} className="text-xl font-semibold hover:text-accent">
                    {main.name}
                  </Link>
                  <span className="text-ink-2 text-sm">{main.latest.job}</span>
                  <Badge tone="accent">Lv. {main.latest.level}</Badge>
                  <span className="text-ink-3 text-xs">#{fmtInt(main.latest.rank)} overall</span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-ink-2 mb-1">
                    <span>{pct(pctToNext(main.latest.level, main.latest.exp), 2)} to {main.latest.level + 1}</span>
                    <span className="tabular">{formatBig(BigInt(main.latest.exp))} EXP</span>
                  </div>
                  <Progress value={pctToNext(main.latest.level, main.latest.exp)} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <Stat label="Today" value={main.gainToday == null ? '—' : `+${formatBig(main.gainToday)}`} tone={main.gainToday && main.gainToday > 0n ? 'good' : undefined} />
                  <Stat label="7 days" value={`+${formatBig(main.gain7)}`} sub={`${formatBig(main.avg7)}/day`} />
                  <Stat label="Legion" value={fmtInt(main.latest.legionLevel)} sub={main.latest.raidPower ? `${formatBig(main.latest.raidPower)} raid power` : undefined} />
                  <Stat label="Next level" value={main.projected ? fmtDate(main.projected) : '—'} sub={main.projected ? 'at 7-day pace' : 'no recent gain'} />
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card title="Account">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Characters" value={roster.length} sub={characters ? `${characters.characters.length} configured` : undefined} />
            <Stat label="Total levels" value={fmtInt(totalLevels)} sub={prevTotal != null && totalLevels - prevTotal !== 0 ? `${totalLevels - prevTotal > 0 ? '+' : ''}${totalLevels - prevTotal} since last snapshot` : undefined} />
            <Stat label="Legion level" value={fmtInt(main?.latest?.legionLevel ?? latest.rows.find((r) => r.legionLevel)?.legionLevel ?? null)} />
            <Stat label="Raid power" value={formatBig(main?.latest?.raidPower ?? latest.rows.find((r) => r.raidPower)?.raidPower ?? null)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] mt-4">
        <Card title="Total EXP · last 30 days" action={compare && <span className="text-xs text-ink-3">comparing with {compare.name}</span>}>
          {sparkline.length < 2 ? (
            <div className="text-sm text-ink-3 py-8 text-center">Need at least two snapshots to draw a line.</div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer>
                  <AreaChart data={sparkline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mainFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
                    <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fmtBillions(v)} domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTip format={(v) => fmtBillions(v, 2)} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
                    <Area type="monotone" dataKey={main!.name} stroke={ACCENT} strokeWidth={2} fill="url(#mainFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                    {compare && <Area type="monotone" dataKey={compare.name} stroke={SERIES[0]} strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {compare && <Legend items={[{ name: main!.name, color: ACCENT }, { name: compare.name, color: SERIES[0] }]} />}
            </>
          )}
        </Card>

        <Card title="Look changes · this week">
          {lookChanges.length === 0 ? (
            <div className="text-sm text-ink-3 py-6 text-center">No new looks in the last 7 days.</div>
          ) : (
            <ul className="space-y-2">
              {lookChanges.slice(0, 6).map((c) => (
                <li key={c.name + c.hash} className="flex items-center gap-3">
                  <CharacterAvatar src={lookImageUrl(c.name, c.hash)} size={44} alt={c.name} />
                  <div className="text-sm">
                    <Link to="/fashion" className="font-medium hover:text-accent">
                      {c.name}
                    </Link>
                    <div className="text-xs text-ink-3">new look on {fmtDate(c.date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Roster" className="mt-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead className="text-left label">
              <tr>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Character</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium">Job</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Level</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium w-40">Progress</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Today</th>
                <th className="py-2 px-2 first:pl-0 last:pr-0 font-medium text-right">Rank</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r, i) => (
                <tr key={r.name} className="border-t border-border hover:bg-surface-2/50">
                  <td className="py-2 px-2 first:pl-0 last:pr-0">
                    <Link to={`/character/${encodeURIComponent(r.name)}`} className="font-medium hover:text-accent inline-flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0 text-ink-2">{r.row!.job}</td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0 text-right tabular">{r.row!.level}</td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0">
                    <Progress value={pctToNext(r.row!.level, r.row!.exp)} />
                  </td>
                  <td className={`py-2 text-right tabular ${r.todayGain && r.todayGain > 0n ? 'text-good' : 'text-ink-3'}`}>{r.todayGain == null ? '—' : `+${formatBig(r.todayGain)}`}</td>
                  <td className="py-2 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">#{fmtInt(r.row!.rank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <MiniGainChart names={roster.slice(0, 4).map((r) => r.name)} />
    </>
  );
}

function MiniGainChart({ names }: { names: string[] }) {
  const snapshots = useStore((s) => s.snapshots);
  const data = useMemo(() => {
    const today = snapshots[snapshots.length - 1]?.date;
    if (!today || names.length === 0) return [];
    const since = addDays(today, -14);
    const byDate = new Map<string, Record<string, number | string>>();
    for (const name of names) {
      for (const g of dailyGains(seriesFor(name, snapshots))) {
        if (g.date <= since) continue;
        const row = byDate.get(g.date) ?? { date: g.date };
        row[name] = toBillions(g.gain);
        byDate.set(g.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [names, snapshots]);
  if (data.length < 2) return null;
  return (
    <Card title="Daily EXP gain · top characters, 14 days" className="mt-4">
      <div className="h-44">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={40} />
            <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fmtBillions(v)} />
            <Tooltip content={<ChartTip format={(v) => fmtBillions(v, 2)} labelFormat={dateLabel} />} cursor={{ stroke: '#343945' }} />
            {names.map((n, i) => (
              <Line key={n} type="monotone" dataKey={n} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend items={names.map((n, i) => ({ name: n, color: SERIES[i] }))} />
    </Card>
  );
}
