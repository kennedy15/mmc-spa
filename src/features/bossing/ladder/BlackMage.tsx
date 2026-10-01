import { fmtMeso, titleCase } from '../../../app/format';
import { Stepper } from '../../../app/ui';
import type { Assignment } from '../../../lib/types';
import { assignmentMeso, crystalValue, maxParty } from '../lib';
import { useLadder } from './context';
import { withMonthly, withPatch, type LadderChar } from './model';
import { Segment } from './bits';

/** The monthly boss (Black Mage) is set per character; presets never change it. */
export function BlackMage({ c }: { c: LadderChar }) {
  const L = useLadder();
  const { doc, prices, settings } = L.pricing;
  const boss = doc.bosses.find((b) => b.difficulties.some((d) => d.cadence === 'monthly'));
  if (!boss) return null;
  const a = c.monthly.find((m) => m.bossId === boss.id) ?? null;
  const diffs = boss.difficulties.filter((d) => d.cadence === 'monthly');
  const need = a ? (diffs.find((d) => d.key === a.difficulty)?.minLevel ?? 0) : 0;
  const label = a ? `${titleCase(a.difficulty)} ${boss.name}` : '';

  const set = (key: string) => {
    if ((a?.difficulty ?? '') === key) return;
    L.edit({ head: `${c.name}: ${key ? `${titleCase(key)} ${boss.name}` : `no ${boss.name}`}`, text: 'Monthly · presets never change this', key: `monthly:${c.name}` }, withMonthly(L.assignments, c.name, boss.id, key || null, doc));
  };
  const setParty = (party: number) => {
    if (!a) return;
    // Read from where repeated steps started, as on the weekly rows.
    const head = (before: Assignment[]) => {
      const from = (before.find((x) => x.id === a.id) ?? a).defaultPartySize;
      return `${c.name}: ${boss.name} party ${from === party ? `back to ${party}` : `${from} → ${party}`}`;
    };
    L.edit({ head, text: 'Monthly · presets never change this', key: `party:${a.id}` }, withPatch(L.assignments, a.id, { defaultPartySize: party }));
  };

  return (
    <section className="flex flex-col gap-2 border-t border-border px-4 pt-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Monthly · {boss.name}</h3>
        <Segment value={a?.difficulty ?? ''} options={[{ value: '', label: 'None' }, ...diffs.map((d) => ({ value: d.key, label: titleCase(d.key) }))]} onChange={set} label={`${boss.name} difficulty`} />
      </div>
      {a && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
          <span className="label">Party</span>
          <span role="group" aria-label={`Party for ${label}`}>
            <Stepper value={a.defaultPartySize} max={maxParty(doc, a.bossId, a.difficulty)} onChange={setParty} />
          </span>
          <span className="text-xs text-ink-2 tabular">{fmtMeso(assignmentMeso(a, doc, prices, settings))} per person a month</span>
        </div>
      )}
      <span className="text-xs text-ink-3">{a ? `${label} crystal: ${fmtMeso(crystalValue(doc, prices, settings, a.bossId, a.difficulty))}. Presets never change this.` : 'No monthly boss. Presets never change this.'}</span>
      {a && c.level != null && need > c.level && (
        <span className="text-xs text-warn">
          Needs Lv {need}. {c.name} is Lv {c.level}.
        </span>
      )}
    </section>
  );
}
