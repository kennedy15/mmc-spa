import { useStore } from '../../store';
import { Card, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { periodLabel, type Cadence } from '../../lib/reset/period';
import { usePeriodMeso } from './usePeriodMeso';

/**
 * Expected vs sold for this reset week's weekly bosses, or this month's
 * monthly bosses, per character and in total. Renders nothing when no boss of
 * that cadence is assigned or cleared.
 */
export function PeriodMeso({ cadence, compact = false }: { cadence: Cadence; compact?: boolean }) {
  const settings = useStore((s) => s.settings);
  const data = usePeriodMeso(cadence);

  if (!data.total && !data.sold) return null;
  const weekly = cadence === 'weekly';
  const pct = data.expected > 0 ? Math.min(1, data.sold / data.expected) : 0;

  return (
    <Card
      title={weekly ? 'Meso this week' : 'Meso this month'}
      action={
        <span className="text-xs text-ink-3">
          {data.done}/{data.total} {weekly ? 'weekly' : 'monthly'} clears · {weekly ? `${data.crystals}/${settings.worldCrystalCap} crystals` : periodLabel('monthly', data.period)}
        </span>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 mb-2">
        <div>
          <span className="text-2xl font-semibold tabular text-good">{fmtMeso(data.sold)}</span>
          <span className="text-ink-3 text-sm"> sold of </span>
          <span className="text-lg font-medium tabular">{fmtMeso(data.expected)}</span>
          <span className="text-ink-3 text-sm"> expected</span>
        </div>
        <div className="text-sm text-ink-2 tabular">
          {Math.round(pct * 100)}% · <span className="text-accent">{fmtMeso(Math.max(0, data.expected - data.sold))}</span> still on the table
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface-3 overflow-hidden">
        <div className="h-full rounded-full bg-good transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      {!compact && (
        <ul className="mt-4 space-y-2">
          {data.rows.map(([name, r]) => {
            const p = r.expected > 0 ? Math.min(1, r.sold / r.expected) : 0;
            return (
              <li key={name} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate flex items-center gap-1.5">
                  {name}
                  {weekly && r.crystals >= settings.crystalCap && <Badge tone="warn">cap</Badge>}
                </span>
                <div className="hidden sm:block h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full rounded-full bg-good" style={{ width: `${p * 100}%` }} />
                </div>
                <span className="tabular text-xs text-ink-2 w-36 text-right">
                  <span className={r.sold > 0 ? 'text-good' : ''}>{fmtMeso(r.sold)}</span> / {fmtMeso(r.expected)}
                  <span className="text-ink-3"> · {r.done}/{r.total}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
