# Project status — War & Peace Backgammon

- **Last reviewed:** October 25, 2026
- **Owner:** Richard Hobbs
- **Released version:** 0.1.0 — deployed October 25, 2026
- **Working version:** 0.2.0 — October 25 playtest corrections; local release verification complete, publication pending
- **Game:** https://mygeorgiaattorney.github.io/war-peace-backgammon/
- **Repository:** https://github.com/mygeorgiaattorney/war-peace-backgammon

## Where the project resumed

The verified GitHub baseline is commit [`5a39dd3`](https://github.com/mygeorgiaattorney/war-peace-backgammon/commit/5a39dd3999aa19e685aba2ca476134621f116c34), **“Update Menu,” June 28, 2026**. Its GitHub Pages build and deployment succeeded. It already contained two computer strategies, two-person play, WAR/PEACE and Enemy Control logic, sound, blocked-turn auto-pass, the blocked-doubles correction, and hidden automated testing tools.

The later file `App_warpeace_intro_polish_replacement.tsx`, supplied July 25, 2026, was recovered and compared with that baseline. Its differences are capture terminology, move-log text, introduction/rules screens, and related presentation. **It contains no additional rules-engine, computer-strategy, save/restore, or turn-state fixes.** Version 0.1.0 incorporated those presentation decisions. Richard's subsequent October 25 playtest clarified the custom rules and requested the 0.2.0 changes below.

## Decisions to preserve

| Area | Accepted direction |
| --- | --- |
| Visual character | Wood, gold, green, and shaded checkers are the current style. Richard is open to changing the colors; clarity and playing feel take priority. |
| Tablet layout | Target 4:3 board proportions, clean margins, and substantially less unused center space. |
| Points and pieces | Adjacent triangular point areas touch; pieces remain tightly spaced but are approximately 5% smaller than in 0.1.0. Distinguish the thin center divider from the more substantial bar. |
| Move guidance | Full frames replace the small dots: gold sources, ivory selection, cyan destinations, coral captures, and violet last-move trace. Bar and OFF trays use matching guidance. |
| Game choices | Computer 1 — Balanced; Computer 2 — Aggressive; two people sharing one screen. |
| Capture wording | “Prisoner of War” and “Prisoner of Peace,” replacing “POW! Captured.” |
| Introduction | Short explanation of WAR/PEACE, playable doubles, PEACE land mines, Enemy Control, and comeback opportunities. |
| Rules help | Overview, Core Rules, and Strategy tabs, available during play. |
| Rules priorities | Maximum number of playable moves first, including forced PEACE captures; then WAR maximum captures or PEACE minimum captures. No separate higher-die preference. |
| Bearing-off priority | Maximize bear-offs only when all remaining checkers were already home and the bar empty at the start of the turn, after the capture priority. Entering home mid-turn permits bearing off without making it compulsory that turn. WAR captures take priority over extra bear-offs. |
| Enemy Control | The opponent controls the violating player's remaining moves; maximum move use still applies. Capture and bearing-off priorities are suspended. |
| Computer landmines | Both computers consider cautious landmines from 50 through 75 pips behind and stronger landmines beyond 75, accounting for opposing home blocks, open entry points, and exposed checkers. Aggressive accepts more exposure. No-contact races do not use landmine play. |
| Narration and sound | Optional illustrated gameplay notices; separate Sound control. Forceful WAR captures and somber PEACE captures use distinct cues. Preferences persist in the browser. |
| Blocked doubles | No WAR/PEACE switch when the roll has no legal move. |
| Testing arrangement | One application; normal play hides diagnostics, and `?testing=1` exposes them. |
| Persistence | Saved progress and records are local to the browser, including the selected opponent, player names, and turn-start bearing-off condition. Save format 3 accepts older versions with history-based migration. |
| Release direction | Finish and verify the browser/tablet game before considering app-store packaging. |

The July replacement's prose oversimplified PEACE as always requiring an individual non-hitting move when available and described the opening sequence out of order. Preserve the actual rules above and the corrected tabbed explanation, rather than copying that wording verbatim.

## Version 0.2.0 — current work

Richard reported a 6–4 turn where the last outside checker was being forced home ahead of a possible home-board move. The old filter maximized bearing off across every turn, including turns that began outside home, and separately favored the larger die when only one die could be used. Both restrictions have now been corrected to the custom rules above.

- Added a turn-start bearing-off condition. It remains fixed throughout the turn and survives Enemy Control, undo, save, and restore.
- Removed the larger-die tie-break and misleading highest-first guidance. A 4 may be used before a 6 when that order satisfies the maximum-moves and capture rules.
- Removed the remaining higher-die assumption in human input: when either die can bear off the same checker, OFF-tray taps, drags, and repeated source taps present an explicit die choice rather than silently consuming the larger die.
- Preserved the duty to make every playable move in PEACE. A shorter quiet turn cannot be chosen to avoid a capture required by a complete turn.
- Added regressions for the mirrored 6–4 scenario, entering home mid-turn, WAR capture priority over extra bear-offs, compulsory PEACE captures, and migration of earlier saves.
- Updated computer play to consider complete legal turns and board-sensitive landmine tactics at the requested 50- and 75-pip thresholds.
- Added optional illustrated narration, differentiated capture sounds, approximately 5% smaller checkers, and full source/destination/last-move frames.

### Version 0.2.0 verification and release

| Check | Current observed status |
| --- | --- |
| Engine regressions | **25 passed.** Includes both-color 6–4 examples, optional bearing off after entering home mid-turn, mandatory full PEACE turns, and old-save migration. |
| TypeScript and production build | **Passed** for the integrated 0.2.0 application. |
| Strategy regressions | **11 passed.** Both computers cover at a 49-pip deficit, consider exposed-checker traps at 62/84 pips behind with open re-entry, and choose safety at 76 pips behind against a closed home. Mirrored Black positions, Enemy Control, legal complete turns, and state preservation passed. |
| Browser interactions | **21 passed.** Includes the 6–4 example, mid-turn save/reload/undo and older-save migration, compulsory PEACE continuation, explicit bearing-off die choice by tap/drag/repeated source tap and cancellation, full-point frames, optional capture narration, and native audio activation/persistence. The die-choice case also runs at phone size. No runtime or console errors. |
| Browser layouts | **Passed at 1024 × 768, 390 × 844, and 844 × 390:** 4:3 board, no page overflow in the tested active positions, approximately 5% smaller rendered checkers, and distinct full-point frames. The optional tactics note scrolls within the controls. Opening/name-entry screens and actual PEACE narration cards were also checked; card text and dismissal fit tablet and phone. |
| Complete-game simulation | **20/20 completed:** 10 Balanced and 10 Aggressive, in fresh browser contexts. 1,200 rolls, 186 captures, 17 Enemy Control triggers, and 32 blocked doubles; no observed lockups or runtime/diagnostic errors. [Recorded results](verification/feedback-0.2.0-games.json). These are stability checks, not a strategy-strength comparison. |
| GitHub update and Pages deployment | Pending for 0.2.0. Record the release commit and successful deployment after integration checks. |
| Actual iPad Safari and audio | Revised touch comfort, frame visibility, narration, and audible capture effects still require an actual-device check. |

### Saved-game compatibility

Save format 3 records `bearOffPriorityAtTurnStart`. Versions 1 and 2 remain loadable. For an older save, the condition is inferred from the current position and this turn's recorded move origins: an outside origin or bar entry means the turn began outside. If the old move history is incomplete, migration conservatively avoids imposing a new mandatory bear-off condition. Starting the next turn evaluates the condition normally.

## Version 0.1.0 — released history

The following changes and verification counts describe the October 25 initial release. They do not establish that the later 0.2.0 changes passed the same checks.

- Incorporated the July interface direction: concise introduction, Overview/Core Rules/Strategy tabs, and Prisoner of War/Peace wording.
- Refined the existing board and controls for a 4:3 tablet layout.
- Corrected the computer's Enemy Control decisions so it evaluates moves for the controlling side.
- Corrected tap and drag behavior, bearing-off interaction, undo restrictions, and which player resigns.
- Cancelled stale opening and ordinary dice rolls when the game changes, preventing old asynchronous actions from altering a new or restored game.
- Restored complete saved-game setup and position, with a visible resume action.
- Kept diagnostics in the same application behind `?testing=1` and added repeatable engine and browser regression checks.

### Version 0.1.0 verification results

| Check | Observed result |
| --- | --- |
| Engine regressions | **19 passed.** |
| Real Chromium browser scenarios | **15 passed.** Covered tap/undo, keyboard input, drag and bearing-off tray, Enemy Control AI, saved setup/state restoration, opening and ordinary roll cancellation, correct-player resignation, completed-game undo lock, blocked doubles/bar auto-pass, diagnostic visibility, malformed-save recovery, and native audio activation/persistence. |
| Introduction and rules | Checked at **1024 × 768** and **390 × 844** without clipping. Keyboard tabs, focus handling, and Escape dismissal passed. |
| Main board at 1024 × 768 | Verified exact **4:3** board proportions with no overflow. |
| Browser audio | Native AudioContext reaches running on a returning player’s direct gesture; sound preference persists across reload. Physical speaker output still requires a device check. |
| TypeScript and production bundle | Both passed for the updated application. |

### Version 0.1.0 release and device checks

| Check | Current status |
| --- | --- |
| Complete-game simulation | **20/20 completed:** 10 Balanced and 10 Aggressive, each in a fresh browser context. 1,267 rolls, 270 captures, 8 Enemy Control triggers, and 21 blocked doubles; no lockups or runtime/diagnostic errors. These are stability checks, not a strength comparison. |
| Main board in phone portrait | **390 × 844 passed:** 4:3 board, no page overflow or checker overlap. Additional 1366 × 1024 and 768 × 1024 checks passed. Short landscape screens use a compact table with a scrollable control panel. |
| GitHub update and Pages deployment | **Released.** [PR #1](https://github.com/mygeorgiaattorney/war-peace-backgammon/pull/1) passed its automated checks and was merged as [`6a451cf`](https://github.com/mygeorgiaattorney/war-peace-backgammon/commit/6a451cfa1161590c1a4f2066cc9deea7a71c0302). [Pages deployment #23](https://github.com/mygeorgiaattorney/war-peace-backgammon/actions/runs/40210318756) completed successfully. The published HTML returned HTTP 200 and the live beta entry screen opened in Chrome. |
| Actual iPad Safari and audio | Not yet verified on the device. Check touch interaction, audible sound, legibility, and playing feel. |

Browser viewport checks establish layout and interaction in the tested browser; they do not replace the remaining actual-device check.

## How to resume next time

1. Read this file and inspect the latest GitHub commit and deployment result.
2. Use this repository as the working source. Compare any newly supplied historical file before importing it.
3. For development, run `npm ci`, `npm test`, `npx tsc -b`, and `npm run build`. The web game itself requires no installation.
4. Run `npm run test:browser` with the development server running and Chromium installed through Playwright. Play through both computer modes and two-player mode; exercise the 6–4 home-entry scenario, forced full PEACE turns, Enemy Control, landmine thresholds and opposing home defenses, barred checkers, blocked doubles, bearing off, save/resume, undo, and interrupted rolls.
5. Check a 4:3 tablet viewport and a narrow phone viewport, then update this file with observed results and remaining work.

No native iOS/Android store release or network multiplayer is recorded as complete. A successful Pages build establishes that the web bundle deployed; it does not by itself establish correct gameplay or satisfactory tablet presentation.
