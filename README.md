# War & Peace Backgammon

A browser backgammon game in which playable doubles switch the rules between **WAR** and **PEACE**. In PEACE, a forced capture can give the opponent control of the rest of the turn.

**[Open the game](https://mygeorgiaattorney.github.io/war-peace-backgammon/)** · **[Project status and remaining work](docs/PROJECT_STATUS.md)**

Development version: **0.1.0**. See the project-status page for verification results and publication status.

## Play

Open the game in your browser; no software installation is required to play. Use the existing beta entry screen, then choose:

| Mode | Players |
| --- | --- |
| Computer 1 — Balanced | You play White against the computer. |
| Computer 2 — Aggressive | You play White against a computer with a different strategy. |
| Two players | Two people share the same screen. |

Roll the opening dice and follow the turn prompt. Select a checker and a highlighted destination, or drag the checker to a legal destination. Prisoners on the bar must re-enter before other checkers can move. Select a legal home-board checker and its bearing-off tray to bear off. Use **End Turn** after all required moves are complete; a completely blocked turn passes automatically.

**How to play** opens the Overview, Core Rules, and Strategy tabs. A saved game can be continued from the opening menu. The interface supports touch, pointer input, and keyboard navigation; the board targets 4:3 tablet proportions.

## The rules that distinguish this game

1. **Opening:** Each player rolls one die; ties are rerolled. The higher roller chooses WAR or PEACE and moves first using those two opening dice.
2. **Dice use comes first:** Use as many dice as legally possible. If only one of two different dice can be used and both are individually playable, use the higher die. Doubles provide four moves.
3. **WAR:** Among the sequences satisfying the dice-use rules, choose a sequence with the greatest number of captures.
4. **PEACE:** Among those sequences, choose the fewest captures. Use a no-hit sequence when one is available. This is a whole-turn priority, not simply a preference for an individual non-hitting first move.
5. **Bearing-off priority:** After the WAR/PEACE capture priority, bear off as many checkers as possible. Ordinary home-board and oversized-die restrictions still apply.
6. **Enemy Control:** A capture during normal PEACE play gives the opponent control of the moving player's checkers for the remainder of that turn. The opponent uses the unused dice; there is no extra roll. WAR/PEACE priorities are suspended during Enemy Control, while ordinary movement and dice-use rules remain in force.
7. **Doubles:** Playable doubles switch WAR to PEACE or PEACE to WAR before the moves. Completely blocked doubles preserve the current mode and the turn passes.
8. **Winning:** Bear off all 15 checkers, or win by the opponent's resignation.

Captured checkers are called **Prisoners of War** or **Prisoners of Peace**. A deliberately exposed checker can act as a PEACE “land mine” if it forces a capture and leaves useful dice for Enemy Control. The tactic creates an opportunity, not a guaranteed comeback.

The implemented rules live in [src/App.tsx](src/App.tsx). Player-facing explanations live in [RulesDialog.tsx](src/components/RulesDialog.tsx).

## Saved progress

Game progress, player records, sound preferences, and diagnostic reports use the current browser's local storage. Saved progress includes the game position, selected opponent, and player names. These records do not automatically transfer between devices or browsers. Clearing this site's browser data removes them. The menu offers **Continue saved game** when a resumable game is available.

## Version 0.1.0

This update incorporates the later introduction, tabbed rules, and Prisoner of War/Peace terminology; refines the board layout; and corrects Enemy Control computer decisions, tap/drag interactions, undo restrictions, resignation ownership, interrupted dice rolls, and saved-game restoration.

The update has passed **19 engine regressions**, **15 Chromium browser scenarios**, TypeScript validation, and the production build. Actual iPad Safari interaction and audible output still require device verification. The [status page](docs/PROJECT_STATUS.md) records the remaining release checks.

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

These scenarios exercise real browser interaction, game-state transitions, and responsive interface behavior. Engine regressions run separately with `npm test`.

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
| `src/components/GameIntro.tsx` | Opening explanation and game selection. |
| `src/components/RulesDialog.tsx` | In-game rules and strategy tabs. |
| `src/index.css`, `src/components/game-info.css` | Responsive layout and interface styling. |
| `tests/engine-regression.mjs` | Rules regression tests. |
| `tests/browser-regression.cjs` | Chromium interaction and game-state regression scenarios. |
| `docs/PROJECT_STATUS.md` | Decisions, verification status, and next steps. |
| `.github/workflows/deploy.yml` | GitHub Pages build and deployment. |

Pushes to `main` trigger the Pages workflow. Keep the Vite base path `/war-peace-backgammon/`. Develop changes on a branch, verify them, and update the project-status file before merging.

This repository contains the browser game. Native iOS/Android store packaging and online multiplayer are not delivered here.
