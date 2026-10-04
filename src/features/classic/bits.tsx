import { Fragment, type ReactNode } from 'react';
import { dataUrl } from '../../lib/paths';
import type { Archetype, SkillInfo, Source, Tier } from './types';
import { siteOf } from './labels';
import type { LevelLine } from './skillLevels';

/**
 * The in-game class icon (32px pixel art in public/classic/jobs/); multiples of 16 stay pixel-sharp on 2x screens.
 * Pirate has an icon too, but no builds or spots until Classic World adds the class.
 */
export function Emblem({ archetype, size = 32, className = '' }: { archetype: Archetype; size?: number; className?: string }) {
  return (
    <img
      src={dataUrl(`classic/jobs/${archetype.toLowerCase()}.webp`, 'public')}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] shadow-sm ${className}`}
      style={{ width: size, height: size, imageRendering: size % 16 === 0 ? 'pixelated' : 'auto' }}
    />
  );
}

/** Tier letter, stepping down from S (solid accent) through A (accent outline) to plain and muted outlines. */
export function TierBadge({ tier, size = 'sm' }: { tier: Tier; size?: 'xs' | 'sm' | 'lg' }) {
  const tone = tier === 'S' ? 'bg-accent text-on-accent border-accent' : tier === 'A' ? 'bg-accent/15 text-accent border-accent/60' : tier === 'B' ? 'bg-surface-3 text-ink border-border-2' : tier === 'C' ? 'bg-transparent text-ink-2 border-border-2' : 'bg-transparent text-ink-3 border-dashed border-border-2';
  const box = size === 'lg' ? 'size-14 rounded-2xl text-3xl' : size === 'xs' ? 'size-5 rounded-md text-[11px]' : 'size-7 rounded-lg text-sm';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center border font-bold ${box} ${tone}`} title={`${tier} tier`} aria-label={`${tier} tier`}>
      {tier}
    </span>
  );
}

/** A score out of `max` as segmented pips (2px surface gaps between segments). */
export function Pips({ score, max = 5, className = '' }: { score: number; max?: number; className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} role="img" aria-label={`${score} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 first:rounded-l-full last:rounded-r-full ${i < score ? 'bg-accent' : 'bg-surface-3'}`} />
      ))}
    </span>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {sources.map((s) => (
        <li key={s.url} className="flex gap-2 min-w-0">
          <span className="text-ink-3 shrink-0">↗</span>
          <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-accent">
            <span className="text-ink">{s.title}</span> <span className="text-ink-3">· {siteOf(s.url)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Small uppercase heading inside a card section. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`label mb-2 ${className}`}>{children}</div>;
}

/**
 * A skill's in-game icon (32px pixel art; whole multiples of 32 stay pixel-sharp).
 * Skills the game data has no icon for yet get a lettered tile instead.
 */
export function SkillIcon({ skill, name, size = 24 }: { skill?: SkillInfo | null; name?: string; size?: number }) {
  if (skill?.icon)
    return <img src={dataUrl(skill.icon, 'public')} alt="" width={size} height={size} loading="lazy" className="shrink-0" style={{ width: size, height: size, imageRendering: size % 32 === 0 ? 'pixelated' : undefined }} />;
  const letters = (skill?.skill ?? name ?? '?')
    .split(/[\s:/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-border-2 bg-surface-3 font-semibold text-ink-3" style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.36)) }} title="No icon in the game data yet">
      {letters}
    </span>
  );
}

/**
 * A level's game text with each number that changed since the level before followed by its difference.
 * `strong` also sets those numbers in bold; the skill builder leaves that off, since it bolds the whole level you're at.
 */
export function LevelText({ line, change, strong = true }: { line: LevelLine; change: number[] | null; strong?: boolean }) {
  return (
    <>
      {line.text.map((t, k) => (
        <Fragment key={k}>
          {t}
          {k < line.raw.length &&
            (change && change[k] !== 0 ? (
              <>
                <span className={`text-ink tabular ${strong ? 'font-semibold' : ''}`}>{line.raw[k]}</span>
                <span className="ml-0.5 align-super text-[10px] font-semibold text-accent tabular">{change[k] > 0 ? `+${change[k]}` : `−${-change[k]}`}</span>
              </>
            ) : (
              <span className="tabular">{line.raw[k]}</span>
            ))}
        </Fragment>
      ))}
    </>
  );
}
