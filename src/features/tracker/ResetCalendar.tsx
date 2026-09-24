import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { utcDay, utcThursday } from 'd3-time';
import { Card } from '../../app/ui';
import { HoverTip } from '../../app/HoverTip';
import { anchorOf, type Tip } from '../../app/tip';
import { useMeasure } from '../../app/useMeasure';
import { fmtDate, fmtLevels } from '../../app/format';
import { heatColor } from './heat';
import { HeatLegend } from './Activity';
import { useActivity } from './hooks';

const CELL = 12;
const STEP = CELL + 3;
const LEFT = 30;
const TOP = 18;
const ACCOUNT = '';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const weekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

interface Day {
  date: Date;
  key: string;
  col: number;
  row: number;
  levels: number;
  parts: [string, number][];
  observed: boolean;
}

/**
 * Up to a year of daily activity where each column is one reset week
 * (Thursday 00:00 UTC to Wednesday), so a column lines up with a boss week.
 * Shows the whole account with a character picker, or one `character`.
 */
export function ResetCalendar({ character }: { character?: string }) {
  const { names, today, firstDate, gains } = useActivity();
  const [who, setWho] = useState(ACCOUNT);
  const target = character ?? who;
  const [boxRef, boxWidth, boxEl] = useMeasure<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const model = useMemo(() => {
    if (!today || !firstDate) return null;
    const end = new Date(today + 'T00:00:00Z');
    const tracked = utcThursday.count(utcThursday.floor(new Date(firstDate + 'T00:00:00Z')), end) + 1;
    // Fill the card (at least 16 weeks, at most a year) and never cut off tracked history.
    const fits = Math.floor((boxWidth - LEFT) / STEP);
    const weeks = Math.min(53, Math.max(16, fits, tracked));
    const first = utcThursday.offset(utcThursday.floor(end), -(weeks - 1));
    const byDate = new Map<string, { levels: number; parts: [string, number][] }>();
    for (const n of target ? [target] : names) {
      for (const g of gains[n] ?? []) {
        const e = byDate.get(g.date) ?? { levels: 0, parts: [] };
        const lv = Math.max(0, g.levels ?? 0);
        e.levels += lv;
        if (lv > 0) e.parts.push([n, lv]);
        byDate.set(g.date, e);
      }
    }
    const days: Day[] = utcDay.range(first, utcDay.offset(end, 1)).map((date) => {
      const key = iso(date);
      const e = byDate.get(key);
      return { date, key, col: utcThursday.count(first, date), row: (date.getUTCDay() + 3) % 7, levels: e?.levels ?? 0, parts: e?.parts ?? [], observed: !!e };
    });
    const months: { x: number; label: string }[] = [];
    let lastMonth = -1;
    let lastX = -Infinity;
    for (let c = 0; c < weeks; c++) {
      const wk = utcThursday.offset(first, c);
      if (wk.getUTCMonth() === lastMonth) continue;
      lastMonth = wk.getUTCMonth();
      const x = LEFT + c * STEP;
      if (x - lastX < 30) continue;
      lastX = x;
      months.push({ x, label: wk.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) });
    }
    const total = days.reduce((n, d) => n + d.levels, 0);
    const active = days.filter((d) => d.levels > 0).length;
    return { days, weeks, months, total, active };
  }, [today, firstDate, names, gains, target, boxWidth]);

  // When the year is wider than the card, start scrolled to the newest weeks.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [model?.weeks]);

  if (!model) return null;
  const width = LEFT + model.weeks * STEP;
  const height = TOP + 7 * STEP;
  const show = (e: MouseEvent<SVGRectElement>, d: Day) => {
    if (!boxEl) return;
    const value = d.levels > 0 ? `${fmtLevels(d.levels)} of a level` : d.observed ? 'No EXP' : 'No snapshot';
    const parts = target ? [] : [...d.parts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => ({ value: fmtLevels(v), label: n }));
    setTip({ ...anchorOf(e.currentTarget, boxEl), rows: [{ value, label: `${weekday(d.date)}, ${fmtDate(d.key)}` }, ...parts] });
  };

  return (
    <Card
      title="Reset-week calendar"
      action={
        !character && (
          <select className="input w-auto py-0.5 text-xs" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Whose activity">
            <option value={ACCOUNT}>Whole account</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )
      }
    >
      <p className="text-xs text-ink-3 mb-3">
        Each column is a reset week, Thursday to Wednesday. {model.active ? `${fmtLevels(model.total)} of a level over ${model.active} active day${model.active === 1 ? '' : 's'}.` : 'No EXP gained yet.'}
      </p>
      <div ref={boxRef} className="relative" onMouseLeave={() => setTip(null)}>
        <div ref={scroller} className="overflow-x-auto -mx-4 px-4 pb-1" onScroll={() => setTip(null)}>
          <svg width={width} height={height} role="img" aria-label={`Share of a level gained per day by reset week, ${target || 'whole account'}`}>
            {model.months.map((m) => (
              <text key={m.x} x={m.x} y={11} className="fill-ink-3 text-[11px]">
                {m.label}
              </text>
            ))}
            {['Thu', 'Sat', 'Mon', 'Wed'].map((label, i) => (
              <text key={label} x={0} y={TOP + i * 2 * STEP + CELL - 2} className="fill-ink-3 text-[10px]">
                {label}
              </text>
            ))}
            {model.days.map((d) => (
              <rect
                key={d.key}
                x={LEFT + d.col * STEP + 0.5}
                y={TOP + d.row * STEP + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                rx={3}
                fill={d.levels > 0 ? heatColor(d.levels) : undefined}
                className={d.levels > 0 ? 'hover:stroke-ink-2' : d.observed ? 'fill-surface-3 hover:stroke-ink-2' : 'fill-transparent stroke-border hover:stroke-ink-3'}
                onMouseEnter={(e) => show(e, d)}
              />
            ))}
          </svg>
        </div>
        <HoverTip tip={tip} width={boxWidth} />
      </div>
      <HeatLegend className="mt-3" />
    </Card>
  );
}
