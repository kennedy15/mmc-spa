import type { ReactNode } from 'react';
import { fmtMeso } from '../../../app/format';
import { bossLabel } from '../lib';
import { useLadder } from './context';
import { TRAY, type LadderChar } from './model';
import { Avatar, Tag, focusRing } from './bits';
import { Check, ChevronLeft, ChevronRight, Star } from './icons';

/** A character on its rung: drag it to another rung, or step it one rung down or up. */
export function CharCard({ c }: { c: LadderChar }) {
  const L = useLadder();
  const cap = L.pricing.settings.crystalCap;
  const idx = L.rungs.indexOf(c.rung);
  const down = idx > 0 ? L.rungs[idx - 1] : null;
  const up = idx >= 0 && idx < L.rungs.length - 1 ? L.rungs[idx + 1] : null;
  const isSel = !L.selectMode && L.selected?.name === c.name;
  const isPicked = L.selectMode && L.picked.includes(c.name);
  const dragging = !!L.drag?.includes(c.name);
  const landed = L.landed.includes(c.name);
  const look = isSel ? 'border-accent bg-accent/10 ring-2 ring-accent/40' : isPicked ? 'border-accent bg-accent/10' : landed ? 'border-good/50 bg-surface-2 ring-2 ring-good/15' : 'border-border-2 bg-surface-2';
  const downLabel = !down ? `${c.name} has no preset` : down === TRAY ? `Move ${c.name} down to no preset (clears its weekly bosses)` : `Move ${c.name} down to ${L.rungName(down)}`;
  const upLabel = up ? `Promote ${c.name} to ${L.rungName(up)}` : `${c.name} is on the top rung`;
  const where = c.preset ? c.preset.name : c.weekly.length ? 'its own list' : 'no bosses';

  return (
    <div
      data-card={c.name}
      draggable
      onDragStart={(e) => L.startDrag(c.name, e)}
      onDragEnd={L.endDrag}
      title={`${c.name}${c.job ? ` · ${c.job}` : ''} · ${where} · ${fmtMeso(c.meso)} / week. Drag to another rung.`}
      className={`flex min-w-0 cursor-grab flex-col rounded-lg border transition-[background-color,border-color,box-shadow,opacity] ${look} ${dragging ? 'opacity-40' : ''}`}
    >
      <button type="button" onClick={() => L.select(c.name)} aria-pressed={isSel || isPicked} className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-t-[7px] px-2 pt-1.5 pb-0.5 text-left transition-colors hover:bg-ink/5 ${focusRing} focus-visible:outline-offset-[-2px]`}>
        <span className="flex w-full min-w-0 items-center gap-1.5">
          {L.selectMode ? <Checkbox on={isPicked} /> : <Avatar c={c} />}
          <span className="min-w-0 text-sm font-medium break-all text-ink">{c.name}</span>
          {c.main && <Star className="size-3 text-accent" />}
        </span>
        <span className="flex w-full justify-between gap-1.5 text-[11px] leading-4 tabular">
          <span className={c.gaps.length ? 'text-warn' : 'text-ink-3'}>{c.level != null ? `Lv ${c.level}` : 'Ledger only'}</span>
          <span className={c.weekly.length > cap ? 'text-warn' : 'text-ink-3'} title={`${c.weekly.length} weekly crystals of ${cap}`}>
            {c.weekly.length}/{cap}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-0.5 px-0.5 pb-0.5">
        <StepButton to={down} label={downLabel} name={c.name}>
          <ChevronLeft className="size-3 text-ink-3 group-hover:text-ink" />
        </StepButton>
        <span className="flex min-w-0 flex-1 flex-wrap justify-center gap-1">
          {c.edited && c.preset && <Tag title={`Edited from ${c.preset.name}`}>Edited</Tag>}
          {c.gaps.length > 0 && <Tag tone="warn" title={c.gaps.map((g) => `${bossLabel(L.pricing.doc, g.bossId, g.difficulty)} needs Lv ${g.need}`).join(', ')}>Lv gap</Tag>}
        </span>
        <StepButton to={up} label={upLabel} name={c.name}>
          <ChevronRight className="size-3 text-ink-2 group-hover:text-accent" />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({ to, label, name, children }: { to: string | null; label: string; name: string; children: ReactNode }) {
  const L = useLadder();
  const show = () => to && L.hover({ names: [name], to });
  return (
    <button
      type="button"
      disabled={!to}
      onClick={(e) => {
        if (!to) return;
        L.move([name], to);
        // The card remounts on its new rung and focus goes with it. From the keyboard (detail 0) the page
        // follows; a tap or click leaves the page where it is, so a phone isn't thrown up to rung 1 each time.
        const follow = e.detail === 0;
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card="${CSS.escape(name)}"] button`)?.focus({ preventScroll: !follow }));
      }}
      onMouseEnter={show}
      onMouseLeave={() => L.hover(null)}
      onFocus={show}
      onBlur={() => L.hover(null)}
      aria-label={label}
      title={label}
      className={`group inline-flex h-7 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-3 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent sm:h-6 sm:w-7 ${focusRing} focus-visible:outline-offset-[-1px]`}
    >
      {children}
    </button>
  );
}

function Checkbox({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md border-[1.5px] text-black ${on ? 'border-accent bg-accent' : 'border-ink-3'}`}>
      {on && <Check className="size-3" />}
    </span>
  );
}
