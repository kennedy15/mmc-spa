import { useEffect, useRef, useState } from 'react';
import { fmtInt, fmtMeso, titleCase } from '../../../app/format';
import type { BossPreset } from '../../../lib/types';
import { cadenceFor, crystalValue, entryParty, mesoPerClear, presetMeso } from '../lib';
import { useLadder } from './context';
import { bossCount, bossName, diffTone } from './model';
import { StepBadge, Tag, focusRing } from './bits';
import { ChevronDown, Close } from './icons';

/** A rung's "12 bosses" toggle and the preset's boss list in a popover under it. */
export function BossList({ preset, step }: { preset: BossPreset; step: number }) {
  const L = useLadder();
  const open = L.peek === preset.id;
  const setPeek = L.setPeek;
  const wrap = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setPeek(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPeek(null);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open, setPeek]);

  const toggle = () => {
    // Open to the left when a popover anchored on the rung's left edge would run off the page.
    const r = wrap.current?.getBoundingClientRect();
    if (r) setAlignRight(r.left + 380 > document.documentElement.clientWidth - 16);
    L.setPeek(open ? null : preset.id);
  };

  const { doc, prices, settings } = L.pricing;
  const total = presetMeso(preset, doc, prices, settings);
  // Moves the selected character here, from the list itself.
  const mover = L.selected && !L.selectMode && L.selected.rung !== preset.id ? L.selected : null;

  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${bossCount(preset.entries.length)} in ${preset.name}, ${open ? 'hide' : 'show'} the list`} className={`-mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-surface-2 ${focusRing}`}>
        <span className="text-xs text-ink-2">{bossCount(preset.entries.length)}</span>
        <ChevronDown className={`size-3 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="dialog" aria-label={`${preset.name} boss list`} className={`absolute top-full z-30 mt-1 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-border-2 bg-surface shadow-2xl shadow-black/50 ${alignRight ? 'right-[-0.375rem]' : 'left-[-0.375rem]'}`}>
          <div className="flex items-center gap-2 py-2.5 pr-2.5 pl-3.5">
            <StepBadge n={step} />
            <span className="min-w-0 flex-1 text-sm font-semibold">{preset.name}</span>
            {preset.main && <Tag tone="accent">Main</Tag>}
            <button type="button" onClick={() => L.setPeek(null)} aria-label="Close boss list" className={`group inline-flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-surface-3 ${focusRing}`}>
              <Close className="size-3 text-ink-3 group-hover:text-ink" />
            </button>
          </div>
          {preset.description && <p className="-mt-1 px-3.5 pb-2 text-xs text-ink-2">{preset.description}</p>}
          <div className="label grid grid-cols-[minmax(0,1fr)_2.5rem_4.75rem] gap-x-2.5 px-3.5 pb-1">
            <span>Boss</span>
            <span className="text-right">Party</span>
            <span className="text-right">Per person</span>
          </div>
          <ul className="max-h-80 overflow-y-auto border-t border-border">
            {preset.entries.map((e) => {
              const party = entryParty(doc, e);
              const v = mesoPerClear(crystalValue(doc, prices, settings, e.bossId, e.difficulty), party);
              const monthly = cadenceFor(doc, e.bossId, e.difficulty) === 'monthly';
              return (
                <li key={`${e.bossId}:${e.difficulty}`} title={`${titleCase(e.difficulty)} ${bossName(doc, e.bossId)} · party ${party} · ${fmtInt(v)} per person`} className="grid grid-cols-[minmax(0,1fr)_2.5rem_4.75rem] items-baseline gap-x-2.5 border-b border-border px-3.5 py-1 text-sm">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className={`w-13 shrink-0 text-xs font-medium ${diffTone(e.difficulty)}`}>{titleCase(e.difficulty)}</span>
                    <span className="truncate">{bossName(doc, e.bossId)}</span>
                    {monthly && <span className="text-[11px] text-ink-3">monthly</span>}
                  </span>
                  <span className={`text-right tabular ${party > 1 ? 'text-ink' : 'text-ink-3'}`}>{party}</span>
                  <span className="text-right tabular text-ink-2">{fmtMeso(v)}</span>
                </li>
              );
            })}
            {!preset.entries.length && <li className="px-3.5 py-3 text-xs text-ink-3">No bosses in this preset yet.</li>}
          </ul>
          <div className="flex items-baseline justify-between gap-3 px-3.5 pt-2.5 pb-3">
            <span className="text-xs text-ink-3">Weekly, if every boss is cleared</span>
            <span className="text-sm font-semibold tabular" title={`${fmtInt(total)} per character a week`}>
              {fmtMeso(total)}
            </span>
          </div>
          {mover && (
            <div className="px-3.5 pb-3.5 text-sm">
              <button type="button" onClick={() => L.move([mover.name], preset.id)} onMouseEnter={() => L.hover({ names: [mover.name], to: preset.id })} onMouseLeave={() => L.hover(null)} onFocus={() => L.hover({ names: [mover.name], to: preset.id })} onBlur={() => L.hover(null)} className={`btn w-full justify-center ${focusRing}`}>
                Move {mover.name} here
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
