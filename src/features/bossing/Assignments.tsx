import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { Card, Empty, PageHeader, Stepper, Field, Badge } from '../../app/ui';
import { fmtMeso } from '../../app/format';
import { uid, type Assignment } from '../../lib/types';
import { assignmentMeso, bossLabel, crystalValue, mesoPerClear, visibleCharacters } from './lib';

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
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('weekly');
  const [party, setParty] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newChar, setNewChar] = useState('');

  const boss = bosses?.bosses.find((b) => b.id === bossId);
  const diff = boss?.difficulties.find((d) => d.key === difficulty);
  const mine = useMemo(() => assignments.filter((a) => a.character === character).sort((a, b) => a.order - b.order), [assignments, character]);
  const already = mine.some((a) => a.bossId === bossId && a.difficulty === difficulty);

  const pickBoss = (id: string) => {
    setBossId(id);
    const b = bosses?.bosses.find((x) => x.id === id);
    const d = b?.difficulties[b.difficulties.length - 1];
    setDifficulty(d?.key ?? '');
    setCadence(d?.cadence === 'monthly' ? 'monthly' : 'weekly');
  };
  const pickDiff = (key: string) => {
    setDifficulty(key);
    const d = boss?.difficulties.find((x) => x.key === key);
    setCadence(d?.cadence === 'monthly' ? 'monthly' : 'weekly');
  };

  const add = () => {
    if (!character || !boss || !diff || already) return;
    const a: Assignment = { id: uid(), character, bossId, difficulty, cadence, defaultPartySize: party, order: mine.length ? Math.max(...mine.map((m) => m.order)) + 1 : 0 };
    void setAssignments([...assignments, a]);
  };
  const remove = (id: string) => void setAssignments(assignments.filter((a) => a.id !== id));
  const update = (id: string, patch: Partial<Assignment>) => void setAssignments(assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = mine.map((a) => a.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const order = new Map(ids.map((id, i) => [id, i]));
    void setAssignments(assignments.map((a) => (order.has(a.id) ? { ...a, order: order.get(a.id)! } : a)));
  };

  const addCharacter = () => {
    const n = newChar.trim();
    if (!n || names.includes(n)) return;
    void saveSettings({ extraCharacters: [...settings.extraCharacters, n] });
    setCharacter(n);
    setNewChar('');
  };

  if (!bosses) return <Empty title="Boss list missing">public/bosses.json could not be loaded.</Empty>;

  const total = mine.reduce((n, a) => n + assignmentMeso(a, bosses, prices, settings) / (a.cadence === 'monthly' ? 4.345 : 1), 0);

  return (
    <>
      <PageHeader title="Assignments" subtitle={`Crystal values ${bosses.version ?? ''} as of ${bosses.asOf}${settings.heroic ? ' · Heroic ×5 applied' : ''}. Override any value in Settings.`} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {names.map((n) => (
          <button key={n} className={character === n ? 'chip-on' : 'chip'} onClick={() => setCharacter(n)}>
            {n}
            {assignments.some((a) => a.character === n) && <span className="ml-1.5 text-ink-3">{assignments.filter((a) => a.character === n).length}</span>}
          </button>
        ))}
        <span className="inline-flex items-center gap-1">
          <input className="input w-36 py-0.5 text-xs" placeholder="Add character…" value={newChar} onChange={(e) => setNewChar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCharacter()} />
          <button className="btn btn-sm" onClick={addCharacter} disabled={!newChar.trim()}>
            Add
          </button>
        </span>
      </div>

      {!character ? (
        <Empty title="Add a character first">Characters come from data/characters.json, or add one by name above for the ledger only.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card title={`Add a boss for ${character}`}>
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
                      <button key={d.key} className={difficulty === d.key ? 'chip-on' : 'chip'} onClick={() => pickDiff(d.key)}>
                        {d.key} <span className="ml-1 text-ink-3">{d.minLevel ? `${d.minLevel}+` : ''}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {diff && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cadence" hint={diff.cadence === 'daily' ? 'Daily boss: tracked once per week.' : undefined}>
                      <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value as 'weekly' | 'monthly')}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
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
                    {already ? 'Already assigned' : 'Add to checklist'}
                  </button>
                </>
              )}
            </div>
          </Card>

          <Card title={`${character} · ${mine.length} boss${mine.length === 1 ? '' : 'es'}`} action={<span className="text-xs text-ink-2 tabular">≈ {fmtMeso(total)} / week</span>}>
            {mine.length === 0 ? (
              <div className="text-sm text-ink-3 py-8 text-center">Nothing assigned yet.</div>
            ) : (
              <ul className="divide-y divide-border -mx-4">
                {mine.map((a) => (
                  <li
                    key={a.id}
                    draggable
                    onDragStart={() => setDragId(a.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dragId && reorder(dragId, a.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`flex items-center gap-3 px-4 py-2 ${dragId === a.id ? 'opacity-40' : ''}`}
                  >
                    <span className="cursor-grab text-ink-3 select-none" title="Drag to reorder">
                      ⋮⋮
                    </span>
                    <span className="flex-1 text-sm">
                      {bossLabel(bosses, a.bossId, a.difficulty)} {a.cadence === 'monthly' && <Badge>monthly</Badge>}
                    </span>
                    <select className="input w-auto py-0.5 text-xs" value={a.cadence} onChange={(e) => update(a.id, { cadence: e.target.value as 'weekly' | 'monthly' })}>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                    </select>
                    <Stepper value={a.defaultPartySize} onChange={(v) => update(a.id, { defaultPartySize: v })} />
                    <span className="w-20 text-right text-sm tabular text-ink-2">{fmtMeso(assignmentMeso(a, bosses, prices, settings))}</span>
                    <button className="btn-ghost btn-sm" onClick={() => remove(a.id)} aria-label="Remove">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
