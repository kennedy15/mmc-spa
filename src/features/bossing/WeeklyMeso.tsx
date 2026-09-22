import { useMemo } from 'react';
import { useStore } from '../../store';
import { Card, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { periodKey } from '../../lib/reset/period';
import { assignmentMeso, clearFor, crystalsInWeek, visibleCharacters } from './lib';
import { useCharacterNames } from '../tracker/hooks';

/**
 * Weekly meso tracker: what every assignment would pay this week (expected)
 * against what has been checked off (sold), per character and in total.
 * Monthly bosses count in the week they are cleared; their expected value is
 * spread across the month.
 */
export function WeeklyMeso({ compact = false }: { compact?: boolean }) {
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const clears = useStore((s) => s.clears);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const names = visibleCharacters(useCharacterNames(), settings);

  const data = useMemo(() => {
    const week = periodKey('weekly');
    const month = periodKey('monthly');
    const weekClears = crystalsInWeek(clears, week);
    const perChar = new Map<string, { expected: number; sold: number; done: number; total: number; crystals: number }>();
    const bump = (c: string) => {
      const e = perChar.get(c) ?? { expected: 0, sold: 0, done: 0, total: 0, crystals: 0 };
      perChar.set(c, e);
      return e;
    };
    for (const a of assignments) {
      if (settings.hiddenCharacters.includes(a.character)) continue;
      const e = bump(a.character);
      const value = assignmentMeso(a, bosses, prices, settings);
      if (a.cadence === 'weekly') {
        e.expected += value;
        e.total += 1;
        const c = clearFor(clears, a, week);
        if (c) {
          e.sold += c.meso;
          e.done += 1;
        }
      } else {
        e.expected += value / 4.345;
        const c = clearFor(clears, a, month);
        if (c && weekClears.some((w) => w.id === c.id)) e.sold += c.meso;
      }
    }
    for (const c of weekClears) {
      if (settings.hiddenCharacters.includes(c.character)) continue;
      bump(c.character).crystals += 1;
    }
    const rows = [...perChar.entries()].sort((a, b) => (names.indexOf(a[0]) + 1 || 999) - (names.indexOf(b[0]) + 1 || 999));
    const expected = rows.reduce((n, [, r]) => n + r.expected, 0);
    const sold = rows.reduce((n, [, r]) => n + r.sold, 0);
    const done = rows.reduce((n, [, r]) => n + r.done, 0);
    const total = rows.reduce((n, [, r]) => n + r.total, 0);
    return { rows, expected, sold, done, total, crystals: weekClears.length };
  }, [assignments, clears, bosses, prices, settings, names]);

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
