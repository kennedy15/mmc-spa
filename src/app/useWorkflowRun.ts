import { useEffect, useRef, useState } from 'react';
import { githubToken } from '../lib/storage/persist';
import { dispatchWorkflow, failureReason, findRun, getRun, type RunFailure, type RunInfo, type Workflow } from '../lib/github';

export type RunInputs = Record<string, string>;

export type RunPhase =
  | { kind: 'idle' }
  | { kind: 'dispatching' }
  | { kind: 'waiting' }
  | { kind: 'running'; run: RunInfo }
  | { kind: 'done'; run: RunInfo; inputs: RunInputs }
  | { kind: 'failed'; run: RunInfo | null; inputs: RunInputs; message: string; reason: RunFailure | null };

/**
 * Starts one of the repo's workflows with the GitHub token stored in this
 * browser and follows the run to the end. `onSuccess` runs before the phase
 * turns 'done' (say, to reload what the run committed); `failed` is the
 * message for a failed run whose script left no reason.
 */
export function useWorkflowRun(workflow: Workflow) {
  const [phase, setPhase] = useState<RunPhase>({ kind: 'idle' });
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const start = async (inputs: RunInputs, { onSuccess, failed }: { onSuccess: () => Promise<void>; failed: string }) => {
    const tok = (await githubToken.get()) ?? '';
    if (!tok) return;
    setPhase({ kind: 'dispatching' });
    const since = new Date(Date.now() - 5000).toISOString();
    const res = await dispatchWorkflow(tok, workflow, inputs);
    if (!res.ok) return setPhase({ kind: 'failed', run: null, inputs, message: res.error, reason: null });
    setPhase({ kind: 'waiting' });

    const poll = async (runId: number | null, tries = 0) => {
      const run = runId ? await getRun(tok, runId) : await findRun(tok, workflow, since);
      if (!run) {
        if (tries > 20) return setPhase({ kind: 'failed', run: null, inputs, message: 'The workflow did not start. Check the Actions tab.', reason: null });
        timer.current = window.setTimeout(() => void poll(runId, tries + 1), 3000);
        return;
      }
      if (run.status !== 'completed') {
        setPhase({ kind: 'running', run });
        timer.current = window.setTimeout(() => void poll(run.id, tries + 1), 5000);
        return;
      }
      if (run.conclusion === 'success') {
        await onSuccess();
        setPhase({ kind: 'done', run, inputs });
      } else {
        const reason = await failureReason(tok, run.id);
        setPhase({ kind: 'failed', run, inputs, message: reason?.message ?? failed, reason });
      }
    };
    timer.current = window.setTimeout(() => void poll(res.runId), 4000);
  };

  const busy = phase.kind === 'dispatching' || phase.kind === 'waiting' || phase.kind === 'running';
  return { phase, busy, start };
}
