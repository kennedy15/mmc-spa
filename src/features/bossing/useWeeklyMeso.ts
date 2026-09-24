import { useMemo } from 'react';
import { useStore } from '../../store';
import { periodKey } from '../../lib/reset/period';
import { assignmentMeso, clearFor, crystalsInWeek, visibleCharacters } from './lib';
import { useCharacterNames } from '../tracker/hooks';

export interface CharacterWeek {
  expected: number;
  sold: number;
  /** Weekly clears done / assigned. */
  done: number;
  total: number;
  crystals: number;
}

export interface WeekTotals {
  rows: [string, CharacterWeek][];
  expected: number;
  sold: number;
  done: number;
  total: number;
  crystals: number;
}

/**
 * This week's meso: what every assignment would pay (expected) against what
 * has been checked off (sold), per character and in total. Monthly bosses
 * count in the week they are cleared; their expected value is spread across
 * the month.
 */
export function useWeeklyMeso(now: Date = new Date()): WeekTotals {
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const clears = useStore((s) => s.clears);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const names = visibleCharacters(useCharacterNames(), settings);
  const week = periodKey('weekly', now);
  const month = periodKey('monthly', now);

  return useMemo(() => {
    const weekClears = crystalsInWeek(clears, week);
    const perChar = new Map<string, CharacterWeek>();
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
    const sum = (k: keyof CharacterWeek) => rows.reduce((n, [, r]) => n + r[k], 0);
    return { rows, expected: sum('expected'), sold: sum('sold'), done: sum('done'), total: sum('total'), crystals: weekClears.length };
  }, [assignments, clears, bosses, prices, settings, names, week, month]);
}
