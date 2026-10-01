import type { ReactNode } from 'react';
import type { LadderChar } from './model';
import { People } from './icons';

/**
 * index.css has an unlayered `button { font: inherit; color: inherit }`, which
 * beats Tailwind's text classes on a <button>. Buttons here take their size
 * from the parent and put colour on an inner span.
 */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
/** The label of a .btn-ghost, in its ink-2 with ink on hover; give the button `group`. */
export const ghostText = 'inline-flex items-center gap-1.5 text-ink-2 group-hover:text-ink';

/** The character's sprite in a small square, like the Checklist's picker; first two letters when there is none. */
export function Avatar({ c, large }: { c: LadderChar; large?: boolean }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-end justify-center overflow-hidden bg-surface-3 ${large ? 'size-10 rounded-lg' : 'size-6 rounded-md'}`}>
      {c.img ? (
        <img src={c.img} alt="" className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} loading="lazy" />
      ) : (
        <span className={`self-center text-ink-3 ${large ? 'text-sm font-semibold' : 'text-[10px]'}`}>{c.name.slice(0, 2)}</span>
      )}
    </span>
  );
}

export function StepBadge({ n }: { n: number }) {
  return <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-3 text-[11px] font-semibold text-ink-2">{n}</span>;
}

export function Tag({ children, tone = 'muted', title }: { children: ReactNode; tone?: 'muted' | 'warn' | 'accent'; title?: string }) {
  const cls = tone === 'warn' ? 'border-warn/40 bg-warn/10 text-warn' : tone === 'accent' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border-2 text-ink-2';
  return (
    <span title={title} className={`inline-flex items-center rounded-md border px-1.5 text-[11px] leading-4 font-medium whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

export function Count({ n }: { n: number }) {
  return (
    <span title={`${n} ${n === 1 ? 'character' : 'characters'}`} className={`inline-flex items-center gap-1 text-xs tabular ${n ? 'text-ink-2' : 'text-ink-3'}`}>
      <People className="size-3.5" />
      {n}
    </span>
  );
}

/** A pill toggle. Put it in a text-xs container so the button's own line height matches. */
export function Chip({ on, onClick, children, label, title }: { on: boolean; onClick: () => void; children: ReactNode; label?: string; title?: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} title={title} onClick={onClick} className={`${on ? 'chip-on' : 'chip'} ${focusRing}`}>
      <span className={`inline-flex items-center gap-1.5 ${on ? 'text-accent' : 'text-ink-2'}`}>{children}</span>
    </button>
  );
}

/**
 * The kit's Segmented look (active on surface-3 in ink, the rest in ink-3), with
 * the colours on inner spans so the unlayered button rule can't flatten them.
 */
export function Segment<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border-2 p-0.5 text-xs">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)} className={`group cursor-pointer rounded-md px-2 py-0.5 whitespace-nowrap transition-colors ${on ? 'bg-surface-3' : 'hover:bg-surface-2'} ${focusRing}`}>
            <span className={on ? 'font-medium text-ink' : 'text-ink-3 group-hover:text-ink'}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
