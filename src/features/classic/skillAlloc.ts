import { jobEnd, spBy, type Rules, type World } from './skillPlan';
import type { ClassicBuild, JobSkills, SkillInfo } from './types';

/**
 * The skill builder's rules: each job has its own SP pool (1 at the advancement, 3 a level, kept in that job),
 * a skill can't go past its max or the pool, and a skill stays locked until the skills it needs reach their levels.
 */

/** Points per skill ID for one build. */
export type Alloc = Record<string, number>;

export interface Pool {
  job: JobSkills;
  /** The job's skills in skill-book order (by skill ID). */
  skills: SkillInfo[];
  /** SP the job earns, from its advancement to `to`. */
  sp: number;
  /** Levels the job earns SP at: its advancement to the next one (or the level cap). */
  from: number;
  to: number;
}

/** 1st, 2nd and 3rd job, each with its skills and SP. */
export function poolsOf(build: ClassicBuild, world: World): Pool[] {
  return build.skills.map((job) => {
    const to = jobEnd(build, job, world);
    return { job, skills: build.skillInfo.filter((s) => s.tier === job.tier).sort((a, b) => a.id - b.id), sp: spBy(job, world.rules, to), from: job.from, to };
  });
}

export const pointsIn = (s: SkillInfo, alloc: Alloc) => alloc[s.id] ?? 0;

export const spentIn = (pool: Pool, alloc: Alloc) => pool.skills.reduce((n, s) => n + pointsIn(s, alloc), 0);

/** The character level by which the job has earned `points` SP (the advancement level for 0 or 1). */
export const levelFor = (pool: Pool, points: number, rules: Rules) => pool.from + Math.max(0, Math.ceil((points - rules.spAtAdvancement) / rules.spPerLevel));

/** What `skill` still needs before it can take a point: each required skill short of its level. */
export function missingFor(skill: SkillInfo, pool: Pool, alloc: Alloc): { skill: SkillInfo; level: number }[] {
  return (skill.req ?? []).flatMap((r) => {
    const need = pool.skills.find((s) => s.skill === r.skill);
    return need && pointsIn(need, alloc) < r.level ? [{ skill: need, level: r.level }] : [];
  });
}

/** Skills in the job that need `skill`, with the level they need it at. */
export function dependentsOf(skill: SkillInfo, pool: Pool): { skill: SkillInfo; level: number }[] {
  return pool.skills.flatMap((s) => (s.req ?? []).filter((r) => r.skill === skill.skill).map((r) => ({ skill: s, level: r.level })));
}

/** Points `skill` can still take: up to its max and the job's unspent SP; 0 while it's locked. */
export function roomFor(skill: SkillInfo, pool: Pool, alloc: Alloc): number {
  if (missingFor(skill, pool, alloc).length) return 0;
  return Math.max(0, Math.min(skill.max - pointsIn(skill, alloc), pool.sp - spentIn(pool, alloc)));
}

/** A skill with points that needs `skill` at its current level, so taking a point off would leave it without its requirement. */
export function holderOf(skill: SkillInfo, pool: Pool, alloc: Alloc): { skill: SkillInfo; level: number } | null {
  const now = pointsIn(skill, alloc);
  return dependentsOf(skill, pool).find((d) => pointsIn(d.skill, alloc) > 0 && d.level >= now) ?? null;
}
