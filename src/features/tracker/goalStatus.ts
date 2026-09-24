import type { Goal } from '../../lib/types';
import type { CharacterStats } from './hooks';
import { cumulativeExp, expToReach } from '../../lib/nexon/exp';
import { daysBetween, projectDate } from '../../lib/nexon/snapshots';

export type GoalState = 'reached' | 'on-pace' | 'behind' | 'no-pace' | 'overdue';

export interface GoalStatus {
  /** EXP still needed as of the latest snapshot. */
  remaining: bigint | null;
  /** Days from the latest snapshot to the target date. */
  daysLeft: number;
  /** EXP per day needed to make the date. */
  needPerDay: bigint | null;
  /** 7-day average gain. */
  pace: bigint;
  /** When the goal is reached at that pace. */
  eta: string | null;
  /** 0..1 of the EXP between where the goal was set and the target. */
  progress: number;
  state: GoalState;
}

/** EXP per day to cover `remaining` in `days` days (rounded up), or null when no days are left. */
export function perDay(remaining: bigint, days: number): bigint | null {
  return days > 0 ? (remaining + BigInt(days) - 1n) / BigInt(days) : null;
}

export function goalStatus(goal: Goal, stats: CharacterStats): GoalStatus | null {
  const L = stats.latest;
  const asOf = stats.today;
  if (!L || !asOf) return null;
  const reached = L.level >= goal.level;
  const remaining = expToReach(L.level, L.exp, goal.level);
  const daysLeft = daysBetween(asOf, goal.by);
  const needPerDay = remaining != null ? perDay(remaining, daysLeft) : null;
  const eta = remaining != null ? projectDate(remaining, stats.avg7, asOf) : null;
  const start = cumulativeExp(goal.startLevel, goal.startExp);
  const now = cumulativeExp(L.level, L.exp);
  const end = cumulativeExp(goal.level, 0n);
  const progress = reached ? 1 : start != null && now != null && end != null && end > start ? Math.max(0, Math.min(1, Number(((now - start) * 10_000n) / (end - start)) / 10_000)) : 0;
  const state: GoalState = reached ? 'reached' : daysLeft <= 0 ? 'overdue' : stats.avg7 <= 0n ? 'no-pace' : needPerDay != null && stats.avg7 >= needPerDay ? 'on-pace' : 'behind';
  return { remaining, daysLeft, needPerDay, pace: stats.avg7, eta, progress, state };
}

export const GOAL_STATE: Record<GoalState, { label: string; tone: 'good' | 'warn' | 'bad' | 'muted' }> = {
  reached: { label: 'Reached', tone: 'good' },
  'on-pace': { label: 'On pace', tone: 'good' },
  behind: { label: 'Behind pace', tone: 'warn' },
  'no-pace': { label: 'No recent EXP', tone: 'muted' },
  overdue: { label: 'Past due', tone: 'bad' },
};
