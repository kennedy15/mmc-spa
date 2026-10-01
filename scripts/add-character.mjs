#!/usr/bin/env node
// Look a character up in Nexon's rankings and append it to data/characters.json.
// Usage: node scripts/add-character.mjs <name> [--role main|mule|...] [--owner me|friend] [--world <id or name>]
// Exits 1 (with a clear message, an Actions error annotation the app shows) when the name is not in the rankings.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataIsForThisRepo, fail, notSetUpMessage } from './repo-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The rankings are split by region: Luna and Solis are only in /eu (worlds.json "region").
const API = 'https://www.nexon.com/api/maplestory/no-auth/ranking/v2';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'))?.trim();
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
if (!name) {
  console.error('usage: add-character.mjs <name> [--role mule] [--owner me] [--world 45]');
  process.exit(2);
}

const cfgPath = path.join(ROOT, 'data', 'characters.json');
const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
if (!dataIsForThisRepo(cfg)) fail('Not set up yet', notSetUpMessage(cfg));
const worlds = JSON.parse(await readFile(path.join(ROOT, 'public', 'worlds.json'), 'utf8')).worlds;
const worldName = (id) => worlds[id]?.name ?? String(id);
const resolveWorld = (v) => {
  if (v == null || v === '') return null;
  if (/^\d+$/.test(String(v))) return Number(v);
  const hit = Object.entries(worlds).find(([, w]) => w.name.toLowerCase() === String(v).toLowerCase());
  return hit ? Number(hit[0]) : null;
};
const wantWorld = resolveWorld(opt('world')) ?? Number(cfg.worldId);
const role = opt('role', 'mule');
const owner = opt('owner', 'me');

async function ranked(region) {
  const res = await fetch(`${API}/${region}?${new URLSearchParams({ type: 'overall', id: 'legendary', reboot_index: 0, page_index: 1, character_name: name })}`, { headers: { accept: 'application/json' } });
  if (!res.ok) fail('Rankings unavailable', `Nexon's rankings returned HTTP ${res.status}. Try again later.`);
  return JSON.parse((await res.text()).replace(/"(exp|gap)":(-?\d+)/g, '"$1":"$2"')).ranks ?? [];
}
// The wanted world's region first; the others only to say where else the name is.
const regions = [...new Set([worlds[wantWorld]?.region ?? 'na', ...Object.values(worlds).map((w) => w.region ?? 'na')])];
const exact = [];
for (const region of regions) {
  exact.push(...(await ranked(region)).filter((r) => r.characterName.toLowerCase() === name.toLowerCase()));
  if (exact.some((r) => r.worldID === wantWorld)) break;
}
if (!exact.length) fail('Not in rankings', `"${name}" is not in the GMS rankings on any world. Check the spelling (capital I vs small l, 0 vs O); characters under about level 10 do not appear.`);
let row = exact.find((r) => r.worldID === wantWorld);
if (!row) {
  const where = exact.map((r) => `${r.characterName} on ${worldName(r.worldID)} (Lv.${r.level} ${r.jobName})`).join(', ');
  if (exact.length === 1 && opt('world') == null) {
    row = exact[0];
    console.log(`Not on ${worldName(wantWorld)}; found ${where}. Adding with that world.`);
  } else {
    fail('Not on this world', `"${name}" is not on ${worldName(wantWorld)}. Found: ${where}. Pick that world (or check the spelling).`);
  }
}

const existing = (cfg.characters ??= []).find((c) => c.name.toLowerCase() === row.characterName.toLowerCase());
if (existing) {
  console.log(`${row.characterName} is already in characters.json (${existing.role ?? 'mule'}). Nothing to do.`);
  process.exit(0);
}
const entry = { name: row.characterName, role, owner };
if (row.worldID !== Number(cfg.worldId)) entry.worldId = row.worldID;
cfg.characters = cfg.characters.filter((c) => !['YourMain', 'Mule01'].includes(c.name));
cfg.characters.push(entry);
await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`Added ${row.characterName}: Lv.${row.level} ${row.jobName} on ${worldName(row.worldID)}, rank #${row.rank}.`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `Added **${row.characterName}** (Lv.${row.level} ${row.jobName}, ${worldName(row.worldID)})\n`, { flag: 'a' });
