import { fmtInt, fmtMeso } from '../../../app/format';
import { Badge } from '../../../app/ui';
import { useLadder } from './context';
import { TRAY, plural } from './model';

/** World crystals against the cap, weekly meso of every list, and how many characters sit on each rung. */
export function Totals() {
  const L = useLadder();
  const { crystalCap, worldCrystalCap } = L.pricing.settings;
  // A character sells at most its cap, so extra bosses on one list don't count toward the world.
  const crystals = L.chars.reduce((n, c) => n + Math.min(c.weekly.length, crystalCap), 0);
  const over = crystals - worldCrystalCap;
  const tone = over > crystalCap ? 'bad' : over > 0 ? 'warn' : null;
  const week = L.chars.reduce((n, c) => n + c.meso, 0);
  const month = L.chars.reduce((n, c) => n + c.monthMeso, 0);
  const tray = L.chars.filter((c) => c.rung === TRAY);
  const bars = [
    { key: 'own', label: 'Own', n: tray.filter((c) => c.weekly.length).length, title: 'Own list, no preset' },
    ...L.presets.map((p, i) => ({ key: p.id, label: String(i + 1), n: L.chars.filter((c) => c.rung === p.id).length, title: `${i + 1} · ${p.name}` })),
  ];
  const top = Math.max(1, ...bars.map((b) => b.n));
  const noBosses = tray.length - bars[0].n;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-3">
      <section className="card flex min-w-0 flex-col gap-1.5 px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="label">World crystals a week</h2>
          {tone && <Badge tone={tone}>Over cap</Badge>}
        </div>
        <div className="flex items-baseline gap-1.5" title={`Weekly bosses on every list, up to ${crystalCap} per character`}>
          <span className={`text-xl font-semibold tabular ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'}`}>{crystals}</span>
          <span className="text-sm text-ink-3">/ {worldCrystalCap}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className={`h-full rounded-full transition-[width] ${tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, (crystals / Math.max(1, worldCrystalCap)) * 100)}%` }} />
        </div>
        <span className={`text-xs ${tone ? (tone === 'bad' ? 'text-bad' : 'text-warn') : 'text-ink-3'}`}>{over > 0 ? `Over by ${over}. Crystals past ${worldCrystalCap} a week don’t sell.` : `${-over} left before the world cap.`}</span>
      </section>

      <section className="card flex min-w-0 flex-col gap-1.5 px-4 pt-3 pb-3.5">
        <h2 className="label">Weekly meso, all characters</h2>
        <span className="text-xl font-semibold tabular" title={`${fmtInt(week)} meso a week`}>
          ≈ {fmtMeso(week)}
        </span>
        <span className="text-xs text-ink-3">
          If every weekly boss is cleared, split by party.{month > 0 && ` Black Mage adds ${fmtMeso(month)} a month.`}
        </span>
      </section>

      <section className="card flex min-w-0 flex-col gap-1.5 px-4 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-2" title={noBosses ? `${plural(noBosses, 'character')} with no weekly bosses` : undefined}>
          <h2 className="label">Characters per rung</h2>
          {noBosses > 0 && <span className="shrink-0 text-[11px] text-ink-3">+{noBosses} with no bosses</span>}
        </div>
        <div className="flex h-16 items-end gap-1.5">
          {bars.map((b) => (
            <div key={b.key} title={`${b.title}: ${plural(b.n, 'character')}`} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <span className={`text-xs font-medium tabular ${b.n ? 'text-ink-2' : 'text-ink-3'}`}>{b.n}</span>
              <span className={`block w-full max-w-7 rounded-t transition-[height] ${b.n ? 'bg-ink-3' : 'bg-border-2'}`} style={{ height: b.n ? Math.max(4, Math.round((b.n / top) * 30)) : 2 }} />
              <span className="text-[11px] text-ink-3">{b.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
