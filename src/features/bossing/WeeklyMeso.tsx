import { useStore } from '../../store';
import { Card, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { useWeeklyMeso } from './useWeeklyMeso';

/** Weekly meso tracker: expected vs sold this week, per character and in total. */
export function WeeklyMeso({ compact = false }: { compact?: boolean }) {
  const assignments = useStore((s) => s.assignments);
  const settings = useStore((s) => s.settings);
  const data = useWeeklyMeso();

  if (!assignments.length) return null;
  const pct = data.expected > 0 ? Math.min(1, data.sold / data.expected) : 0;

  return (
    <Card
      title="Meso this week"
      action={
        <span className="text-xs text-ink-3">
          {data.done}/{data.total} weekly clears · {data.crystals}/{settings.worldCrystalCap} crystals
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
              <li key={name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate flex items-center gap-1.5">
                  {name}
                  {r.crystals >= settings.crystalCap && <Badge tone="warn">cap</Badge>}
                </span>
                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
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
