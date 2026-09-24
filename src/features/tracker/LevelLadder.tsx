import { useMemo, useState, type FocusEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { scaleLinear } from 'd3-scale';
import { useStore, mainCharacterName } from '../../store';
import { Card } from '../../app/ui';
import { HoverTip } from '../../app/HoverTip';
import { anchorOf, type Tip } from '../../app/tip';
import { useMeasure } from '../../app/useMeasure';
import { formatBig, fmtLevels, pct } from '../../app/format';
import { expRemaining, expToNext, MAX_LEVEL, pctToNext } from '../../lib/nexon/exp';
import { lookImageUrl } from '../../lib/nexon/snapshots';
import { useActivity } from './hooks';

interface Sprite {
  name: string;
  job: string;
  level: number;
  pct: number;
  toNext: bigint | null;
  gain: bigint | null;
  levels: number | null;
  img: string | null;
  main: boolean;
  cx: number;
  dy: number;
}

const BAND = 5;
const LABEL_H = 24;

/**
 * Every character on one level axis, drawn as its own sprite. Background bands
 * are five levels wide and labelled with the EXP one level costs at the band's
 * first level, which is why the 290s crawl while the 260s fly.
 */
export function LevelLadder() {
  const { names, series, gains, today } = useActivity();
  const looks = useStore((s) => s.looks);
  const characters = useStore((s) => s.characters);
  const snapshots = useStore((s) => s.snapshots);
  const mainName = mainCharacterName({ characters, snapshots });
  const navigate = useNavigate();
  const [boxRef, width, boxEl] = useMeasure<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);

  const chars = useMemo(
    () =>
      names.flatMap((name) => {
        const s = series[name];
        const last = s[s.length - 1];
        if (!last) return [];
        const g = gains[name] ?? [];
        const lg = g[g.length - 1];
        const fresh = !!lg && lg.date === today;
        const hash = last.row.lookHash ?? looks[name]?.[looks[name].length - 1]?.hash ?? null;
        return [
          {
            name,
            job: last.row.job,
            level: last.level,
            pct: pctToNext(last.level, last.exp),
            toNext: last.level >= MAX_LEVEL ? null : expRemaining(last.level, last.exp),
            gain: fresh ? lg.gain : null,
            levels: fresh ? lg.levels : null,
            img: hash ? lookImageUrl(name, hash) : last.row.imgUrl || null,
            main: name === mainName,
          },
        ];
      }),
    [names, series, gains, today, looks, mainName],
  );

  const layout = useMemo(() => {
    if (!width || !chars.length) return null;
    const R = width < 520 ? 14 : 20;
    const M = { l: R + 6, r: R + 6 };
    const lowest = Math.min(...chars.map((c) => c.level + c.pct));
    const start = Math.min(MAX_LEVEL - BAND, Math.floor(lowest / BAND) * BAND);
    const x = scaleLinear([start, MAX_LEVEL], [M.l, width - M.r]);
    // Mirrored beeswarm: nudge each sprite up or down until it clears the ones already placed.
    const placed: Sprite[] = [];
    for (const c of [...chars].sort((a, b) => a.level + a.pct - (b.level + b.pct))) {
      const cx = x(c.level + c.pct);
      let dy = 0;
      for (let i = 1; placed.some((p) => Math.hypot(p.cx - cx, p.dy - dy) < 2 * R + 4); i++) dy = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 2;
      placed.push({ ...c, cx, dy });
    }
    const spread = Math.max(...placed.map((p) => Math.abs(p.dy))) + R;
    const mid = LABEL_H + spread + 8;
    const height = mid + spread + 8 + LABEL_H + 6;
    const bands = [];
    for (let lv = start; lv < MAX_LEVEL; lv += BAND) bands.push({ from: lv, to: Math.min(lv + BAND, MAX_LEVEL), cost: expToNext(lv) });
    const tickStep = width < 480 ? 10 : 5;
    const ticks = [];
    for (let lv = Math.ceil(start / tickStep) * tickStep; lv <= MAX_LEVEL; lv += tickStep) ticks.push(lv);
    return { R, x, placed, mid, height, bands, ticks, first: placed[0], last: placed[placed.length - 1] };
  }, [width, chars]);

  const show = (e: MouseEvent<SVGGElement> | FocusEvent<SVGGElement>, s: Sprite) => {
    if (!boxEl) return;
    const { x, y } = anchorOf(e.currentTarget, boxEl);
    setTip({
      x,
      y,
      rows: [
        { value: s.name, label: s.job },
        { value: `Lv. ${s.level} · ${pct(s.pct, 2)}`, label: s.level < MAX_LEVEL ? `to ${s.level + 1}` : 'max level' },
        ...(s.toNext != null ? [{ value: formatBig(s.toNext), label: 'EXP to next level' }] : []),
        s.gain && s.gain > 0n ? { value: `+${formatBig(s.gain)}`, label: `${fmtLevels(s.levels)} of a level, last day` } : { value: 'No EXP', label: 'last day' },
      ],
    });
  };
  const open = (name: string) => navigate(`/character/${encodeURIComponent(name)}`);

  return (
    <Card title="Level ladder" action={<span className="text-xs text-ink-3">band labels: EXP for one level</span>}>
      <div ref={boxRef} className="relative min-h-40" onMouseLeave={() => setTip(null)}>
        {layout && (
          <svg width={width} height={layout.height} role="group" aria-label={`${chars.length} characters placed by level; band labels give the EXP for one level`}>
            {layout.bands.map((b, i) => {
              const x0 = layout.x(b.from);
              const w = layout.x(b.to) - x0;
              return (
                <g key={b.from}>
                  <rect x={x0} y={LABEL_H} width={w} height={layout.height - 2 * LABEL_H - 6} className={i % 2 ? 'fill-transparent' : 'fill-surface-2'} />
                  {/* On narrow screens bands are too thin for every label, so every other one gets it. */}
                  {b.cost != null && (w >= 40 || (w >= 20 && i % 2 === 0)) && (
                    <text x={x0 + w / 2} y={LABEL_H - 8} textAnchor="middle" className="fill-ink-2 text-[11px] font-semibold tabular">
                      {formatBig(b.cost)}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={layout.x.range()[0]} x2={layout.x.range()[1]} y1={layout.mid} y2={layout.mid} className="stroke-border-2" />
            {layout.ticks.map((lv) => (
              <text key={lv} x={layout.x(lv)} y={layout.height - 8} textAnchor="middle" className="fill-ink-3 text-[11px] tabular">
                {lv}
              </text>
            ))}
            {layout.placed.map((s) => (
              <g key={`at-${s.name}`}>
                <circle cx={s.cx} cy={layout.mid} r={2.5} className={s.main ? 'fill-accent' : 'fill-ink-3'} />
                {s.dy !== 0 && <line x1={s.cx} x2={s.cx} y1={layout.mid} y2={layout.mid + s.dy} className="stroke-border-2" />}
              </g>
            ))}
            {layout.placed.map((s) => (
              <g
                key={s.name}
                transform={`translate(${s.cx},${layout.mid + s.dy})`}
                role="link"
                tabIndex={0}
                aria-label={`${s.name}, ${s.job}, level ${s.level}, ${pct(s.pct)} to the next level`}
                className="group cursor-pointer outline-none"
                onMouseEnter={(e) => show(e, s)}
                onFocus={(e) => show(e, s)}
                onBlur={() => setTip(null)}
                onClick={() => open(s.name)}
                onKeyDown={(e) => e.key === 'Enter' && open(s.name)}
              >
                <circle r={layout.R} strokeWidth={s.main ? 2 : 1} className={`fill-surface-3 ${s.main ? 'stroke-accent' : 'stroke-border-2 group-hover:stroke-ink-2 group-focus-visible:stroke-accent'}`} />
                {s.img && <image href={s.img} x={-layout.R} y={-layout.R + 1} width={2 * layout.R} height={2 * layout.R} style={{ imageRendering: 'pixelated' }} />}
              </g>
            ))}
            {[layout.first, layout.last].map((s, i) => (
              <text key={`label-${s.name}`} x={i === 0 ? s.cx - layout.R : s.cx + layout.R} y={layout.mid + s.dy + layout.R + 14} textAnchor={i === 0 ? 'start' : 'end'} className={`text-xs ${s.main ? 'fill-ink font-semibold' : 'fill-ink-2'}`}>
                {s.name} {s.level}
              </text>
            ))}
          </svg>
        )}
        <HoverTip tip={tip} width={width} />
      </div>
    </Card>
  );
}
