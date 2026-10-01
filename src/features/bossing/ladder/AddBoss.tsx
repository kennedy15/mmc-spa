import { useState } from 'react';
import { fmtMeso, titleCase } from '../../../app/format';
import { Stepper } from '../../../app/ui';
import { bossLabel, crystalValue, mesoPerClear } from '../lib';
import { useLadder } from './context';
import { diffTone, signed, weeklyDifficulties, withBoss, type LadderChar } from './model';
import { Chip, focusRing, ghostText } from './bits';
import { Close, Plus } from './icons';

/** Add one weekly boss by hand: boss, then difficulty, then party. Bosses already on the list aren't offered. */
export function AddBoss({ c }: { c: LadderChar }) {
  const L = useLadder();
  const { doc, prices, settings } = L.pricing;
  const [open, setOpen] = useState(false);
  const [bossId, setBossId] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [party, setParty] = useState(1);

  if (!open) {
    return (
      <span className="text-xs">
        <button type="button" onClick={() => setOpen(true)} className={`group btn-ghost btn-sm -ml-2 ${focusRing}`}>
          <span className={ghostText}>
            <Plus className="size-3" />
            Add a boss
          </span>
        </button>
      </span>
    );
  }

  const have = new Set(c.weekly.map((a) => a.bossId));
  const choices = doc.bosses.filter((b) => !have.has(b.id) && weeklyDifficulties(doc, b.id).length);
  const diffs = bossId && !have.has(bossId) ? weeklyDifficulties(doc, bossId) : [];
  const d = diffs.find((x) => x.key === key) ?? null;
  const cap = d?.maxParty ?? 6;
  const size = Math.min(party, cap);
  const meso = bossId && d ? mesoPerClear(crystalValue(doc, prices, settings, bossId, d.key), size) : 0;
  const n = c.weekly.length;
  const warn = [d && c.level != null && (d.minLevel ?? 0) > c.level && `Needs Lv ${d.minLevel}. ${c.name} is Lv ${c.level}.`, d && n >= settings.crystalCap && `${c.name} is at ${n}/${settings.crystalCap} crystals. One more won’t sell.`].filter(Boolean).join(' ');

  const close = () => {
    setOpen(false);
    setBossId(null);
    setKey(null);
    setParty(1);
  };
  const pickBoss = (id: string) => {
    const all = weeklyDifficulties(doc, id);
    const ok = all.filter((x) => c.level == null || (x.minLevel ?? 0) <= c.level);
    setBossId(id);
    setKey((ok[0] ?? all[0])?.key ?? null);
    setParty(1);
  };
  const add = () => {
    if (!bossId || !d) return;
    L.edit({ head: `Added ${bossLabel(doc, bossId, d.key)}`, text: `to ${c.name}’s weekly list · ${signed(meso)} / week` }, withBoss(L.assignments, c.name, bossId, d.key, size, doc));
    close();
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border-2 bg-surface-2 px-3 pt-2 pb-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Add one boss</span>
        <button type="button" onClick={close} aria-label="Close add a boss" className={`group inline-flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-surface-3 ${focusRing}`}>
          <Close className="size-3 text-ink-3 group-hover:text-ink" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="label">Boss</span>
        <div role="group" aria-label="Boss" className="flex flex-wrap gap-1.5 text-xs">
          {choices.map((b) => (
            <Chip key={b.id} on={bossId === b.id} onClick={() => pickBoss(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      </div>
      {diffs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="label">Difficulty</span>
          <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-1.5 text-xs">
            {diffs.map((x) => (
              <Chip key={x.key} on={key === x.key} onClick={() => setKey(x.key)}>
                <span className={`font-medium ${diffTone(x.key)}`}>{titleCase(x.key)}</span>
                {x.minLevel ? <span className={c.level != null && x.minLevel > c.level ? 'text-warn' : 'text-ink-3'}>Lv {x.minLevel}</span> : null}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {d && bossId && (
        <>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
            <span className="label">Party</span>
            <Stepper value={size} max={cap} onChange={setParty} />
            <span className="text-xs text-ink-2 tabular">{fmtMeso(meso)} per person per clear</span>
          </div>
          {warn && <span className="text-xs text-warn">{warn}</span>}
          <span className="text-sm">
            <button type="button" onClick={add} className={`btn ${focusRing}`}>
              <Plus className="size-3.5" />
              Add {bossLabel(doc, bossId, d.key)}
            </button>
          </span>
        </>
      )}
    </div>
  );
}
