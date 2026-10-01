import { useState } from 'react';
import { useStore } from '../../../store';
import { useCharacterNames } from '../../tracker/hooks';
import { useLadder } from './context';
import { TRAY, laneLook, plural, type LadderChar } from './model';
import { Count } from './bits';
import { Cards, PickAll } from './Lane';
import { Ghost } from './Ghost';

/**
 * Characters on no preset. "Own list" holds weekly lists made by hand (lists
 * from before presets land here until they're moved onto a rung); "No bosses"
 * holds the rest. Dropping a character here clears its weekly bosses.
 */
export function Tray() {
  const L = useLadder();
  const members = L.chars.filter((c) => c.rung === TRAY);
  const own = members.filter((c) => c.weekly.length);
  const none = members.filter((c) => !c.weekly.length);

  return (
    <section aria-label={`No preset, ${plural(members.length, 'character')}`} {...L.dropTarget(TRAY)} className={`relative flex min-w-0 flex-col rounded-xl border transition-colors ${laneLook(!!L.drag, L.over === TRAY)}`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 pt-2.5 pb-1">
        <h3 className="text-sm font-semibold">No preset</h3>
        <Count n={members.length} />
        <span className="min-w-0 flex-[1_1_16rem] text-xs text-ink-3">Drop a character here to clear its weekly bosses. Recorded clears are kept.</span>
        {L.selectMode && members.length > 0 && (
          <span className="w-32">
            <PickAll rung={TRAY} chars={members} />
          </span>
        )}
      </header>
      <div className="relative min-h-16 px-1.5 pb-1.5">
        <Ghost to={TRAY} />
        {own.length > 0 && <Group label="Own list" hint="weekly bosses picked by hand" chars={own} />}
        {none.length > 0 && <Group label="No bosses" chars={none} />}
        {!members.length && <div className="m-1.5 flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border-2 p-2 text-center text-xs text-ink-3">Everyone is on a preset.</div>}
      </div>
      <LedgerAdd />
    </section>
  );
}

function Group({ label, hint, chars }: { label: string; hint?: string; chars: LadderChar[] }) {
  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-baseline gap-x-2 px-1.5">
        <span className="label">{label}</span>
        <span className="text-[11px] text-ink-3 tabular">
          {chars.length}
          {hint && ` · ${hint}`}
        </span>
      </div>
      <Cards chars={chars} />
    </div>
  );
}

/** Adds a name the tracker doesn't follow, for the boss ledger only (kept in settings). */
function LedgerAdd() {
  const L = useLadder();
  const settings = useStore((s) => s.settings);
  const saveSettings = useStore((s) => s.saveSettings);
  const all = useCharacterNames();
  const [name, setName] = useState('');
  const n = name.trim();
  const taken = all.includes(n);

  const add = () => {
    if (!n || taken) return;
    void saveSettings({ extraCharacters: [...settings.extraCharacters, n] });
    if (!L.selectMode) L.select(n);
    setName('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-xs">
      <label htmlFor="ledger-only" className="text-ink-3">
        Ledger-only character
      </label>
      <input id="ledger-only" className="input w-40 py-0.5 text-xs" placeholder="Name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <button type="button" className="btn btn-sm" onClick={add} disabled={!n || taken} title={taken ? `${n} is already on the list` : undefined}>
        Add
      </button>
      {taken && <span className="text-ink-3">{n} is already on the list{settings.hiddenCharacters.includes(n) ? ' (hidden in Settings)' : ''}.</span>}
    </div>
  );
}
