import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Card, Field, Badge } from '../../app/ui';
import { useWorkflowRun } from '../../app/useWorkflowRun';
import { REPO, tokenUrl, workflowUrl, WORKFLOWS } from '../../lib/github';
import { useTrackedNames } from '../tracker/hooks';

export function AddCharacter() {
  const hasToken = useStore((s) => s.hasGithubToken);
  const setGithubToken = useStore((s) => s.setGithubToken);
  const reload = useStore((s) => s.reloadRepoData);
  const characters = useStore((s) => s.characters);
  const worlds = useStore((s) => s.worlds);
  const snapshots = useStore((s) => s.snapshots);
  const [name, setName] = useState('');
  const [role, setRole] = useState('mule');
  const [owner, setOwner] = useState('me');
  const [world, setWorld] = useState('');
  const [token, setToken] = useState('');
  const { phase, busy, start } = useWorkflowRun(WORKFLOWS.add);
  const tracked = useTrackedNames();

  const already = characters?.characters.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  // A character renamed in game drops out of the rankings under its old name.
  const unranked = (snapshots[snapshots.length - 1]?.missing ?? []).filter((n) => tracked.includes(n));

  const submit = () => {
    const submitted = name.trim();
    if (!submitted) return;
    void start(
      { name: submitted, role, owner, world },
      {
        onSuccess: async () => {
          await reload();
          setName('');
        },
        failed: 'Lookup failed. Usually the name is misspelled or not in the rankings; the run log has the details.',
      },
    );
  };

  return (
    <Card title="Add a character by name" className="lg:col-span-2">
      <p className="text-sm text-ink-2 mb-3">
        Nexon's rankings block browser requests, so the lookup runs as a GitHub Action: it finds the character, adds it to <code className="font-mono text-ink">data/characters.json</code>, takes a snapshot and redeploys the site (about two minutes). It needs a GitHub token that can run workflows on this repo.
      </p>
      {!hasToken ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-md py-1 font-mono text-xs" type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
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
            Create a <a className="underline hover:text-ink" href={tokenUrl} target="_blank" rel="noreferrer">fine-grained token</a> for the <span className="text-ink">{REPO.repo}</span> repo only, with <span className="text-ink">Actions: read and write</span> (and the default Metadata: read). Stored in this browser only. Without a token you can still run the <a className="underline hover:text-ink" href={workflowUrl(WORKFLOWS.add)} target="_blank" rel="noreferrer">Add character workflow</a> from the Actions tab.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Character name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Exactly as in game" disabled={busy} onKeyDown={(e) => e.key === 'Enter' && !busy && !already && submit()} />
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
          {unranked.length > 0 && (
            <p className="text-xs text-ink-3">
              Not in the latest rankings:{' '}
              {unranked.map((n, i) => (
                <Fragment key={n}>
                  {i > 0 && ', '}
                  <Link className="underline hover:text-ink" to={`/character/${encodeURIComponent(n)}`}>
                    {n}
                  </Link>
                </Fragment>
              ))}
              . If one was renamed in game, use Update name on its page rather than adding the new name, so its history carries over.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-accent" onClick={submit} disabled={busy || !name.trim() || already}>
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
                {phase.inputs.name} added and snapshotted. The site redeploys in a minute; the roster here is already updated.
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
