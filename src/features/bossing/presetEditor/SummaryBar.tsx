import type { ReactNode } from 'react';
import { fmtInt, fmtMeso } from '../../../app/format';
import { Action } from './bits';

interface Props {
  crystals: number;
  cap: number;
  /** A boss was refused for want of crystals: the slots light up as a warning. */
  full: boolean;
  meso: number;
  /** Weekly meso of the saved version, when the draft changes it. */
  savedMeso: number | null;
  dirty: boolean;
  isNew: boolean;
  /** Why Save is off (a missing or taken name), or null. */
  problem: string | null;
  onSave: () => void;
  onDiscard: () => void;
  /** An open question about the save, under the numbers. */
  children?: ReactNode;
}

/** Sticks to the top of the board: crystals used, weekly meso per character, and the save state. */
export function SummaryBar({ crystals, cap, full, meso, savedMeso, dirty, isNew, problem, onSave, onDiscard, children }: Props) {
  const over = crystals > cap;
  const slot = (i: number) => (i >= cap ? 'bg-bad' : i < crystals ? (full ? 'bg-warn' : 'bg-accent') : 'bg-surface-3');
  return (
    <div className="sticky top-2 z-10 rounded-lg border border-border-2 bg-surface-2 shadow-lg shadow-black/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="label">Crystals</div>
          <div className="flex items-center gap-2.5 h-7">
            <span role="img" aria-label={`${crystals} of ${cap} weekly crystals`} className="flex gap-[3px]">
              {Array.from({ length: Math.max(cap, crystals) }, (_, i) => (
                <span key={i} className={`w-2 h-[18px] rounded-sm transition-colors ${slot(i)}`} />
              ))}
            </span>
            <span className={`text-sm font-semibold tabular ${over ? 'text-bad' : full ? 'text-warn' : 'text-ink'}`}>
              {crystals}/{cap}
              {over && <span className="font-normal"> · over the cap</span>}
            </span>
          </div>
        </div>
        <div title={`${fmtInt(meso)} per character per week, every boss cleared`}>
          <div className="label">Weekly meso</div>
          <div className="flex items-baseline gap-2 h-7">
            <span className="text-xl font-semibold tabular text-ink">{fmtMeso(meso)}</span>
            <span className="text-xs text-ink-3">{savedMeso != null && savedMeso !== meso ? `was ${fmtMeso(savedMeso)}` : 'per character'}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {dirty ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-accent">
                <span className="size-1.5 rounded-full bg-accent" />
                {isNew ? 'New preset, not saved' : 'Unsaved changes'}
              </span>
              <Action kind="ghost" small onClick={onDiscard}>
                Discard
              </Action>
              <Action kind="accent" small onClick={onSave} disabled={!!problem} title={problem ?? undefined}>
                {isNew ? 'Save preset' : 'Save'}
              </Action>
            </>
          ) : (
            <span className="text-xs text-ink-3">All changes saved</span>
          )}
        </div>
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
