import { Fragment, useState } from 'react';
import { fmtMeso } from '../../../app/format';
import { bossLabel, cadenceFor, levelGaps } from '../lib';
import { useLadder } from './context';
import { TRAY, bossCount, changeLabel, fromAssignment, fromEntry, gapNote, moveDiff, shortList, signed, type LadderChar } from './model';
import { Tag, focusRing } from './bits';
import { ChevronLeft, ChevronRight, Info } from './icons';

/**
 * Pick a rung to compare (the next one up by default) and see what switching
 * would remove, add, change and keep before committing. Key it by character
 * and rung so the pick resets after a move.
 */
export function RungPicker({ c }: { c: LadderChar }) {
  const L = useLadder();
  const [target, setTarget] = useState<string | null>(null);
  const nowIdx = L.rungs.indexOf(c.rung);
  const to = target ?? (nowIdx < L.rungs.length - 1 ? L.rungs[nowIdx + 1] : c.rung);
  const up = L.rungs.indexOf(to) > nowIdx;
  const moving = to !== c.rung;
  const preset = L.presetFor(to);
  const n = c.weekly.length;

  const top = nowIdx === L.rungs.length - 1;
  const stay =
    c.rung !== TRAY
      ? `${c.name} is on ${top ? 'the top rung' : c.preset?.name}. Pick ${top ? 'a lower' : 'another'} rung to see what changes.`
      : n
        ? `${c.name} has its own list. Pick a rung to replace it with a preset.`
        : `${c.name} has no weekly bosses. Pick a rung to start from a preset.`;

  return (
    <section className="flex flex-col gap-2.5 border-t border-border px-4 pt-3 pb-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="label">Rung</h3>
        <span className="min-w-0 text-right text-xs text-ink-2">{c.rung === TRAY ? (n ? `Own list · ${bossCount(n)}` : 'No bosses') : `Now ${nowIdx} · ${c.preset?.name}`}</span>
      </div>
      <div role="group" aria-label="Pick a rung to compare" className="grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1 text-xs">
        {L.rungs.map((key, i) => {
          const isNow = key === c.rung;
          const isTarget = moving && key === to;
          const name = i === 0 ? 'No preset' : `Rung ${i}, ${L.rungName(key)}`;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTarget(key)}
              aria-pressed={key === to}
              aria-label={`${name}${isNow ? ' (now)' : ''}`}
              title={`${name}${isNow ? ' (now)' : ''}`}
              className={`flex h-10 cursor-pointer flex-col items-center justify-center rounded-lg border transition-colors ${isNow ? 'border-ink-3 bg-surface-3' : isTarget ? 'border-accent bg-accent/10' : 'border-border-2 hover:border-ink-3'} ${focusRing}`}
            >
              <span className={`text-xs font-semibold ${isNow ? 'text-ink' : isTarget ? 'text-accent' : 'text-ink-2'}`}>{i === 0 ? 'None' : i}</span>
              <span className={`text-[10px] leading-3 ${isNow ? 'text-ink-2' : 'text-accent'}`}>{isNow ? 'Now' : isTarget ? 'Target' : ' '}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
        {moving ? <Preview c={c} to={to} up={up} /> : <span className="text-sm text-ink-2">{stay}</span>}
        {moving && preset?.main && !c.main && <span className="text-xs text-ink-3">Main presets are meant for your main character.</span>}
        {moving && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <button type="button" onClick={() => L.move([c.name], to)} onMouseEnter={() => L.hover({ names: [c.name], to })} onMouseLeave={() => L.hover(null)} onFocus={() => L.hover({ names: [c.name], to })} onBlur={() => L.hover(null)} className={`btn-accent ${focusRing}`}>
              <span className="inline-flex items-center gap-1.5 text-black">
                {up ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
                {up ? `Promote ${c.name}` : to === TRAY ? `Clear ${c.name}’s weekly bosses` : `Move ${c.name} down`}
              </span>
            </button>
            <span className="min-w-0 flex-[1_1_8.75rem] text-xs text-ink-3">Recorded clears are kept. Black Mage stays as it is.</span>
          </div>
        )}
      </div>
    </section>
  );
}

/** What switching would do: meso change, crystals, the bosses removed, added, changed and kept, and level gaps. */
function Preview({ c, to, up }: { c: LadderChar; to: string; up: boolean }) {
  const L = useLadder();
  const { doc, settings } = L.pricing;
  const cap = settings.crystalCap;
  const p = L.presetFor(to);
  const d = moveDiff(c, p, L.pricing);
  const after = p ? p.entries.filter((e) => cadenceFor(doc, e.bossId, e.difficulty) === 'weekly').length : 0;
  const delta = d.after - d.before;
  const label = (x: { bossId: string; difficulty: string }) => bossLabel(doc, x.bossId, x.difficulty);
  const lines = [
    d.removed.length > 0 && { label: `Removes ${d.removed.length}`, text: shortList(d.removed.map(label), 6), tone: 'text-bad' },
    d.added.length > 0 && { label: `Adds ${d.added.length}`, text: shortList(d.added.map(label), 6), tone: 'text-good' },
    d.changed.length > 0 && { label: `Changes ${d.changed.length}`, text: shortList(d.changed.map((x) => changeLabel(doc, fromAssignment(x.from), fromEntry(doc, x.to))), 4), tone: 'text-ink' },
    d.kept.length > 0 && { label: `Keeps ${d.kept.length}`, text: 'Same difficulty and party', tone: 'text-ink-3' },
  ].filter((l) => !!l);
  const gap = p ? gapNote(doc, levelGaps(p, c.level, doc), c) : '';

  return (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="label">{up ? 'Promote to' : to === TRAY ? 'Move to' : 'Move down to'}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-sm font-semibold">{L.rungName(to)}</span>
            {p?.main && <Tag tone="accent">Main</Tag>}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-xl font-semibold tabular ${delta > 0 ? 'text-good' : 'text-ink-2'}`}>{signed(delta)}</div>
          <div className="text-[11px] text-ink-3">per week</div>
        </div>
      </div>
      <span className="text-xs text-ink-2 tabular">
        {fmtMeso(d.before)} → {fmtMeso(d.after)} a week · {after === c.weekly.length ? `still ${after}/${cap} crystals` : `${c.weekly.length}/${cap} → ${after}/${cap} crystals`}
      </span>
      {lines.length > 0 && (
        <dl className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
          {lines.map((l) => (
            <Fragment key={l.label}>
              <dt className={`font-medium ${l.tone}`}>{l.label}</dt>
              <dd className="text-ink-2">{l.text}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {gap && (
        <span className="flex items-start gap-1.5 text-xs text-warn">
          <Info className="mt-px size-3.5" />
          {gap}
        </span>
      )}
    </>
  );
}
