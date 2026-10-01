import { fmtInt, fmtMeso } from '../../../app/format';
import type { BossPreset } from '../../../lib/types';
import { presetMeso } from '../lib';
import { useLadder } from './context';
import { laneLook, plural, type LadderChar } from './model';
import { Count, StepBadge, Tag } from './bits';
import { BossList } from './BossList';
import { CharCard } from './CharCard';
import { Ghost } from './Ghost';

/** One rung of the ladder: a preset and the characters on it. */
export function Lane({ preset, step }: { preset: BossPreset; step: number }) {
  const L = useLadder();
  const members = L.chars.filter((c) => c.rung === preset.id);
  const { doc, prices, settings } = L.pricing;
  const meso = presetMeso(preset, doc, prices, settings);

  return (
    <section aria-label={`Rung ${step}: ${preset.name}${preset.main ? ' (Main)' : ''}, ${plural(members.length, 'character')}`} {...L.dropTarget(preset.id)} className={`relative flex min-w-0 flex-col rounded-xl border transition-colors ${laneLook(!!L.drag, L.over === preset.id)}`}>
      <header className="flex flex-col gap-1 border-b border-border px-2.5 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          <StepBadge n={step} />
          {preset.main && <Tag tone="accent">Main</Tag>}
          <span className="ml-auto">
            <Count n={members.length} />
          </span>
        </div>
        <h3 className="text-sm font-semibold break-words @[24rem]:min-h-10">{preset.name}</h3>
        <div className="flex items-baseline gap-1" title={`${fmtInt(meso)} per character a week, if every boss is cleared`}>
          <span className="text-sm font-semibold tabular">{fmtMeso(meso)}</span>
          <span className="text-[11px] text-ink-3">/ week each</span>
        </div>
        <BossList preset={preset} step={step} />
        {L.selectMode && members.length > 0 && <PickAll rung={preset.id} chars={members} />}
      </header>
      <div className="relative flex-1">
        <Ghost to={preset.id} />
        <Cards chars={members} empty="Drop a character here" />
      </div>
    </section>
  );
}

export function Cards({ chars, empty }: { chars: LadderChar[]; empty?: string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(8.25rem,100%),1fr))] content-start gap-1.5 p-1.5">
      {chars.map((c) => (
        <CharCard key={c.name} c={c} />
      ))}
      {!chars.length && empty && <div className="col-span-full flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border-2 p-2 text-center text-xs text-ink-3 sm:min-h-18">{empty}</div>}
    </div>
  );
}

/** Select mode: check every character on a rung at once. */
export function PickAll({ rung, chars }: { rung: string; chars: LadderChar[] }) {
  const L = useLadder();
  const all = chars.every((c) => L.picked.includes(c.name));
  return (
    <span className="text-xs">
      <button type="button" onClick={() => L.pickRung(rung)} className="btn btn-sm w-full justify-center">
        {all ? 'Unselect all' : `Select all ${chars.length}`}
      </button>
    </span>
  );
}
