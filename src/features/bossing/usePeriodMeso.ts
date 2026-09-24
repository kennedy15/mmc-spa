import { useMemo } from 'react';
import { useStore } from '../../store';
import { periodKey, type Cadence } from '../../lib/reset/period';
import { assignmentMeso, clearFor, clearsIn, visibleCharacters } from './lib';
import { useCharacterNames } from '../tracker/hooks';

export interface CharacterPeriod {
  expected: number;
  sold: number;
  /** Assigned bosses cleared / assigned. */
  done: number;
  total: number;
  crystals: number;
}

export interface PeriodTotals {
  cadence: Cadence;
  /** Reset-week start (YYYY-MM-DD) or month (YYYY-MM). */
  period: string;
  rows: [string, CharacterPeriod][];
  expected: number;
  sold: number;
  done: number;
  total: number;
  /** Crystals from every character's clears, hidden ones included (they still count toward the world cap). */
  crystals: number;
}

/**
 * This reset week's weekly bosses, or this month's monthly bosses: what every
 * assignment would pay (expected) against the meso recorded (sold), per
 * character and in total. The two cadences never mix.
 */
export function usePeriodMeso(cadence: Cadence, now: Date = new Date()): PeriodTotals {
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const clears = useStore((s) => s.clears);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const allNames = useCharacterNames();
  const period = periodKey(cadence, now);

  return useMemo(() => {
    const names = visibleCharacters(allNames, settings);
    const hidden = (c: string) => settings.hiddenCharacters.includes(c);
    const perChar = new Map<string, CharacterPeriod>();
    const bump = (c: string) => {
      const e = perChar.get(c) ?? { expected: 0, sold: 0, done: 0, total: 0, crystals: 0 };
      perChar.set(c, e);
      return e;
    };
    for (const a of assignments) {
      if (a.cadence !== cadence || hidden(a.character)) continue;
      const e = bump(a.character);
      e.expected += assignmentMeso(a, bosses, prices, settings);
      e.total += 1;
      if (clearFor(clears, a, period)) e.done += 1;
    }
    const inPeriod = clearsIn(clears, cadence, period);
    for (const c of inPeriod) {
      if (hidden(c.character)) continue;
      const e = bump(c.character);
      e.sold += c.meso;
      e.crystals += 1;
    }
    const rows = [...perChar.entries()].sort((a, b) => (names.indexOf(a[0]) + 1 || 999) - (names.indexOf(b[0]) + 1 || 999));
    const sum = (k: keyof CharacterPeriod) => rows.reduce((n, [, r]) => n + r[k], 0);
    return { cadence, period, rows, expected: sum('expected'), sold: sum('sold'), done: sum('done'), total: sum('total'), crystals: inPeriod.length };
  }, [cadence, period, assignments, clears, bosses, prices, settings, allNames]);
}
