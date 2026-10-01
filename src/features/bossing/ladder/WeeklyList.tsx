import { useState } from 'react';
import { fmtInt, fmtMeso, titleCase } from '../../../app/format';
import { Stepper } from '../../../app/ui';
import type { Assignment } from '../../../lib/types';
import { assignmentMeso, bossLabel, crystalValue, diffPreset, findBoss, maxParty, mesoPerClear } from '../lib';
import { useLadder } from './context';
import { TRAY, bossName, changeLabel, diffTone, editedNote, fromAssignment, signed, weeklyDifficulties, withDifficulty, withOrder, withPatch, type LadderChar } from './model';
import { Chip, focusRing, ghostText } from './bits';
import { ChevronDown, Close, Grip, Pencil } from './icons';
import { AddBoss } from './AddBoss';

/** The selected character's weekly bosses, in Checklist order: drag to reorder, change difficulty or party, remove, add. */
export function WeeklyList({ c }: { c: LadderChar }) {
  const L = useLadder();
  const { doc, prices, settings } = L.pricing;
  const cap = settings.crystalCap;
  const n = c.weekly.length;
  const [open, setOpen] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const drift = c.preset && c.edited ? diffPreset(c.weekly, c.preset, doc, prices, settings) : null;

  const reorder = (fromId: string, toId: string) => {
    const next = withOrder(L.assignments, c.name, fromId, toId);
    if (next === L.assignments) return;
    const a = c.weekly.find((x) => x.id === fromId)!;
    const at = c.weekly.findIndex((x) => x.id === toId) + 1;
    L.edit({ head: `${c.name}: ${bossLabel(doc, a.bossId, a.difficulty)} moved to #${at}`, text: 'The Checklist follows this order' }, next);
  };

  return (
    <section className="@container flex flex-col gap-2 border-t border-border px-4 pt-3 pb-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Weekly bosses</h3>
        <span className="flex items-baseline gap-2">
          <span className={`text-xs tabular ${n > cap ? 'text-warn' : 'text-ink-2'}`}>
            {n}/{cap} crystals{n > cap && ` · ${n - cap} over`}
          </span>
          {n > 0 && (
            <span className="text-xs">
              <button type="button" onClick={() => L.move([c.name], TRAY, { force: true, head: `Cleared ${c.name}’s weekly bosses` })} className="group btn-ghost btn-sm">
                <span className={ghostText}>Clear</span>
              </button>
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full transition-[width] ${n > cap ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, (n / Math.max(1, cap)) * 100)}%` }} />
      </div>

      {drift && c.preset && (
        <div className="flex items-center gap-2 rounded-lg border border-border-2 bg-surface-2 py-1.5 pr-1.5 pl-2.5">
          <Pencil className="size-3.5 text-ink-2" />
          <span className="min-w-0 flex-1 text-xs text-ink-2">
            Edited from {c.preset.name}: {editedNote(doc, drift)}.
          </span>
          <span className="text-xs">
            <button type="button" onClick={() => c.preset && L.move([c.name], c.preset.id, { force: true, head: `${c.name} reset to ${c.preset.name}` })} className="btn btn-sm">
              Reset
            </button>
          </span>
        </div>
      )}

      {n === 0 ? (
        <p className="py-1.5 text-xs text-ink-3">{c.name} has no weekly bosses. Pick a rung above, or add bosses one at a time.</p>
      ) : (
        <div>
          <div className={`label border-b border-border pb-1 ${COLS}`}>
            <span />
            <span>Boss</span>
            <span className="hidden text-center @[21rem]:block">Party</span>
            <span className="hidden text-right @[21rem]:block" title="Per person, per clear">
              Meso
            </span>
          </div>
          <ul>
            {c.weekly.map((a) => (
              <li
                key={a.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', bossLabel(doc, a.bossId, a.difficulty));
                  setDragId(a.id);
                }}
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) reorder(dragId, a.id);
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
                className={`border-b border-border transition-opacity ${dragId === a.id ? 'opacity-40' : ''}`}
              >
                <Row c={c} a={a} open={open === a.id} toggle={() => setOpen(open === a.id ? null : a.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <AddBoss key={c.name} c={c} />
    </section>
  );
}

/**
 * Row columns: grip, boss, party, meso, remove. Where the list is narrower than
 * 21rem (phones) party and meso drop to a second line so boss names keep room.
 */
const COLS = 'grid grid-cols-[1rem_minmax(0,1fr)_1.75rem] gap-x-1.5 @[21rem]:grid-cols-[1rem_minmax(0,1fr)_4.75rem_3rem_1.75rem]';

function Row({ c, a, open, toggle }: { c: LadderChar; a: Assignment; open: boolean; toggle: () => void }) {
  const L = useLadder();
  const { doc, prices, settings } = L.pricing;
  const boss = findBoss(doc, a.bossId);
  const label = bossLabel(doc, a.bossId, a.difficulty);
  const weekly = weeklyDifficulties(doc, a.bossId);
  // An older list can hold a difficulty the picker doesn't offer; keep it pickable so the row still shows it.
  const options = weekly.some((d) => d.key === a.difficulty) ? weekly : [...(boss?.difficulties.filter((d) => d.key === a.difficulty) ?? []), ...weekly];
  const meso = assignmentMeso(a, doc, prices, settings);
  const need = boss?.difficulties.find((d) => d.key === a.difficulty)?.minLevel ?? 0;
  const gap = c.level != null && need > c.level;
  const name = bossName(doc, a.bossId);

  const setParty = (party: number) => {
    const v = mesoPerClear(crystalValue(doc, prices, settings, a.bossId, a.difficulty), party);
    // Repeated + or − fold into one Undo step, read from where the first one started.
    const was = (before: Assignment[]) => before.find((x) => x.id === a.id) ?? a;
    const head = (before: Assignment[]) => {
      const from = was(before).defaultPartySize;
      return `${c.name}: ${name} party ${from === party ? `back to ${party}` : `${from} → ${party}`}`;
    };
    const text = (before: Assignment[]) => `${signed(v - assignmentMeso(was(before), doc, prices, settings))} / week · ${fmtMeso(v)} per person`;
    L.edit({ head, text, key: `party:${a.id}` }, withPatch(L.assignments, a.id, { defaultPartySize: party }));
  };
  const setDifficulty = (key: string) => {
    toggle();
    if (key === a.difficulty) return;
    const next = withDifficulty(L.assignments, a, key, doc);
    const to = next.find((x) => x.id === a.id)!;
    L.edit({ head: `${c.name}: ${changeLabel(doc, fromAssignment(a), fromAssignment(to))}`, text: `${signed(assignmentMeso(to, doc, prices, settings) - meso)} / week` }, next);
  };
  const remove = () => L.edit({ head: `Removed ${label}`, text: `from ${c.name}’s weekly list · ${signed(-meso)} / week` }, L.assignments.filter((x) => x.id !== a.id));

  const title = `${titleCase(a.difficulty)} ${name}${need ? ` · Lv ${need}+` : ''}`;
  const word = (
    <>
      <span className={`w-12 shrink-0 text-xs font-medium ${diffTone(a.difficulty)}`}>{titleCase(a.difficulty)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm break-words text-ink">{name}</span>
        {gap && (
          <span className="text-[11px] leading-4 text-warn" title={`${c.name} is Lv ${c.level}`}>
            Needs Lv {need}
          </span>
        )}
      </span>
    </>
  );

  return (
    <>
      <div className={`min-h-9 items-center gap-y-1 py-1 @[21rem]:py-0.5 ${COLS}`}>
        <span className="cursor-grab text-ink-3" title="Drag to reorder">
          <Grip className="size-3.5" />
        </span>
        {options.length > 1 ? (
          <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${label}, change difficulty`} title={title} className={`-ml-1 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md border px-1 py-0.5 text-left transition-colors ${open ? 'border-border-2 bg-surface-2' : 'border-transparent hover:bg-surface-2'} ${focusRing}`}>
            {word}
            <ChevronDown className={`size-3 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <span title={title} className="flex min-w-0 items-center gap-1.5 py-0.5">
            {word}
          </span>
        )}
        <button type="button" onClick={remove} aria-label={`Remove ${label}`} title={`Remove ${label}`} className={`group col-start-3 row-start-1 inline-flex size-7 cursor-pointer items-center justify-center justify-self-end rounded-md hover:bg-surface-2 @[21rem]:col-start-5 ${focusRing}`}>
          <Close className="size-3 text-ink-3 group-hover:text-ink" />
        </button>
        <div className="col-start-2 flex items-center justify-between gap-2 @[21rem]:contents">
          <span role="group" aria-label={`Party for ${label}`} className="text-sm @[21rem]:col-start-3 @[21rem]:row-start-1">
            <Stepper value={a.defaultPartySize} max={maxParty(doc, a.bossId, a.difficulty)} onChange={setParty} />
          </span>
          <span className="text-right text-sm tabular text-ink-2 @[21rem]:col-start-4 @[21rem]:row-start-1" title={`${fmtInt(meso)} per person, per clear`}>
            {fmtMeso(meso)}
            <span className="text-xs text-ink-3 @[21rem]:hidden"> per person</span>
          </span>
        </div>
      </div>
      {open && options.length > 1 && (
        <div role="group" aria-label={`${name} difficulty`} className="flex flex-wrap gap-1.5 pb-2.5 pl-5 text-xs">
          {options.map((d) => {
            const v = mesoPerClear(crystalValue(doc, prices, settings, a.bossId, d.key), Math.min(a.defaultPartySize, d.maxParty ?? 6));
            const under = c.level != null && (d.minLevel ?? 0) > c.level;
            return (
              <Chip key={d.key} on={d.key === a.difficulty} onClick={() => setDifficulty(d.key)}>
                <span className={`font-medium ${diffTone(d.key)}`}>{titleCase(d.key)}</span>
                <span className="text-ink-2 tabular">{fmtMeso(v)}</span>
                {d.minLevel ? <span className={under ? 'text-warn' : 'text-ink-3'}>Lv {d.minLevel}</span> : null}
              </Chip>
            );
          })}
        </div>
      )}
    </>
  );
}
