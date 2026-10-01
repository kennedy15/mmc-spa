import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore, mainCharacterName } from '../../store';
import { useCharacterNames } from '../tracker/hooks';
import { latestRow, lookImageUrl } from '../../lib/nexon/snapshots';
import { useMediaQuery } from '../../app/useMediaQuery';
import { Empty, PageHeader } from '../../app/ui';
import type { BossesDoc } from '../../lib/types';
import { expectedPer, levelGaps, presetOf, visibleCharacters, weeklyOf, type PresetDiff } from './lib';
import { LadderContext, type Ladder, type PendingMove } from './ladder/context';
import { TRAY, churn, moveDiff, signed, type LadderChar } from './ladder/model';
import { useUndo } from './ladder/useUndo';
import { Totals } from './ladder/Totals';
import { MoveBar } from './ladder/MoveBar';
import { Lane } from './ladder/Lane';
import { Tray } from './ladder/Tray';
import { Panel } from './ladder/Panel';
import { UndoToast } from './ladder/UndoToast';
import { Pencil } from './ladder/icons';

export function Assignments() {
  const doc = useStore((s) => s.bosses);
  if (!doc) return <Empty title="Boss list missing">public/bosses.json could not be loaded.</Empty>;
  return <ProgressionLadder doc={doc} />;
}

/**
 * Each character runs one preset, and the presets form a ladder in progression
 * order. Moving a character to another rung wipes its weekly bosses and puts the
 * preset's in (party sizes too); Black Mage and recorded clears stay. Characters
 * on no preset wait in the tray, with a list of their own or none.
 */
function ProgressionLadder({ doc }: { doc: BossesDoc }) {
  const assignments = useStore((s) => s.assignments);
  const appliedPresets = useStore((s) => s.appliedPresets);
  const presets = useStore((s) => s.presets);
  const prices = useStore((s) => s.prices);
  const settings = useStore((s) => s.settings);
  const snapshots = useStore((s) => s.snapshots);
  const looks = useStore((s) => s.looks);
  const characters = useStore((s) => s.characters);
  const switchPreset = useStore((s) => s.switchPreset);
  const setBossing = useStore((s) => s.setBossing);
  const allNames = useCharacterNames();
  const names = useMemo(() => visibleCharacters(allNames, settings), [allNames, settings]);
  const main = mainCharacterName({ characters, snapshots });
  const pricing = useMemo(() => ({ doc, prices, settings }), [doc, prices, settings]);
  const wide = useMediaQuery('(min-width: 1280px)');
  const panelRef = useRef<HTMLDivElement>(null);
  const undo = useUndo();

  const chars = useMemo(
    () =>
      names.map((name): LadderChar => {
        const row = latestRow(snapshots, name);
        const hash = row?.lookHash ?? looks[name]?.[looks[name].length - 1]?.hash ?? null;
        const { preset, edited } = presetOf(name, appliedPresets, presets, assignments, doc);
        const weekly = weeklyOf(assignments, name);
        const monthly = assignments.filter((a) => a.character === name && a.cadence === 'monthly').sort((a, b) => a.order - b.order);
        const level = row?.level ?? null;
        return {
          name,
          img: hash ? lookImageUrl(name, hash) : (row?.imgUrl ?? null),
          level,
          job: row?.job ?? null,
          main: name === main,
          rung: preset?.id ?? TRAY,
          preset,
          edited,
          weekly,
          monthly,
          gaps: levelGaps({ id: '', name: '', entries: weekly.map((a) => ({ bossId: a.bossId, difficulty: a.difficulty })) }, level, doc),
          meso: expectedPer('weekly', weekly, doc, prices, settings),
          monthMeso: expectedPer('monthly', monthly, doc, prices, settings),
        };
      }),
    [names, snapshots, looks, appliedPresets, presets, assignments, doc, main, prices, settings],
  );
  const byName = useMemo(() => new Map(chars.map((c) => [c.name, c])), [chars]);
  // Opens on the first character still on a hand-made list, else the main.
  const firstPick = () => chars.find((c) => c.rung === TRAY && c.weekly.length)?.name ?? main ?? chars[0]?.name ?? null;

  const [selectedName, setSelectedName] = useState<string | null>(firstPick);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkTo, setBulkTo] = useState<string | null>(null);
  const [drag, setDrag] = useState<string[] | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [hovered, setHovered] = useState<PendingMove | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const dragNames = useRef<string[] | null>(null);

  const selected = byName.get(selectedName ?? '') ?? byName.get(firstPick() ?? '') ?? null;
  const shown = selected?.name ?? null;
  // On desktop the panel scrolls by itself; a newly picked character opens at its top, not where the last one was left.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [shown]);
  const rungs = [TRAY, ...presets.map((p) => p.id)];
  const presetFor = (key: string) => presets.find((p) => p.id === key) ?? null;
  const rungName = (key: string) => (key === TRAY ? 'No preset' : (presetFor(key)?.name ?? key));
  const inOrder = (list: string[]) => chars.filter((c) => list.includes(c.name)).map((c) => c.name);

  const exitSelect = () => {
    setSelectMode(false);
    setPicked([]);
    setBulkTo(null);
  };

  const move: Ladder['move'] = (list, to, opts = {}) => {
    setHovered(null);
    setOver(null);
    setDrag(null);
    setPeek(null);
    const who = list.map((n) => byName.get(n)).filter((c): c is LadderChar => !!c && (!!opts.force || c.rung !== to));
    if (!who.length) return;
    const preset = presetFor(to);
    let delta = 0;
    let last: PresetDiff | null = null;
    for (const c of who) {
      last = moveDiff(c, preset, pricing);
      delta += last.after - last.before;
    }
    const whoNames = who.map((c) => c.name);
    const head = opts.head ?? `${whoNames.length <= 3 ? whoNames.join(', ') : `${whoNames.length} characters`} → ${rungName(to)}`;
    const what = who.length === 1 && last ? churn(last) : `${who.length} weekly lists replaced`;
    undo.run({ head, text: `${what} · ${signed(delta)} / week · Recorded clears are kept`, names: whoNames }, () => switchPreset(whoNames, preset?.id ?? null));
    if (who.length === 1 && !selectMode) setSelectedName(whoNames[0]);
    if (selectMode && who.length > 1) exitSelect();
  };

  const ladder: Ladder = {
    chars,
    byName,
    presets,
    assignments,
    pricing,
    rungs,
    rungName,
    presetFor,
    selected,
    select: (name) => {
      if (selectMode) {
        setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
        return;
      }
      setSelectedName(name);
      setPeek(null);
      // Below the lanes on narrow screens: bring the panel into view.
      if (!wide) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    },
    selectMode,
    picked,
    pickRung: (key) => {
      const here = chars.filter((c) => c.rung === key).map((c) => c.name);
      const all = here.every((n) => picked.includes(n));
      setPicked(all ? picked.filter((n) => !here.includes(n)) : [...picked, ...here.filter((n) => !picked.includes(n))]);
    },
    drag,
    over,
    preview: drag && over != null ? { names: drag, to: over } : (hovered ?? (selectMode && bulkTo != null && picked.length ? { names: inOrder(picked), to: bulkTo } : null)),
    hover: (m) => !dragNames.current && setHovered(m),
    startDrag: (name: string, e: DragEvent) => {
      const list = selectMode && picked.includes(name) ? inOrder(picked) : [name];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', list.join(', '));
      dragNames.current = list;
      // Deferred so the browser takes the drag image before the card fades.
      setTimeout(() => {
        if (!dragNames.current) return;
        setDrag(dragNames.current);
        setHovered(null);
        setPeek(null);
      }, 0);
    },
    endDrag: () => {
      dragNames.current = null;
      setDrag(null);
      setOver(null);
    },
    dropTarget: (key) => ({
      onDragOver: (e) => {
        if (!dragNames.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (over !== key) setOver(key);
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === key ? null : o));
      },
      onDrop: (e) => {
        e.preventDefault();
        const list = dragNames.current;
        dragNames.current = null;
        if (list) move(list, key);
        else setOver(null);
      },
    }),
    move,
    edit: (msg, next) => undo.run({ ...msg, next }, () => setBossing({ assignments: next })),
    peek,
    setPeek,
    landed: undo.toast?.names ?? [],
  };

  // Lanes balance into rows: at most 2, 3 or 6 across as the column widens (six presets: 2+2+2, 3+3, then one row).
  const n = presets.length;
  const across = (max: number) => (n ? Math.ceil(n / Math.ceil(n / max)) : 1);
  const laneCols = { '--lanes-2': across(2), '--lanes-3': across(3), '--lanes-6': across(6) } as CSSProperties;

  return (
    <LadderContext.Provider value={ladder}>
      <PageHeader
        title="Assignments"
        subtitle={`Crystal values ${doc.version ?? ''} as of ${doc.asOf}${settings.heroic ? ' · Heroic ×5 applied' : ''}. Moving a character to another rung replaces its weekly bosses.`}
        action={
          <Link to="/bossing/presets" className="btn">
            <Pencil className="size-3.5" />
            Edit presets
          </Link>
        }
      />
      <Totals />
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <MoveBar
            undo={undo}
            bulkTo={bulkTo}
            setBulkTo={setBulkTo}
            toggleSelect={() => {
              if (selectMode) return exitSelect();
              setSelectMode(true);
              setPicked(selected ? [selected.name] : []);
              setPeek(null);
            }}
            clearPicked={() => {
              setPicked([]);
              setBulkTo(null);
            }}
            bulkMove={(list, to) => {
              move(list, to);
              exitSelect();
            }}
          />
          {n ? (
            <div className="@container">
              <div className="grid grid-cols-1 gap-2 @[24rem]:grid-cols-[repeat(var(--lanes-2),minmax(0,1fr))] @[35rem]:grid-cols-[repeat(var(--lanes-3),minmax(0,1fr))] @[56rem]:grid-cols-[repeat(var(--lanes-6),minmax(0,1fr))]" style={laneCols}>
                {presets.map((p, i) => (
                  <Lane key={p.id} preset={p} step={i + 1} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-sm text-ink-2">
              No presets yet.{' '}
              <Link to="/bossing/presets" className="text-accent underline-offset-2 hover:underline">
                Make one on the Presets page
              </Link>
              ; until then, characters keep their own lists below.
            </div>
          )}
          <Tray />
        </div>
        <div ref={panelRef} className="min-w-0 scroll-mt-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:rounded-xl">
          <Panel c={selected} />
        </div>
      </div>
      <UndoToast undo={undo} />
    </LadderContext.Provider>
  );
}
