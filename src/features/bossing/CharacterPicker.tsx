import { useMemo, useState } from 'react';
import { useStore, mainCharacterName } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { latestRow, lookImageUrl } from '../../lib/nexon/snapshots';
import type { Assignment, BossPreset } from '../../lib/types';
import { clearFor, currentPeriods, presetAssignments, visibleCharacters } from './lib';

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

/** Most specific preset whose entries are all assigned to the character, else custom / none. */
function groupOf(mine: Assignment[], presets: BossPreset[]): GroupId {
  if (!mine.length) return 'none';
  const have = new Set(mine.map((a) => `${a.bossId}:${a.difficulty}`));
  const match = presets.filter((p) => p.entries.every((e) => have.has(`${e.bossId}:${e.difficulty}`))).sort((a, b) => b.entries.length - a.entries.length)[0];
  return match?.id ?? 'custom';
}

export function CharacterPicker({ selected, onSelect, draggable = true }: { selected: string | null; onSelect: (name: string | null) => void; draggable?: boolean }) {
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const clears = useStore((s) => s.clears);
  const settings = useStore((s) => s.settings);
  const snapshots = useStore((s) => s.snapshots);
  const looks = useStore((s) => s.looks);
  const characters = useStore((s) => s.characters);
  const setAssignments = useStore((s) => s.setAssignments);
  const names = visibleCharacters(useCharacterNames(), settings);
  const main = mainCharacterName({ characters, snapshots });
  const presets = useMemo(() => bosses?.presets ?? [], [bosses]);
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
      return { name, img: hash ? lookImageUrl(name, hash) : (row?.imgUrl ?? null), level: row?.level ?? null, group: groupOf(mine, presets), assigned: mine.length, done, total: weekly.length, complete: weekly.length > 0 && done === weekly.length, monthDone, monthTotal: monthly.length };
    });
  }, [names, assignments, clears, snapshots, looks, presets]);

  const groups: { id: GroupId; label: string; hint: string }[] = [
    ...presets.map((p) => ({ id: p.id, label: p.name, hint: `drop here to apply ${p.name}` })),
    { id: 'custom', label: 'Custom', hint: 'hand-picked bosses' },
    { id: 'none', label: 'No preset', hint: 'drop here to clear all bosses' },
  ];

  const move = (name: string, to: GroupId) => {
    const tile = tiles.find((t) => t.name === name);
    if (!tile || tile.group === to || to === 'custom') return;
    const others = assignments.filter((a) => a.character !== name);
    if (to === 'none') {
      if (tile.assigned && !confirm(`Remove all ${tile.assigned} bosses from ${name}? Recorded clears are kept.`)) return;
      void setAssignments(others);
      return;
    }
    const preset = presets.find((p) => p.id === to);
    if (!preset) return;
    if (tile.assigned && !confirm(`Replace ${name}'s ${tile.assigned} bosses with the ${preset.name} preset? Recorded clears are kept.`)) return;
    void setAssignments([...others, ...presetAssignments(preset, name, others, bosses)]);
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
            <div className={`flex items-baseline gap-2 ${members.length || canDrop ? 'mb-1.5' : ''}`}>
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
