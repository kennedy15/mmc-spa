import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCharacterNames, useTrackedNames } from '../tracker/hooks';
import { Card, PageHeader, Field, Toggle, Badge } from '../../app/ui';
import { fmtMeso, relTime, fmtDateLong } from '../../app/format';
import { buildExportZip, readImportZip } from '../../lib/storage/exportImport';
import { priceKey } from '../bossing/lib';
import { AddCharacter } from './AddCharacter';

export function Settings() {
  const s = useStore();
  const names = useCharacterNames();
  const tracked = useTrackedNames();
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceFilter, setPriceFilter] = useState('');

  const priceRows = useMemo(() => {
    const rows: { key: string; label: string; crystal: number; cadence: string }[] = [];
    for (const b of s.bosses?.bosses ?? []) for (const d of b.difficulties) rows.push({ key: priceKey(b.id, d.key), label: `${d.key.charAt(0).toUpperCase()}${d.key.slice(1)} ${b.name}`, crystal: d.crystal, cadence: d.cadence });
    const f = priceFilter.trim().toLowerCase();
    return f ? rows.filter((r) => r.label.toLowerCase().includes(f)) : rows;
  }, [s.bosses, priceFilter]);

  const exportZip = async () => {
    setBusy(true);
    try {
      const blob = await buildExportZip({ ideas: s.ideas, photos: s.photos, assignments: s.assignments, clears: s.clears, prices: s.prices, settings: s.settings });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `maple-tracker-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally {
      setBusy(false);
    }
  };
  const importZip = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await readImportZip(file);
      const n = await s.importBundle(r);
      setMsg(`Imported ${n.ideas} ideas, ${n.clears} clears, ${n.assignments} assignments, ${n.photos} photos.`);
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" />
      {msg && (
        <div className="card p-3 text-sm mb-4 flex justify-between">
          <span>{msg}</span>
          <button className="text-ink-3" onClick={() => setMsg(null)}>
            ✕
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Data folder">
          <p className="text-sm text-ink-2 mb-3">Pick a folder on this PC and the app writes ideas, photos, boss clears and settings into it as plain JSON and PNG, plus a mirror of every snapshot. Chrome and Edge only; other browsers keep everything in browser storage and rely on export/import.</p>
          <div className="flex flex-wrap items-center gap-2">
            {!s.folder.supported ? (
              <Badge tone="warn">Not supported in this browser</Badge>
            ) : s.folder.connected ? (
              <>
                <Badge tone="good">Connected: {s.folder.name}</Badge>
                <button className="btn btn-sm" onClick={() => void s.connectFolder()}>
                  Change folder
                </button>
                <button className="btn-ghost btn-sm" onClick={() => void s.disconnectFolder()}>
                  Disconnect
                </button>
              </>
            ) : s.folder.needsPermission ? (
              <>
                <Badge tone="warn">Permission needed: {s.folder.name}</Badge>
                <button className="btn-accent btn-sm" onClick={() => void s.grantFolder()}>
                  Reconnect
                </button>
                <button className="btn-ghost btn-sm" onClick={() => void s.disconnectFolder()}>
                  Forget
                </button>
              </>
            ) : (
              <button className="btn-accent" onClick={() => void s.connectFolder()}>
                Choose data folder
              </button>
            )}
          </div>
        </Card>

        <Card title="Export / import">
          <p className="text-sm text-ink-2 mb-3">A zip with the board, photos, boss assignments, clears and price overrides. Import merges by id, so you can view a friend's history next to yours.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => void exportZip()} disabled={busy}>
              Export zip
            </button>
            <label className="btn cursor-pointer">
              Import zip
              <input type="file" accept=".zip" className="hidden" onChange={(e) => void importZip(e.target.files?.[0])} disabled={busy} />
            </label>
          </div>
        </Card>

        <Card title="Bossing">
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Weekly crystal cap" hint="GMS: 14 per character per week">
                <input type="number" className="input" min={1} max={180} value={s.settings.crystalCap} onChange={(e) => void s.saveSettings({ crystalCap: Math.max(1, Number(e.target.value) || 14) })} />
              </Field>
              <Field label="World crystal cap" hint="GMS: 180 per world per week">
                <input type="number" className="input" min={1} max={2000} value={s.settings.worldCrystalCap} onChange={(e) => void s.saveSettings({ worldCrystalCap: Math.max(1, Number(e.target.value) || 180) })} />
              </Field>
              <Field label="Heroic world" hint="Crystals sell for 5× in Kronos, Hyperion and Solis">
                <div className="pt-2">
                  <Toggle checked={s.settings.heroic} onChange={(v) => void s.saveSettings({ heroic: v })} label={s.settings.heroic ? '×5 applied' : 'regular values'} />
                </div>
              </Field>
            </div>
            <Field label="Hidden from bossing pages">
              <div className="flex flex-wrap gap-1.5">
                {names.map((n) => (
                  <button key={n} className={s.settings.hiddenCharacters.includes(n) ? 'chip' : 'chip-on'} onClick={() => void s.saveSettings({ hiddenCharacters: s.settings.hiddenCharacters.includes(n) ? s.settings.hiddenCharacters.filter((x) => x !== n) : [...s.settings.hiddenCharacters, n] })}>
                    {n}
                  </button>
                ))}
                {names.length === 0 && <span className="text-xs text-ink-3">No characters yet.</span>}
              </div>
            </Field>
            {s.settings.extraCharacters.length > 0 && (
              <Field label="Ledger-only characters">
                <div className="flex flex-wrap gap-1.5">
                  {s.settings.extraCharacters.map((n) => (
                    <span key={n} className="chip">
                      {n}
                      <button className="ml-1.5 text-ink-3 hover:text-bad" onClick={() => void s.saveSettings({ extraCharacters: s.settings.extraCharacters.filter((x) => x !== n) })} aria-label={`Remove ${n}`}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </Card>

        <Card title="Tracker">
          <Field label="Compare with" hint="Overlay another character (e.g. your friend's main) on the dashboard EXP chart.">
            <select className="input" value={s.settings.compareWith ?? ''} onChange={(e) => void s.saveSettings({ compareWith: e.target.value || null })}>
              <option value="">Nobody</option>
              {tracked.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <div className="text-sm text-ink-2 mt-4 space-y-1">
            <div>
              Snapshots: <span className="text-ink tabular">{s.snapshots.length}</span> · last collected {relTime(s.index?.updatedAt)}
            </div>
            <div>
              Characters configured: <span className="text-ink">{s.characters?.characters.map((c) => c.name).join(', ') || 'none'}</span> on {s.characters?.world ?? '—'}
            </div>
            <div className="text-xs text-ink-3">Add characters with the lookup below; remove one by editing data/characters.json in the repo.</div>
          </div>
        </Card>

        <AddCharacter />

        <Card title="AI generator key" className="lg:col-span-2">
          <p className="text-sm text-ink-2 mb-3">Optional. Your Anthropic API key is stored in this browser's IndexedDB only, never in the data folder or the repo. Requests go straight from the browser to api.anthropic.com. Set a spending limit on the Anthropic console.</p>
          <div className="flex flex-wrap items-center gap-2">
            {s.hasApiKey ? (
              <>
                <Badge tone="good">Key stored</Badge>
                <button className="btn-ghost btn-sm" onClick={() => void s.setApiKey(null)}>
                  Remove key
                </button>
              </>
            ) : (
              <>
                <input className="input max-w-md font-mono text-xs" type="password" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
                <button
                  className="btn-accent btn-sm"
                  disabled={!key.trim().startsWith('sk-ant-')}
                  onClick={() => {
                    void s.setApiKey(key.trim());
                    setKey('');
                  }}
                >
                  Save key
                </button>
              </>
            )}
          </div>
        </Card>

        <Card title={`Crystal values · ${s.bosses?.version ?? ''} as of ${s.bosses ? fmtDateLong(s.bosses.asOf) : '—'}`} className="lg:col-span-2" action={<input className="input w-48 py-0.5 text-xs" placeholder="Filter…" value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} />}>
          <p className="text-xs text-ink-3 mb-2">Base values for one party member from the MapleStory Wiki. Override any value; the override is stored in bossing/prices.json and only affects future clears. Heroic ×5 is applied on top.</p>
          <div className="max-h-96 overflow-y-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead className="text-left label sticky top-0 bg-surface">
                <tr>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium">Boss</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium">Reset</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right">Bundled</th>
                  <th className="py-1.5 px-2 first:pl-0 last:pr-0 font-medium text-right w-40">Override</th>
                </tr>
              </thead>
              <tbody>
                {priceRows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="py-1">{r.label}</td>
                    <td className="py-1 px-2 first:pl-0 last:pr-0 text-ink-3 text-xs">{r.cadence}</td>
                    <td className="py-1 px-2 first:pl-0 last:pr-0 text-right tabular text-ink-2">{fmtMeso(r.crystal)}</td>
                    <td className="py-1 px-2 first:pl-0 last:pr-0 text-right">
                      <input
                        type="number"
                        className="input py-0.5 text-xs text-right"
                        placeholder={String(r.crystal)}
                        value={s.prices[r.key] ?? ''}
                        onChange={(e) => void s.setPrice(r.key, e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
