import { createContext, useContext, type DragEvent } from 'react';
import type { Assignment, BossPreset } from '../../../lib/types';
import type { LadderChar, Pricing } from './model';
import type { StepMsg } from './useUndo';

/** A move being pointed at, dragged or picked, shown as a preview in the target rung before it lands. */
export interface PendingMove {
  names: string[];
  to: string;
}

export interface Ladder {
  chars: LadderChar[];
  byName: Map<string, LadderChar>;
  presets: BossPreset[];
  assignments: Assignment[];
  pricing: Pricing;
  /** TRAY, then the presets in progression order. */
  rungs: string[];
  rungName: (key: string) => string;
  presetFor: (key: string) => BossPreset | null;

  selected: LadderChar | null;
  /** Card click: shows the character in the panel, or checks it in Select mode. */
  select: (name: string) => void;
  selectMode: boolean;
  picked: string[];
  /** Checks every character on a rung, or unchecks them when all are checked. */
  pickRung: (key: string) => void;

  drag: string[] | null;
  over: string | null;
  preview: PendingMove | null;
  /** Previews a move while a control that would make it is hovered or focused; null clears. */
  hover: (move: PendingMove | null) => void;
  startDrag: (name: string, e: DragEvent) => void;
  endDrag: () => void;
  dropTarget: (key: string) => { onDragOver: (e: DragEvent) => void; onDragLeave: (e: DragEvent) => void; onDrop: (e: DragEvent) => void };

  /**
   * Switches characters to a rung: their weekly lists are wiped and replaced by
   * the preset's (the tray clears them). Characters already there are skipped
   * unless `force` (Reset, Clear).
   */
  move: (names: string[], to: string, opts?: { head?: string; force?: boolean }) => void;
  /** Saves a hand edit of the boss lists with an Undo step. */
  edit: (msg: Omit<StepMsg, 'names' | 'next'>, next: Assignment[]) => void;

  /** Rung whose boss list is open. */
  peek: string | null;
  setPeek: (key: string | null) => void;
  /** Characters the latest change landed on. */
  landed: string[];
}

export const LadderContext = createContext<Ladder | null>(null);

export function useLadder(): Ladder {
  const l = useContext(LadderContext);
  if (!l) throw new Error('useLadder outside the Assignments page');
  return l;
}
