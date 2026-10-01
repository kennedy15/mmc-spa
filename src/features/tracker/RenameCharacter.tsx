import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Field, Modal } from '../../app/ui';
import { fmtDate } from '../../app/format';
import { useWorkflowRun } from '../../app/useWorkflowRun';
import { WORKFLOWS, workflowUrl } from '../../lib/github';
import type { NameSpan } from '../../lib/renames';

/** The title scripts/rename-character.mjs gives its error when the new name fails the same-character checks. */
const NOT_SAME = 'Not the same character?';

/**
 * "Update name": after a name change in game, points the tracker at the new
 * name through the Rename character workflow. The character keeps everything
 * recorded under the old one.
 */
export function RenameCharacter({ name, spans }: { name: string; spans: NameSpan[] }) {
  const hasToken = useStore((s) => s.hasGithubToken);
  const characters = useStore((s) => s.characters);
  const reload = useStore((s) => s.reloadRepoData);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const { phase, busy, start } = useWorkflowRun(WORKFLOWS.rename);

  const next = to.trim();
  const unchanged = next.toLowerCase() === name.toLowerCase();
  const taken = characters?.characters.find((c) => c.name !== name && c.name.toLowerCase() === next.toLowerCase());
  const ready = !!next && !unchanged && !taken && !busy;

  const rename = (from: string, newName: string, force: boolean) =>
    void start(
      { from, to: newName, force: String(force) },
      {
        onSuccess: async () => {
          await reload();
          setTo('');
        },
        failed: 'The rename failed; the run log has the details.',
      },
    );

  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        {busy ? 'Renaming…' : 'Update name'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Update name">
        <div className="space-y-4 text-sm">
          <p className="text-ink-2">
            Changed this character's name in game? Enter the new one. From then on the daily snapshot looks it up by the new name, and everything recorded as {name} (EXP history, looks, boss clears, goals) stays with it.
          </p>
          {spans.length > 0 && (
            <div>
              <div className="label mb-1.5">Name history</div>
              <ol className="space-y-1">
                {spans.map((s) => (
                  <li key={s.from} className="flex items-baseline justify-between gap-3">
                    <span className={s.name === name ? 'font-medium' : 'text-ink-2'}>{s.name}</span>
                    <span className="text-xs text-ink-3 tabular">
                      {fmtDate(s.from)}
                      {s.to !== s.from && ` – ${fmtDate(s.to)}`}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {!hasToken ? (
            <p className="text-ink-2">
              The rename runs the{' '}
              <a className="underline hover:text-ink" href={workflowUrl(WORKFLOWS.rename)} target="_blank" rel="noreferrer">
                Rename character workflow
              </a>{' '}
              on GitHub with the token that adding a character uses. Save one in{' '}
              <Link className="underline hover:text-ink" to="/settings">
                Settings
              </Link>{' '}
              first, or run the workflow from the Actions tab.
            </p>
          ) : (
            <>
              <Field
                label="New name"
                hint={taken ? <span className="text-warn">{taken.name} is already tracked.</span> : next && unchanged ? <span className="text-warn">That is its current name.</span> : "Nexon's rankings must list it already; they update about once a day."}
              >
                <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Exactly as in game" autoFocus disabled={busy} onKeyDown={(e) => e.key === 'Enter' && ready && rename(name, next, false)} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-accent" disabled={!ready} onClick={() => rename(name, next, false)}>
                  {busy ? 'Working…' : 'Rename'}
                </button>
                {phase.kind === 'dispatching' && <span className="text-ink-2">Starting the workflow…</span>}
                {phase.kind === 'waiting' && <span className="text-ink-2">Waiting for the run to start…</span>}
                {phase.kind === 'running' && (
                  <span className="text-ink-2">
                    Checking the rankings and snapshotting… <a className="underline" href={phase.run.html_url} target="_blank" rel="noreferrer">view run</a>
                  </span>
                )}
              </div>
              {phase.kind === 'done' && (
                <p className="text-good">
                  Renamed {phase.inputs.from} to {phase.inputs.to}. The daily snapshot looks up the new name from now on.
                </p>
              )}
              {phase.kind === 'failed' && (
                <div className="space-y-2">
                  <p className="text-bad">
                    {phase.message}{' '}
                    {phase.run && (
                      <a className="underline" href={phase.run.html_url} target="_blank" rel="noreferrer">
                        view run
                      </a>
                    )}
                  </p>
                  {phase.reason?.title === NOT_SAME && (
                    <button className="btn btn-sm" onClick={() => rename(phase.inputs.from, phase.inputs.to, true)}>
                      Rename anyway
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
