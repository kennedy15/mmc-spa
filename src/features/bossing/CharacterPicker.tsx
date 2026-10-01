import { useMemo, useState } from 'react';
import { useStore, mainCharacterName } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { latestRow, lookImageUrl } from '../../lib/nexon/snapshots';
import { clearFor, currentPeriods, presetOf, visibleCharacters, weeklyOf } from './lib';

type GroupId = string; // preset id | 'custom' | 'none'

interface TileInfo {
  name: string;
  img: string | null;
  level: number | null;
  group: GroupId;
  /** Every assigned boss, weekly and monthly. */
  assigned: number;
  /** Weekly bosses cleared this reset week / assigned. */
  done: number;
  total: number;
  complete: boolean;
  /** Monthly bosses cleared this month / assigned, tracked apart from the week. */
  monthDone: number;
  monthTotal: number;
}

/** "1 weekly boss", "3 weekly bosses". */
const weeklyBosses = (n: number) => `${n} weekly ${n === 1 ? 'boss' : 'bosses'}`;

export function CharacterPicker({ selected, onSelect, draggable = true }: { selected: string | null; onSelect: (name: string | null) => void; draggable?: boolean }) {
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const clears = useStore((s) => s.clears);
  const settings = useStore((s) => s.settings);
  const snapshots = useStore((s) => s.snapshots);
  const looks = useStore((s) => s.looks);
  const characters = useStore((s) => s.characters);
  const switchPreset = useStore((s) => s.switchPreset);
  const appliedPresets = useStore((s) => s.appliedPresets);
  const names = visibleCharacters(useCharacterNames(), settings);
  const main = mainCharacterName({ characters, snapshots });
  const presets = useStore((s) => s.presets);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<GroupId | null>(null);

  const tiles = useMemo(() => {
    const periods = currentPeriods();
    return names.map((name): TileInfo => {
      const mine = assignments.filter((a) => a.character === name);
      const weekly = mine.filter((a) => a.cadence === 'weekly');
      const monthly = mine.filter((a) => a.cadence === 'monthly');
      const done = weekly.filter((a) => clearFor(clears, a, periods.weekly)).length;
      const monthDone = monthly.filter((a) => clearFor(clears, a, periods.monthly)).length;
      const row = latestRow(snapshots, name);
      const hash = row?.lookHash ?? looks[name]?.[looks[name].length - 1]?.hash ?? null;
      return { name, img: hash ? lookImageUrl(name, hash) : (row?.imgUrl ?? null), level: row?.level ?? null, group: presetOf(name, appliedPresets, presets, assignments, bosses).preset?.id ?? (weeklyOf(assignments, name).length ? 'custom' : 'none'), assigned: mine.length, done, total: weekly.length, complete: weekly.length > 0 && done === weekly.length, monthDone, monthTotal: monthly.length };
    });
  }, [names, assignments, clears, snapshots, looks, presets, appliedPresets, bosses]);

  const groups: { id: GroupId; label: string; hint: string }[] = [
    ...presets.map((p) => ({ id: p.id, label: p.name, hint: `drop here to apply ${p.name}` })),
    { id: 'custom', label: 'No preset', hint: 'own boss list' },
    { id: 'none', label: 'No bosses', hint: 'drop here to clear weekly bosses' },
  ];

  const move = (name: string, to: GroupId) => {
    const tile = tiles.find((t) => t.name === name);
    if (!tile || tile.group === to || to === 'custom') return;
    const weekly = weeklyOf(assignments, name).length;
    if (to === 'none') {
      if (weekly && !confirm(`Remove ${name}'s ${weeklyBosses(weekly)}? Monthly bosses and recorded clears are kept.`)) return;
      void switchPreset([name], null);
      return;
    }
    const preset = presets.find((p) => p.id === to);
    if (!preset) return;
    if (weekly && !confirm(`Replace ${name}'s ${weeklyBosses(weekly)} with the ${preset.name} preset? Monthly bosses and recorded clears are kept.`)) return;
    void switchPreset([name], preset.id);
  };

  return (
    <div className="space-y-1.5">
      {groups.map((g) => {
        const members = tiles.filter((t) => t.group === g.id);
        const canDrop = draggable && dragging != null && g.id !== 'custom' && tiles.find((t) => t.name === dragging)?.group !== g.id;
        return (
          <div
            key={g.id}
            className={`rounded-xl border border-dashed px-3 transition-colors ${over === g.id && canDrop ? 'border-accent bg-accent/5' : canDrop ? 'border-border-2' : 'border-transparent'} ${members.length === 0 && !canDrop ? 'py-1' : 'py-2'}`}
            onDragOver={(e) => {
              if (!canDrop) return;
              e.preventDefault();
              setOver(g.id);
            }}
            onDragLeave={() => setOver((o) => (o === g.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging && canDrop) move(dragging, g.id);
              setDragging(null);
              setOver(null);
            }}
          >
            <div className={`flex flex-wrap items-baseline gap-x-2 ${members.length || canDrop ? 'mb-1.5' : ''}`}>
              <span className="label">{g.label}</span>
              <span className="text-[11px] text-ink-3 tabular">{members.length}</span>
              {(canDrop || members.length === 0) && <span className="text-[11px] text-ink-3">· {g.hint}</span>}
            </div>
            <div className={`flex flex-wrap gap-2 ${canDrop ? 'min-h-8' : ''}`}>
              {members.map((t) => {
                const on = t.name === selected;
                const pct = t.total ? (t.done / t.total) * 100 : 0;
                return (
                  <button
                    key={t.name}
                    draggable={draggable}
                    onDragStart={(e) => {
                      setDragging(t.name);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onClick={() => onSelect(on ? null : t.name)}
                    title={t.assigned ? [t.total ? `${t.done}/${t.total} weekly cleared this week` : 'no weekly bosses', t.monthTotal ? `${t.monthDone}/${t.monthTotal} monthly cleared this month` : ''].filter(Boolean).join(' · ') : 'No bosses assigned'}
                    className={`relative overflow-hidden flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg border text-sm transition-colors ${
                      t.complete ? 'border-good bg-good/10' : on ? 'border-accent bg-accent/10' : 'border-border-2 bg-surface-2 hover:border-ink-3'
                    } ${on ? 'ring-2 ring-accent/40' : ''} ${dragging === t.name ? 'opacity-40' : ''}`}
                  >
                    <span className="size-6 rounded-md bg-surface-3 overflow-hidden flex items-end justify-center shrink-0">
                      {t.img ? <img src={t.img} alt="" className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} loading="lazy" /> : <span className="text-[10px] text-ink-3">{t.name.slice(0, 2)}</span>}
                    </span>
                    <span className={`font-medium ${on ? 'text-accent' : t.complete ? 'text-good' : ''}`}>
                      {t.name}
                      {t.name === main && <span className="text-accent ml-0.5" title="Main">★</span>}
                    </span>
                    <span className={`text-[11px] tabular ${t.complete ? 'text-good' : 'text-ink-3'}`}>{t.total ? `${t.done}/${t.total}` : '–'}</span>
                    {t.monthTotal > 0 && (
                      <span className={`rounded border px-1 text-[10px] leading-4 ${t.monthDone === t.monthTotal ? 'border-good/50 text-good' : 'border-border-2 text-ink-3'}`} aria-label={`Monthly ${t.monthDone} of ${t.monthTotal}`}>
                        M{t.monthTotal > 1 ? ` ${t.monthDone}/${t.monthTotal}` : ''}
                      </span>
                    )}
                    {t.total > 0 && (
                      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-surface-3">
                        <span className={`block h-full ${t.complete ? 'bg-good' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
