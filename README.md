# MapleTracker + Build Board

A private React single-page app on GitHub Pages: a GMS MapleStory account tracker fed by Nexon's public rankings plus a hand-kept boss-clear ledger, and a Minecraft build-idea board with an optional AI generator. No server anywhere: a scheduled GitHub Action commits daily snapshots into `data/`, and everything personal lives in your browser and a folder on your PC.

The design doc is in [`MapleTracker + Build Board — Design Doc.md`](./MapleTracker%20%2B%20Build%20Board%20%E2%80%94%20Design%20Doc.md). Verification results for the rankings endpoint are in [`docs/verification.md`](docs/verification.md).

## Make your own copy (for a friend)

Anyone can run their own tracker from this repo, with their own characters and their own site. Nothing in the copy can touch this repo or its data, and the two sites never share anything: boss clears, presets, ideas and settings live in each person's own browser.

You need a GitHub account. All of this happens on github.com; nothing to install.

1. **Copy the repo.** Open this repo on GitHub, click the green **Use this template** button (above the file list) → **Create a new repository**. Pick any name, choose **Public** (a free account only publishes sites from public repos) and click **Create repository**. (No *Use this template* button? The owner ticks *Template repository* under Settings → General first. Forking also works; see the notes below.)
2. **Turn on Pages.** In your new repo: **Settings** (top tab) → **Pages** (left menu) → under *Build and deployment*, set **Source** to **GitHub Actions**. There is nothing else to pick on that page.
3. **Set it up for your characters.** **Actions** (top tab) → **Set up my copy** (left list) → **Run workflow** (right). Fill in your world and your character names exactly as in game, main first, separated by commas (`Mainy, Muley, Otherguy`), then click the green **Run workflow**. It checks every name against the rankings, replaces the copied characters, snapshots and sprites with yours, takes your first snapshot and publishes the site. It takes a few minutes; refresh the page to see the run.
   - **If the run fails (red ✗)**, nothing was saved. Click the run: the messages at the top say what to fix. A name not found: check the spelling (capital I and small l look alike, so do 0 and O). A character on another world: leave it out, and add it afterwards with **Actions → Add character**, filling in its world. Pages not turned on: do step 2. Then run **Set up my copy** again with the corrected list. (Only the last part, *deploy*, failed? Your characters are saved: fix Pages, then run **Actions → Deploy to GitHub Pages → Run workflow**.)
4. **Open your site.** Settings → Pages shows *Your site is live at …* with a **Visit site** button; the address is `https://<your-username>.github.io/<your-repo>/`. The *Daily snapshot* workflow updates it every day from then on.
5. **Later.** To add one character and keep your history, run **Actions → Add character** (name, then **Run workflow**), or use *Add a character by name* in the app's Settings with a token for **your** repo (see *Adding a character later* below). To replace your whole list, run *Set up my copy* again with *Start over* ticked; that deletes your snapshots.

If you forked instead of using the template: click **I understand my workflows, go ahead and enable them** on the fork's Actions tab before step 3, and after step 3 open **Actions → Daily snapshot** and click **Enable workflow** (GitHub turns scheduled workflows off in forks). Never click **Sync fork** (it would pull this repo's snapshots into yours) and don't open a pull request back to this repo. A copy does not pick up later changes to the app by itself.

How the copy stays separate: the build reads its own repo name, so the site and its GitHub buttons point at your repo. `data/characters.json` records which repo the data belongs to (`"repo"`, plus `"repoId"`, which survives renaming the repo). Until *Set up my copy* has run, a copy's daily snapshot collects nothing and its deploy publishes nothing, so the original's characters never show up on your site. *Set up my copy* never runs in the original repo (`kennedy15/mmc-spa`), even if it is renamed.

## Setup (once)

1. **Characters.** Edit [`data/characters.json`](data/characters.json): set `world` / `worldId` (Bera 1, Scania 19, Kronos 45, Hyperion 70, Luna 30, Solis 46) and list every character you want tracked (or use *Set up my copy* above in a copy). `repo` and `repoId` name the GitHub repo the data belongs to (if you rename or transfer the repo, `repoId` keeps it recognised; leave both as they are). A friend's characters can go in the same list with `"owner": "friend"` and, if they play elsewhere, their own `"worldId"`.
2. **Pages.** In the repo's Settings → Pages, under "Build and deployment", change the Source dropdown from "Deploy from a branch" to **GitHub Actions** (no branch or folder to pick). Until this is done the deploy workflow fails at the `configure-pages` step. The `Deploy to GitHub Pages` workflow runs on every push to `main` and publishes to `https://<owner>.github.io/<repo>/` (this repo: https://kennedy15.github.io/mmc-spa/). Note: GitHub only serves Pages from a **private** repo on GitHub Pro; on a Free account either make the repo public (it holds only public rankings data) or run the site locally with `npm run dev` after `git pull` — the daily snapshot Action works either way.
3. **First snapshot.** Actions → *Daily snapshot* → *Run workflow*. It runs every day at 18:37 UTC after that (GitHub can start scheduled runs late) and redeploys the site whenever the data changed.
4. **Data folder** (optional, Chrome/Edge). Open the site → Settings → *Choose data folder*. Ideas, photos, boss clears, level goals, settings and a mirror of every snapshot are written there as JSON/PNG.
5. **AI generator** (optional). Settings → paste an Anthropic API key. It is kept in IndexedDB only.

## Adding a character later

Settings → *Add a character by name* looks the IGN up in the rankings, appends it to `data/characters.json`, snapshots it and redeploys. It runs the `Add character` workflow, so it needs a fine-grained GitHub token (this repo only, Actions: read and write) stored in the browser. Without a token, run the same workflow from the Actions tab, or locally:

```bash
node scripts/add-character.mjs SomeName --role mule
```

## Renaming a character

Changed a name in game? Open the character from *Characters* and click **Update name**. It runs the `Rename character` workflow with the same token. The workflow checks that the new name is in the rankings and looks like the same character (same world and job, no lower level, old name gone from the rankings), then records the old name under the entry's `formerNames` in `data/characters.json`, moves `data/looks/<old>/` to `data/looks/<new>/`, snapshots and redeploys. Snapshots taken before the rename keep the old name; the app files them under the new one, along with the boss clears, assignments and goals kept in the browser. Nexon's rankings update about once a day, so a name changed in game today may not be found until tomorrow. Without a token, run the workflow from the Actions tab, or locally:

```bash
node scripts/rename-character.mjs OldName NewName   # --force skips the same-character checks
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/<repo>/ (the repo name from the git remote; VITE_BASE overrides it)
npm run snapshot     # run the collector once against data/characters.json
npm run build        # type-check + production build into dist/
```

`npm run snapshot` writes `data/snapshots/<date>.json`, downloads changed character images into `data/looks/<name>/`, and updates `data/index.json`. Running it again on the same day replaces that day's file with the newer numbers, and leaves it untouched when nothing changed.

## Layout

```
.github/workflows/  snapshot.yml (daily collector + redeploy), deploy.yml (Pages), add-character.yml, rename-character.yml, setup-copy.yml (a copy's first run)
scripts/            snapshot.mjs (collector; Node 20+, the Actions use 24, no dependencies), add/rename-character.mjs, setup-copy.mjs, repo-guard.mjs
data/               characters.json (you edit), index.json, snapshots/, looks/ (Action commits)
public/             exp-table.json, bosses.json (crystal values), recipes.json, worlds.json, classic.json (Classic World builds and grinding spots), classic/skills/ (skill icons)
src/app             layout, shared UI, chart theme
src/features        tracker/, bossing/, classic/, ideas/, settings/
src/lib             nexon/ (BigInt EXP math, snapshot parsing), reset/ (UTC boss periods), storage/ (IndexedDB, File System Access, export/import)
docs/samples        raw rankings responses captured during verification
```

## Boss presets

A preset is a named weekly boss list with a party size per boss. `public/bosses.json` ships six in progression order (Chaos Tenebris, HSeren / Easy Grandis, Normal Grandis, then Normal Baltrix, Hard Baltrix and The Juice for the main). **Presets** (under Bossing) edits them, makes new ones and sets their order on a board of every boss: Off or a difficulty, and the party size. The edited list is kept in the browser (and the data folder, and Export) as `bossing/presets.json`; *Reset to defaults* goes back to `bosses.json`.

**Assignments** is a ladder with one lane per preset. Moving a character to a lane wipes its weekly bosses and replaces them with the preset's, after a preview and with Undo; monthly Black Mage and recorded clears are kept. Characters with a hand-made list wait in the tray until moved. A character's list can still be tuned by hand (party, difficulty, add, reorder); it then shows as edited, with Reset. Caps: 14 weekly-boss crystals per character per week and 180 per world per week (both editable in Settings); the Checklist locks unticked bosses once either is reached. Weekly and monthly bosses are tracked separately: the weekly meso, crystal counts, history chart and meso flow cover weekly bosses only, and Black Mage has its own monthly figures (Checklist header, Summary, History by month), so a monthly clear never inflates a week.

## Classic Maple

The sidebar has three sections. **Modern Maple** holds today's GMS tracker and bossing pages. **Classic Maple** covers MapleStory Classic World, Nexon's pre-Big Bang world: Founder's Access opens Oct 6, 2026, and Grand Launch is Oct 21. **Minecraft** holds the Build board.

- **Class builds** ranks the ten launch branches using the tier lists from the two closed online tests (COT #1 in April, COT #2 in August). Each build opens an infographic page:
  - ratings, the stat plan and variants
  - milestones
  - the skill order for each job, showing the level each step is affordable at (1 SP at each advancement, 3 per level)
  - key skills, tips, gear and what Classic changed
  - its sources
- **Grinding spots** puts every researched map on a Lv 1–100 chart. Pick a level, class and branch to see where to train, with quests and leveling tips alongside.

All of it is read from `public/classic.json`, researched on 2026-10-03 from Nexon's test and Founder's Access notes plus MeowDB, Metaroad and tester guides. Skill icons are in `public/classic/skills/`; they were taken once from [maplestory.io](https://maplestory.io/)'s Classic World data (region `MCW`, version `CBT2`), with the original GMS art used where that data didn't load. Each skill's `icon` in the JSON points at one of them, and skills without an icon show a lettered tile. Every build and spot lists its sources. 3rd job, Orbis and El Nath were only in COT #2, so they appear as a preview.

Recheck the file once Founder's Access is live, because skill numbers come from COT #2 client data. When 3rd job ships, raise `world.launchJobs` to 3: the skill timelines and labels follow it.

## Data sources

- Rankings: `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na` (undocumented, no auth, no CORS). One overall-ranking request per character per day, plus one legion-ranking request per account: the legion row is filed under the account's highest-level character, and on a level tie the character that got there first keeps it ([`scripts/legion.mjs`](scripts/legion.mjs)).
- EXP table, crystal values, boss list: [maplestorywiki.net](https://maplestorywiki.net/) (`public/exp-table.json`, `public/bosses.json` carry the fetch date). Update `public/bosses.json` and its `asOf` when Nexon changes crystal prices; old clears keep the meso recorded at the time.
