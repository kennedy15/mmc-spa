import { useLadder } from './context';
import { bossCount, plural, previewMove, signed, type LadderChar } from './model';

/** What a pending move would do, shown in the rung it would land on before it lands. */
export function Ghost({ to }: { to: string }) {
  const L = useLadder();
  const pv = L.preview;
  if (!pv || pv.to !== to) return null;
  const chars = pv.names.map((n) => L.byName.get(n)).filter((c): c is LadderChar => !!c);
  const m = previewMove(chars, to, L.presetFor(to), L.pricing);
  const n = m.movers.length;
  const title = !n ? (chars.length === 1 ? `${chars[0].name} is already here` : 'Already here') : n === 1 ? `${m.movers[0].name} lands here` : `${n} characters land here`;
  const gap = !m.under.length ? '' : n === 1 ? `Under level for ${bossCount(m.under[0].gaps.length)}` : `${m.under.map((u) => u.name).join(', ')} ${m.under.length === 1 ? 'is' : 'are'} under level for some`;

  return (
    <div aria-hidden className="pointer-events-none absolute top-1.5 left-1.5 z-10 w-[min(calc(100%-0.75rem),16rem)] rounded-lg border border-dashed border-accent bg-surface shadow-xl shadow-black/40">
      <div className="flex flex-col gap-0.5 rounded-[7px] bg-accent/10 px-2.5 py-2 text-xs">
        <span className="font-medium text-accent">{title}</span>
        {n > 0 && (
          <>
            <span className={`font-semibold tabular ${m.delta > 0 ? 'text-good' : 'text-ink-2'}`}>{signed(m.delta)} / week</span>
            <span className="text-ink-2">{m.churn}</span>
            {m.stay.length > 0 && <span className="text-ink-3">{plural(m.stay.length, 'character')} already here</span>}
          </>
        )}
        {gap && <span className="text-warn">{gap}</span>}
      </div>
    </div>
  );
}
