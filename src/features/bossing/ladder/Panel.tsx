import { fmtInt, fmtMeso } from '../../../app/format';
import type { LadderChar } from './model';
import { Avatar, Tag } from './bits';
import { RungPicker } from './RungPicker';
import { WeeklyList } from './WeeklyList';
import { BlackMage } from './BlackMage';

/** The selected character: its rung with a preview of moving, its weekly list, and its monthly boss. */
export function Panel({ c }: { c: LadderChar | null }) {
  if (!c) return <div className="card p-6 text-center text-sm text-ink-2">Pick a character to see its bosses.</div>;
  return (
    <aside aria-label={`${c.name}’s bosses`} className="card flex min-w-0 flex-col">
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <Avatar c={c} large />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="min-w-0 text-sm font-semibold break-all">{c.name}</h2>
            {c.main && <Tag tone="accent">Main</Tag>}
          </div>
          <div className="text-xs text-ink-2">{c.level != null ? `Lv ${c.level}${c.job ? ` · ${c.job}` : ''}` : 'Ledger only'}</div>
        </div>
        <div className="shrink-0 text-right" title={`${fmtInt(c.meso)} meso a week${c.monthMeso ? `, ${fmtInt(c.monthMeso)} a month` : ''}, if every boss is cleared`}>
          <div className="text-xl font-semibold tabular">{fmtMeso(c.meso)}</div>
          <div className="text-[11px] text-ink-3 tabular">per week{c.monthMeso > 0 && ` · ${fmtMeso(c.monthMeso)} / month`}</div>
        </div>
      </header>
      <RungPicker key={`${c.name}|${c.rung}`} c={c} />
      <WeeklyList key={c.name} c={c} />
      <BlackMage c={c} />
    </aside>
  );
}
