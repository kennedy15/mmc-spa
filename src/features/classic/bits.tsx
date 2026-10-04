import type { ReactNode } from 'react';
import { dataUrl } from '../../lib/paths';
import type { Archetype, SkillInfo, Source, Tier } from './types';
import { siteOf } from './labels';

/** Line glyph per class archetype, drawn on a 24px grid in currentColor. */
const GLYPHS: Record<Archetype, ReactNode> = {
  Warrior: (
    <>
      <path d="M7.5 15.5 18 5l2.5-.5L20 7 9.5 17.5" />
      <path d="M5.5 13.5l6 6" />
      <path d="M7.5 17.5l-3.5 3" />
    </>
  ),
  Magician: (
    <>
      <circle cx="16" cy="8" r="3.5" />
      <path d="M13.5 10.5 4 20" />
      <path d="M20.5 2.5v2M21.5 3.5h-2" />
    </>
  ),
  Bowman: (
    <>
      <path d="M8 3c6.5 3 6.5 15 0 18" />
      <path d="M8 3v18" strokeOpacity={0.5} />
      <path d="M3.5 12h16" />
      <path d="M17 9.5l2.5 2.5-2.5 2.5" />
      <path d="M3.5 12l-1-1.5M3.5 12l-1 1.5" />
    </>
  ),
  Thief: (
    <>
      <path d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" />
      <circle cx="12" cy="12" r="1.25" />
    </>
  ),
  Pirate: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v13.5M8 10.5h8" />
      <path d="M4.5 14a7.5 7.5 0 0 0 15 0" />
    </>
  ),
};

/** The archetype glyph in a rounded tile. */
export function Emblem({ archetype, size = 40 }: { archetype: Archetype; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border-2 bg-surface-2 text-accent" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[archetype]}
      </svg>
    </span>
  );
}

/** Tier letter, stepping down from S (solid accent) through A (accent outline) to plain and muted outlines. */
export function TierBadge({ tier, size = 'sm' }: { tier: Tier; size?: 'sm' | 'lg' }) {
  const tone = tier === 'S' ? 'bg-accent text-black border-accent' : tier === 'A' ? 'bg-accent/15 text-accent border-accent/60' : tier === 'B' ? 'bg-surface-3 text-ink border-border-2' : tier === 'C' ? 'bg-transparent text-ink-2 border-border-2' : 'bg-transparent text-ink-3 border-dashed border-border-2';
  const box = size === 'lg' ? 'size-14 rounded-2xl text-3xl' : 'size-7 rounded-lg text-sm';
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
