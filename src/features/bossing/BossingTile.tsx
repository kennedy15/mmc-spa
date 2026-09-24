import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Card, Stat } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { useNow } from '../../app/useNow';
import { formatCountdown, nextReset } from '../../lib/reset/period';
import { useWeeklyMeso } from './useWeeklyMeso';

/** Dashboard summary of this reset week's boss ledger. */
export function BossingTile() {
  const now = useNow(60_000);
  const assignments = useStore((s) => s.assignments);
  const settings = useStore((s) => s.settings);
  const data = useWeeklyMeso(now);
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
  const share = data.expected > 0 ? Math.min(1, data.sold / data.expected) : 0;
  const worldCapped = data.crystals >= settings.worldCrystalCap;
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
        <span className="text-2xl font-semibold text-good">{fmtMeso(data.sold)}</span>
        <span className="text-sm text-ink-3">sold of</span>
        <span className="text-sm font-medium">{fmtMeso(data.expected)}</span>
        <span className="ml-auto text-xs text-ink-2 tabular">{Math.round(share * 100)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden mt-2">
        <div className="h-full rounded-full bg-good transition-all" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Weekly clears" value={`${data.done}/${data.total}`} />
        <Stat label="Crystals" value={`${data.crystals}/${settings.worldCrystalCap}`} tone={worldCapped ? 'bad' : undefined} sub={worldCapped ? 'world cap' : undefined} />
        <Stat label="Resets in" value={reset} sub="Thu 00:00 UTC" />
      </div>
    </Card>
  );
}
