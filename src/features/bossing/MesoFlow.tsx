import { useMemo, useState, type MouseEvent } from 'react';
import { sankey, sankeyLinkHorizontal, type SankeyNode } from 'd3-sankey';
import { useStore } from '../../store';
import { Card } from '../../app/ui';
import { HoverTip } from '../../app/HoverTip';
import { pointerIn, type Tip } from '../../app/tip';
import { useMeasure } from '../../app/useMeasure';
import { fmtMeso } from '../../app/format';
import { SERIES } from '../../app/charts';
import { periodKey, periodLabel } from '../../lib/reset/period';
import { useCharacterNames } from '../tracker/hooks';
import { OTHERS } from '../tracker/heat';
import { bossLabel, clearsIn, mesoByPeriod } from './lib';

interface FlowNode {
  id: string;
  kind: 'boss' | 'char';
}
type FlowLink = object;
type Node = SankeyNode<FlowNode, FlowLink>;

const LEFT = 230;
const RIGHT = 150;
const OTHER_CHARS = 'Other characters';

/** One reset week of weekly-boss clears as a flow from boss to character; band width is meso. Monthly bosses stay out of it. */
export function MesoFlow() {
  const clears = useStore((s) => s.clears);
  const bosses = useStore((s) => s.bosses);
  const names = useCharacterNames();
  const weeks = useMemo(() => mesoByPeriod(clears, 'weekly').filter((w) => w.total > 0), [clears]);
  const current = periodKey('weekly');
  const [picked, setPicked] = useState<string | null>(null);
  const week = picked ?? weeks.find((w) => w.period === current)?.period ?? weeks[weeks.length - 1]?.period ?? null;
  const [boxRef, width, boxEl] = useMeasure<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const flow = useMemo(() => {
    if (!week || !width) return null;
    const inWeek = clearsIn(clears, 'weekly', week);
    if (!inWeek.length) return null;
    const byChar = new Map<string, number>();
    for (const c of inWeek) byChar.set(c.character, (byChar.get(c.character) ?? 0) + c.meso);
    // Eight colors at most: past eight characters, the smallest fold into one band.
    const ranked = [...byChar.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const keep = new Set(ranked.length > 8 ? ranked.slice(0, 7) : ranked);
    const charOf = (c: string) => (keep.has(c) ? c : OTHER_CHARS);
    // Colors follow characters.json order, so a character keeps its color from week to week.
    const order = [...names.filter((n) => keep.has(n)), ...[...keep].filter((n) => !names.includes(n))];
    const colors = new Map<string, string>(order.map((c, i) => [c, SERIES[i]]));
    colors.set(OTHER_CHARS, OTHERS);

    const links = new Map<string, { source: string; target: string; value: number }>();
    for (const c of inWeek) {
      const source = bossLabel(bosses, c.bossId, c.difficulty);
      const target = charOf(c.character);
      const key = `${source}|${target}`;
      const l = links.get(key) ?? { source, target, value: 0 };
      l.value += c.meso;
      links.set(key, l);
    }
    const bossIds = [...new Set([...links.values()].map((l) => l.source))];
    const charIds = [...new Set([...links.values()].map((l) => l.target))];
    const W = Math.max(width, 640);
    const H = Math.max(160, bossIds.length * 28 + 20);
    const layout = sankey<FlowNode, FlowLink>()
      .nodeId((d) => d.id)
      .nodeWidth(10)
      .nodePadding(12)
      .nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .extent([
        [LEFT, 10],
        [W - RIGHT, H - 10],
      ]);
    const graph = layout({
      nodes: [...bossIds.map((id) => ({ id, kind: 'boss' as const })), ...charIds.map((id) => ({ id, kind: 'char' as const }))],
      links: [...links.values()],
    });
    const total = inWeek.reduce((n, c) => n + c.meso, 0);
    return { graph, W, H, total, colors, count: inWeek.length };
  }, [week, width, clears, bosses, names]);

  if (!weeks.length) {
    return (
      <Card title="Meso flow">
        <div className="text-sm text-ink-3 py-6 text-center">Tick weekly bosses on the Checklist and this shows which bosses each week's meso comes from.</div>
      </Card>
    );
  }

  const path = sankeyLinkHorizontal<FlowNode, FlowLink>();
  const nodeOf = (n: Node | string | number) => n as Node;
  const showLink = (e: MouseEvent, i: number) => {
    if (!flow || !boxEl) return;
    const l = flow.graph.links[i];
    const src = nodeOf(l.source).id;
    const dst = nodeOf(l.target).id;
    setHover(i);
    setTip({
      ...pointerIn(e, boxEl),
      rows: [
        { value: fmtMeso(l.value), label: `${src} → ${dst}`, color: flow.colors.get(dst) },
        { value: `${((l.value / flow.total) * 100).toFixed(1)}%`, label: 'of the week' },
      ],
    });
  };

  return (
    <Card
      title={week ? `Meso flow · week of ${periodLabel('weekly', week)}` : 'Meso flow'}
      action={
        <select className="input w-auto py-0.5 text-xs" value={week ?? ''} onChange={(e) => setPicked(e.target.value)} aria-label="Reset week">
          {[...weeks].reverse().map((w) => (
            <option key={w.period} value={w.period}>
              {periodLabel('weekly', w.period)} · {fmtMeso(w.total)}
            </option>
          ))}
        </select>
      }
    >
      {/* The tooltip sits outside the scroll box so it is never clipped. */}
      <div
        ref={boxRef}
        className="relative"
        onMouseLeave={() => {
          setTip(null);
          setHover(null);
        }}
      >
        <div className="overflow-x-auto -mx-4 px-4 min-h-40">
          {flow && (
            <svg width={flow.W} height={flow.H} role="img" aria-label={`${fmtMeso(flow.total)} from ${flow.count} clears, by boss and character`}>
              <g fill="none">
                {flow.graph.links.map((l, i) => (
                  <path
                    key={i}
                    d={path(l) ?? undefined}
                    stroke={flow.colors.get(nodeOf(l.target).id)}
                    strokeOpacity={hover === i ? 0.8 : 0.38}
                    strokeWidth={Math.max(1, l.width ?? 1)}
                    onMouseEnter={(e) => showLink(e, i)}
                    onMouseMove={(e) => showLink(e, i)}
                  />
                ))}
              </g>
              {flow.graph.nodes.map((n) => {
                const boss = n.kind === 'boss';
                const x0 = n.x0 ?? 0;
                const x1 = n.x1 ?? 0;
                const y0 = n.y0 ?? 0;
                const y1 = n.y1 ?? 0;
                return (
                  <g key={n.id}>
                    <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} rx={2} fill={boss ? undefined : flow.colors.get(n.id)} className={boss ? 'fill-border-2' : undefined} />
                    <text x={boss ? x0 - 8 : x1 + 8} y={(y0 + y1) / 2} dy="0.35em" textAnchor={boss ? 'end' : 'start'} className={boss ? 'fill-ink-2 text-xs' : 'fill-ink text-[13px] font-semibold'}>
                      {n.id}
                      <tspan className="fill-ink-3 font-normal tabular"> {fmtMeso(n.value ?? 0)}</tspan>
                    </text>
                  </g>
                );
              })}
              <text x={flow.W - 8} y={flow.H - 6} textAnchor="end" className="fill-ink-3 text-xs">
                week total {fmtMeso(flow.total)}
              </text>
            </svg>
          )}
        </div>
        <HoverTip tip={tip} width={width} />
      </div>
    </Card>
  );
}
