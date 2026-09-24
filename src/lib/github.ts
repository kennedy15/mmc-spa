/**
 * Minimal GitHub REST client for dispatching the "Add character" workflow
 * and watching its run. api.github.com allows browser requests; a
 * fine-grained token with Actions read/write on this one repo is enough.
 */
export const REPO = { owner: 'kennedy15', repo: 'mmc-spa', workflow: 'add-character.yml', branch: 'main' };
const API = 'https://api.github.com';

export interface RunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

async function gh<T>(token: string | null, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null }> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(init.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { ...init, headers });
  const text = await r.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data };
}

/**
 * Starts the workflow. With `return_run_details` GitHub answers 200 with the
 * new run's id; an older 204 reply has no body, so `runId` is null and the
 * caller finds the run by time instead.
 */
export async function dispatchAddCharacter(token: string, inputs: { name: string; role: string; owner: string; world: string }): Promise<{ ok: true; runId: number | null } | { ok: false; error: string }> {
  const r = await gh<{ message?: string; workflow_run_id?: number }>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/workflows/${REPO.workflow}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: REPO.branch, inputs, return_run_details: true }),
  });
  if (r.ok) return { ok: true, runId: r.data?.workflow_run_id ?? null };
  if (r.status === 401) return { ok: false, error: 'GitHub rejected the token.' };
  if (r.status === 403 || r.status === 404) return { ok: false, error: 'The token cannot run workflows on this repo. It needs Actions: read and write.' };
  return { ok: false, error: r.data?.message ?? `GitHub returned HTTP ${r.status}.` };
}

/** Most recent run of the workflow created at or after `since` (ISO). Public repo: no token needed to read. */
export async function findRun(token: string | null, since: string): Promise<RunInfo | null> {
  const r = await gh<{ workflow_runs: RunInfo[] }>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/workflows/${REPO.workflow}/runs?per_page=5&event=workflow_dispatch`, { cache: 'no-store' });
  const run = r.data?.workflow_runs?.find((x) => x.created_at >= since);
  return run ?? null;
}

export async function getRun(token: string | null, id: number): Promise<RunInfo | null> {
  const r = await gh<RunInfo>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/runs/${id}`, { cache: 'no-store' });
  return r.data;
}

export const actionsUrl = `https://github.com/${REPO.owner}/${REPO.repo}/actions/workflows/${REPO.workflow}`;
export const tokenUrl = `https://github.com/settings/personal-access-tokens/new`;
