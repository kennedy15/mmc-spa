#!/usr/bin/env node
// Daily collector: reads data/characters.json, looks each character up in
// Nexon's public GMS rankings, and writes data/snapshots/<date>.json plus
// data/looks/<name>/<hash>.png when a character's look changes.
//
// One overall-ranking request per character, then one legion-ranking request
// per account and world: the legion row is filed under the account's
// highest-level character (see legion.mjs), so only that row carries
// legionLevel / legionRank / raidPower.
//
// No dependencies beyond Node 20's built-in fetch and crypto. Runs in the
// GitHub Action (see .github/workflows/snapshot.yml) or locally with
// `npm run snapshot`.
//
// Env:
//   SNAPSHOT_DATE   override the snapshot date (YYYY-MM-DD, UTC). Default: today.
//   RETRY_DELAY_MS  wait before retrying a whole run after a 403/5xx. Default 0 (no retry).
//   REQUEST_GAP_MS  pause between requests. Default 400.
//   DATA_DIR        override the data directory. Default ./data next to the repo root.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legionCandidates } from './legion.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const API = 'https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na';
const GAP = Number(process.env.REQUEST_GAP_MS ?? 400);
const RETRY_DELAY = Number(process.env.RETRY_DELAY_MS ?? 0);
const PLACEHOLDER_NAMES = new Set(['YourMain', 'Mule01']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayUtc = () => new Date().toISOString().slice(0, 10);

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}
async function readJson(p, fallback) {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
}
async function writeJsonIfChanged(p, value) {
  const next = JSON.stringify(value, null, 2) + '\n';
  const prev = (await exists(p)) ? await readFile(p, 'utf8') : null;
  if (prev === next) return false;
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, next);
  return true;
}

class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status} for ${url}`); this.status = status; }
}

// exp can exceed 2^53 once characters sit at the level cap, so quote the
// integer before JSON.parse ever sees it.
function parseRanking(text) {
  const quoted = text.replace(/"(exp|gap)":(-?\d+)/g, '"$1":"$2"');
  return JSON.parse(quoted);
}

async function fetchRanking(params) {
  const url = `${API}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'maple-tracker/1.0 (+github actions; 1 request per character plus 1 per legion, daily)' } });
  if (!res.ok) throw new HttpError(res.status, url);
  return parseRanking(await res.text());
}

async function lookupCharacter(name, worldId) {
  // Overall ranking filtered by name. The list is global, so filter by world
  // to avoid picking up a same-named character elsewhere.
  const overall = await fetchRanking({ type: 'overall', id: 'legendary', reboot_index: 0, page_index: 1, character_name: name });
  const row = (overall.ranks ?? []).find((r) => r.worldID === worldId && r.characterName.toLowerCase() === name.toLowerCase());
  if (!row) return null;
  return {
    name: row.characterName,
    level: row.level,
    exp: String(row.exp),
    job: row.jobName,
    worldId: row.worldID,
    rank: row.rank,
    rankChange: Number(row.gap ?? 0),
    // Filled in afterwards for the one character that reports the legion.
    legionLevel: null,
    legionRank: null,
    raidPower: null,
    imgUrl: row.characterImgURL,
    lookHash: null,
  };
}

// The legion ranking only lists an account under its reporting character, so
// asking about any other character returns no row for the world.
async function lookupLegion(name, worldId) {
  try {
    const l = await fetchRanking({ type: 'legion', id: worldId, reboot_index: 0, page_index: 1, character_name: name });
    return (l.ranks ?? []).find((r) => r.worldID === worldId && r.characterName.toLowerCase() === name.toLowerCase()) ?? null;
  } catch (e) {
    if (!(e instanceof HttpError) || e.status >= 500 || e.status === 403) throw e;
    return null;
  }
}

// Attach legion data to the reporting row of each account/world group. The
// previous snapshot's reporter keeps the row on a level tie (see legion.mjs).
async function collectLegions(rows, previous) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.owner}|${r.worldId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [key, members] of groups) {
    const incumbent = previous?.rows?.find((r) => r.legionLevel != null && `${r.owner ?? 'me'}|${r.worldId}` === key)?.name ?? null;
    let found = false;
    for (const name of legionCandidates(members, incumbent)) {
      const legion = await lookupLegion(name, members[0].worldId);
      await sleep(GAP);
      if (!legion) continue;
      const row = members.find((r) => r.name === name);
      row.legionLevel = legion.legionLevel ?? null;
      row.legionRank = legion.rank ?? null;
      row.raidPower = legion.raidPower ?? null;
      console.log(`Legion ${row.legionLevel} (#${row.legionRank}) reported by ${name}${incumbent && incumbent !== name ? ` (was ${incumbent})` : ''}`);
      found = true;
      break;
    }
    if (!found) console.warn(`No legion row found for ${key}; its reporting character may not be in characters.json.`);
  }
}

// Latest snapshot on or before `date`, to learn who reported the legion.
async function latestSnapshot(date) {
  const index = await readJson(path.join(DATA_DIR, 'index.json'), { dates: [] });
  const dates = (index.dates ?? []).filter((d) => d <= date).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const snap = await readJson(path.join(DATA_DIR, 'snapshots', `${dates[i]}.json`), null);
    if (snap) return snap;
  }
  return null;
}

async function archiveLook(row, date) {
  if (!row.imgUrl) return null;
  const res = await fetch(row.imgUrl);
  if (!res.ok) { console.warn(`  look: HTTP ${res.status} for ${row.name}`); return null; }
  const bytes = Buffer.from(await res.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const dir = path.join(DATA_DIR, 'looks', row.name);
  const indexPath = path.join(dir, 'index.json');
  const index = await readJson(indexPath, []);
  const entry = index.find((e) => e.hash === hash);
  if (entry) {
    if (entry.lastSeen < date) entry.lastSeen = date;
  } else {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${hash}.png`), bytes);
    index.push({ hash, firstSeen: date, lastSeen: date });
    console.log(`  new look for ${row.name}: ${hash}`);
  }
  index.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  await writeJsonIfChanged(indexPath, index);
  return hash;
}

async function run() {
  const date = process.env.SNAPSHOT_DATE ?? todayUtc();
  const config = await readJson(path.join(DATA_DIR, 'characters.json'), null);
  const worlds = (await readJson(path.join(PUBLIC_DIR, 'worlds.json'), { worlds: {} })).worlds;
  if (!config) throw new Error('data/characters.json is missing or invalid');

  const characters = (config.characters ?? []).filter((c) => c?.name && !PLACEHOLDER_NAMES.has(c.name));
  if (characters.length === 0) {
    console.log('No characters configured in data/characters.json (only placeholders). Nothing to do.');
    return;
  }
  const worldIdFor = (c) => {
    if (c.worldId != null) return Number(c.worldId);
    if (config.worldId != null) return Number(config.worldId);
    const byName = Object.entries(worlds).find(([, w]) => w.name.toLowerCase() === String(c.world ?? config.world ?? '').toLowerCase());
    if (!byName) throw new Error(`Cannot resolve world for ${c.name}; set worldId in characters.json`);
    return Number(byName[0]);
  };

  console.log(`Snapshot ${date}: ${characters.length} character(s)`);
  const rows = [];
  const missing = [];
  for (const c of characters) {
    const worldId = worldIdFor(c);
    process.stdout.write(`- ${c.name} (${worlds[worldId]?.name ?? worldId}) ... `);
    const row = await lookupCharacter(c.name, worldId);
    if (!row) { console.log('not in rankings'); missing.push(c.name); await sleep(GAP); continue; }
    row.world = worlds[worldId]?.name ?? String(worldId);
    row.role = c.role ?? 'mule';
    row.owner = c.owner ?? 'me';
    console.log(`Lv.${row.level} ${row.job}`);
    row.lookHash = await archiveLook(row, date);
    rows.push(row);
    await sleep(GAP);
  }
  await collectLegions(rows, await latestSnapshot(date));

  const snapshotPath = path.join(DATA_DIR, 'snapshots', `${date}.json`);
  const previous = await readJson(snapshotPath, null);
  const snapshot = { date, fetchedAt: new Date().toISOString(), rows, missing };
  // Idempotent: if nothing but fetchedAt changed, leave the file untouched.
  const same = previous && JSON.stringify({ ...previous, fetchedAt: null }) === JSON.stringify({ ...snapshot, fetchedAt: null });
  if (same) {
    console.log('Snapshot unchanged; not rewriting.');
  } else {
    await writeJsonIfChanged(snapshotPath, snapshot);
    console.log(`Wrote ${path.relative(ROOT, snapshotPath)}`);
  }

  const index = await readJson(path.join(DATA_DIR, 'index.json'), { dates: [] });
  const dates = new Set(index.dates ?? []);
  dates.add(date);
  const nextIndex = { updatedAt: same ? index.updatedAt : snapshot.fetchedAt, dates: [...dates].sort() };
  await writeJsonIfChanged(path.join(DATA_DIR, 'index.json'), nextIndex);
}

try {
  await run();
} catch (err) {
  const retryable = err instanceof HttpError && (err.status === 403 || err.status === 429 || err.status >= 500);
  if (retryable && RETRY_DELAY > 0) {
    console.warn(`${err.message}; retrying once in ${Math.round(RETRY_DELAY / 1000)}s`);
    await sleep(RETRY_DELAY);
    await run();
  } else {
    console.error(err);
    process.exit(1);
  }
}
