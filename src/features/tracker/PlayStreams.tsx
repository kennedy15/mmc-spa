import { useMemo, useState, type MouseEvent } from 'react';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, curveBasis, stack, stackOffsetSilhouette, type SeriesPoint } from 'd3-shape';
import { HoverTip } from '../../app/HoverTip';
import { pointerIn, type Tip } from '../../app/tip';
import { useMeasure } from '../../app/useMeasure';
import { shortDate } from '../../app/charts';
import { usePalette } from '../../app/theme';
import { fmtDate, fmtLevels, formatBig } from '../../app/format';
import { bigDesc } from '../../lib/nexon/exp';
import { addDays } from '../../lib/nexon/snapshots';
import { useActivity } from './hooks';

type Row = Record<string, number> & { date: number };

const H = 220;
const M = { t: 8, r: 4, b: 24, l: 4 };
const OTHERS_KEY = 'Others';
const toTime = (d: string) => Date.parse(d + 'T00:00:00Z');

/**
 * Indices of `keys` for d3's stack: d3's inside-out, but ranked by raw EXP gained
 * (most in the middle) rather than by when each band peaks. Each band then goes
 * to whichever side is thinner so far, measured in drawn size (share of a level).
 */
function insideOutByExp(keys: string[], exp: Map<string, bigint>, size: Map<string, number>): number[] {
  const tops: number[] = [];
  const bottoms: number[] = [];
  let top = 0;
  let bottom = 0;
  for (const i of keys.map((_, i) => i).sort((a, b) => bigDesc(exp.get(keys[a]) ?? 0n, exp.get(keys[b]) ?? 0n))) {
    const v = size.get(keys[i]) ?? 0;
    if (top < bottom) {
      tops.push(i);
      top += v;
    } else {
      bottoms.push(i);
      bottom += v;
    }
  }
  return bottoms.reverse().concat(tops);
}

/**
 * Share of a level per day as a streamgraph: the five characters with the most
 * raw EXP gained plus everyone else. Centered (silhouette) offset: D3's wiggle
 * offset lets bursty play drift the whole stream downhill.
 */
export function PlayStreams({ days }: { days: number }) {
  const P = usePalette();
  const { names, today, gains } = useActivity();
  const [boxRef, width, boxEl] = useMeasure<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [at, setAt] = useState<number | null>(null);

  const model = useMemo(() => {
    if (!today) return null;
    const since = addDays(today, -days);
    // Band values are shares of a level; every ordering uses raw EXP (a same-level gain can dip below 0, so both clamp at 0).
    const byName = new Map<string, Map<string, number>>();
    const expByName = new Map<string, Map<string, bigint>>();
    const observed = new Set<string>();
    for (const n of names) {
      const m = new Map<string, number>();
      const e = new Map<string, bigint>();
      for (const g of gains[n] ?? []) {
        if (g.date <= since) continue;
        m.set(g.date, Math.max(0, g.levels ?? 0));
        e.set(g.date, g.gain > 0n ? g.gain : 0n);
        observed.add(g.date);
      }
      byName.set(n, m);
      expByName.set(n, e);
    }
    const expTotal = new Map(names.map((n) => [n, [...(expByName.get(n)?.values() ?? [])].reduce((a, b) => a + b, 0n)]));
    const ranked = names.filter((n) => expTotal.get(n)! > 0n).sort((a, b) => bigDesc(expTotal.get(a)!, expTotal.get(b)!));
    // Up to five named bands; fold the rest into Others only when that joins two or more.
    const shown = ranked.length > 6 ? ranked.slice(0, 5) : ranked;
    // Colors follow characters.json order among those shown, so they don't swap as rankings shift.
    const top = names.filter((n) => shown.includes(n));
    const rest = ranked.filter((n) => !shown.includes(n));
    const keys = rest.length ? [...top, OTHERS_KEY] : top;
    const dates = [...observed].sort();
    const rows: Row[] = dates.map((date) => {
      const r = { date: toTime(date) } as Row;
      for (const n of top) r[n] = byName.get(n)?.get(date) ?? 0;
      if (rest.length) r[OTHERS_KEY] = rest.reduce((s, n) => s + (byName.get(n)?.get(date) ?? 0), 0);
      return r;
    });
    // Raw EXP per row (same index as rows) and per key over the window, for the stack order and the tooltip.
    const rowExp = dates.map((date) => {
      const e = new Map<string, bigint>(top.map((n) => [n, expByName.get(n)?.get(date) ?? 0n]));
      if (rest.length) e.set(OTHERS_KEY, rest.reduce((s, n) => s + (expByName.get(n)?.get(date) ?? 0n), 0n));
      return e;
    });
    const keyExp = new Map(keys.map((k) => [k, k === OTHERS_KEY ? rest.reduce((s, n) => s + expTotal.get(n)!, 0n) : expTotal.get(k)!]));
    const keySize = new Map(keys.map((k) => [k, rows.reduce((s, r) => s + (r[k] ?? 0), 0)]));
    const colors = new Map(keys.map((k, i) => [k, k === OTHERS_KEY ? P.others : P.series[i]]));
    return { rows, rowExp, keys, keyExp, keySize, colors };
  }, [names, gains, today, days, P]);

  const geo = useMemo(() => {
    if (!model || model.rows.length < 2 || !model.keys.length || !width) return null;
    const layers = stack<Row, string>()
      .keys(model.keys)
      .value((d, k) => d[k] ?? 0)
      .offset(stackOffsetSilhouette)
      .order(() => insideOutByExp(model.keys, model.keyExp, model.keySize))(model.rows);
    const x = scaleUtc([model.rows[0].date, model.rows[model.rows.length - 1].date], [M.l, width - M.r]);
    const lo = Math.min(...layers.map((l) => Math.min(...l.map((p) => p[0]))));
    const hi = Math.max(...layers.map((l) => Math.max(...l.map((p) => p[1]))));
    const y = scaleLinear([lo, hi], [H - M.b, M.t]);
    const band = area<SeriesPoint<Row>>()
      .x((p) => x(p.data.date))
      .y0((p) => y(p[0]))
      .y1((p) => y(p[1]))
      .curve(curveBasis);
    const every = Math.max(1, Math.ceil(model.rows.length / 5));
    const ticks = model.rows.filter((_, i) => (model.rows.length - 1 - i) % every === 0);
    return { layers, x, band, ticks };
  }, [model, width]);

  if (!model) return null;
  const rows = model.rows;
  const move = (e: MouseEvent<SVGRectElement>) => {
    if (!geo || !boxEl) return;
    const p = pointerIn(e, boxEl);
    const t = geo.x.invert(p.x).getTime();
    let i = 0;
    for (let k = 1; k < rows.length; k++) if (Math.abs(rows[k].date - t) < Math.abs(rows[i].date - t)) i = k;
    const r = rows[i];
    const exp = model.rowExp[i];
    setAt(i);
    setTip({
      x: geo.x(r.date),
      y: M.t + 12,
      rows: [
        { value: fmtDate(new Date(r.date).toISOString().slice(0, 10)) },
        ...model.keys
          .filter((k) => exp.get(k)! > 0n)
          .sort((a, b) => bigDesc(exp.get(a)!, exp.get(b)!))
          .map((k) => ({ value: `+${formatBig(exp.get(k)!)} · ${fmtLevels(r[k])}`, label: k, color: model.colors.get(k) })),
      ],
    });
  };

  return (
    <div>
      <div
        ref={boxRef}
        className="relative"
        onMouseLeave={() => {
          setTip(null);
          setAt(null);
        }}
      >
        {!geo ? (
          <div className="text-sm text-ink-3 py-10 text-center">{model.keys.length ? 'Streams need two days with EXP gains; they fill in after the next snapshot.' : `No EXP gained in the last ${days} days.`}</div>
        ) : (
          <svg width={width} height={H} role="img" aria-label={`Share of a level per day for ${model.keys.join(', ')}, last ${days} days`}>
            {geo.layers.map((l) => (
              <path key={l.key} d={geo.band(l) ?? undefined} fill={model.colors.get(l.key)} className="stroke-surface" strokeWidth={1} />
            ))}
            {geo.ticks.map((r) => (
              <text key={r.date} x={geo.x(r.date)} y={H - 6} textAnchor={r.date === rows[0].date ? 'start' : r.date === rows[rows.length - 1].date ? 'end' : 'middle'} className="fill-ink-3 text-[11px]">
                {shortDate(new Date(r.date).toISOString().slice(0, 10))}
              </text>
            ))}
            {at != null && <line x1={geo.x(rows[at].date)} x2={geo.x(rows[at].date)} y1={M.t} y2={H - M.b} className="stroke-ink-2" strokeOpacity={0.6} />}
            <rect x={M.l} y={0} width={Math.max(0, width - M.l - M.r)} height={H - M.b} fill="transparent" onMouseMove={move} />
          </svg>
        )}
        <HoverTip tip={tip} width={width} />
      </div>
      {geo && model.keys.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 mt-2">
          {model.keys.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[3px]" style={{ background: model.colors.get(k) }} />
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
