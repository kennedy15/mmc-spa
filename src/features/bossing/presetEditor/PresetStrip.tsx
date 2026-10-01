import { useRef, useState, type ReactNode } from 'react';
import { fmtInt, fmtMeso } from '../../../app/format';
import type { BossPreset } from '../../../lib/types';
import { Icon } from './bits';
import { Faces } from './Faces';
import { plural } from './board';

export interface StripItem {
  preset: BossPreset;
  crystals: number;
  meso: number;
  users: string[];
}

interface Props {
  items: StripItem[];
  /** The preset open in the editor; null while a new one is. */
  selectedId: string | null;
  /** The preset with unsaved edits, if any. */
  dirtyId: string | null;
  /** A new, unsaved preset and the step it would take. */
  draft: { item: StripItem; at: number } | null;
  onSelect: (id: string) => void;
  /** Move a preset to another step (0-based). */
  onMove: (id: string, to: number) => void;
}

/** Every preset in progression order, as cards: pick one to edit, drag or use the arrows to reorder. */
export function PresetStrip({ items, selectedId, dirtyId, draft, onSelect, onMove }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  /** Move with an arrow. At either end that arrow turns off, so the keyboard goes on to the card's other one. */
  const step = (id: string, to: number) => {
    onMove(id, to);
    const other = to === 0 ? 'later' : to === items.length - 1 ? 'earlier' : null;
    if (other) requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-move="${id}"][data-dir="${other}"]`)?.focus());
  };
  const cards: ReactNode[] = items.map((it, i) => {
    const p = it.preset;
    const on = p.id === selectedId;
    return (
      <li
        key={p.id}
        draggable
        onDragStart={(e) => {
          setDragging(p.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => dragging && dragging !== p.id && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dragging && dragging !== p.id) onMove(dragging, i);
          setDragging(null);
        }}
        onDragEnd={() => setDragging(null)}
        className={`relative min-w-0 rounded-lg border transition-colors ${on ? 'border-accent bg-accent/10 ring-2 ring-accent/40' : 'border-border-2 bg-surface-2 hover:border-ink-3'} ${dragging === p.id ? 'opacity-40' : ''}`}
      >
        <button type="button" aria-pressed={on} onClick={() => onSelect(p.id)} className="block w-full text-left p-3 cursor-pointer" title={`${p.name}: ${fmtInt(it.meso)} per character per week, every boss cleared`}>
          <Body step={String(i + 1)} item={it} on={on} dirty={p.id === dirtyId} />
        </button>
        <span className="absolute right-1.5 bottom-1.5 flex">
          <MoveButton id={p.id} name={p.name} dir="earlier" disabled={i === 0} onClick={() => step(p.id, i - 1)} />
          <MoveButton id={p.id} name={p.name} dir="later" disabled={i === items.length - 1} onClick={() => step(p.id, i + 1)} />
        </span>
      </li>
    );
  });
  if (draft) {
    cards.splice(
      draft.at,
      0,
      <li key="new" className="relative min-w-0 rounded-lg border border-dashed border-accent bg-accent/10 ring-2 ring-accent/40">
        <div className="p-3" aria-current="true">
          <Body step="New" item={draft.item} on dirty />
        </div>
      </li>,
    );
  }
  return <ol ref={list} className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))]">{cards}</ol>;
}

function Body({ step, item, on, dirty }: { step: string; item: StripItem; on: boolean; dirty: boolean }) {
  const p = item.preset;
  return (
    <>
      <span className="flex items-center justify-between gap-2 h-5">
        <span className="flex items-center gap-1.5">
          <span className={`min-w-5 h-5 px-1 rounded-md grid place-items-center text-[11px] font-semibold tabular ${on ? 'bg-accent/20 text-accent' : 'bg-surface-3 text-ink-2'}`}>{step}</span>
          {dirty && (
            <span className="flex items-center gap-1 text-[11px] text-accent">
              <span className="size-1.5 rounded-full bg-accent" />
              Unsaved
            </span>
          )}
        </span>
        {p.main && <span className="rounded-md border border-border-2 px-1.5 text-[11px] leading-4 font-medium text-ink-2">Main</span>}
      </span>
      <span className={`mt-1.5 block text-sm font-semibold leading-5 line-clamp-2 break-words ${on ? 'text-accent' : 'text-ink'}`}>{p.name.trim() || 'Untitled'}</span>
      <span className="mt-0.5 block text-xs text-ink-2 tabular">
        {plural(item.crystals, 'boss', 'bosses')} · {fmtMeso(item.meso)}
      </span>
      <span className="mt-2 flex items-center gap-1.5 h-5 pr-12 min-w-0">
        <Faces names={item.users} />
        <span className="truncate text-[11px] text-ink-3">{item.users.length ? '' : 'No characters'}</span>
      </span>
    </>
  );
}

function MoveButton({ id, name, dir, disabled, onClick }: { id: string; name: string; dir: 'earlier' | 'later'; disabled: boolean; onClick: () => void }) {
  const label = `Move ${name} ${dir}`;
  return (
    <button type="button" aria-label={label} title={label} data-move={id} data-dir={dir} disabled={disabled} onClick={onClick} className="group size-6 grid place-items-center rounded-md cursor-pointer hover:bg-surface-3 disabled:opacity-30 disabled:pointer-events-none">
      <Icon name={dir === 'earlier' ? 'left' : 'right'} size={14} className="text-ink-3 group-hover:text-ink" />
    </button>
  );
}
