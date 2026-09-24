import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card, Segmented } from '../../app/ui';
import { formatBig, fmtDate, fmtLevels } from '../../app/format';
import { shortDate } from '../../app/charts';
import { useMediaQuery } from '../../app/useMediaQuery';
import { addDays, coveredDays, type GainPoint } from '../../lib/nexon/snapshots';
import { useActivity } from './hooks';

const WINDOWS: { value: number; label: string }[] = [
  { value: 1, label: 'Last day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];

const charLink = (name: string) => `/character/${encodeURIComponent(name)}`;

/**
 * EXP gained as a share of each character's current level, so a 292 main and
 * a 262 mule compare fairly: 5T at 292 and 35B at 262 are both about 1.5–2%.
 */
export function LevelProgress() {
  const { names, today, prevDate, firstDate, gains } = useActivity();
  const [days, setDays] = useState(1);

  const rows = useMemo(() => {
    if (!today) return [];
    const since = addDays(today, -days);
    return names.map((name) => {
      const inWindow = (gains[name] ?? []).filter((g) => g.date > since);
      return {
        name,
        levels: inWindow.reduce((n, g) => n + (g.levels ?? 0), 0),
        exp: inWindow.reduce((n, g) => n + g.gain, 0n),
        levelUps: inWindow.filter((g) => g.levelUp).length,
      };
    });
  }, [names, gains, today, days]);

  if (!today) return null;
  const active = rows.filter((r) => r.levels > 0).sort((a, b) => b.levels - a.levels);
  const idle = rows.filter((r) => r.levels <= 0).map((r) => r.name);
  const max = active[0]?.levels ?? 0;
  const span = firstDate ? coveredDays(days, firstDate, today) : 0;
  const caption =
    days === 1
      ? prevDate
        ? `${fmtDate(prevDate)} → ${fmtDate(today)} snapshot`
        : 'Needs a second snapshot.'
      : span < days
        ? `Only ${span} day${span === 1 ? '' : 's'} of data so far.`
        : `${fmtDate(addDays(today, -days + 1))} → ${fmtDate(today)}`;

  return (
    <Card title="Progress · share of a level" action={<Segmented value={days} options={WINDOWS} onChange={setDays} label="Window" />}>
      <p className="text-xs text-ink-3 mb-3">{caption}</p>
      {active.length === 0 ? (
        <div className="text-sm text-ink-3 py-6 text-center">No EXP gained in this window.</div>
      ) : (
        <ul className="space-y-0.5">
          {active.map((r) => (
            <li
              key={r.name}
              className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 rounded-md px-1 -mx-1 hover:bg-surface-2/70"
              title={`${r.name}: ${fmtLevels(r.levels)} of a level, +${formatBig(r.exp)} EXP${r.levelUps ? `, ${r.levelUps} level-up${r.levelUps === 1 ? '' : 's'}` : ''}`}
            >
              <Link to={charLink(r.name)} className="truncate text-sm py-1 hover:text-accent">
                {r.name}
              </Link>
              <div className="h-5 flex items-center" aria-hidden>
                <div className="h-3 rounded-r bg-accent" style={{ width: `${Math.max(1.5, (r.levels / max) * 100)}%` }} />
              </div>
              <span className="text-xs tabular text-ink-2 text-right whitespace-nowrap">
                <span className="text-ink font-medium">{fmtLevels(r.levels)}</span> · +{formatBig(r.exp)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {idle.length > 0 && <p className="text-xs text-ink-3 mt-3 leading-relaxed">No gain: {idle.join(', ')}</p>}
    </Card>
  );
}

// One-hue ramp for "share of a level per day", validated as an ordinal ramp
// against the card surface (#131519): monotone lightness, first step >= 2:1.
const HEAT = ['#713d19', '#a1521a', '#d0661a', '#ff7a1a', '#ff9e55'];
const HEAT_MAX = [0.005, 0.015, 0.03, 0.06, Infinity];
const HEAT_LABEL = ['<0.5%', '0.5–1.5%', '1.5–3%', '3–6%', '6%+'];
const heatColor = (levels: number) => HEAT[HEAT_MAX.findIndex((m) => levels <= m)];

function cellText(g: GainPoint | null): string {
  if (!g) return 'No snapshot';
  if (!g.levels || g.levels <= 0) return 'No EXP gained';
  return `${fmtLevels(g.levels)} of a level · +${formatBig(g.gain)}`;
}

interface Tip {
  x: number;
  y: number;
  name: string;
  date: string;
  g: GainPoint | null;
}

/** Character × day grid of the share of a level gained; hollow cells are days without a snapshot. */
export function ActivityHeatmap({ days: fullDays = 30 }: { days?: number }) {
  const { names, today, gains } = useActivity();
  // Two weeks fit a phone without scrolling the names out of view.
  const days = useMediaQuery('(max-width: 639px)') ? Math.min(14, fullDays) : fullDays;
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  // If the grid still has to scroll sideways, start at the newest days.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [today, days]);

  const dates = useMemo(() => (today ? Array.from({ length: days }, (_, i) => addDays(today, i - days + 1)) : []), [today, days]);
  const rows = useMemo(() => {
    const since = dates[0] ?? '';
    return names
      .map((name, order) => {
        const byDate = new Map((gains[name] ?? []).filter((g) => g.date >= since).map((g) => [g.date, g]));
        let total = 0;
        for (const g of byDate.values()) total += g.levels ?? 0;
        return { name, order, byDate, total };
      })
      .sort((a, b) => b.total - a.total || a.order - b.order);
  }, [names, gains, dates]);

  if (!today) return null;
  // Date ticks every 7 days, anchored on the latest day.
  const ticks = new Set([0, 7, 14, 21, 28].map((k) => days - 1 - k).filter((i) => i >= 0));
  const show = (e: MouseEvent<HTMLElement>, name: string, date: string, g: GainPoint | null) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const cell = e.currentTarget.getBoundingClientRect();
    setTip({ x: cell.left - box.left + cell.width / 2, y: cell.top - box.top, name, date, g });
  };

  return (
    <Card title="Activity · share of a level per day" action={<span className="text-xs text-ink-3">last {days} days · most active first</span>}>
      <div ref={wrap} className="relative" onMouseLeave={() => setTip(null)}>
        <div ref={scroller} className="overflow-x-auto pb-1" onScroll={() => setTip(null)}>
          <div role="table" aria-label={`Share of a level gained per character per day, last ${days} days`} className="grid gap-[3px] justify-start" style={{ gridTemplateColumns: `minmax(4.5rem, 8rem) repeat(${days}, minmax(10px, 18px)) auto` }}>
            {rows.map((r) => (
              <div role="row" key={r.name} className="contents">
                <div role="rowheader" className="truncate text-xs text-ink-2 pr-2 self-center">
                  <Link to={charLink(r.name)} className="hover:text-accent">
                    {r.name}
                  </Link>
                </div>
                {dates.map((d) => {
                  const g = r.byDate.get(d) ?? null;
                  const lv = g?.levels ?? 0;
                  return (
                    <div
                      role="cell"
                      key={d}
                      aria-label={`${r.name}, ${fmtDate(d)}: ${cellText(g)}`}
                      onMouseEnter={(e) => show(e, r.name, d, g)}
                      className={`aspect-square rounded-[3px] hover:ring-1 hover:ring-ink-2 ${!g ? 'border border-border' : lv > 0 ? '' : 'bg-surface-3'}`}
                      style={g && lv > 0 ? { background: heatColor(lv) } : undefined}
                    />
                  );
                })}
                <div role="cell" className="text-[11px] text-ink-3 tabular pl-2 self-center whitespace-nowrap">
                  {r.total > 0 ? fmtLevels(r.total) : ''}
                </div>
              </div>
            ))}
            <div aria-hidden />
            {dates.map((d, i) => (
              <div key={d} aria-hidden className="relative h-4">
                {ticks.has(i) && <span className="absolute left-1/2 -translate-x-1/2 top-0.5 text-[10px] text-ink-3 whitespace-nowrap">{shortDate(d)}</span>}
              </div>
            ))}
            <div aria-hidden />
          </div>
        </div>
        {tip && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border-2 bg-surface-2/95 backdrop-blur px-2.5 py-1.5 text-xs shadow-xl whitespace-nowrap" style={{ left: tip.x, top: tip.y - 6 }}>
            <div className="text-ink font-medium tabular">{cellText(tip.g)}</div>
            <div className="text-ink-3">
              {tip.name} · {fmtDate(tip.date)}
              {tip.g && tip.g.spanDays > 1 ? ` · over ${tip.g.spanDays} days` : ''}
              {tip.g?.levelUp ? ' · level up' : ''}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border border-border" /> no snapshot
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-surface-3" /> no EXP
        </span>
        {HEAT.map((c, i) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ background: c }} /> {HEAT_LABEL[i]}
          </span>
        ))}
        <span>of a level</span>
      </div>
    </Card>
  );
}
