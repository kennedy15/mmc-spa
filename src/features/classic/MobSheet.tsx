import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtInt } from '../../app/format';
import { dataUrl } from '../../lib/paths';
import { SectionLabel } from './bits';
import { accToAlwaysHit, fmtRate, isHidden, spawnTimer, throughDef, TIMER_HINT, type AtlasIndex } from './atlasIndex';
import { OpenMob, useAtlasNav } from './atlasNav';
import { ItemIcon } from './AtlasParts';
import { siteOf } from './labels';
import type { AtlasMob, ElementResponse } from './types';

/**
 * Holds a page's monster sheet: any monster clicked opens it on the right, another click swaps it,
 * and closing it hands focus back to whatever opened it.
 */
export function MobSheetHost({ ix, children }: { ix: AtlasIndex; children: ReactNode }) {
  const [id, setId] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = (mob: number) => {
    if (id == null) opener.current = document.activeElement as HTMLElement | null;
    setId(mob);
  };
  const close = () => {
    setId(null);
    opener.current?.focus();
  };
  const mob = id != null ? ix.mob.get(id) : undefined;
  return (
    <OpenMob.Provider value={open}>
      {children}
      {mob && <MobSheet ix={ix} mob={mob} onClose={close} />}
    </OpenMob.Provider>
  );
}

const ELEMENT_TONE: Record<ElementResponse, string> = {
  Weak: 'border-good/50 bg-good/10 text-good',
  Strong: 'border-warn/50 bg-warn/10 text-warn',
  Immune: 'border-bad/50 bg-bad/10 text-bad',
};
const ELEMENT_SAYS: Record<ElementResponse, string> = { Weak: 'takes extra damage from', Strong: 'takes less damage from', Immune: 'takes no damage from' };

/** A monster's profile: launch stats, what it takes to hit it, its skills, drops and every map it spawns on. */
function MobSheet({ ix, mob: m, onClose }: { ix: AtlasIndex; mob: AtlasMob; onClose: () => void }) {
  const { go } = useAtlasNav();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    body.current?.scrollTo({ top: 0 });
  }, [m.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const homes = ix.homes.get(m.id) ?? [];
  const acc = accToAlwaysHit(m.eva);
  const accStep = accToAlwaysHit(m.eva, 10) - acc;
  const items = (m.drops ?? []).map((d) => ({ ...d, item: ix.doc.items?.[String(d.id)] })).filter((d) => d.item);
  const kinds = [m.boss && 'Boss', m.undead && 'Undead', m.aggro && 'Attacks on sight', m.special].filter(Boolean) as string[];
  const elements = Object.entries(m.elements ?? {}) as [string, ElementResponse][];

  return (
    <aside role="dialog" aria-labelledby="mob-sheet-title" className="sheet-in fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border-2 bg-surface shadow-2xl sm:w-[34rem]">
      <header className="flex items-start gap-4 border-b border-border px-5 py-4">
        <span className="flex size-24 shrink-0 items-end justify-center overflow-hidden rounded-xl border border-border-2 bg-[#1c140e] p-1.5">
          <img src={dataUrl(m.anim ?? m.icon, 'public')} alt="" className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 id="mob-sheet-title" className="text-xl! font-semibold leading-tight text-ink">
            {m.name}
          </h2>
          <div className="mt-1 text-sm text-ink-2 tabular">Lv {m.level}</div>
          {kinds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <span key={k} className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${k === 'Boss' ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border-2 text-ink-2'}`}>
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
        <button ref={closeBtn} type="button" className="btn-ghost btn-sm text-base leading-none" onClick={onClose} aria-label="Close monster details">
          ✕
        </button>
      </header>

      <div ref={body} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <dl className="grid grid-cols-4 gap-2">
          <Big label="HP" value={fmtInt(m.hp)} />
          <Big label="EXP" value={fmtInt(m.exp)} />
          <Big label="EXP / HP" value={m.hp > 0 && m.exp > 0 ? (m.exp / m.hp).toFixed(3) : '—'} title="EXP for each point of damage: higher is more EXP for the same damage" />
          <Big label="MP" value={fmtInt(m.mp ?? 0)} />
        </dl>

        <section>
          <SectionLabel>Combat</SectionLabel>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <Row label="Weapon attack" value={fmtInt(m.pad ?? 0)} />
            <Row label="Magic attack" value={fmtInt(m.mad ?? 0)} />
            <Row label="Weapon defense" value={fmtInt(m.pdd ?? 0)} hint={`Your weapon hits deal ${Math.round(throughDef(m.pdd) * 100)}%`} />
            <Row label="Magic defense" value={fmtInt(m.mdd ?? 0)} hint={`Your spells deal ${Math.round(throughDef(m.mdd) * 100)}%`} />
            <Row label="Accuracy" value={fmtInt(m.acc ?? 0)} />
            <Row label="Avoidability" value={fmtInt(m.eva)} />
            <Row label="Speed" value={m.speed == null ? '0' : m.speed > 0 ? `+${m.speed}` : String(m.speed)} />
            <Row label="Knockback" value={fmtInt(m.knockback ?? 0)} hint="One hit of at least this much damage knocks it back" />
            {m.hpRec != null && <Row label="HP regen" value={fmtInt(m.hpRec)} hint="HP it heals each tick" />}
            {m.mpRec != null && <Row label="MP regen" value={fmtInt(m.mpRec)} />}
          </dl>
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
            {acc > 0 ? (
              <>
                Every hit lands from <span className="font-semibold text-ink tabular">{acc}</span> accuracy at Lv {m.level} or above, plus about{' '}
                <span className="tabular">{Math.round(accStep / 10)}</span> for each level you are under it. Spells use the same accuracy check.
              </>
            ) : (
              <>It has no avoidability: every hit lands.</>
            )}
          </p>
          {elements.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {elements.map(([el, r]) => (
                <span key={el} className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${ELEMENT_TONE[r]}`} title={`${m.name} ${ELEMENT_SAYS[r]} ${el.toLowerCase()} attacks`}>
                  {r} to {el}
                </span>
              ))}
            </div>
          )}
        </section>

        {Boolean(m.attacks?.length || m.debuffs?.length || m.buffs?.length || m.revives?.length) && (
          <section>
            <SectionLabel>Attacks and skills</SectionLabel>
            <ul className="space-y-1.5 text-sm text-ink-2">
              {m.attacks?.map((a) => (
                <li key={`a${a.index}`}>
                  <span className="font-medium text-ink">Attack {a.index}</span>: {a.magic ? 'magic' : 'physical'}
                  {a.element && `, ${a.element.toLowerCase()}`}, {a.ratio ?? 100}% of its {a.magic ? 'magic' : 'weapon'} attack{a.delay ? `, every ${a.delay / 1000} s at most` : ''}
                  {a.jump ? ', a jump attack' : ''}
                </li>
              ))}
              {m.debuffs?.map((d) => (
                <li key={`d${d.id}`}>
                  <span className="font-medium text-ink">{d.name}</span> on you: {d.prop ?? 100}% chance, lasts {d.time} s, every {d.interval} s
                </li>
              ))}
              {m.buffs?.map((b) => (
                <li key={`b${b.id}`}>
                  <span className="font-medium text-ink">Buffs itself</span> (skill {b.id}): {b.x != null ? `+${b.x}% ` : ''}for {b.time} s, every {b.interval} s
                </li>
              ))}
              {m.revives?.map((r) => (
                <li key={`r${r.id}`}>
                  <span className="font-medium text-ink">Splits</span> into {r.count} {r.name}
                  {r.count === 1 ? '' : 's'} when it dies
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionLabel>Drops</SectionLabel>
          {items.length ? (
            <>
              <p className="mb-2 text-xs text-ink-2">
                {m.dropKills ? (
                  <>
                    Out of <span className="font-semibold text-ink tabular">{fmtInt(m.dropKills)}</span> kills logged on the launch build
                    {m.dropKills < 50 && ', too few for steady rates'}.
                  </>
                ) : (
                  <>Seen dropping in game; no kill counts logged yet.</>
                )}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {m.meso && (
                  <DropRow icon={<span className="flex size-7 items-center justify-center rounded-full bg-[#e8b830] text-[11px] font-bold text-[#4a3000]">$</span>} name="Mesos" sub={`${m.meso.q[0] === m.meso.q[1] ? m.meso.q[0] : `${m.meso.q[0]}–${m.meso.q[1]}`} each`} rate={`${m.meso.rate}%`} />
                )}
                {items.map((d) => (
                  <DropRow
                    key={d.id}
                    icon={<ItemIcon item={d.item!} size={28} />}
                    name={d.item!.name}
                    sub={[d.quest ? 'quest item, only while you have the quest' : d.item!.type, d.q ? `${d.q[0] === d.q[1] ? d.q[0] : `${d.q[0]}–${d.q[1]}`} at once` : ''].filter(Boolean).join(' · ')}
                    rate={fmtRate(d)}
                    range={d.rate != null && d.lo != null ? `95% range ${d.lo}–${d.hi}%` : undefined}
                  />
                ))}
                {m.noDrop != null && <DropRow icon={<span className="size-7" />} name="Nothing at all" rate={`${m.noDrop}%`} />}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-2">No drop records for {m.name} yet. Drop tables live on the game server, not in the client files, so they come from players' kill logs.</p>
          )}
          {ix.doc.dropSource && (
            <p className="mt-2 text-[11px] text-ink-3">
              {items.length ? 'From the ' : 'Log a drop on the '}
              <a href={ix.doc.dropSource.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-accent">
                {ix.doc.dropSource.title}
              </a>{' '}
              {items.length ? 'drop logs (CC BY-NC-SA 4.0).' : 'to help fill these in.'}
            </p>
          )}
        </section>

        <section>
          <SectionLabel>Spawns on</SectionLabel>
          {homes.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {homes.map(({ map, count }) => (
                <li key={map.id}>
                  <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer" onClick={() => go(map.id)}>
                    <span className="min-w-0 flex-1 truncate text-ink">{map.name}</span>
                    {isHidden(map) && <span className="shrink-0 rounded border border-border-2 px-1 text-[10px] text-ink-3">hidden</span>}
                    {spawnTimer(map, m.id) && (
                      <span className="shrink-0 text-xs text-ink-2" title={TIMER_HINT}>
                        ⏱ {spawnTimer(map, m.id)}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-ink-3">{ix.island.get(map.island)?.name}</span>
                    <span className="shrink-0 text-xs text-ink-3 tabular">
                      {count} spawn{count === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">It has no spawn points on any map: it is summoned or appears during an event.</p>
          )}
        </section>

        <p className="text-[11px] text-ink-3">
          Stats from the launch client:{' '}
          <a href={ix.doc.source.url} target="_blank" rel="noreferrer" className="hover:text-accent">
            {siteOf(ix.doc.source.url)}
          </a>
          . Hit and defense math from its formulas, read from the client.
        </p>
      </div>
    </aside>
  );
}

/** One line of a drop table: icon, name and detail, and the rate on the right (its 95% range on hover). */
function DropRow({ icon, name, sub, rate, range }: { icon: ReactNode; name: string; sub?: string; rate: string; range?: string }) {
  return (
    <li className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ink">{name}</span>
        {sub && <span className="block truncate text-[11px] text-ink-3">{sub}</span>}
      </span>
      <span className={`shrink-0 tabular ${rate === 'no count yet' ? 'text-xs text-ink-3' : 'font-medium text-ink'}`} title={range}>
        {rate}
      </span>
    </li>
  );
}

function Big({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-2.5 py-2" title={title}>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-semibold text-ink tabular">{value}</dd>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/70 py-1">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right tabular">
        <span className="font-medium text-ink">{value}</span>
        {hint && <span className="block text-[11px] text-ink-3">{hint}</span>}
      </dd>
    </div>
  );
}
