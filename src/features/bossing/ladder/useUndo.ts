import { useEffect, useState } from 'react';
import { useStore } from '../../../store';
import type { AppliedPresets, Assignment } from '../../../lib/types';

export interface Toast {
  id: number;
  head: string;
  text: string;
  /** Characters the change landed on, highlighted while the toast is up. */
  names: string[];
  /** Control that made the change; repeats on it fold into one Undo step. */
  key: string | null;
  /** False when the change left nothing to undo (stepped back to where it started). */
  undoable: boolean;
}

/** A toast's head or text, or a function of the boss lists from before the step (for a folded step, before its first). */
export type StepText = string | ((before: Assignment[]) => string);

export interface StepMsg {
  head: StepText;
  text: StepText;
  names?: string[];
  key?: string;
  /** The boss lists the step saves, when known: a folded step that lands back where it started drops its Undo step. */
  next?: Assignment[];
}

interface Step {
  assignments: Assignment[];
  appliedPresets: AppliedPresets;
  label: string;
  key: string | null;
}

const DEPTH = 20;
let seq = 0;

/**
 * Every change this page makes to the boss lists goes through run(): it keeps
 * the assignments and applied presets from just before, so Undo puts back
 * exactly what was there. Recorded clears are never part of it. Repeated steps
 * on one control (party + + +) fold into one Undo step while their toast is up.
 */
export function useUndo() {
  const [history, setHistory] = useState<Step[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 12_000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (msg: StepMsg, change: () => Promise<void>) => {
    const s = useStore.getState();
    const key = msg.key ?? null;
    const top = history[history.length - 1];
    const fold = key != null && toast?.key === key && top?.key === key;
    // Head and text read from where a folded step started (party 1 → 3, not 2 → 3).
    const before = fold ? top.assignments : s.assignments;
    const head = typeof msg.head === 'function' ? msg.head(before) : msg.head;
    const text = typeof msg.text === 'function' ? msg.text(before) : msg.text;
    if (fold && msg.next && JSON.stringify(msg.next) === JSON.stringify(top.assignments)) {
      // Stepped back to where it started: nothing is left to undo for this control.
      setHistory(history.slice(0, -1));
      setToast({ id: ++seq, head, text: 'Same as before', names: [], key: null, undoable: false });
    } else {
      setHistory(fold ? [...history.slice(0, -1), { ...top, label: head }] : [...history, { assignments: s.assignments, appliedPresets: s.appliedPresets, label: head, key }].slice(-DEPTH));
      setToast({ id: ++seq, head, text, names: msg.names ?? [], key, undoable: true });
    }
    void change();
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    setToast({ id: ++seq, head: 'Undone', text: last.label, names: [], key: null, undoable: true });
    void useStore.getState().setBossing({ assignments: last.assignments, appliedPresets: last.appliedPresets });
  };

  return { toast, run, undo, dismiss: () => setToast(null), steps: history.length, nextUndo: history[history.length - 1]?.label ?? null };
}

export type Undo = ReturnType<typeof useUndo>;
