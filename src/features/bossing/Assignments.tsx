import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { Card, Empty, PageHeader, Stepper, Field, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { uid, type Assignment } from '../../lib/types';
import { assignmentMeso, bossLabel, cadenceFor, crystalValue, findBoss, mesoPerClear, presetAssignments, visibleCharacters } from './lib';
import { CharacterPicker } from './CharacterPicker';

export function Assignments() {
  const bosses = useStore((s) => s.bosses);
  const assignments = useStore((s) => s.assignments);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const setAssignments = useStore((s) => s.setAssignments);
  const saveSettings = useStore((s) => s.saveSettings);
  const names = visibleCharacters(useCharacterNames(), settings);
  const [character, setCharacter] = useState<string>(names[0] ?? '');
  const [bossId, setBossId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [party, setParty] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newChar, setNewChar] = useState('');
  const [applyTo, setApplyTo] = useState<'one' | 'all'>('one');

  const boss = findBoss(bosses, bossId);
  const diff = boss?.difficulties.find((d) => d.key === difficulty);
  const mine = useMemo(() => assignments.filter((a) => a.character === character).sort((a, b) => a.order - b.order), [assignments, character]);
  const already = mine.some((a) => a.bossId === bossId && a.difficulty === difficulty);

  const pickBoss = (id: string) => {
    setBossId(id);
    const b = findBoss(bosses, id);
    setDifficulty(b?.difficulties[b.difficulties.length - 1]?.key ?? '');
  };

  const add = () => {
    if (!character || !boss || !diff || already) return;
    const a: Assignment = { id: uid(), character, bossId, difficulty, cadence: cadenceFor(bosses, bossId, difficulty), defaultPartySize: party, order: mine.length ? Math.max(...mine.map((m) => m.order)) + 1 : 0 };
    void setAssignments([...assignments, a]);
  };
  const remove = (id: string) => void setAssignments(assignments.filter((a) => a.id !== id));
  const update = (id: string, patch: Partial<Assignment>) => void setAssignments(assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const changeDifficulty = (a: Assignment, key: string) => {
    if (mine.some((x) => x.id !== a.id && x.bossId === a.bossId && x.difficulty === key)) return;
    update(a.id, { difficulty: key, cadence: cadenceFor(bosses, a.bossId, key) });
  };
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = mine.map((a) => a.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const order = new Map(ids.map((id, i) => [id, i]));
    void setAssignments(assignments.map((a) => (order.has(a.id) ? { ...a, order: order.get(a.id)! } : a)));
  };
  const applyPreset = (presetId: string) => {
    const preset = bosses?.presets?.find((p) => p.id === presetId);
    if (!preset) return;
    const targets = applyTo === 'all' ? names : [character];
    let next = assignments;
    for (const c of targets) next = [...next, ...presetAssignments(preset, c, next, bosses)];
    void setAssignments(next);
  };
  const clearCharacter = () => {
    if (!confirm(`Remove all ${mine.length} assignments for ${character}? Recorded clears are kept.`)) return;
    void setAssignments(assignments.filter((a) => a.character !== character));
  };

  const addCharacter = () => {
    const n = newChar.trim();
    if (!n || names.includes(n)) return;
    void saveSettings({ extraCharacters: [...settings.extraCharacters, n] });
    setCharacter(n);
    setNewChar('');
  };

  if (!bosses) return <Empty title="Boss list missing">public/bosses.json could not be loaded.</Empty>;

  const weekly = mine.filter((a) => a.cadence === 'weekly');
  const monthly = mine.filter((a) => a.cadence === 'monthly');
  const total = mine.reduce((n, a) => n + assignmentMeso(a, bosses, prices, settings) / (a.cadence === 'monthly' ? 4.345 : 1), 0);

  const row = (a: Assignment) => {
    const b = findBoss(bosses, a.bossId);
    return (
      <li
        key={a.id}
        draggable
        onDragStart={() => setDragId(a.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dragId && reorder(dragId, a.id)}
        onDragEnd={() => setDragId(null)}
        className={`flex flex-wrap items-center gap-2 px-4 py-2 ${dragId === a.id ? 'opacity-40' : ''}`}
      >
        <span className="cursor-grab text-ink-3 select-none" title="Drag to reorder">
          ⋮⋮
        </span>
        <span className="flex-1 min-w-32 text-sm">{b?.name ?? a.bossId}</span>
        <select className="input w-auto py-0.5 text-xs" value={a.difficulty} onChange={(e) => changeDifficulty(a, e.target.value)} title="Difficulty">
          {(b?.difficulties ?? [{ key: a.difficulty, crystal: 0, cadence: 'weekly' as const }]).map((d) => (
            <option key={d.key} value={d.key}>
              {d.key}
              {d.minLevel ? ` · ${d.minLevel}+` : ''}
              {d.cadence === 'monthly' ? ' · monthly' : ''}
            </option>
          ))}
        </select>
        <Stepper value={a.defaultPartySize} onChange={(v) => update(a.id, { defaultPartySize: v })} />
        <span className="w-20 text-right text-sm tabular text-ink-2">{fmtMeso(assignmentMeso(a, bosses, prices, settings))}</span>
        <button className="btn-ghost btn-sm" onClick={() => remove(a.id)} aria-label="Remove">
          ✕
        </button>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Assignments" subtitle={`Crystal values ${bosses.version ?? ''} as of ${bosses.asOf}${settings.heroic ? ' · Heroic ×5 applied' : ''}. Change a boss's difficulty from its dropdown; only Black Mage is monthly; everything else is weekly.`} />
      <div className="card p-3 mb-4">
        <CharacterPicker selected={character || null} onSelect={(n) => setCharacter(n ?? '')} />
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <span className="text-xs text-ink-3">Drag a character onto a group to apply that preset. Ledger-only character:</span>
          <input className="input w-40 py-0.5 text-xs" placeholder="Name…" value={newChar} onChange={(e) => setNewChar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCharacter()} />
          <button className="btn btn-sm" onClick={addCharacter} disabled={!newChar.trim()}>
            Add
          </button>
        </div>
      </div>

      {!character ? (
        <Empty title="Pick a character">Click a tile above to edit its bosses. Characters come from data/characters.json, or add one by name for the ledger only.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-4">
            {bosses.presets && bosses.presets.length > 0 && (
              <Card title="Presets">
                <div className="space-y-3">
                  {bosses.presets.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-ink-3">
                          {p.entries.map((e) => bossLabel(bosses, e.bossId, e.difficulty)).join(', ')}
                        </div>
                      </div>
                      <button className="btn btn-sm shrink-0" onClick={() => applyPreset(p.id)}>
                        Apply
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs text-ink-2 pt-1 border-t border-border">
                    Apply to
                    <button className={applyTo === 'one' ? 'chip-on' : 'chip'} onClick={() => setApplyTo('one')}>
                      {character}
                    </button>
                    <button className={applyTo === 'all' ? 'chip-on' : 'chip'} onClick={() => setApplyTo('all')}>
                      all {names.length} characters
                    </button>
                  </div>
                  <div className="text-xs text-ink-3">Bosses already assigned are skipped, so applying twice is safe.</div>
                </div>
              </Card>
            )}
            <Card title={`Add a single boss for ${character}`}>
              <div className="space-y-3">
                <Field label="Boss">
                  <select className="input" value={bossId} onChange={(e) => pickBoss(e.target.value)}>
                    <option value="">Choose…</option>
                    {bosses.bosses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {boss && (
                  <Field label="Difficulty">
                    <div className="flex flex-wrap gap-1.5">
                      {boss.difficulties.map((d) => (
                        <button key={d.key} className={difficulty === d.key ? 'chip-on' : 'chip'} onClick={() => setDifficulty(d.key)}>
                          {d.key} <span className="ml-1 text-ink-3">{d.minLevel ? `${d.minLevel}+` : ''}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                {diff && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tracker">
                        <div className="pt-1.5 text-sm">{diff.cadence === 'monthly' ? <Badge>monthly</Badge> : <Badge>weekly{diff.cadence === 'daily' ? ' (daily boss)' : ''}</Badge>}</div>
                      </Field>
                      <Field label="Party size">
                        <div className="pt-1">
                          <Stepper value={party} onChange={setParty} />
                        </div>
                      </Field>
                    </div>
                    <div className="text-sm text-ink-2">
                      Crystal <span className="text-ink tabular">{fmtMeso(crystalValue(bosses, prices, settings, bossId, difficulty))}</span> → <span className="text-accent tabular">{fmtMeso(mesoPerClear(crystalValue(bosses, prices, settings, bossId, difficulty), party))}</span> per clear
                    </div>
                    <button className="btn-accent" onClick={add} disabled={already}>
                      {already ? 'Already assigned' : 'Add to tracker'}
                    </button>
                  </>
                )}
              </div>
            </Card>
          </div>

          <Card
            title={`${character} · ${weekly.length} weekly · ${monthly.length} monthly`}
            action={
              <span className="flex items-center gap-3">
                <span className="text-xs text-ink-2 tabular">≈ {fmtMeso(total)} / week</span>
                {mine.length > 0 && (
                  <button className="btn-ghost btn-sm" onClick={clearCharacter}>
                    Clear all
                  </button>
                )}
              </span>
            }
          >
            {mine.length === 0 ? (
              <div className="text-sm text-ink-3 py-8 text-center">Nothing assigned yet. Apply a preset or add bosses one by one.</div>
            ) : (
              <div className="-mx-4">
                <div className="label px-4 pb-1">Weekly · {weekly.length > settings.crystalCap && <span className="text-warn normal-case tracking-normal">more than the {settings.crystalCap}-crystal cap</span>}</div>
                <ul className="divide-y divide-border border-y border-border">{weekly.map(row)}</ul>
                <div className="label px-4 pt-4 pb-1">Monthly</div>
                <ul className="divide-y divide-border border-y border-border">
                  {monthly.length ? monthly.map(row) : <li className="px-4 py-2 text-xs text-ink-3">No monthly bosses. Add Hard or Extreme Black Mage.</li>}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
