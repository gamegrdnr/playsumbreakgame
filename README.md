# Sum Break

A free browser number puzzle: merge matching circles until only one is left. It's a static site with no build step on GitHub, no dependencies and no external scripts, fonts or images, so GitHub Pages serves it as-is.

## How to play

- Drag a circle onto a neighbour (up, down, left or right) with the same number, or tap one then the other. They merge into their total in the cell you dropped onto.
- The cell you dragged from stays empty. Nothing slides in.
- Numbers follow 1, 2, 4, 8, 16 and so on. From level 30, wildcards (`+1`, `+2`, `+3`, `×2`, `×3`) merge with any number. A number outside the sequence always starts next to the wildcard that brings it back.
- You win when one circle is left.
- **Hint** makes the circle to move glow and draws an arrow. You get 3 per level, and a fresh 3 once you've solved it. If the board can no longer be finished, it says how many moves to undo instead and doesn't use one up.
- After a win, **Share result** copies a Wordle-style summary with an emoji picture of the board and a link to that level. On phones it opens the share sheet.
- Progress, best times, hints used and unfinished boards are saved in the browser (localStorage).

## What's in the repo

Every file the live site needs sits at the top level of the repo with a unique name, so nothing has to go in a folder.

| Files | What they are |
| --- | --- |
| `index.html` | Home: the daily puzzle and 100 levels cards, how to play, questions & answers |
| `daily.html`, `daily.js` | The daily puzzle and 365 pre-generated dailies (generated) |
| `levels.html` | All 100 levels |
| `achievements.html` | Achievements and progress |
| `level-1.html` … `level-100.html` | One page per level: the playable board, tips on where to start, and the full solution behind a spoiler |
| `how-to-play.html`, `about.html`, `contact.html`, `privacy.html` | Content pages |
| `sumbreak.js`, `sumbreak.css`, `levels.js` | Game code and rules engine, styles, and the 100 levels (generated) |
| `common.js` | Shared by every page: saved progress, daily dates and streaks, achievements |
| `og.png` | Image shown when a link is shared |
| `sitemap.xml`, `robots.txt`, `404.html`, `CNAME`, `.nojekyll` | For search engines and GitHub Pages |
| `tools/` | Level generator, page builder and page templates. Not needed by the live site |
| `.github/workflows/update-ads-txt.yml` | Downloads Ezoic's `ads.txt` daily and commits it |

Every HTML file is generated. Don't edit them directly, or your changes are overwritten on the next build.

## Editing pages and regenerating levels

You need Node.js 16 or later. No packages are required.

```sh
node tools/build-site.js                 # rebuild every page after editing tools/templates/*.html
node tools/generate-levels.js            # build a new set of 100 levels, then rebuild every page
node tools/generate-levels.js --check    # replay every stored solution, change nothing
node tools/generate-levels.js --seed=7   # a different level set (the default seed is fixed)
node tools/generate-dailies.js           # 365 dailies from 2026-11-20 into daily.js (a few minutes)
node tools/generate-dailies.js --check   # replay every daily solution
node tools/generate-dailies.js --days=730 --launch=2026-11-20   # more days, or a new launch date
```

- **Daily puzzle:** #1 is the launch date (`LAUNCH` in `tools/build-site.js`, which must match `--launch`). It changes at local midnight. Sizes follow the weekday: Mon–Tue 6×6, Wed–Thu 7×7, Fri–Sat 8×8, Sun 9×9. Boards come from the hardest quarter of a large pool, all with wildcards and a high count of proven trap pairs. You get 1 hint. Streaks only count dailies solved on their own day, and `daily.html?day=N` plays an earlier one. Before launch, the page shows #1 as a preview. When the 365 run out, regenerate with more `--days`.
- **Achievements:** 28 of them, defined in `common.js`, for progress, dailies and streaks, finishing position, speed and skill. They're stored in localStorage with the rest of the progress.

- Page text lives in `tools/templates/`. That covers the game header (`game.html`), the home sections and FAQ (`home.html`), the footer, and each content page.
- Level pages are written by `tools/build-site.js`, including their titles, descriptions and tips.
- The site address used in canonical links, the sitemap and shared results is `SITE` at the top of `tools/build-site.js`.
- The generator reads the game's rules from `sumbreak.js`, between the `ENGINE` markers. It replays every stored solution with those rules before writing anything.
- Each level is built backwards from a power of two by splitting it, so every level is solvable. Boards with too few proven decoy pairs are rejected. Each band is sorted by how often random games get stuck, with ties broken by how far they get.

## Publishing on GitHub Pages

1. On the repo page, click **Add file → Upload files** and drag in the files. The web uploader takes fewer than 100 files at a time, so do it in batches: the site files, then `level-1` to `level-50`, then `level-51` to `level-100`. Commit after each batch.
2. In **Settings → Pages**, set **Source** to **Deploy from a branch**, then choose **main** and **/ (root)**.
3. Keep `CNAME` in the repo and check the domain under **Custom domain**.
4. In Google Search Console and Bing Webmaster Tools, verify the domain and submit `https://playsumbreakgame.xyz/sitemap.xml`.

## ads.txt (Ezoic)

GitHub Pages can't do the 301 redirect Ezoic suggests, so `.github/workflows/update-ads-txt.yml` uses Ezoic's automated-updates method instead. Every day it downloads `https://srv.adstxtmanager.com/19390/playsumbreakgame.xyz`, and if the file changed, it commits it as `ads.txt` at the site root. A download that's empty or isn't an ads.txt file is ignored, so the live file is never wiped. Run it straight away from **Actions → Update ads.txt → Run workflow**. When uploading a new version of the site, don't delete `ads.txt`.
