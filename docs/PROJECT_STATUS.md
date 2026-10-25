# Project status — War & Peace Backgammon

- **Last reviewed:** October 25, 2026
- **Owner:** Richard Hobbs
- **Working version:** 0.1.0 — implemented and verified locally; publication pending
- **Game:** https://mygeorgiaattorney.github.io/war-peace-backgammon/
- **Repository:** https://github.com/mygeorgiaattorney/war-peace-backgammon

## Where the project resumed

The verified GitHub baseline is commit [`5a39dd3`](https://github.com/mygeorgiaattorney/war-peace-backgammon/commit/5a39dd3999aa19e685aba2ca476134621f116c34), **“Update Menu,” June 28, 2026**. Its GitHub Pages build and deployment succeeded. It already contained two computer strategies, two-person play, WAR/PEACE and Enemy Control logic, sound, blocked-turn auto-pass, the blocked-doubles correction, and hidden automated testing tools.

The later file `App_warpeace_intro_polish_replacement.tsx`, supplied July 25, 2026, was recovered and compared with that baseline. Its differences are capture terminology, move-log text, introduction/rules screens, and related presentation. **It contains no additional rules-engine, computer-strategy, save/restore, or turn-state fixes.** The current update can preserve the June engine while incorporating the July interface decisions; replacing the whole application with that historical file is unnecessary.

## Decisions to preserve

| Area | Accepted direction |
| --- | --- |
| Visual character | Preserve the existing wood, gold, green playing surface, and shaded checkers. |
| Tablet layout | Target 4:3 board proportions, clean margins, and substantially less unused center space. |
| Points and pieces | Adjacent triangular point areas touch; pieces are larger and tightly spaced. Distinguish the thin center divider from the more substantial bar. |
| Game choices | Computer 1 — Balanced; Computer 2 — Aggressive; two people sharing one screen. |
| Capture wording | “Prisoner of War” and “Prisoner of Peace,” replacing “POW! Captured.” |
| Introduction | Short explanation of WAR/PEACE, playable doubles, PEACE land mines, Enemy Control, and comeback opportunities. |
| Rules help | Overview, Core Rules, and Strategy tabs, available during play. |
| Rules priorities | Maximum dice use and higher-die rule first; then WAR maximum captures or PEACE minimum captures; then bearing-off priority. |
| Blocked doubles | No WAR/PEACE switch when the roll has no legal move. |
| Testing arrangement | One application; normal play hides diagnostics, and `?testing=1` exposes them. |
| Persistence | Saved progress and records are local to the browser, including the selected opponent and player names. |
| Release direction | Finish and verify the browser/tablet game before considering app-store packaging. |

The July replacement's prose oversimplified PEACE as always requiring an individual non-hitting move when available and described the opening sequence out of order. Preserve the actual rules above and the corrected tabbed explanation, rather than copying that wording verbatim.

## Version 0.1.0 — completed changes

- Incorporated the July interface direction: concise introduction, Overview/Core Rules/Strategy tabs, and Prisoner of War/Peace wording.
- Refined the existing board and controls for a 4:3 tablet layout.
- Corrected the computer's Enemy Control decisions so it evaluates moves for the controlling side.
- Corrected tap and drag behavior, bearing-off interaction, undo restrictions, and which player resigns.
- Cancelled stale opening and ordinary dice rolls when the game changes, preventing old asynchronous actions from altering a new or restored game.
- Restored complete saved-game setup and position, with a visible resume action.
- Kept diagnostics in the same application behind `?testing=1` and added repeatable engine and browser regression checks.

## Verification results

| Check | Observed result |
| --- | --- |
| Engine regressions | **19 passed.** |
| Real Chromium browser scenarios | **15 passed.** Covered tap/undo, keyboard input, drag and bearing-off tray, Enemy Control AI, saved setup/state restoration, opening and ordinary roll cancellation, correct-player resignation, completed-game undo lock, blocked doubles/bar auto-pass, diagnostic visibility, malformed-save recovery, and native audio activation/persistence. |
| Introduction and rules | Checked at **1024 × 768** and **390 × 844** without clipping. Keyboard tabs, focus handling, and Escape dismissal passed. |
| Main board at 1024 × 768 | Verified exact **4:3** board proportions with no overflow. |
| Browser audio | Native AudioContext reaches running on a returning player’s direct gesture; sound preference persists across reload. Physical speaker output still requires a device check. |
| TypeScript and production bundle | Both passed for the updated application. |

## Release and device checks

| Check | Current status |
| --- | --- |
| Complete-game simulation | **20/20 completed:** 10 Balanced and 10 Aggressive, each in a fresh browser context. 1,267 rolls, 270 captures, 8 Enemy Control triggers, and 21 blocked doubles; no lockups or runtime/diagnostic errors. These are stability checks, not a strength comparison. |
| Main board in phone portrait | **390 × 844 passed:** 4:3 board, no page overflow or checker overlap. Additional 1366 × 1024 and 768 × 1024 checks passed. Short landscape screens use a compact table with a scrollable control panel. |
| GitHub update and Pages deployment | **Pending for version 0.1.0.** Update this entry with the release commit and successful deployment result. |
| Actual iPad Safari and audio | Not yet verified on the device. Check touch interaction, audible sound, legibility, and playing feel. |

Browser viewport checks establish layout and interaction in the tested browser; they do not replace the remaining actual-device check.

## How to resume next time

1. Read this file and inspect the latest GitHub commit and deployment result.
2. Use this repository as the working source. Compare any newly supplied historical file before importing it.
3. For development, run `npm ci`, `npm test`, `npx tsc -b`, and `npm run build`. The web game itself requires no installation.
4. Run `npm run test:browser` with the development server running and Chromium installed through Playwright. Play through both computer modes and two-player mode; exercise forced PEACE captures, Enemy Control, barred checkers, blocked doubles, bearing off, save/resume, and interrupted rolls.
5. Check a 4:3 tablet viewport and a narrow phone viewport, then update this file with observed results and remaining work.

No native iOS/Android store release or network multiplayer is recorded as complete. A successful Pages build establishes that the web bundle deployed; it does not by itself establish correct gameplay or satisfactory tablet presentation.
