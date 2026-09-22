export type LegionRank = 'B' | 'A' | 'S' | 'SS' | 'SSS';

const TIERS: { rank: LegionRank; level: number; zero: number }[] = [
  { rank: 'B', level: 60, zero: 130 },
  { rank: 'A', level: 100, zero: 160 },
  { rank: 'S', level: 140, zero: 180 },
  { rank: 'SS', level: 200, zero: 200 },
  { rank: 'SSS', level: 250, zero: 250 },
];

const isZero = (job: string) => job.toLowerCase() === 'zero';

/** Legion block rank for a character, or null below the first tier. */
export function legionRank(level: number, job: string): LegionRank | null {
  let out: LegionRank | null = null;
  for (const t of TIERS) if (level >= (isZero(job) ? t.zero : t.level)) out = t.rank;
  return out;
}

/** The next tier this character has not reached, or null at SSS. */
export function nextLegionTier(level: number, job: string): { rank: LegionRank; level: number; remaining: number } | null {
  for (const t of TIERS) {
    const need = isZero(job) ? t.zero : t.level;
    if (level < need) return { rank: t.rank, level: need, remaining: need - level };
  }
  return null;
}

export const LEGION_TIERS = TIERS;
