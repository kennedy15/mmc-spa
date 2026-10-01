/**
 * Minimal GitHub REST client for dispatching this repo's character workflows
 * (Add character, Rename character) and watching their runs. api.github.com
 * allows browser requests; a fine-grained token with Actions read/write on
 * this one repo is enough.
 */

/** "owner/name" of the repo the site was built from (vite.config.ts: GitHub Actions or the git remote). */
declare const __GITHUB_REPO__: string | null;

/** The repo this copy of the site belongs to: from the build, else from a <owner>.github.io/<repo>/ address. */
function thisRepo(): { owner: string; repo: string } | null {
  const built = typeof __GITHUB_REPO__ === 'string' ? __GITHUB_REPO__.split('/') : [];
  if (built.length === 2 && built[0] && built[1]) return { owner: built[0], repo: built[1] };
  const host = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!host) return null;
  const first = location.pathname.split('/').filter(Boolean)[0];
  return { owner: host[1], repo: first ?? `${host[1]}.github.io` };
}

const repo = thisRepo();
export const REPO = { owner: repo?.owner ?? '', repo: repo?.repo ?? '', branch: 'main' };
export const WORKFLOWS = { add: 'add-character.yml', rename: 'rename-character.yml' } as const;
export type Workflow = (typeof WORKFLOWS)[keyof typeof WORKFLOWS];
const API = 'https://api.github.com';

export interface RunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

/** Why a run failed, from the error annotation its script printed. */
export interface RunFailure {
  title: string;
  message: string;
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
 * Starts a workflow. With `return_run_details` GitHub answers 200 with the
 * new run's id; an older 204 reply has no body, so `runId` is null and the
 * caller finds the run by time instead.
 */
export async function dispatchWorkflow(token: string, workflow: Workflow, inputs: Record<string, string>): Promise<{ ok: true; runId: number | null } | { ok: false; error: string }> {
  if (!REPO.owner) return { ok: false, error: "This build doesn't know which GitHub repo it belongs to. Build it from a clone of the repo, or open it at its github.io address." };
  const r = await gh<{ message?: string; workflow_run_id?: number }>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: REPO.branch, inputs, return_run_details: true }),
  });
  if (r.ok) return { ok: true, runId: r.data?.workflow_run_id ?? null };
  if (r.status === 401) return { ok: false, error: 'GitHub rejected the token.' };
  if (r.status === 403 || r.status === 404) return { ok: false, error: 'The token cannot run workflows on this repo. It needs Actions: read and write.' };
  return { ok: false, error: r.data?.message ?? `GitHub returned HTTP ${r.status}.` };
}

/** Most recent run of the workflow created at or after `since` (ISO). Public repo: no token needed to read. */
export async function findRun(token: string | null, workflow: Workflow, since: string): Promise<RunInfo | null> {
  const r = await gh<{ workflow_runs: RunInfo[] }>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/workflows/${workflow}/runs?per_page=5&event=workflow_dispatch`, { cache: 'no-store' });
  const run = r.data?.workflow_runs?.find((x) => x.created_at >= since);
  return run ?? null;
}

export async function getRun(token: string | null, id: number): Promise<RunInfo | null> {
  const r = await gh<RunInfo>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/runs/${id}`, { cache: 'no-store' });
  return r.data;
}

/**
 * The first error a failed run's script reported with `::error title=…::`,
 * skipping GitHub's own "Process completed with exit code" note. Annotations
 * are read without the token, which may lack the Checks permission; that
 * works while the repo is public.
 */
export async function failureReason(token: string | null, runId: number): Promise<RunFailure | null> {
  try {
    const r = await gh<{ jobs: { conclusion: string | null; check_run_url: string }[] }>(token, `/repos/${REPO.owner}/${REPO.repo}/actions/runs/${runId}/jobs`, { cache: 'no-store' });
    for (const job of r.data?.jobs ?? []) {
      if (job.conclusion !== 'failure') continue;
      const a = await gh<{ annotation_level: string; title: string | null; message: string }[]>(null, `${new URL(job.check_run_url).pathname}/annotations`, { cache: 'no-store' });
      const hit = (a.ok ? a.data : null)?.find((x) => x.annotation_level === 'failure' && !x.message.startsWith('Process completed with exit code'));
      if (hit) return { title: hit.title ?? '', message: hit.message };
    }
  } catch {
    // No reason to show; the caller falls back to its own message.
  }
  return null;
}

export const workflowUrl = (workflow: Workflow) => `https://github.com/${REPO.owner}/${REPO.repo}/actions/workflows/${workflow}`;
export const tokenUrl = `https://github.com/settings/personal-access-tokens/new`;
