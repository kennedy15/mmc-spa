import { useStore } from '../../../store';
import { fmtInt, fmtMeso, titleCase } from '../../../app/format';
import type { PresetEntry } from '../../../lib/types';
import { crystalValue, entryParty, maxParty, mesoPerClear } from '../lib';
import type { BoardBoss } from './board';

interface Props extends BoardBoss {
  /** The boss's place in the preset, or undefined when it's off. */
  entry: PresetEntry | undefined;
  /** Switching it on was refused: the preset already uses every crystal. */
  blocked: boolean;
  cap: number;
  onPick: (difficulty: string | null) => void;
  onParty: (party: number) => void;
}

/** One boss on the board: Off or a difficulty, the party size, and what each person makes per clear. */
export function BossTile({ boss, difficulties, entry, blocked, cap, onPick, onParty }: Props) {
  const doc = useStore((s) => s.bosses);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  // A difficulty that isn't weekly (from older data) still shows, so it can be seen and changed.
  const options = entry && !difficulties.some((d) => d.key === entry.difficulty) ? [...difficulties, ...boss.difficulties.filter((d) => d.key === entry.difficulty)] : difficulties;
  const current = entry ? options.find((d) => d.key === entry.difficulty) : undefined;
  const party = entry ? entryParty(doc, entry) : 1;
  const max = entry ? maxParty(doc, boss.id, entry.difficulty) : 1;
  const share = (key: string, p: number) => mesoPerClear(crystalValue(doc, prices, settings, boss.id, key), p);
  const meso = entry ? share(entry.difficulty, party) : 0;
  const level = current ? current.minLevel : Math.min(...options.map((d) => d.minLevel ?? 0));

  const tone = blocked ? 'border-warn/40 bg-warn/10' : entry ? 'border-border-2 bg-surface-2' : 'border-border';
  // An off tile fades its name, meso and party; the difficulty control stays readable, as it is how the boss goes on.
  const fade = entry ? '' : 'opacity-60 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100';
  return (
    <div className={`group/tile min-w-0 flex flex-col gap-1.5 rounded-lg border p-2.5 transition-[background-color,border-color] ${tone}`}>
      <div className={`flex items-baseline justify-between gap-2 min-w-0 transition-opacity ${fade}`}>
        <span className={`truncate text-sm font-semibold ${entry ? 'text-ink' : 'text-ink-2'}`} title={boss.name}>
          {boss.name}
        </span>
        <span className={`shrink-0 text-sm font-semibold tabular ${entry ? 'text-ink' : 'text-ink-3'}`} title={entry ? `${fmtInt(meso)} per person per clear` : `${boss.name} is off`}>
          {entry ? fmtMeso(meso) : '—'}
        </span>
      </div>
      <div className={`flex items-center justify-between gap-2 min-w-0 h-[26px] transition-opacity ${fade}`}>
        <span className="truncate text-xs text-ink-3">{level ? `Lv ${level}+` : ''}</span>
        <PartyStepper name={boss.name} value={party} max={max} disabled={!entry} onChange={onParty} />
      </div>
      <div role="group" aria-label={`${boss.name} difficulty`} className="flex gap-0.5 rounded-lg border border-border-2 p-0.5 text-xs">
        <Pill on={!entry} quiet label="Off" title={entry ? `Switch ${boss.name} off` : `${boss.name} is off`} onClick={() => onPick(null)} />
        {options.map((d) => {
          const p = Math.min(party, d.maxParty ?? 6);
          return <Pill key={d.key} on={d.key === entry?.difficulty} label={titleCase(d.key)} title={`${titleCase(d.key)} ${boss.name} · Lv ${d.minLevel ?? '?'}+ · ${fmtMeso(share(d.key, p))} per person${p > 1 ? ` in a party of ${p}` : ''}`} onClick={() => onPick(d.key)} />;
        })}
      </div>
      {blocked && (
        <p role="alert" className="text-xs text-warn">
          All {cap} crystals are used. Switch a boss off to add {boss.name}.
        </p>
      )}
    </div>
  );
}

/** One choice of the difficulty control. `quiet`: Off, which stays a shade softer when picked so a board of off tiles reads calm. */
function Pill({ on, quiet, label, title, onClick }: { on: boolean; quiet?: boolean; label: string; title: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} title={title} onClick={onClick} className={`group flex-auto min-w-0 rounded-md px-1 py-0.5 whitespace-nowrap transition-colors cursor-pointer ${on ? 'bg-surface-3' : 'hover:bg-surface-3/50'}`}>
      <span className={on ? `font-medium ${quiet ? 'text-ink-2' : 'text-ink'}` : 'text-ink-3 group-hover:text-ink'}>{label}</span>
    </button>
  );
}

function PartyStepper({ name, value, max, disabled, onChange }: { name: string; value: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  const step = 'w-6 h-full grid place-items-center cursor-pointer hover:bg-surface-3 disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent';
  return (
    <span className={`flex items-center gap-1.5 shrink-0 ${disabled ? 'opacity-50' : ''}`} title={disabled ? 'Pick a difficulty first' : `Party of ${value}, up to ${max}`}>
      <span className="text-[11px] text-ink-3">Party</span>
      <span className="inline-flex items-center h-[26px] rounded-lg border border-border-2 overflow-hidden text-sm text-ink-2">
        <button type="button" className={step} aria-label={`Smaller ${name} party`} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className={`min-w-5 text-center tabular font-medium ${disabled ? 'text-ink-3' : 'text-ink'}`}>{value}</span>
        <button type="button" className={step} aria-label={`Bigger ${name} party`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </span>
    </span>
  );
}
