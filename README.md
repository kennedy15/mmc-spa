# MapleTracker + Build Board

A private React single-page app on GitHub Pages: a GMS MapleStory account tracker fed by Nexon's public rankings plus a hand-kept boss-clear ledger, and a Minecraft build-idea board with an optional AI generator. No server anywhere: a scheduled GitHub Action commits daily snapshots into `data/`, and everything personal lives in your browser and a folder on your PC.

The design doc is in [`MapleTracker + Build Board — Design Doc.md`](./MapleTracker%20%2B%20Build%20Board%20%E2%80%94%20Design%20Doc.md). Verification results for the rankings endpoint are in [`docs/verification.md`](docs/verification.md).

## Setup (once)

1. **Characters.** Edit [`data/characters.json`](data/characters.json): set `world` / `worldId` (Bera 1, Scania 19, Kronos 45, Hyperion 70, Luna 30, Solis 46) and list every character you want tracked. A friend's characters can go in the same list with `"owner": "friend"` and, if they play elsewhere, their own `"worldId"`.
2. **Pages.** In the repo: Settings → Pages → Source: **GitHub Actions**. The `Deploy to GitHub Pages` workflow runs on every push to `main`.
3. **First snapshot.** Actions → *Daily snapshot* → *Run workflow*. It runs every day at 18:00 UTC after that and redeploys the site whenever the data changed.
4. **Data folder** (optional, Chrome/Edge). Open the site → Settings → *Choose data folder*. Ideas, photos, boss clears, settings and a mirror of every snapshot are written there as JSON/PNG.
5. **AI generator** (optional). Settings → paste an Anthropic API key. It is kept in IndexedDB only.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/maple-tracker/
npm run snapshot     # run the collector once against data/characters.json
npm run build        # type-check + production build into dist/
```

`npm run snapshot` writes `data/snapshots/<date>.json`, downloads changed character images into `data/looks/<name>/`, and updates `data/index.json`. Running it twice on the same day leaves the files untouched.

## Layout

```
.github/workflows/  snapshot.yml (daily collector + redeploy), deploy.yml (Pages)
scripts/snapshot.mjs  collector; Node 20, no dependencies
data/               characters.json (you edit), index.json, snapshots/, looks/ (Action commits)
public/             exp-table.json, bosses.json (crystal values), recipes.json, worlds.json
src/app             layout, shared UI, chart theme
src/features        tracker/, bossing/, ideas/, settings/
src/lib             nexon/ (BigInt EXP math, snapshot parsing), reset/ (UTC boss periods), storage/ (IndexedDB, File System Access, export/import)
docs/samples        raw rankings responses captured during verification
```

## Data sources

- Rankings: `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na` (undocumented, no auth, no CORS). Two requests per character per day.
- EXP table, crystal values, boss list: [maplestorywiki.net](https://maplestorywiki.net/) (`public/exp-table.json`, `public/bosses.json` carry the fetch date). Update `public/bosses.json` and its `asOf` when Nexon changes crystal prices; old clears keep the meso recorded at the time.
