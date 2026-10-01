import { useStore } from '../../../store';
import { latestRow, lookImageUrl } from '../../../lib/nexon/snapshots';

/** Character sprite in a small square, as on the character tiles; ledger-only characters get their first two letters. */
function Face({ name }: { name: string }) {
  const snapshots = useStore((s) => s.snapshots);
  const looks = useStore((s) => s.looks);
  const row = latestRow(snapshots, name);
  const hash = row?.lookHash ?? looks[name]?.[looks[name].length - 1]?.hash ?? null;
  const img = hash ? lookImageUrl(name, hash) : (row?.imgUrl ?? null);
  return (
    <span className="size-5 rounded-md bg-surface-3 ring-2 ring-surface overflow-hidden flex items-end justify-center shrink-0" title={name}>
      {img ? <img src={img} alt="" className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} loading="lazy" /> : <span className="text-[9px] leading-5 text-ink-3">{name.slice(0, 2)}</span>}
    </span>
  );
}

/** Up to `max` faces, overlapping, then "+n". */
export function Faces({ names, max = 3 }: { names: string[]; max?: number }) {
  if (!names.length) return null;
  return (
    <span className="flex items-center" role="img" aria-label={names.join(', ')}>
      {names.slice(0, max).map((n, i) => (
        <span key={n} className={i ? '-ml-1.5' : ''}>
          <Face name={n} />
        </span>
      ))}
      {names.length > max && <span className="ml-1 text-[11px] text-ink-3 tabular">+{names.length - max}</span>}
    </span>
  );
}
