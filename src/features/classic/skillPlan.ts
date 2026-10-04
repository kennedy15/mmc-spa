import type { ClassicBuild, ClassicDoc, JobSkills, SkillStep } from './types';

export type World = ClassicDoc['world'];
export type Rules = World['rules'];

export interface TimedStep extends SkillStep {
  /** 1-based position in the job's order. */
  n: number;
  /** Points this step adds. */
  points: number;
  /** SP spent in this job once the step is done. */
  spent: number;
  /** Character level by which the job has earned enough SP for the step. */
  level: number;
}

/** A job the launch doesn't open yet (3rd job was only in the second test). */
export const isPreview = (job: JobSkills, world: World) => job.tier > world.launchJobs;

/** Last level that earns SP for `job`: the next advancement level, or the level cap for 3rd job. 2nd-job SP stops at the 3rd-job level (Lv 70) even while the launch keeps you in 2nd job up to the cap. */
export function jobEnd(build: ClassicBuild, job: JobSkills, world: World): number {
  if (job.tier === 1) return build.jobLevels[1];
  if (job.tier === 2) return build.jobLevels[2];
  return world.levelCap;
}

/** SP a job earns from its advancement up to `until` (SP from the level-up into the next job still lands in this one). */
export function spBy(job: JobSkills, rules: Rules, until: number): number {
  return rules.spAtAdvancement + rules.spPerLevel * Math.max(0, until - job.from);
}

/** Walks a job's skill order, pricing each step in SP and placing it at the level that pays for it. */
export function timeSteps(job: JobSkills, rules: Rules): TimedStep[] {
  const cur = new Map<string, number>();
  let spent = 0;
  return job.order.map((s, i) => {
    const had = cur.get(s.skill) ?? 0;
    const points = Math.max(0, s.to - had);
    cur.set(s.skill, Math.max(had, s.to));
    spent += points;
    const level = job.from + Math.max(0, Math.ceil((spent - rules.spAtAdvancement) / rules.spPerLevel));
    return { ...s, n: i + 1, points, spent, level };
  });
}

/** Final points per skill in the order they first get points. */
export function finalPoints(job: JobSkills): { skill: string; points: number }[] {
  const out = new Map<string, number>();
  for (const s of job.order) out.set(s.skill, Math.max(out.get(s.skill) ?? 0, s.to));
  return [...out].map(([skill, points]) => ({ skill, points }));
}
