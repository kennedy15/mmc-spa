#!/usr/bin/env node
// Turn a copy of this repo into your own tracker: the characters, snapshots
// and sprites copied from the original are replaced with yours. The "Set up
// my copy" workflow (Actions tab) runs this, then takes your first snapshot,
// commits and redeploys.
//
// Usage: node scripts/setup-copy.mjs --world Kronos --characters "Main, Mule1, Mule2" [--start-over] [--repo owner/name]
//
// The first name is your main. Names may be separated by commas, spaces or
// new lines (MapleStory names have no spaces). Every name is looked up in the
// rankings; if any is missing the run fails after listing all of them, so the
// workflow commits nothing.
// It refuses to run in the original repo (ORIGINAL_REPO / ORIGINAL_REPO_ID in
// repo-guard.mjs, so a rename does not get past it), and in a copy that is
// already set up unless --start-over is given.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGINAL_REPO, fail, isOriginal, runningIn, runningInId, sameRepo } from './repo-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const startOver = args.includes('--start-over');

const repo = opt('repo') ?? runningIn();
if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) fail('Unknown repo', 'Run this from the "Set up my copy" workflow, or pass --repo owner/name.');
// The id is known only for the repo the Actions run belongs to.
const repoId = runningIn() && sameRepo(repo, runningIn()) ? runningInId() : null;
if (isOriginal(repo, repoId)) fail('This is the original repo', `${ORIGINAL_REPO} keeps its own characters; setup only runs in a copy of it.`);

const cfgPath = path.join(DATA_DIR, 'characters.json');
const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
const alreadyMine = !!cfg.repo && (cfg.repoId != null && repoId ? String(cfg.repoId) === String(repoId) : sameRepo(cfg.repo, repo));
if (alreadyMine && !startOver) fail('Already set up', `This repo already tracks its own characters. Tick "Start over" to replace them (their snapshots are deleted).`);

const worlds = JSON.parse(await readFile(path.join(ROOT, 'public', 'worlds.json'), 'utf8')).worlds;
const wantWorld = (opt('world') ?? '').trim();
const worldId = /^\d+$/.test(wantWorld) ? Number(wantWorld) : Number(Object.entries(worlds).find(([, w]) => w.name.toLowerCase() === wantWorld.toLowerCase())?.[0]);
if (!worlds[worldId]) fail('Unknown world', `"${wantWorld}" is not a world in public/worlds.json. Use one of: ${Object.values(worlds).map((w) => w.name).join(', ')}.`);

const names = [];
for (const raw of (opt('characters') ?? '').split(/[\s,;]+/)) {
  const n = raw.replace(/^["'`]+|["'`.]+$/g, '');
  if (n && !names.some((m) => m.toLowerCase() === n.toLowerCase())) names.push(n);
}
if (!names.length) fail('No characters', 'List your character names, main first, separated by commas.');

// Start from an empty data folder that belongs to this repo.
await rm(path.join(DATA_DIR, 'snapshots'), { recursive: true, force: true });
await rm(path.join(DATA_DIR, 'looks'), { recursive: true, force: true });
await mkdir(path.join(DATA_DIR, 'snapshots'), { recursive: true });
await mkdir(path.join(DATA_DIR, 'looks'), { recursive: true });
await writeFile(path.join(DATA_DIR, 'snapshots', '.gitkeep'), '');
await writeFile(path.join(DATA_DIR, 'looks', '.gitkeep'), '');
await writeFile(path.join(DATA_DIR, 'index.json'), JSON.stringify({ updatedAt: null, dates: [] }, null, 2) + '\n');
await writeFile(cfgPath, JSON.stringify({ repo, ...(repoId ? { repoId: Number(repoId) } : {}), world: worlds[worldId].name, worldId, characters: [] }, null, 2) + '\n');

// add-character.mjs checks each name against the rankings and records the world it plays on.
// Every name is tried, so one run reports every misspelling at once.
const env = { ...process.env, GITHUB_REPOSITORY: repo };
const failed = [];
for (const [i, name] of names.entries()) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'add-character.mjs'), name, '--role', i === 0 ? 'main' : 'mule', '--owner', 'me', '--world', String(worldId)], { stdio: 'inherit', env });
  } catch {
    failed.push(name); // add-character printed why
  }
}
if (failed.length) {
  fail(
    'Names not added',
    `Not added: ${failed.join(', ')} (the other errors say why). Nothing was saved. Check the spelling (capital I and small l look alike, so do 0 and O) and run "Set up my copy" again with the corrected list. A character on another world: leave it out, then add it with the "Add character" workflow, filling in its world.`,
  );
}
console.log(`Set up ${repo} for ${names.length} character(s) on ${worlds[worldId].name}: ${names.join(', ')}. Main: ${names[0]}.`);
