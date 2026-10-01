import type { Undo } from './useUndo';
import { Check, Close, UndoIcon } from './icons';

/** The latest change, pinned to the bottom of the window so it's in view wherever the change was made. */
export function UndoToast({ undo }: { undo: Undo }) {
  const t = undo.toast;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center lg:left-[244px]">
      {t && (
        <div key={t.id} className="card pointer-events-auto flex w-full max-w-xl items-start gap-2.5 py-2 pr-2 pl-3 shadow-2xl shadow-black/60">
          <Check className="mt-[5px] size-3.5 text-good" />
          <span className="min-w-0 flex-1 py-0.5 text-sm">
            <span className="font-semibold text-ink">{t.head}</span>
            <span className="text-ink-3"> · </span>
            <span className="text-ink-2">{t.text}</span>
          </span>
          {t.undoable && undo.steps > 0 && (
            <span className="shrink-0 text-xs">
              <button type="button" onClick={undo.undo} aria-label={`Undo: ${undo.nextUndo}`} title={`Undo: ${undo.nextUndo}`} className="btn btn-sm">
                <UndoIcon className="size-3" />
                Undo
              </button>
            </span>
          )}
          <button type="button" onClick={undo.dismiss} aria-label="Dismiss" className="group inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2">
            <Close className="size-3 text-ink-3 group-hover:text-ink" />
          </button>
        </div>
      )}
    </div>
  );
}
