import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { Empty, PageHeader } from '../../app/ui';
import type { AppliedPresets, Assignment, BossPreset } from '../../lib/types';
import { presetMeso, visibleCharacters } from './lib';
import { agree, boardBosses, cleanPreset, crystalsOf, nameList, nameProblem, newPresetId, plural, sameBosses, samePreset, uniqueName, withDifficulty, withParty, type BoardBoss } from './presetEditor/board';
import { Action, Ask, Icon, Switch, Toast, type ToastMsg } from './presetEditor/bits';
import { BossTile } from './presetEditor/BossTile';
import { Faces } from './presetEditor/Faces';
import { PresetStrip, type StripItem } from './presetEditor/PresetStrip';
import { SummaryBar } from './presetEditor/SummaryBar';

/** Where a click leads: a saved preset, or a new one (empty, started from a preset, or a duplicate placed right after it). */
type Target = { kind: 'preset'; id: string } | { kind: 'new'; from: string | null; duplicate?: boolean };

/** Edits not saved yet. A new preset gets its id when saved; `after` is the preset it goes behind (null: last). */
interface Draft {
  preset: BossPreset;
  isNew: boolean;
  after: string | null;
}

/** The one inline question open at a time. */
type Asking = { kind: 'leave'; then: Target } | { kind: 'users'; then?: Target; inStrip: boolean } | { kind: 'delete' } | { kind: 'reset' } | { kind: 'new' };

/** What a save, delete or reset replaced, for Undo. */
interface Before {
  presets: BossPreset[];
  edited: boolean;
  assignments: Assignment[];
  applied: AppliedPresets;
}

const before = (): Before => {
  const s = useStore.getState();
  return { presets: s.presets, edited: s.presetsEdited, assignments: s.assignments, applied: s.appliedPresets };
};

/** Puts the preset list back (an unedited list goes back to the defaults), and the characters' bosses when they changed too. */
async function restore(b: Before, bossing: { assignments?: boolean; applied?: boolean }) {
  const s = useStore.getState();
  await (b.edited ? s.savePresets(b.presets) : s.resetPresets());
  if (bossing.assignments || bossing.applied) await s.setBossing({ ...(bossing.assignments ? { assignments: b.assignments } : {}), ...(bossing.applied ? { appliedPresets: b.applied } : {}) });
}

/** "Jurni keeps…", "Jurni and Strom keep…": characters whose preset goes away. */
const keepOwn = (names: string[]) => `${nameList(names)} ${agree(names.length, 'keeps', 'keep')} their current bosses on their own list.`;

const insertIndex = (list: BossPreset[], after: string | null) => {
  const i = after ? list.findIndex((p) => p.id === after) : -1;
  return i >= 0 ? i + 1 : list.length;
};

export function Presets() {
  const bosses = useStore((s) => s.bosses);
  const presets = useStore((s) => s.presets);
  const presetsEdited = useStore((s) => s.presetsEdited);
  const applied = useStore((s) => s.appliedPresets);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const savePresets = useStore((s) => s.savePresets);
  const names = visibleCharacters(useCharacterNames(), settings);
  // #/bossing/presets?preset=<id> opens that preset (Assignments can link straight to one).
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState(() => params.get('preset') ?? presets[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  /** "More bosses" open or shut; null follows the preset (open when it uses one of them). */
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const board = useMemo(() => (bosses ? boardBosses(bosses) : null), [bosses]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!bosses || !board) return <Empty title="Boss list missing">public/bosses.json could not be loaded.</Empty>;

  const saved = presets.find((p) => p.id === selectedId) ?? presets[0] ?? null;
  const current = draft?.preset ?? saved;
  const isNew = !!draft?.isNew;
  const dirty = !!draft && (draft.isNew || !saved || !samePreset(draft.preset, saved, bosses));
  const usersOf = (id: string) => names.filter((n) => applied[n] === id);
  const users = current && !isNew ? usersOf(current.id) : [];
  const problem = current && dirty ? nameProblem(current.name, presets, isNew ? null : current.id) : null;
  const crystals = current ? crystalsOf(current, bosses) : 0;
  const has = (b: BoardBoss) => !!current?.entries.some((e) => e.bossId === b.boss.id);
  const olderOn = board.older.filter(has).length;
  const open = moreOpen ?? olderOn > 0;
  const item = (p: BossPreset): StripItem => ({ preset: p, crystals: crystalsOf(p, bosses), meso: presetMeso(p, bosses, prices, settings), users: usersOf(p.id) });
  const label = isNew ? 'The new preset' : (saved?.name ?? 'This preset');

  /** Open a preset or start a new one, dropping any draft. */
  const go = (t: Target, list = presets) => {
    setAsking(null);
    setBlocked(null);
    setMoreOpen(null);
    if (t.kind === 'preset') {
      setDraft(null);
      setSelectedId(t.id);
      return;
    }
    const from = list.find((p) => p.id === t.from) ?? null;
    const name = uniqueName(t.duplicate && from ? `${from.name} copy` : 'New preset', list);
    setDraft({ isNew: true, after: t.duplicate ? (from?.id ?? null) : null, preset: { id: '', name, ...(from?.main ? { main: true } : {}), entries: from ? from.entries.map((e) => ({ ...e })) : [] } });
  };
  /** Like go, but asks first when there are unsaved edits. */
  const request = (t: Target) => {
    if (t.kind === 'preset' && t.id === saved?.id && !isNew) return;
    if (dirty) setAsking({ kind: 'leave', then: t });
    else go(t);
  };

  const edit = (next: BossPreset) => {
    // Pin "More bosses" as it is, so switching its last boss off doesn't fold it away under the pointer.
    setMoreOpen(open);
    setBlocked(null);
    setDraft({ preset: next, isNew, after: draft?.after ?? null });
  };
  const pick = (bossId: string, difficulty: string | null) => {
    if (!current) return;
    if (difficulty && !current.entries.some((e) => e.bossId === bossId) && crystals >= settings.crystalCap) {
      setBlocked(bossId);
      return;
    }
    edit({ ...current, entries: withDifficulty(current.entries, bossId, difficulty, bosses) });
  };

  /** Save, first asking whether the characters on the preset should get its new bosses (a rename alone leaves their lists as they are). */
  const save = (then?: Target, inStrip = false) => {
    if (!dirty || problem) return;
    if (users.length && current && saved && !sameBosses(current, saved, bosses)) setAsking({ kind: 'users', then, inStrip });
    else void commit(false, then);
  };
  const commit = async (update: boolean, then?: Target) => {
    if (!draft || !current || problem) return;
    const b = before();
    const taken = new Set([...b.presets.map((p) => p.id), ...(bosses.presets ?? []).map((p) => p.id), ...Object.values(b.applied)]);
    const preset = cleanPreset({ ...current, id: draft.isNew ? newPresetId(current.name, taken) : current.id }, bosses);
    const at = draft.isNew ? insertIndex(b.presets, draft.after) : -1;
    const list = draft.isNew ? [...b.presets.slice(0, at), preset, ...b.presets.slice(at)] : b.presets.map((p) => (p.id === preset.id ? preset : p));
    const moved = update ? users : [];
    const back = selectedId;
    await savePresets(list);
    // switchPreset reads the presets from the store, so it runs after the save.
    if (moved.length) await useStore.getState().switchPreset(moved, preset.id);
    setDraft(null);
    setSelectedId(preset.id);
    setAsking(null);
    setBlocked(null);
    setToast({
      text: draft.isNew ? `Added ${preset.name} at step ${at + 1}` : `Saved ${preset.name}`,
      sub: moved.length ? `${nameList(moved)} now ${moved.length === 1 ? 'runs' : 'run'} it. Black Mage and recorded clears are kept.` : undefined,
      undo: () => restore(b, { assignments: moved.length > 0, applied: moved.length > 0 }),
      // Undoing a new preset takes it away again, so the editor goes back to where it was.
      select: draft.isNew ? back : preset.id,
    });
    if (then) go(then, list);
  };

  const remove = async () => {
    if (!saved || isNew) return;
    const b = before();
    const i = b.presets.findIndex((p) => p.id === saved.id);
    const list = b.presets.filter((p) => p.id !== saved.id);
    // Characters on it keep their bosses and drop to their own list.
    const dropped = Object.keys(b.applied).filter((n) => b.applied[n] === saved.id);
    await savePresets(list);
    if (dropped.length) await useStore.getState().setBossing({ appliedPresets: Object.fromEntries(Object.entries(b.applied).filter(([, id]) => id !== saved.id)) });
    go({ kind: 'preset', id: list[Math.min(i, list.length - 1)]?.id ?? '' }, list);
    setToast({
      text: `Deleted ${saved.name}`,
      sub: users.length ? keepOwn(users) : undefined,
      undo: () => restore(b, { applied: dropped.length > 0 }),
      select: saved.id,
    });
  };

  const defaults = bosses.presets ?? [];
  const goesAway = (id: string | undefined) => !!id && presets.some((p) => p.id === id) && !defaults.some((d) => d.id === id);
  const resetDrops = names.filter((n) => goesAway(applied[n]));
  const reset = async () => {
    const b = before();
    const dropped = Object.keys(b.applied).filter((n) => goesAway(b.applied[n]));
    await useStore.getState().resetPresets();
    if (dropped.length) await useStore.getState().setBossing({ appliedPresets: Object.fromEntries(Object.entries(b.applied).filter(([n]) => !dropped.includes(n))) });
    go({ kind: 'preset', id: selectedId }, defaults);
    setToast({ text: 'Presets are back to the defaults', sub: resetDrops.length ? keepOwn(resetDrops) : undefined, undo: () => restore(b, { applied: dropped.length > 0 }) });
  };

  const move = (id: string, to: number) => {
    const p = presets.find((x) => x.id === id);
    if (!p || to < 0 || to >= presets.length) return;
    const rest = presets.filter((x) => x !== p);
    void savePresets([...rest.slice(0, to), p, ...rest.slice(to)]);
  };

  const undo = async () => {
    if (!toast?.undo) return;
    const { undo: run, select } = toast;
    await run();
    // A draft of another preset that is still there stays open. Any other draft builds on what was just undone, so it goes.
    const list = useStore.getState().presets;
    const keep = !!draft && (draft.isNew || (draft.preset.id !== select && list.some((p) => p.id === draft.preset.id)));
    if (!keep) go({ kind: 'preset', id: select ?? selectedId });
    setToast({ text: 'Undone', sub: 'Recorded clears were never touched.' });
  };

  const usersAsk = asking?.kind === 'users' && saved && (
    <Ask
      title={`${plural(users.length, 'character')} ${users.length === 1 ? 'uses' : 'use'} ${saved.name}. Update their weekly bosses to match?`}
      actions={
        <>
          <Action kind="accent" small disabled={!!problem} onClick={() => void commit(true, asking.then)}>
            Save and update {users.length}
          </Action>
          <Action small disabled={!!problem} onClick={() => void commit(false, asking.then)}>
            Save preset only
          </Action>
          <Action kind="ghost" small onClick={() => setAsking(null)}>
            Keep editing
          </Action>
        </>
      }
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Faces names={users} max={6} />
        <span>
          Updating replaces {nameList(users)}'s weekly bosses with the preset, party sizes included. Black Mage and recorded clears are kept. Without it they keep their lists, marked as edited.
        </span>
      </span>
    </Ask>
  );

  const tile = (b: BoardBoss) => {
    if (!current) return null;
    return (
      <BossTile
        key={b.boss.id}
        {...b}
        entry={current.entries.find((e) => e.bossId === b.boss.id)}
        blocked={blocked === b.boss.id}
        cap={settings.crystalCap}
        onPick={(d) => pick(b.boss.id, d)}
        onParty={(n) => edit({ ...current, entries: withParty(current.entries, b.boss.id, n) })}
      />
    );
  };
  const savedIndex = saved ? presets.indexOf(saved) : -1;
  const newAt = draft?.isNew ? insertIndex(presets, draft.after) : -1;

  return (
    <>
      <PageHeader
        title="Presets"
        subtitle="Weekly boss lists in progression order. Picking one on Assignments replaces a character's weekly bosses."
        action={
          <Link to="/bossing/assignments" className="btn">
            <Icon name="back" />
            Assignments
          </Link>
        }
      />

      <section className="card p-4 mb-4 space-y-3" aria-label="Presets">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Progression order</h2>
            <p className="text-xs text-ink-3">Assignments moves characters up this list, first to last. Drag a card or use its arrows to reorder.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presetsEdited && (
              <Action kind="ghost" small onClick={() => setAsking({ kind: 'reset' })}>
                <Icon name="reset" size={12} />
                Reset to defaults
              </Action>
            )}
            <Action small aria-expanded={asking?.kind === 'new'} onClick={() => setAsking(asking?.kind === 'new' ? null : { kind: 'new' })}>
              <Icon name="plus" size={12} />
              New preset
            </Action>
          </div>
        </header>

        {asking?.kind === 'new' && (
          <div className="rounded-lg border border-border-2 bg-surface-2 px-3 py-2.5">
            <div className="text-xs text-ink-2 mb-2">Start the new preset from</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
              <button type="button" className="chip" onClick={() => request({ kind: 'new', from: null })}>
                Empty
              </button>
              {presets.map((p) => (
                <button key={p.id} type="button" className="chip" onClick={() => request({ kind: 'new', from: p.id })}>
                  {p.name}
                </button>
              ))}
              <Action kind="ghost" small onClick={() => setAsking(null)}>
                Cancel
              </Action>
            </div>
          </div>
        )}
        {asking?.kind === 'reset' && (
          <Ask
            tone="warn"
            title="Go back to the default presets?"
            actions={
              <>
                <Action small onClick={() => void reset()}>
                  Reset presets
                </Action>
                <Action kind="ghost" small onClick={() => setAsking(null)}>
                  Cancel
                </Action>
              </>
            }
          >
            The {defaults.length} presets from bosses.json come back as shipped; your edits, new presets and order are dropped
            {dirty ? ', unsaved changes too' : ''}. {resetDrops.length ? `${nameList(resetDrops)} ${agree(resetDrops.length, 'is', 'are')} on a preset that goes away and ${agree(resetDrops.length, 'keeps', 'keep')} their current bosses on their own list. ` : ''}Characters' weekly bosses don't change.
          </Ask>
        )}
        {asking?.kind === 'leave' && (
          <Ask
            title={`${label} has unsaved changes`}
            actions={
              <>
                <Action kind="accent" small disabled={!!problem} onClick={() => save(asking.then, true)}>
                  Save
                </Action>
                <Action small onClick={() => go(asking.then)}>
                  Discard
                </Action>
                <Action kind="ghost" small onClick={() => setAsking(null)}>
                  Keep editing
                </Action>
              </>
            }
          >
            {problem ?? 'Save or discard them before opening another preset.'}
          </Ask>
        )}
        {asking?.kind === 'users' && asking.inStrip && usersAsk}

        {presets.length || draft ? (
          <PresetStrip
            items={presets.map(item)}
            selectedId={isNew ? null : (saved?.id ?? null)}
            dirtyId={dirty && !isNew ? (saved?.id ?? null) : null}
            draft={draft?.isNew ? { item: item(draft.preset), at: newAt } : null}
            onSelect={(id) => request({ kind: 'preset', id })}
            onMove={move}
          />
        ) : (
          <p className="text-sm text-ink-3">No presets yet. Start one with New preset.</p>
        )}
      </section>

      {!current ? (
        <Empty title="No preset open">Pick a preset above, or start a new one.</Empty>
      ) : (
        <section className="card" aria-label="Preset editor">
          <div className="p-4 pb-3 space-y-3 border-b border-border">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <label className="block w-full sm:w-80 text-sm text-ink">
                <span className="label">Preset name</span>
                <input className="input mt-1" value={current.name} aria-invalid={!!problem} onChange={(e) => edit({ ...current, name: e.target.value })} />
              </label>
              <div className="h-[34px] flex items-center">
                <Switch checked={!!current.main} onChange={(v) => edit({ ...current, main: v })} label="For the main character" />
              </div>
              {!isNew && saved && (
                <div className="flex gap-2 sm:ml-auto">
                  <Action small onClick={() => request({ kind: 'new', from: saved.id, duplicate: true })}>
                    <Icon name="copy" size={12} />
                    Duplicate
                  </Action>
                  <Action kind="ghost" small aria-expanded={asking?.kind === 'delete'} onClick={() => setAsking({ kind: 'delete' })}>
                    <Icon name="trash" size={12} />
                    Delete
                  </Action>
                </div>
              )}
            </div>
            {problem && <p className="text-xs text-bad">{problem}</p>}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
              <span>{isNew ? `New · goes in at step ${newAt + 1} when saved` : `Step ${savedIndex + 1} of ${presets.length}`}</span>
              <span aria-hidden>·</span>
              {users.length ? (
                <>
                  <Faces names={users} max={6} />
                  <span>
                    {nameList(users, 4)} {users.length === 1 ? 'uses' : 'use'} it
                  </span>
                </>
              ) : (
                <span>
                  No characters use it yet. Pick it for a character on{' '}
                  <Link to="/bossing/assignments" className="underline hover:text-ink">
                    Assignments
                  </Link>
                  .
                </span>
              )}
            </p>
            {asking?.kind === 'delete' && saved && (
              <Ask
                tone="bad"
                title={`Delete ${saved.name}?`}
                actions={
                  <>
                    <Action small onClick={() => void remove()}>
                      <span className="text-bad">Delete preset</span>
                    </Action>
                    <Action kind="ghost" small onClick={() => setAsking(null)}>
                      Cancel
                    </Action>
                  </>
                }
              >
                {users.length ? `${keepOwn(users)} Recorded clears are kept.` : 'No characters use it.'}
                {dirty ? ' Unsaved changes to it are dropped.' : ''}
              </Ask>
            )}
          </div>

          <div className="p-4">
            <SummaryBar
              crystals={crystals}
              cap={settings.crystalCap}
              full={!!blocked}
              meso={presetMeso(current, bosses, prices, settings)}
              savedMeso={saved && !isNew ? presetMeso(saved, bosses, prices, settings) : null}
              dirty={dirty}
              isNew={isNew}
              problem={problem}
              onSave={() => save()}
              onDiscard={() => go({ kind: 'preset', id: isNew ? selectedId : (saved?.id ?? '') })}
            >
              {asking?.kind === 'users' && !asking.inStrip ? usersAsk : null}
            </SummaryBar>

            <div className="mt-3 grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))]">{board.endgame.map(tile)}</div>
            {board.older.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setMoreOpen(!open)}
                  className="group mt-3 w-full flex items-center gap-2.5 rounded-lg border border-dashed border-border-2 px-3 py-2.5 text-left cursor-pointer transition-colors hover:border-ink-3 hover:bg-surface-2"
                >
                  <Icon name="down" className={`text-ink-3 group-hover:text-ink transition-transform ${open ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-medium text-ink-2 group-hover:text-ink whitespace-nowrap">{open ? 'Hide older bosses' : 'More bosses'}</span>
                  {/* Zero width, then grow: the long list must not widen the page's grid column. */}
                  <span className="w-0 grow truncate text-xs text-ink-3">
                    {olderOn ? `${olderOn} in this preset · ` : ''}
                    {board.older.map((b) => b.boss.name).join(', ')}
                  </span>
                </button>
                {open && <div className="mt-2.5 grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))]">{board.older.map(tile)}</div>}
              </>
            )}
            <p className="mt-4 text-xs text-ink-3">
              Meso is per person: the crystal value{settings.heroic ? ' ×5 (Heroic)' : ''}, split by the party. Black Mage is monthly, so it isn't part of any preset: set it per character on{' '}
              <Link to="/bossing/assignments" className="underline hover:text-ink">
                Assignments
              </Link>
              .
            </p>
          </div>
        </section>
      )}

      {toast && <Toast msg={toast} onUndo={() => void undo()} onClose={() => setToast(null)} />}
    </>
  );
}
