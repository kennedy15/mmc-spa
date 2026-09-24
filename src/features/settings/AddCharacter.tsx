import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Card, Field, Badge } from '../../app/ui';
import { githubToken as tokenStore } from '../../lib/storage/persist';
import { actionsUrl, dispatchAddCharacter, findRun, getRun, tokenUrl, type RunInfo } from '../../lib/github';

type Phase = { kind: 'idle' } | { kind: 'dispatching' } | { kind: 'waiting'; since: string } | { kind: 'running'; run: RunInfo } | { kind: 'done'; run: RunInfo; name: string } | { kind: 'failed'; run: RunInfo | null; message: string };

export function AddCharacter() {
  const hasToken = useStore((s) => s.hasGithubToken);
  const setGithubToken = useStore((s) => s.setGithubToken);
  const reload = useStore((s) => s.reloadRepoData);
  const characters = useStore((s) => s.characters);
  const worlds = useStore((s) => s.worlds);
  const [name, setName] = useState('');
  const [role, setRole] = useState('mule');
  const [owner, setOwner] = useState('me');
  const [world, setWorld] = useState('');
  const [token, setToken] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const busy = phase.kind === 'dispatching' || phase.kind === 'waiting' || phase.kind === 'running';
  const already = characters?.characters.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());

  const poll = async (tok: string, since: string, runId: number | null, submitted: string, tries = 0) => {
    const run = runId ? await getRun(tok, runId) : await findRun(tok, since);
    if (!run) {
      if (tries > 20) return setPhase({ kind: 'failed', run: null, message: 'The workflow did not start. Check the Actions tab.' });
      timer.current = window.setTimeout(() => void poll(tok, since, runId, submitted, tries + 1), 3000);
      return;
    }
    if (run.status !== 'completed') {
      setPhase({ kind: 'running', run });
      timer.current = window.setTimeout(() => void poll(tok, since, run.id, submitted, tries + 1), 5000);
      return;
    }
    if (run.conclusion === 'success') {
      await reload();
      setPhase({ kind: 'done', run, name: submitted });
      setName('');
    } else {
      setPhase({ kind: 'failed', run, message: 'Lookup failed. Usually the name is misspelled or not in the rankings; the run log has the details.' });
    }
  };

  const submit = async () => {
    const tok = (await tokenStore.get()) ?? '';
    const submitted = name.trim();
    if (!tok || !submitted) return;
    setPhase({ kind: 'dispatching' });
    const since = new Date(Date.now() - 5000).toISOString();
    const res = await dispatchAddCharacter(tok, { name: submitted, role, owner, world });
    if (!res.ok) return setPhase({ kind: 'failed', run: null, message: res.error });
    setPhase({ kind: 'waiting', since });
    timer.current = window.setTimeout(() => void poll(tok, since, res.runId, submitted), 4000);
  };

  return (
    <Card title="Add a character by name" className="lg:col-span-2">
      <p className="text-sm text-ink-2 mb-3">
        Nexon's rankings block browser requests, so the lookup runs as a GitHub Action: it finds the character, adds it to <code className="font-mono text-ink">data/characters.json</code>, takes a snapshot and redeploys the site (about two minutes). It needs a GitHub token that can run workflows on this repo.
      </p>
      {!hasToken ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-md font-mono text-xs" type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
          <button
            className="btn-accent btn-sm"
            disabled={token.trim().length < 20}
            onClick={() => {
              void setGithubToken(token.trim());
              setToken('');
            }}
          >
            Save token
          </button>
          <span className="text-xs text-ink-3 basis-full">
            Create a <a className="underline hover:text-ink" href={tokenUrl} target="_blank" rel="noreferrer">fine-grained token</a> for the <span className="text-ink">mmc-spa</span> repo only, with <span className="text-ink">Actions: read and write</span> (and the default Metadata: read). Stored in this browser only. Without a token you can still run the <a className="underline hover:text-ink" href={actionsUrl} target="_blank" rel="noreferrer">Add character workflow</a> from the Actions tab.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Character name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Exactly as in game" disabled={busy} onKeyDown={(e) => e.key === 'Enter' && !busy && !already && void submit()} />
            </Field>
            <Field label="Role">
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
                <option value="mule">mule</option>
                <option value="main">main</option>
                <option value="legion">legion</option>
                <option value="bossing">bossing</option>
                <option value="friend-main">friend-main</option>
              </select>
            </Field>
            <Field label="Owner">
              <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)} disabled={busy}>
                <option value="me">me</option>
                <option value="friend">friend</option>
              </select>
            </Field>
            <Field label="World" hint={`blank = ${characters?.world ?? 'configured world'}`}>
              <select className="input" value={world} onChange={(e) => setWorld(e.target.value)} disabled={busy}>
                <option value="">Same as account</option>
                {Object.entries(worlds).map(([id, w]) => (
                  <option key={id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-accent" onClick={() => void submit()} disabled={busy || !name.trim() || already}>
              {busy ? 'Working…' : 'Look up and add'}
            </button>
            {already && <Badge tone="warn">already tracked</Badge>}
            {phase.kind === 'dispatching' && <span className="text-sm text-ink-2">Starting the workflow…</span>}
            {phase.kind === 'waiting' && <span className="text-sm text-ink-2">Waiting for the run to start…</span>}
            {phase.kind === 'running' && (
              <span className="text-sm text-ink-2">
                Looking up and snapshotting… <a className="underline" href={phase.run.html_url} target="_blank" rel="noreferrer">view run</a>
              </span>
            )}
            {phase.kind === 'done' && (
              <span className="text-sm text-good">
                {phase.name} added and snapshotted. The site redeploys in a minute; the roster here is already updated.
              </span>
            )}
            {phase.kind === 'failed' && (
              <span className="text-sm text-bad">
                {phase.message}{' '}
                {phase.run && <a className="underline" href={phase.run.html_url} target="_blank" rel="noreferrer">view run</a>}
              </span>
            )}
            <button className="btn-ghost btn-sm ml-auto" onClick={() => void setGithubToken(null)} disabled={busy}>
              Remove token
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
