# War & Peace Backgammon

A browser backgammon game in which playable doubles switch the rules between **WAR** and **PEACE**. In PEACE, a forced capture can give the opponent control of the rest of the turn.

**[Open the game](https://mygeorgiaattorney.github.io/war-peace-backgammon/)** · **[Project status and remaining work](docs/PROJECT_STATUS.md)**

Current version: **0.3.1**. The [project status](docs/PROJECT_STATUS.md) records the release history, verification results, and remaining device checks.

## Play

Open the game in your browser; no software installation is required to play. Use the existing beta entry screen, then choose:

| Mode | Players |
| --- | --- |
| Computer 1 — Balanced | You play White against the computer. |
| Computer 2 — Aggressive | You play White against a computer with a different strategy. |
| Two players | Two people share the same screen. |

Roll the opening dice and follow the turn prompt. Select a checker and a highlighted destination, or drag the checker to a legal destination. Prisoners on the bar must re-enter before other checkers can move. Select a legal home-board checker and its bearing-off tray to bear off. Use **End Turn** after all required moves are complete; a completely blocked turn passes automatically.

If either die can legally bear off the selected checker, choose the die in the controls—for example **Use 4** or **Use 6**. Tapping, dragging, and tapping the selected source again all honor that choice.

**How to play** opens the Overview, Core Rules, and Strategy tabs. A saved game can be continued from the opening menu. The interface supports touch, pointer input, and keyboard navigation; the board targets 4:3 tablet proportions.

Full frames identify the moves: gold dashes mark playable sources, an ivory frame marks the selected source, cyan marks destinations, coral marks captures, and violet traces the last move. A bar entry and bearing-off destination use matching frames. The board checkers are approximately 5% smaller than in 0.1.0.

**Narration** turns the illustrated gameplay notices on or off. **Sound** separately controls the audio, including a forceful WAR capture cue and a somber descending PEACE capture cue. Both preferences stay in this browser.

## The rules that distinguish this game

1. **Opening:** Each player rolls one die; ties are rerolled. The higher roller chooses WAR or PEACE and moves first using those two opening dice.
2. **Dice use comes first:** Use the maximum number of moves possible, even when completing the turn requires a PEACE capture. Either die may be played first when that order satisfies the rules. There is no separate higher-die preference, including when only one die can be used. Doubles provide four moves, all of which must be used when possible.
3. **WAR:** Among the sequences satisfying the dice-use rules, choose a sequence with the greatest number of captures.
4. **PEACE:** Among the turns using the maximum number of moves, choose the fewest captures. A quiet move that strands a playable die is not permitted when a complete turn exists. A forced capture remains compulsory and triggers Enemy Control.
5. **Bearing-off priority:** If every remaining checker was already home and the bar empty when this turn began, maximize bearing off after satisfying the WAR/PEACE capture priority. In WAR, captures take priority over extra bear-offs. If the last outside checker comes home during the turn, bearing off becomes possible but maximizing bear-offs is optional until the next turn. Ordinary exact-die and oversized-die restrictions still apply.
6. **Enemy Control:** A capture during normal PEACE play gives the opponent control of the moving player's checkers for the remainder of that turn. The opponent uses the unused dice; there is no extra roll. WAR/PEACE and bearing-off priorities are suspended during Enemy Control, while ordinary movement and maximum move use remain in force.
7. **Doubles:** Playable doubles switch WAR to PEACE or PEACE to WAR before the moves. Completely blocked doubles preserve the current mode and the turn passes.
8. **Winning:** Bear off all 15 checkers, or win by the opponent's resignation.

Captured checkers are called **Prisoners of War** or **Prisoners of Peace**. A deliberately exposed checker can act as a PEACE “land mine” if it forces a capture and leaves useful dice for Enemy Control. The tactic creates an opportunity, not a guaranteed comeback.

Both computer opponents consider **cautious landmine play from 50 through 75 pips behind**, and **stronger landmine play when more than 75 pips behind**. They consider the opponent's made home points, open entries, and exposed home checkers before accepting a capture risk. The Aggressive opponent accepts more exposure; a closed opposing home board discourages sacrifice. Landmine play is disabled when the checkers have passed one another and contact is no longer possible.

The implemented rules live in [src/App.tsx](src/App.tsx), and computer evaluation lives in [src/game/strategy.ts](src/game/strategy.ts). Player-facing explanations live in [RulesDialog.tsx](src/components/RulesDialog.tsx).

## Saved progress

Game progress, player records, sound and narration preferences, and diagnostic reports use the current browser's local storage. Saved progress includes the game position, selected opponent, player names, and whether all checkers were home at the start of the current turn. That rule condition survives undo and reload. Save format 3 continues to accept versions 1 and 2; old saves infer the condition from the current turn's move history. These records do not automatically transfer between devices or browsers. Clearing this site's browser data removes them. The menu offers **Continue saved game** when a resumable game is available.

## Version 0.3.1 — larger iPad board

Landscape tablets now put the turn information and controls in a narrow strip beside the board. Player names share the header. The board and essential controls fit the screen; the optional move guide and footer can scroll below play. Keyboard entry and pinch-zoom no longer reduce the table width. Portrait tablets retain controls below the board.

## Version 0.3.0 — October 26 iPad presentation

The approved design is now part of the playable game: a 4:3 board with controls beneath it, automatic height fitting after rotation, separated dimensional checkers, red WAR and blue PEACE tables, and a dark violet VENGEANCE table for useful borrowed moves. **Sound** in the header opens separate music, effects, and narration controls. Music starts only after a gesture and pauses when the tab is hidden. **How to play → Watch the rules** contains 26 interactive example states. Existing saves and local player records remain compatible.

Verified with 36 engine/strategy regressions, 27 Chromium browser scenarios with touch enabled, 15 layout checks across WAR/PEACE/VENGEANCE, and a real browser touch move. Actual iPad speaker output remains a device check.

## Version 0.2.0 — October 25 playtest update

This update implements Richard's October 25 playtest corrections: freely ordered dice without a higher-die tie-break; bearing-off priority tied to the start of the turn; complete PEACE turns even when capture is unavoidable; risk-adjusted computer landmines; optional illustrated narration and differentiated capture sounds; smaller checkers and full move frames.

This update passed **25 engine regressions**, **11 computer-strategy regressions**, **21 browser scenarios**, and **20 complete simulated games**. The [status page](docs/PROJECT_STATUS.md) records layout, build, and publication checks. The older results below are historical evidence for 0.1.0. Simulated games establish stability, not proven strategy strength.

## Version 0.1.0 — released history

This update incorporates the later introduction, tabbed rules, and Prisoner of War/Peace terminology; refines the board layout; and corrects Enemy Control computer decisions, tap/drag interactions, undo restrictions, resignation ownership, interrupted dice rolls, and saved-game restoration.

The 0.1.0 release passed **19 engine regressions**, **15 Chromium browser scenarios**, **20 complete simulated games**, TypeScript validation, and the production build. Richard's subsequent playtest supplied the rule and presentation corrections incorporated into 0.2.0. Actual-device verification of the revised release and audible output remains necessary.

## Development

Use **Node.js 24** and npm, matching the deployment workflow.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/war-peace-backgammon/`.

```sh
npm test
npx tsc -b
npm run build
npm run preview
```

The production build is written to `dist/`. The preview command normally serves it at `http://localhost:4173/war-peace-backgammon/`.

### Optional browser regression tests

Install the test browser once:

```sh
npm exec -- playwright install chromium
```

Start `npm run dev` in one terminal. In a second terminal, run:

```sh
npm run test:browser
```

These scenarios exercise real browser interaction and game-state transitions. The rule-engine and computer-strategy regressions run with `npm test`; responsive layouts are also inspected in tablet and phone viewports.

## Diagnostic mode

The playing version and the testing version share the **same application and rules engine**. Add `?testing=1` to the game address to expose the developer testing panel:

```text
http://localhost:5173/war-peace-backgammon/?testing=1
```

The panel supports automated games, different computer strategies and speeds, and saved reports. Diagnostics can change the current game state; use a separate browser profile when preserving an ongoing personal game matters. The query option controls the interface; it is not a separate authentication system.

## Repository and deployment

| Location | Purpose |
| --- | --- |
| `src/App.tsx` | Rules engine, turn state, computer play, board, and diagnostics. |
| `src/game/strategy.ts` | Computer evaluation, legal-turn selection, and landmine risk. |
| `src/components/GameIntro.tsx` | Opening explanation and game selection. |
| `src/components/RulesDialog.tsx` | In-game rules and strategy tabs. |
| `src/components/GameNarration.tsx` | Optional illustrated gameplay notices. |
| `src/game.css`, `src/index.css`, `src/components/game-info.css`, `src/components/game-narration.css` | Board, responsive layout, and interface styling. |
| `tests/engine-regression.mjs` | Rules regression tests. |
| `tests/strategy-regression.mjs` | Landmine thresholds, home-board risk, and legal computer decisions. |
| `tests/browser-regression.cjs` | Chromium interaction and game-state regression scenarios. |
| `docs/PROJECT_STATUS.md` | Decisions, verification status, and next steps. |
| `.github/workflows/deploy.yml` | GitHub Pages build and deployment. |

Pushes to `main` trigger the Pages workflow. Keep the Vite base path `/war-peace-backgammon/`. Develop changes on a branch, verify them, and update the project-status file before merging.

This repository contains the browser game. Native iOS/Android store packaging and online multiplayer are not delivered here.
