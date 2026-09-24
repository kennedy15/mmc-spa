import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { useTrackedNames } from './hooks';
import { Card, Empty, PageHeader, Modal } from '../../app/ui';
import { fmtDate, fmtDateLong } from '../../app/format';
import { lookImageUrl } from '../../lib/nexon/snapshots';

export function Fashion() {
  const looks = useStore((s) => s.looks);
  const names = useTrackedNames();
  const [open, setOpen] = useState<{ name: string; hash: string; firstSeen: string; lastSeen: string } | null>(null);

  // A character's first archived look is where tracking started, not a change.
  const feed = useMemo(() => {
    const out: { name: string; hash: string; firstSeen: string; lastSeen: string }[] = [];
    for (const [name, list] of Object.entries(looks)) list.forEach((l, i) => i > 0 && out.push({ name, ...l }));
    return out.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)).slice(0, 12);
  }, [looks]);
  const trackingStart = useMemo(() => Object.values(looks).reduce<string | null>((min, list) => (list[0] && (!min || list[0].firstSeen < min) ? list[0].firstSeen : min), null), [looks]);

  const withLooks = names.filter((n) => looks[n]?.length);
  if (!withLooks.length) return <Empty title="No looks archived yet">The collector saves a PNG whenever a character's avatar image changes.</Empty>;

  return (
    <>
      <PageHeader title="Fashion timeline" subtitle="Every look the collector has seen, per character. Click a look to enlarge." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {withLooks.map((name) => (
            <Card key={name} title={<Link to={`/character/${encodeURIComponent(name)}`} className="hover:text-accent">{name}</Link>} action={<span className="text-xs text-ink-3">{looks[name].length} look{looks[name].length === 1 ? '' : 's'}</span>}>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {[...looks[name]].reverse().map((l, i) => (
                  <button key={l.hash} className="shrink-0 text-center group" onClick={() => setOpen({ name, ...l })}>
                    <div className={`rounded-xl border ${i === 0 ? 'border-accent/60' : 'border-border'} bg-surface-2 p-1 group-hover:border-ink-3 transition-colors`}>
                      <img src={lookImageUrl(name, l.hash)} alt={`${name} look`} className="h-20 w-20 object-contain" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                    </div>
                    <div className="text-[10px] text-ink-3 mt-1 tabular">
                      {fmtDate(l.firstSeen)}
                      {l.lastSeen !== l.firstSeen && <> → {fmtDate(l.lastSeen)}</>}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <Card title="Looks changed">
          {feed.length === 0 && <div className="text-sm text-ink-3 py-4">No changes yet. Every character's current look was archived{trackingStart ? ` on ${fmtDate(trackingStart)}` : ''}; new outfits show up here.</div>}
          <ul className="space-y-2">
            {feed.map((f) => (
              <li key={f.name + f.hash} className="flex items-center gap-3 text-sm">
                <img src={lookImageUrl(f.name, f.hash)} alt="" className="h-10 w-10 object-contain rounded-lg bg-surface-2 border border-border" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-ink-3">{fmtDate(f.firstSeen)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.name}` : ''}>
        {open && (
          <div className="text-center">
            <img src={lookImageUrl(open.name, open.hash)} alt={`${open.name} look`} className="mx-auto h-64 w-64 object-contain" style={{ imageRendering: 'pixelated' }} />
            <div className="text-sm text-ink-2 mt-3">
              First seen {fmtDateLong(open.firstSeen)}
              {open.lastSeen !== open.firstSeen && <> · last seen {fmtDateLong(open.lastSeen)}</>}
            </div>
            <div className="text-xs text-ink-3 mt-1 font-mono">{open.hash}</div>
          </div>
        )}
      </Modal>
    </>
  );
}
