# Sum Break

A browser puzzle game in one self-contained `index.html`. It has no build step, no dependencies and no external files, so it runs as-is on GitHub Pages or straight from disk.

## How to play

- The board is a grid of numbered circles.
- Drag a circle onto a neighbour (up, down, left or right) with the same number. They merge into their sum in the cell you dropped onto.
- The cell you dragged from stays empty. Nothing slides in to fill it.
- Wildcards (`+1`, `+2`, `+3`, `×2`, `×3`) merge with any number and apply their operation to it. Two wildcards can't merge with each other.
- You win when only one circle is left.
- You can drag, or tap one circle and then its neighbour.
- **Undo** steps back one move. **Restart** resets the level and the timer.
- **Hint** shows the next move. It searches from your current position for up to 1.5 seconds. If it finds no route, it takes you back to the last position on the level's stored solution and shows that solution's next move.
- All 100 levels are unlocked. **Levels** opens the picker, where solved levels have a tick.
- Progress, best times and unfinished games are saved in your browser (localStorage).
- Keyboard: `Z` or `U` undoes, `H` gives a hint, `Esc` closes the picker.

A useful idea: the smallest number on the board can only ever merge with an equal neighbour or a wildcard. Every other number only grows, and emptied cells never refill.

## Levels

| Levels | Board | Wildcards |
| --- | --- | --- |
| 1–10 | 3×3 | none |
| 11–25 | 4×4 | none |
| 26–45 | 5×5 | from level 30 |
| 46–65 | 6×6 | yes |
| 66–80 | 7×7 | yes |
| 81–89 | 8×8 | yes |
| 90–100 | 9×9 | yes, with the most decoys |

How the generator builds and checks levels:

- **Solvable by construction.** Each level is built backwards from a single number by repeatedly splitting a circle into an empty neighbouring cell. A split is either two equal halves, or a number plus the wildcard that turns it back. Replaying the splits in reverse is the stored solution.
- **Decoys.** A decoy is an adjacent pair of equal numbers that leaves an unwinnable position whichever way you merge it. A circle gets cut off, or can never find a partner. The generator proves each one with an exhaustive search, and rejects boards with too few for their band.
- **Difficulty.** Each board plays 400 games of uniformly random legal moves, and the score is the share that get stuck. Above 4×4 nearly every random game gets stuck, so ties are broken by how far those games got. Each band is then sorted easiest to hardest.
- **Size of numbers.** Every number stays at 4 digits or fewer.

## Regenerating levels

You need Node.js 16 or later. It uses no packages.

```sh
node tools/generate-levels.js            # build 100 levels and write them into index.html
node tools/generate-levels.js --check    # replay every stored solution, change nothing
node tools/generate-levels.js --seed=7   # build a different set (the default seed is fixed)
```

The generator reads the game's rules from `index.html` itself, between the `ENGINE` markers. It writes the levels between the `LEVELS` markers. Before writing, it replays every stored solution with those rules. If any fails, it leaves `index.html` untouched. A full run takes a few minutes, mostly proving decoys on the 9×9 boards.

## Publishing on GitHub Pages

1. Create an empty repository on GitHub, for example `playsumbreakgame`.
2. Push this folder to it:

   ```sh
   git init
   git add .
   git commit -m "Sum Break"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/playsumbreakgame.git
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose **main** and **/ (root)**, then **Save**.
5. After a minute or two the game is live at `https://YOUR-USERNAME.github.io/playsumbreakgame/`.

`.nojekyll` tells GitHub Pages to serve the files as they are, without running Jekyll.
