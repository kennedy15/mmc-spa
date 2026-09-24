# Step 0 verification (2026-09-22)

Results of the checks the design doc asked for before writing UI code.

## Rankings endpoint

`GET https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=0&page_index=1&character_name=<IGN>`

- Returns `{ totalCount, ranks: [...] }`. Fields per row (confirmed, see `samples/`): `characterName`, `exp` (integer), `gap`, `level`, `rank`, `worldID` (number, not a name), `characterImgURL`, `jobName`, `legionLevel`, `raidPower`, `tierID`, `starSum`. There is no `jobDetail` or `worldName`.
- `page_index` is a **rank offset**, not a page number (page_index=1600000 returns ranks 1600000–1600009). 10 rows per response.
- In the overall ranking `legionLevel` and `raidPower` are always 0. `type=legion&id=<worldID>&character_name=<IGN>` returns the same row shape with `legionLevel`, `raidPower` and the legion `rank` filled in, but only for the account's reporting character (its highest level; on a tie, whoever reached the level first). Looking up any other character returns no row, so the collector makes one overall call per character and legion calls only until the reporter answers (normally one).
- `reboot_index`: 0 = all worlds, 1 = Heroic worlds only, 2 = regular worlds only.
- `exp` is 0 for level-300 characters (cap). Largest values seen ≈ 8×10^14, still under 2^53, but the collector and the SPA quote `exp` before `JSON.parse` anyway.
- World IDs (from maplearchive.org's frontend, matched against `reboot_index` probing): Bera 1, Scania 19, Kronos 45 (Heroic), Hyperion 70 (Heroic), Luna 30, Solis 46 (Heroic). Stored in `public/worlds.json`.
- Name lookup is global across worlds, so the collector filters the result by `worldID`.

## CORS

Responses carry no `Access-Control-Allow-Origin` header even with an `Origin` header sent; `OPTIONS` returns 405. A browser fetch would be blocked, so there is no "refresh now" button; the GitHub Action is the only collector.

## Rankings floor

The overall ranking holds 16.7M characters. Level 220 sits around rank 1.67M, level 103 around rank 12M, level 40 around rank 16M and the bottom rows are level 11. Every character on an account above roughly level 10 should appear.

## Idempotency

`npm run snapshot` compares the new snapshot with the existing file for the day (ignoring `fetchedAt`) and does not rewrite it when nothing changed; `index.json` and look archives are written only when their content changes. The workflow commits only when `git diff --cached` is non-empty. Verified locally by running the collector twice.

## Legion data shape

The legion ranking returns the account's legion level, legion rank and raid power only on the reporting character's row (see above), so each snapshot carries them on that one row and the Legion screen reads them from whichever row has them. Every other character contributes its level and block rank from the overall ranking.

## Crystal values

`public/bosses.json` was generated from the GMS v270 table on https://maplestorywiki.net/w/Intense_Power_Crystal (values for one party member). The wiki notes values are quintupled in GMS Heroic worlds; the app applies ×5 when the Heroic setting is on (default follows the world in `characters.json`). Cadence per difficulty (daily / weekly / monthly) was assigned from the boss list on the wiki's Bosses page and the GMS reset rules; per Nathan (2026-09-22) only Hard and Extreme Black Mage are monthly, all Extreme bosses reset weekly. Daily bosses can be assigned to the weekly checklist.

Rechecked 2026-09-24 against GMS v.271 (released 2026-09-09): every crystal value and the EXP table still match the wiki, whose GMS crystal table is still labelled v270. The same table caps the party at 3 for First Adversary, Malefic Star, Limbo, Baldrix and Jupiter and at 2 for Extreme Lotus; `bosses.json` records these as `maxParty` and the party steppers stop there.
