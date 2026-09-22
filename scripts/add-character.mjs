#!/usr/bin/env node
// Look a character up in Nexon's rankings and append it to data/characters.json.
// Usage: node scripts/add-character.mjs <name> [--role main|mule|...] [--owner me|friend] [--world <id or name>]
// Exits 1 (with a clear message) when the name is not in the rankings.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na';

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

const res = await fetch(`${API}?${new URLSearchParams({ type: 'overall', id: 'legendary', reboot_index: 0, page_index: 1, character_name: name })}`, { headers: { accept: 'application/json' } });
if (!res.ok) {
  console.error(`Nexon rankings returned HTTP ${res.status}; try again later.`);
  process.exit(1);
}
const rows = JSON.parse((await res.text()).replace(/"(exp|gap)":(-?\d+)/g, '"$1":"$2"')).ranks ?? [];
const exact = rows.filter((r) => r.characterName.toLowerCase() === name.toLowerCase());
if (!exact.length) {
  console.error(`"${name}" is not in the GMS rankings on any world. Check the spelling (I vs l, 0 vs O); characters under ~level 10 do not appear.`);
  process.exit(1);
}
let row = exact.find((r) => r.worldID === wantWorld);
if (!row) {
  const where = exact.map((r) => `${r.characterName} on ${worldName(r.worldID)} (Lv.${r.level} ${r.jobName})`).join(', ');
  if (exact.length === 1 && opt('world') == null) {
    row = exact[0];
    console.log(`Not on ${worldName(wantWorld)}; found ${where}. Adding with that world.`);
  } else {
    console.error(`"${name}" is not on ${worldName(wantWorld)}. Found: ${where}. Re-run with --world <name> to pick one.`);
    process.exit(1);
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
