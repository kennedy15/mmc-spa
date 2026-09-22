import { dataUrl } from '../paths';

let table: Map<number, bigint> | null = null;
let loading: Promise<Map<number, bigint>> | null = null;

/** Loads public/exp-table.json once. EXP to reach level+1 from level. */
export function loadExpTable(): Promise<Map<number, bigint>> {
  if (table) return Promise.resolve(table);
  if (!loading) {
    loading = fetch(dataUrl('exp-table.json', 'public'))
      .then((r) => r.json())
      .then((doc: { expToNext: Record<string, string | null> }) => {
        const m = new Map<number, bigint>();
        for (const [lvl, v] of Object.entries(doc.expToNext)) if (v) m.set(Number(lvl), BigInt(v));
        table = m;
        return m;
      });
  }
  return loading;
}

export function expToNext(level: number): bigint | null {
  return table?.get(level) ?? null;
}

export const MAX_LEVEL = 300;

/** Fraction (0..1) of the way from `level` to `level + 1`. */
export function pctToNext(level: number, exp: string | bigint): number {
  const need = expToNext(level);
  if (!need || need === 0n) return level >= MAX_LEVEL ? 1 : 0;
  const e = typeof exp === 'bigint' ? exp : BigInt(exp || '0');
  return Number((e * 10000n) / need) / 10000;
}

/** EXP remaining until the next level. */
export function expRemaining(level: number, exp: string | bigint): bigint | null {
  const need = expToNext(level);
  if (!need) return null;
  const e = typeof exp === 'bigint' ? exp : BigInt(exp || '0');
  return need > e ? need - e : 0n;
}

/**
 * EXP gained between two observations, accounting for level-ups:
 * the remainder of every level crossed plus the EXP into the new level.
 * Returns null when the table lacks a needed level (e.g. cap) or the
 * character lost levels (should not happen).
 */
export function gainBetween(prevLevel: number, prevExp: string | bigint, nextLevel: number, nextExp: string | bigint): bigint | null {
  const a = typeof prevExp === 'bigint' ? prevExp : BigInt(prevExp || '0');
  const b = typeof nextExp === 'bigint' ? nextExp : BigInt(nextExp || '0');
  if (nextLevel === prevLevel) return b - a;
  if (nextLevel < prevLevel) return null;
  let total = -a;
  for (let l = prevLevel; l < nextLevel; l++) {
    const need = expToNext(l);
    if (need == null) return null;
    total += need;
  }
  return total + b;
}

/** BigInt EXP -> Number of billions, safe for charts. */
export function toBillions(v: bigint): number {
  return Number(v / 1_000_000n) / 1000;
}

const UNITS: [bigint, string][] = [
  [1_000_000_000_000_000n, 'Q'],
  [1_000_000_000_000n, 'T'],
  [1_000_000_000n, 'B'],
  [1_000_000n, 'M'],
  [1_000n, 'K'],
];

/** Compact EXP/meso formatting: 1.23T, 456.7B, 12.3M. Accepts bigint or number. */
export function formatBig(v: bigint | number | null | undefined, digits = 2): string {
  if (v == null) return '—';
  const neg = typeof v === 'bigint' ? v < 0n : v < 0;
  const abs = typeof v === 'bigint' ? (neg ? -v : v) : BigInt(Math.round(Math.abs(v)));
  for (const [size, suffix] of UNITS) {
    if (abs >= size) {
      const whole = abs / size;
      const frac = ((abs % size) * 1000n) / size; // 3 decimal digits
      const num = Number(whole) + Number(frac) / 1000;
      return (neg ? '-' : '') + num.toFixed(num >= 100 ? Math.max(0, digits - 1) : digits).replace(/\.0+$/, '') + suffix;
    }
  }
  return (neg ? '-' : '') + abs.toString();
}

export function formatFull(v: bigint | number | null | undefined): string {
  if (v == null) return '—';
  return (typeof v === 'bigint' ? v : BigInt(Math.round(v))).toLocaleString('en-US');
}

const cumulativeCache = new Map<number, bigint>();
/** Total EXP accumulated to reach `level` with `exp` into it (monotonic across level-ups). */
export function cumulativeExp(level: number, exp: string | bigint): bigint | null {
  if (!table) return null;
  let base = cumulativeCache.get(level);
  if (base == null) {
    base = 0n;
    for (let l = 1; l < level; l++) {
      const need = table.get(l);
      if (need == null) return null;
      base += need;
    }
    cumulativeCache.set(level, base);
  }
  return base + (typeof exp === 'bigint' ? exp : BigInt(exp || '0'));
}
