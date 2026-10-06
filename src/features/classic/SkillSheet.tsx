import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSkillLevels } from './data';
import { LevelText, SectionLabel, SkillIcon } from './bits';
import { ordinal, siteOf, skillsIn, skillTypeLabel } from './labels';
import { changesByLevel, growth, splitLine } from './skillLevels';
import { timeSteps, type World } from './skillPlan';
import { OpenSkill } from './skillSheetContext';
import type { ClassicBuild } from './types';

/**
 * Holds the build page's skill sheet: any skill clicked on the page opens it on the right, another click swaps it,
 * and closing it hands focus back to whatever opened it. Key it by build so prev/next starts closed.
 */
export function SkillSheetHost({ build, world, children }: { build: ClassicBuild; world: World; children: ReactNode }) {
  const [skill, setSkill] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = (name: string) => {
    if (!skill) opener.current = document.activeElement as HTMLElement | null;
    setSkill(name);
  };
  const close = () => {
    setSkill(null);
    opener.current?.focus();
  };
  return (
    <OpenSkill.Provider value={open}>
      {children}
      {skill && <SkillSheet build={build} world={world} skill={skill} onClose={close} />}
    </OpenSkill.Provider>
  );
}

/** A side sheet with what each point of a skill adds: its game text at every level, the changes picked out, and where this build stops. */
function SkillSheet({ build: b, world, skill, onClose }: { build: ClassicBuild; world: World; skill: string; onClose: () => void }) {
  const info = b.skillInfo.find((s) => s.skill === skill);
  const { doc, error } = useSkillLevels();
  const texts = info && doc ? doc.skills[String(info.id)] : undefined;
  const notes = (info && doc?.notes?.[String(info.id)]) || {};
  const lines = useMemo(() => (texts ?? []).map(splitLine), [texts]);
  const changes = useMemo(() => changesByLevel(lines), [lines]);
  const sum = useMemo(() => growth(lines), [lines]);
  // This build's steps for the skill (target level, step number, character level) and any reason it leaves the skill low.
  const job = b.skills.find((j) => j.order.some((s) => s.skill === skill)) ?? b.skills.find((j) => j.tier === info?.tier);
  const planned = job ? timeSteps(job, world.rules).filter((s) => s.skill === skill) : [];
  const final = planned.length ? planned[planned.length - 1] : null;
  const byName = useMemo(() => new Map(b.skillInfo.map((s) => [s.skill, s])), [b.skillInfo]);
  const skip = job?.skip.find((s) => skillsIn(s.skill, byName).some((x) => x.skill === skill));
  const test = info ? info.tier > world.launchJobs : false;

  const closeBtn = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    body.current?.scrollTo({ top: 0 });
  }, [skill]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside role="dialog" aria-labelledby="skill-sheet-title" className="sheet-in fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border-2 bg-surface shadow-2xl sm:w-[36rem]">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="rounded-lg border border-border-2 bg-bg p-1">
          <SkillIcon skill={info} name={skill} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="skill-sheet-title" className="text-lg font-semibold leading-tight text-ink">
            {skill}
          </h2>
          {info && (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-3">
              {ordinal(info.tier)} job · {skillTypeLabel(info.type)} · max {info.max}
              {test && <span className="rounded-md border border-warn/40 px-1.5 text-warn">test only</span>}
            </div>
          )}
        </div>
        <button ref={closeBtn} type="button" className="btn-ghost btn-sm text-base leading-none" onClick={onClose} aria-label="Close skill details">
          ✕
        </button>
      </header>

      <div ref={body} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
          {final ? (
            <>
              This build takes it to <span className="font-semibold">{final.to}</span>
              {final.to < (info?.max ?? final.to) && <> of {info?.max}</>} by Lv {final.level}
              {planned.length > 1 && <span className="text-ink-3"> (steps {planned.map((s) => s.n).join(', ')})</span>}.
            </>
          ) : (
            <>This build puts no points here.</>
          )}
          {skip && <span className="mt-1 block text-xs text-ink-2">{skip.why}</span>}
        </p>

        {info && (
          <div className="text-sm text-ink-2">
            <p>{info.what}</p>
            {info.classicChange && (
              <p className="mt-2 text-xs">
                <span className="font-medium text-accent">Classic: </span>
                {info.classicChange}
              </p>
            )}
          </div>
        )}

        {error ? (
          <p className="text-sm text-bad">The per-level numbers couldn't load ({error}).</p>
        ) : !doc ? (
          <p className="text-sm text-ink-3">Loading the per-level numbers…</p>
        ) : !lines.length ? (
          <p className="text-sm text-ink-3">The game data has no per-level text for this skill.</p>
        ) : (
          <>
            {sum && (
              <section>
                <SectionLabel>What each point adds</SectionLabel>
                <p className="rounded-lg border border-border bg-surface-2/60 px-3 py-2.5 text-sm leading-7 text-ink-2">
                  {sum.text.map((t, k) => {
                    const n = sum.nums[k];
                    // A "%" right after a changing number goes inside its range ("1→20%"), ahead of the step note.
                    const pct = typeof n === 'object' && sum.text[k + 1]?.startsWith('%');
                    const prev = sum.nums[k - 1];
                    const trimmed = k > 0 && typeof prev === 'object' && t.startsWith('%') ? t.slice(1) : t;
                    // A sign right before a changing number ("Weapon Def. -") stays on the range's line.
                    const sign = typeof n === 'object' ? (trimmed.match(/[+-]$/)?.[0] ?? '') : '';
                    const text = sign ? trimmed.slice(0, -1) : trimmed;
                    return (
                      <Fragment key={k}>
                        {/* Each ";" clause on its own line: "MP -10→25 …" / "Attack Power +10→40 …". */}
                        {text.split(';').map((part, j) => (
                          <Fragment key={j}>
                            {j > 0 && <br />}
                            {j > 0 ? part.trimStart() : part}
                          </Fragment>
                        ))}
                        {n == null ? null : typeof n === 'string' ? (
                          n
                        ) : (
                          <span className="whitespace-nowrap">
                            {sign}
                            <span className="rounded bg-accent/10 px-1 py-0.5 font-semibold text-accent tabular">
                              {n.from}→{n.to}
                              {pct && '%'}
                            </span>
                            <span className="ml-1 text-[11px] text-ink-3">({n.step})</span>
                          </span>
                        )}
                      </Fragment>
                    );
                  })}
                </p>
                {sum.upTo < lines.length && (
                  <p className="mt-1.5 text-xs text-ink-3">
                    Lv 1–{sum.upTo}. From Lv {sum.upTo + 1} the wording changes; the rows below have every level.
                  </p>
                )}
              </section>
            )}

            <section>
              <SectionLabel>Every level</SectionLabel>
              <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {lines.map((l, i) => {
                  const lv = i + 1;
                  const step = planned.filter((s) => s.to === lv);
                  const isFinal = final?.to === lv;
                  return (
                    <li key={lv} className={`grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2 px-3 py-1.5 text-[13px] ${isFinal ? 'bg-accent/10' : ''}`}>
                      <span className={`pt-px text-xs font-semibold tabular ${isFinal ? 'text-accent' : 'text-ink-3'}`}>Lv {lv}</span>
                      <span className="min-w-0 text-ink-2">
                        <LevelText line={l} change={changes[i]} />
                        {step.map((s) => (
                          <span key={s.n} className="ml-2 inline-block rounded border border-accent/50 px-1 align-middle text-[10px] font-medium leading-4 text-accent">
                            step {s.n} · by Lv {s.level}
                          </span>
                        ))}
                        {notes[lv] && <span className="mt-0.5 block text-[11px] text-warn">{notes[lv]}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <p className="text-[11px] text-ink-3">
              The game's own text for each level,{' '}
              {test
                ? "from the second closed test's data (COT #2, August 2026); 3rd job was only in that test and is being reworked, so expect changes"
                : "from the launch client (Founder's Access, October 6, 2026)"}
              . Changed numbers are highlighted, with the difference from the level before.{' '}
              <a href={(test && doc.testSource ? doc.testSource : doc.source).url} target="_blank" rel="noreferrer" className="whitespace-nowrap hover:text-accent">
                ↗ {siteOf((test && doc.testSource ? doc.testSource : doc.source).url)}
              </a>
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
