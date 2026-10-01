import type { Undo } from './useUndo';
import { useLadder } from './context';
import { plural, previewMove, signed } from './model';
import { Chip, ghostText } from './bits';
import { ArrowRight, Info, SelectIcon, UndoIcon } from './icons';

/** Above the rungs: a hint, what's being dragged, or Select mode with its bulk move. Undo lives here too. */
export function MoveBar({ undo, bulkTo, setBulkTo, toggleSelect, clearPicked, bulkMove }: { undo: Undo; bulkTo: string | null; setBulkTo: (key: string | null) => void; toggleSelect: () => void; clearPicked: () => void; bulkMove: (names: string[], to: string) => void }) {
  const L = useLadder();
  const picked = L.chars.filter((c) => L.picked.includes(c.name));
  const drag = L.drag;
  const bulk = L.selectMode && bulkTo != null && picked.length ? previewMove(picked, bulkTo, L.presetFor(bulkTo), L.pricing) : null;
  const look = drag ? 'border-dashed border-accent bg-accent/5' : L.selectMode ? 'border-border-2 bg-surface' : 'border-border bg-surface';

  let status;
  if (drag) {
    status = (
      <span className="flex items-start gap-2 text-ink">
        <ArrowRight className="mt-[3px] size-3.5 text-accent" />
        {drag.length === 1 ? `Moving ${drag[0]}` : `Moving ${drag.length} characters`}. Drop on a rung to replace the weekly bosses.
      </span>
    );
  } else if (L.selectMode) {
    status = (
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{picked.length ? `${plural(picked.length, 'character')} selected` : 'Click cards to select them, or select a whole rung'}</span>
        <span className="text-ink-3">{picked.map((c) => c.name).join(', ')}</span>
      </span>
    );
  } else {
    status = (
      <span className="flex items-start gap-2 text-ink-2">
        <Info className="mt-[3px] size-3.5 text-ink-3" />
        Drag a card onto another rung, or use the arrows on a card. Click a card to see its bosses.
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${look}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="status" aria-live="polite" className="min-w-0 flex-[1_1_18rem]">
          {status}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs">
          {L.selectMode && picked.length > 0 && (
            <button type="button" onClick={clearPicked} className="group btn-ghost btn-sm">
              <span className={ghostText}>Clear</span>
            </button>
          )}
          {undo.steps > 0 && (
            <button type="button" onClick={undo.undo} title={`Undo: ${undo.nextUndo}`} aria-label={`Undo: ${undo.nextUndo}`} className="btn btn-sm">
              <UndoIcon className="size-3" />
              Undo
            </button>
          )}
          <button type="button" onClick={toggleSelect} aria-pressed={L.selectMode} className={`btn btn-sm ${L.selectMode ? 'border-accent bg-accent/10' : ''}`}>
            <span className={`inline-flex items-center gap-1.5 ${L.selectMode ? 'text-accent' : ''}`}>
              <SelectIcon className="size-3.5" />
              {L.selectMode ? 'Done' : 'Select'}
            </span>
          </button>
        </div>
      </div>

      {L.selectMode && !drag && (
        <>
          <div role="group" aria-label="Move selected characters to" className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="label mr-0.5">Move to</span>
            {L.rungs.map((key, i) => (
              <Chip key={key} on={bulkTo === key} onClick={() => setBulkTo(bulkTo === key ? null : key)}>
                {i > 0 && <span className={`-ml-1.5 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold ${bulkTo === key ? 'bg-accent text-black' : 'bg-surface-3 text-ink-2'}`}>{i}</span>}
                {L.rungName(key)}
              </Chip>
            ))}
          </div>
          {bulk && bulkTo != null && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <button type="button" onClick={() => bulkMove(bulk.movers.map((c) => c.name), bulkTo)} disabled={!bulk.movers.length} className="btn-accent">
                <span className="text-black">{bulk.movers.length ? `Move ${bulk.movers.length} to ${L.rungName(bulkTo)}` : 'Nothing to move'}</span>
              </button>
              <span className="flex min-w-0 flex-[1_1_15rem] flex-col gap-0.5 text-xs">
                <span className="text-ink-2">
                  {[
                    ...(bulk.movers.length ? [bulk.churn, `${signed(bulk.delta)} / week`, 'Recorded clears are kept'] : []),
                    ...(bulk.stay.length ? [`${bulk.stay.map((c) => c.name).join(', ')} ${bulk.stay.length === 1 ? 'is' : 'are'} already there`] : []),
                  ].join(' · ')}
                </span>
                {bulk.under.length > 0 && (
                  <span className="text-warn">
                    {bulk.under.map((u) => u.name).join(', ')} {bulk.under.length === 1 ? 'is' : 'are'} under level for some of these bosses.
                  </span>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
