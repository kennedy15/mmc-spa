#!/usr/bin/env node
// Rename a tracked character after a name change in game, keeping its history.
// In data/characters.json the new name replaces the old one, which moves to the
// entry's `formerNames` with today's date; the app files snapshots taken before
// that date under the new name. The look archive moves to data/looks/<new name>/.
//
// Usage: node scripts/rename-character.mjs <current name> <new name> [--force]
//
// The new name must be in the rankings on the character's world. It must also
// look like the same character: same job, no lower level than last recorded,
// and the old name gone from the rankings. --force skips those three checks.
// Failures print a GitHub Actions error annotation, which the app shows.
//
// Env:
//   SNAPSHOT_DATE  the first snapshot date under the new name (YYYY-MM-DD, UTC). Default: today.
//   DATA_DIR       override the data directory. Default ./data next to the repo root.
import { access, copyFile, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataIsForThisRepo, notSetUpMessage } from './repo-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
// The rankings are split by region: Luna and Solis are only in /eu (worlds.json "region").
const API = 'https://www.nexon.com/api/maplestory/no-auth/ranking/v2';
// The app looks for this title to offer "Rename anyway".
const NOT_SAME = 'Not the same character?';

const args = process.argv.slice(2);
const force = args.includes('--force');
const [from, to] = args.filter((a) => !a.startsWith('--')).map((a) => a.trim());
if (!from || !to) {
  console.error('usage: rename-character.mjs <current name> <new name> [--force]');
  process.exit(2);
}

function fail(title, message) {
  if (process.env.GITHUB_ACTIONS) {
    const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::error title=${esc(title).replace(/:/g, '%3A').replace(/,/g, '%2C')}::${esc(message)}`);
  } else {
    console.error(message);
  }
  process.exit(1);
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const exists = (p) => access(p).then(() => true, () => false);
const readJson = async (p, fallback) => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(fallback)));

const cfgPath = path.join(DATA_DIR, 'characters.json');
const cfg = await readJson(cfgPath, null);
if (!dataIsForThisRepo(cfg)) fail('Not set up yet', notSetUpMessage(cfg));
const worlds = (await readJson(path.join(ROOT, 'public', 'worlds.json'), { worlds: {} })).worlds;
const worldName = (id) => worlds[id]?.name ?? String(id);

const entry = cfg?.characters?.find((c) => same(c.name, from));
if (!entry) fail('Not tracked', `${from} is not in data/characters.json.`);
if (same(entry.name, to)) fail('Same name', `${entry.name} already has that name. Names are not case-sensitive in MapleStory.`);
const other = cfg.characters.find((c) => c !== entry && same(c.name, to));
if (other) fail('Already tracked', `${other.name} is already tracked as a separate character.`);

// Same resolution as snapshot.mjs.
const byName = Object.entries(worlds).find(([, w]) => w.name.toLowerCase() === String(entry.world ?? cfg.world ?? '').toLowerCase());
const worldId = entry.worldId != null ? Number(entry.worldId) : cfg.worldId != null ? Number(cfg.worldId) : byName ? Number(byName[0]) : null;
if (worldId == null) fail('Unknown world', `Cannot tell which world ${entry.name} plays on; set worldId in characters.json.`);

async function ranked(name) {
  const res = await fetch(`${API}/${worlds[worldId]?.region ?? 'na'}?${new URLSearchParams({ type: 'overall', id: 'legendary', reboot_index: 0, page_index: 1, character_name: name })}`, { headers: { accept: 'application/json' } });
  if (!res.ok) fail('Rankings unavailable', `Nexon's rankings returned HTTP ${res.status}. Try again later.`);
  const rows = JSON.parse((await res.text()).replace(/"(exp|gap)":(-?\d+)/g, '"$1":"$2"')).ranks ?? [];
  return rows.filter((r) => same(r.characterName, name));
}

const found = await ranked(to);
const row = found.find((r) => r.worldID === worldId);
if (!row) {
  const where = found.map((r) => `${r.characterName} on ${worldName(r.worldID)}`).join(', ');
  fail(
    'Not in rankings',
    where
      ? `${to} is not on ${worldName(worldId)}, where ${entry.name} plays; found ${where}.`
      : `${to} is not in the GMS rankings yet. Nexon updates them about once a day, so a name changed in game today can take until tomorrow to show up. Check the spelling (I vs l, 0 vs O) and try again later.`,
  );
}

// The latest snapshot row under the current name, or under a former name before it changed.
async function lastRecorded() {
  const index = await readJson(path.join(DATA_DIR, 'index.json'), { dates: [] });
  for (const date of [...(index.dates ?? [])].sort().reverse()) {
    const snap = await readJson(path.join(DATA_DIR, 'snapshots', `${date}.json`), null);
    const hit = snap?.rows?.find((r) => same(r.name, entry.name) || (entry.formerNames ?? []).some((f) => same(r.name, f.name) && (!f.renamedOn || date < f.renamedOn)));
    if (hit) return { ...hit, date };
  }
  return null;
}

if (!force) {
  const last = await lastRecorded();
  const problems = [];
  const aJob = (job) => (/^[aeiou]/i.test(job) ? `an ${job}` : `a ${job}`);
  if (last && row.jobName !== last.job) problems.push(`${row.characterName} is ${aJob(row.jobName)}, but ${entry.name} was ${aJob(last.job)}`);
  if (last && row.level < last.level) problems.push(`${row.characterName} is Lv.${row.level}, but ${entry.name} was already Lv.${last.level} on ${last.date}`);
  const still = (await ranked(entry.name)).find((r) => r.worldID === worldId);
  if (still) problems.push(`${still.characterName} is still in the rankings (Lv.${still.level} ${still.jobName})`);
  if (problems.length) fail(NOT_SAME, `${problems.join('; ')}. If ${row.characterName} really is ${entry.name} renamed, rename anyway.`);
}

// Moves data/looks/<old>/ to data/looks/<new>/, merging by hash if the new name somehow has an archive already.
async function moveLooks(oldName, newName) {
  const root = path.join(DATA_DIR, 'looks');
  const dirs = await readdir(root).catch(() => []);
  const srcName = dirs.find((d) => same(d, oldName));
  if (!srcName) return;
  const src = path.join(root, srcName);
  const dst = path.join(root, newName);
  if (!(await exists(dst))) {
    await rename(src, dst);
    return;
  }
  const into = await readJson(path.join(dst, 'index.json'), []);
  for (const e of await readJson(path.join(src, 'index.json'), [])) {
    const had = into.find((x) => x.hash === e.hash);
    if (had) {
      if (e.firstSeen < had.firstSeen) had.firstSeen = e.firstSeen;
      if (e.lastSeen > had.lastSeen) had.lastSeen = e.lastSeen;
    } else {
      await copyFile(path.join(src, `${e.hash}.png`), path.join(dst, `${e.hash}.png`));
      into.push(e);
    }
  }
  into.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  await writeFile(path.join(dst, 'index.json'), JSON.stringify(into, null, 2) + '\n');
  await rm(src, { recursive: true });
}

const oldName = entry.name;
entry.name = row.characterName;
entry.formerNames = [...(entry.formerNames ?? []), { name: oldName, renamedOn: process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10) }];
await moveLooks(oldName, entry.name);
await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`Renamed ${oldName} to ${entry.name}: Lv.${row.level} ${row.jobName} on ${worldName(worldId)}, rank #${row.rank}.${force ? ' Same-character checks skipped.' : ''}`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `Renamed **${oldName}** to **${entry.name}** (Lv.${row.level} ${row.jobName}, ${worldName(worldId)})\n`, { flag: 'a' });
