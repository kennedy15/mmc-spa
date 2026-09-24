# MapleTracker + Build Board

A private React single-page app on GitHub Pages: a GMS MapleStory account tracker fed by Nexon's public rankings plus a hand-kept boss-clear ledger, and a Minecraft build-idea board with an optional AI generator. No server anywhere: a scheduled GitHub Action commits daily snapshots into `data/`, and everything personal lives in your browser and a folder on your PC.

The design doc is in [`MapleTracker + Build Board — Design Doc.md`](./MapleTracker%20%2B%20Build%20Board%20%E2%80%94%20Design%20Doc.md). Verification results for the rankings endpoint are in [`docs/verification.md`](docs/verification.md).

## Setup (once)

1. **Characters.** Edit [`data/characters.json`](data/characters.json): set `world` / `worldId` (Bera 1, Scania 19, Kronos 45, Hyperion 70, Luna 30, Solis 46) and list every character you want tracked. A friend's characters can go in the same list with `"owner": "friend"` and, if they play elsewhere, their own `"worldId"`.
2. **Pages.** Open https://github.com/kennedy15/mmc-spa/settings/pages and under "Build and deployment" change the Source dropdown from "Deploy from a branch" to **GitHub Actions** (no branch or folder to pick). Until this is done the deploy workflow fails at the `configure-pages` step. The `Deploy to GitHub Pages` workflow runs on every push to `main` and publishes to https://kennedy15.github.io/mmc-spa/. Note: GitHub only serves Pages from a **private** repo on GitHub Pro; on a Free account either make the repo public (it holds only public rankings data) or run the site locally with `npm run dev` after `git pull` — the daily snapshot Action works either way.
3. **First snapshot.** Actions → *Daily snapshot* → *Run workflow*. It runs every day at 18:37 UTC after that (GitHub can start scheduled runs late) and redeploys the site whenever the data changed.
4. **Data folder** (optional, Chrome/Edge). Open the site → Settings → *Choose data folder*. Ideas, photos, boss clears, level goals, settings and a mirror of every snapshot are written there as JSON/PNG.
5. **AI generator** (optional). Settings → paste an Anthropic API key. It is kept in IndexedDB only.

## Adding a character later

Settings → *Add a character by name* looks the IGN up in the rankings, appends it to `data/characters.json`, snapshots it and redeploys. It runs the `Add character` workflow, so it needs a fine-grained GitHub token (this repo only, Actions: read and write) stored in the browser. Without a token, run the same workflow from the Actions tab, or locally:

```bash
node scripts/add-character.mjs SomeName --role mule
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/mmc-spa/
npm run snapshot     # run the collector once against data/characters.json
npm run build        # type-check + production build into dist/
```

`npm run snapshot` writes `data/snapshots/<date>.json`, downloads changed character images into `data/looks/<name>/`, and updates `data/index.json`. Running it again on the same day replaces that day's file with the newer numbers, and leaves it untouched when nothing changed.

## Layout

```
.github/workflows/  snapshot.yml (daily collector + redeploy), deploy.yml (Pages)
scripts/snapshot.mjs  collector; Node 20+ (the Actions use 24), no dependencies
data/               characters.json (you edit), index.json, snapshots/, looks/ (Action commits)
public/             exp-table.json, bosses.json (crystal values), recipes.json, worlds.json
src/app             layout, shared UI, chart theme
src/features        tracker/, bossing/, ideas/, settings/
src/lib             nexon/ (BigInt EXP math, snapshot parsing), reset/ (UTC boss periods), storage/ (IndexedDB, File System Access, export/import)
docs/samples        raw rankings responses captured during verification
```

## Boss presets

`public/bosses.json` carries two presets that Assignments can apply to one or all characters in a click: **CTENE** (Hard Darknell, Hard Verus Hilla, Chaos Gloom, Chaos Guardian Angel Slime, Hard Will, Hard Lucid, Hard Damien, Hard Lotus, Hard Magnus, Chaos Papulatus, Normal Princess No, Normal Akechi) and **GRANDIS** (Normal Baldrix, Normal Limbo, Normal Malefic Star, Chaos Kalos, Normal Kaling, Normal First Adversary, Hard Seren, Extreme Lotus, plus the Darknell-to-Damien block). Both add Hard Black Mage to the character's monthly tracker; Black Mage is the only monthly boss, Extreme Lotus/Seren and friends reset weekly. Each boss's difficulty can be changed from its dropdown afterwards. Caps: 14 weekly-boss crystals per character per week and 180 per world per week (both editable in Settings). Weekly and monthly bosses are tracked separately: the weekly meso, crystal counts, history chart and meso flow cover weekly bosses only, and Black Mage has its own monthly figures (Checklist header, Summary, History by month), so a monthly clear never inflates a week.

## Data sources

- Rankings: `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na` (undocumented, no auth, no CORS). One overall-ranking request per character per day, plus one legion-ranking request per account: the legion row is filed under the account's highest-level character, and on a level tie the character that got there first keeps it ([`scripts/legion.mjs`](scripts/legion.mjs)).
- EXP table, crystal values, boss list: [maplestorywiki.net](https://maplestorywiki.net/) (`public/exp-table.json`, `public/bosses.json` carry the fetch date). Update `public/bosses.json` and its `asOf` when Nexon changes crystal prices; old clears keep the meso recorded at the time.
