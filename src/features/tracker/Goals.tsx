import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Card, Stat, Badge, Progress, Field } from '../../app/ui';
import { formatBig, fmtDate, fmtDateLong, pct } from '../../app/format';
import { uid, type Goal } from '../../lib/types';
import { expToReach, MAX_LEVEL } from '../../lib/nexon/exp';
import { addDays, daysBetween, projectDate } from '../../lib/nexon/snapshots';
import type { CharacterStats } from './hooks';
import { GOAL_STATE, goalStatus, perDay, type GoalState } from './goalStatus';

function StateBadge({ state }: { state: GoalState }) {
  const s = GOAL_STATE[state];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Level goal for one character: set it, then track EXP/day needed against the 7-day pace. */
export function GoalCard({ stats }: { stats: CharacterStats }) {
  const goal = useStore((s) => s.goals.find((g) => g.character === stats.name)) ?? null;
  const removeGoal = useStore((s) => s.removeGoal);
  const [editing, setEditing] = useState(false);
  if (!stats.latest || !stats.today) return null;

  if (!goal || editing) return <GoalForm stats={stats} goal={goal} onDone={() => setEditing(false)} />;
  const st = goalStatus(goal, stats);
  if (!st) return null;
  return (
    <Card
      title="Goal"
      action={
        <span className="flex gap-1 text-xs">
          <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn-ghost btn-sm" onClick={() => confirm(`Remove the Lv. ${goal.level} goal for ${stats.name}?`) && void removeGoal(goal.id)}>
            Remove
          </button>
        </span>
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-lg font-semibold">
          Lv. {goal.level} by {fmtDateLong(goal.by)}
        </div>
        <StateBadge state={st.state} />
      </div>
      <Progress value={st.progress} className="mt-2" />
      <div className="text-xs text-ink-3 mt-1">
        {pct(st.progress)} of the way from Lv. {goal.startLevel} since {fmtDate(goal.createdAt)}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <Stat label="EXP to go" value={formatBig(st.remaining)} sub={st.state === 'reached' ? 'done' : `${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left`} />
        <Stat label="Needed per day" value={st.needPerDay == null ? '—' : formatBig(st.needPerDay)} sub={`7-day pace ${formatBig(st.pace)}/day`} tone={st.state === 'behind' ? 'warn' : st.state === 'on-pace' ? 'good' : undefined} />
      </div>
      {st.state !== 'reached' && <div className="text-xs text-ink-2 mt-3">{st.eta ? `At the current pace: ${fmtDateLong(st.eta)}.` : 'No EXP in the last 7 days, so no projection.'}</div>}
    </Card>
  );
}

function GoalForm({ stats, goal, onDone }: { stats: CharacterStats; goal: Goal | null; onDone: () => void }) {
  const saveGoal = useStore((s) => s.saveGoal);
  const L = stats.latest!;
  const today = stats.today!;
  const [level, setLevel] = useState(goal?.level ?? Math.min(MAX_LEVEL, L.level + 1));
  const [by, setBy] = useState(goal?.by ?? addDays(today, 30));
  const valid = Number.isInteger(level) && level > L.level && level <= MAX_LEVEL && by > today;
  const need = valid ? expToReach(L.level, L.exp, level) : null;
  const perDayNeeded = need != null ? perDay(need, daysBetween(today, by)) : null;
  const eta = need != null ? projectDate(need, stats.avg7, today) : null;

  const save = () => {
    if (!valid) return;
    void saveGoal({ id: goal?.id ?? uid(), character: stats.name, level, by, createdAt: goal?.createdAt ?? new Date().toISOString(), startLevel: goal?.startLevel ?? L.level, startExp: goal?.startExp ?? L.exp });
    onDone();
  };

  if (L.level >= MAX_LEVEL) {
    return (
      <Card title="Goal">
        <div className="text-sm text-ink-3 py-4 text-center">Level {MAX_LEVEL}: nothing left to set.</div>
      </Card>
    );
  }
  return (
    <Card title={goal ? 'Edit goal' : 'Set a level goal'}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Target level">
          <input type="number" className="input" min={L.level + 1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(Math.round(Number(e.target.value)))} />
        </Field>
        <Field label="By">
          <input type="date" className="input" min={addDays(today, 1)} value={by} onChange={(e) => setBy(e.target.value)} />
        </Field>
      </div>
      <div className="text-xs text-ink-2 mt-3 min-h-8">
        {valid && need != null ? (
          <>
            Needs <span className="text-ink font-medium">{formatBig(need)}</span> EXP, about <span className="text-ink font-medium">{perDayNeeded == null ? '—' : formatBig(perDayNeeded)}/day</span>. {eta ? `At the 7-day pace (${formatBig(stats.avg7)}/day) you'd get there ${fmtDateLong(eta)}.` : 'No EXP in the last 7 days to project from.'}
          </>
        ) : (
          <span className="text-ink-3">Pick a level above {L.level} and a date after {fmtDate(today)}.</span>
        )}
      </div>
      <div className="flex gap-2 mt-3 text-xs">
        <button className="btn-accent btn-sm" disabled={!valid} onClick={save}>
          Save goal
        </button>
        {goal && (
          <button className="btn-ghost btn-sm" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </Card>
  );
}

/** One-line goal status for the dashboard's main card. */
export function GoalLine({ stats }: { stats: CharacterStats }) {
  const goal = useStore((s) => s.goals.find((g) => g.character === stats.name));
  const link = `/character/${encodeURIComponent(stats.name)}`;
  if (!goal) {
    return (
      <Link to={link} className="text-xs text-ink-3 hover:text-ink">
        Set a level goal →
      </Link>
    );
  }
  const st = goalStatus(goal, stats);
  if (!st) return null;
  return (
    <Link to={link} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2 hover:text-ink">
      <span>
        Goal: Lv. {goal.level} by {fmtDate(goal.by)}
      </span>
      <StateBadge state={st.state} />
      {st.state !== 'reached' && st.needPerDay != null && (
        <span className="text-ink-3 tabular">
          needs {formatBig(st.needPerDay)}/day · pace {formatBig(st.pace)}/day
        </span>
      )}
    </Link>
  );
}
