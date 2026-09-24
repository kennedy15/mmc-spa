import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Card, Stat } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { useNow } from '../../app/useNow';
import { formatCountdown, nextReset } from '../../lib/reset/period';
import { usePeriodMeso } from './usePeriodMeso';

/** Dashboard summary of this reset week's weekly bosses, with the month's monthly bosses on their own line. */
export function BossingTile() {
  const now = useNow(60_000);
  const assignments = useStore((s) => s.assignments);
  const settings = useStore((s) => s.settings);
  const week = usePeriodMeso('weekly', now);
  const month = usePeriodMeso('monthly', now);
  const reset = formatCountdown(nextReset('weekly', now), now);

  if (!assignments.length) {
    return (
      <Card title="Bossing · this week">
        <div className="text-sm text-ink-3 py-6 text-center">
          No bosses assigned yet.{' '}
          <Link to="/bossing/assignments" className="text-accent hover:underline">
            Assign bosses
          </Link>
        </div>
      </Card>
    );
  }
  const share = week.expected > 0 ? Math.min(1, week.sold / week.expected) : 0;
  const worldCapped = week.crystals >= settings.worldCrystalCap;
  return (
    <Card
      title="Bossing · this week"
      action={
        <Link to="/bossing" className="text-xs text-ink-3 hover:text-ink">
          Checklist →
        </Link>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-2xl font-semibold text-good">{fmtMeso(week.sold)}</span>
        <span className="text-sm text-ink-3">sold of</span>
        <span className="text-sm font-medium">{fmtMeso(week.expected)}</span>
        <span className="ml-auto text-xs text-ink-2 tabular">{Math.round(share * 100)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden mt-2">
        <div className="h-full rounded-full bg-good transition-all" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Weekly clears" value={`${week.done}/${week.total}`} />
        <Stat label="Crystals" value={`${week.crystals}/${settings.worldCrystalCap}`} tone={worldCapped ? 'bad' : undefined} sub={worldCapped ? 'world cap' : undefined} />
        <Stat label="Resets in" value={reset} sub="Thu 00:00 UTC" />
      </div>
      {(month.total > 0 || month.sold > 0) && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-4 pt-3 border-t border-border text-xs text-ink-2">
          <span className="label">Monthly</span>
          <span className="tabular">
            {month.done}/{month.total} cleared
          </span>
          <span className="tabular">
            <span className="text-good">{fmtMeso(month.sold)}</span> of {fmtMeso(month.expected)}
          </span>
          <span className="ml-auto text-ink-3 tabular">resets in {formatCountdown(nextReset('monthly', now), now)}</span>
        </div>
      )}
    </Card>
  );
}
