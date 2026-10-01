// Which repo a data/ folder belongs to, so a copy of this repo (a friend's
// tracker) never keeps collecting or publishing the original's characters,
// and the setup script can never wipe the original's data.
//
// data/characters.json "repo" names the repo the data was set up for
// ("owner/name") and "repoId" its numeric GitHub id, which survives renaming
// or transferring the repo (a copy or a fork always gets a new id). GitHub
// Actions sets GITHUB_REPOSITORY and GITHUB_REPOSITORY_ID to the repo a run
// belongs to. Outside Actions there is nothing to compare, so local runs
// (npm run snapshot) work as before.
//
// Run directly (`node scripts/repo-guard.mjs`, the deploy workflow does) it
// writes ready=true|false to $GITHUB_OUTPUT: false while data/ still belongs
// to another repo, so a fresh copy never publishes the original's characters.
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repo this project started in. Its data is never replaced by setup-copy.mjs. */
export const ORIGINAL_REPO = 'kennedy15/mmc-spa';
/** Its GitHub id: still the same after a rename or a transfer. */
export const ORIGINAL_REPO_ID = '1381722736';

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** The repo the current GitHub Actions run belongs to, or null outside Actions. */
export function runningIn() {
  return process.env.GITHUB_REPOSITORY || null;
}

/** Its numeric id as a string, or null outside Actions. */
export function runningInId() {
  return process.env.GITHUB_REPOSITORY_ID || null;
}

/** True when the run (or `repo` / `repoId`) is the original repo, even renamed. */
export function isOriginal(repo = runningIn(), repoId = runningInId()) {
  return (repoId != null && String(repoId) === ORIGINAL_REPO_ID) || (repo != null && same(repo, ORIGINAL_REPO));
}

/** True unless this is an Actions run in a repo whose data/ still belongs to another repo. */
export function dataIsForThisRepo(cfg) {
  const here = runningIn();
  if (!here || !cfg?.repo) return true;
  const hereId = runningInId();
  if (cfg.repoId != null && hereId) return String(cfg.repoId) === String(hereId);
  return same(cfg.repo, here);
}

export function notSetUpMessage(cfg) {
  return `This repo still holds the data copied from ${cfg.repo}. Run the "Set up my copy" workflow (Actions tab) with your own world and characters first.`;
}

/** A GitHub Actions error annotation (the app shows its title and message), or plain stderr locally; exits 1. */
export function fail(title, message) {
  if (process.env.GITHUB_ACTIONS) {
    const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::error title=${esc(title).replace(/:/g, '%3A').replace(/,/g, '%2C')}::${esc(message)}`);
  } else {
    console.error(message);
  }
  process.exit(1);
}

export { same as sameRepo };

// CLI: the deploy workflow's check. Unreadable data counts as ready, so the
// check never stops a deploy that would have worked before it existed.
if (path.basename(process.argv[1] ?? '') === 'repo-guard.mjs') {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = await readFile(path.join(root, 'data', 'characters.json'), 'utf8').then(JSON.parse, () => null);
  const ready = dataIsForThisRepo(cfg);
  if (!ready) console.log(`::notice title=Not published yet::${notSetUpMessage(cfg)} The site is published after that.`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `ready=${ready}\n`);
  else console.log(`ready=${ready}`);
}
