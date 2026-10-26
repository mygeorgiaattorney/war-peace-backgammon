import React, { useEffect, useMemo, useRef, useState } from "react";
import GameIntro from "./components/GameIntro";
import RulesDialog from "./components/RulesDialog";
import { chooseStrategicMove, getLandmineProfile } from "./game/strategy";
import GameNarration, { type NarrationEvent } from "./components/GameNarration";
import SoundSettings from "./components/SoundSettings";
import DicePanel, { type RollHistoryEntry } from "./components/DicePanel";
import useTableFit from "./components/useTableFit";
import { createMusicPlayer, type MusicMode } from "./game/music";
import "./game.css";
import "./tablet.css";

function readStoredValue(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStoredValue(key: string, value: string): boolean {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}

function removeStoredValue(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Play remains available without browser storage. */ }
}

type Player = "White" | "Black";
type Mode = "WAR" | "PEACE";
type ControlState = "NORMAL" | "ENEMY_CONTROL";
type GamePhase = "OPENING_ROLL" | "MODE_CHOICE" | "OPENING_TURN" | "NORMAL_TURN" | "GAME_OVER";
type AutoTestSpeed = "SLOW" | "FAST" | "VERY_FAST" | "SAFE_TURBO";
type AutoTestStrategy = "RANDOM_LEGAL" | "BALANCED" | "CONTROLLED_COMEBACK";
type PlaySetupMode = "MENU" | "TWO_PLAYERS" | "COMPUTER_BALANCED" | "COMPUTER_AGGRESSIVE";

type Point = {
  owner: Player | null;
  count: number;
};

type Move = {
  from: number;
  to: number;
  die: number;
  isHit: boolean;
  isBarEntry?: boolean;
  isBearOff?: boolean;
};

type BarState = {
  White: number;
  Black: number;
};

type OffState = {
  White: number;
  Black: number;
};

type WinReason = "BEAR_OFF" | "RESIGNATION";

type FinalResult = {
  winner: Player;
  loser: Player;
  reason: WinReason;
  winnerOff: number;
  loserOff: number;
  winnerPips: number;
  loserPips: number;
  movesPlayed: number;
  modeAtFinish: Mode;
};

type Sequence = {
  moves: Move[];
  totalHits: number;
  totalBearOffs: number;
  diceUsed: number[];
};

type LegalAnalysis = {
  controlState: ControlState;
  controller: Player;
  legalSequences: Sequence[];
  legalMoves: Move[];
  explanation: string[];
};

type MoveLogEntry = {
  id: number;
  player: Player;
  mode: Mode;
  controlState: ControlState;
  controller: Player;
  move: Move;
  remainingDiceAfter: number[];
};

type Snapshot = {
  board: Point[];
  dice: number[];
  usedDiceIndices: number[];
  bar: BarState;
  off: OffState;
  controller: Player;
  controlState: ControlState;
  moveLog: MoveLogEntry[];
  lastMove: Move | null;
  turnMoveCount: number;
  bearOffPriorityAtTurnStart: boolean;
};

type SavedGameState = {
  version: 1 | 2 | 3 | 4;
  rolledDice?: number[];
  usedDiceIndices?: number[];
  rollHistory?: RollHistoryEntry[];
  bearOffPriorityAtTurnStart?: boolean;
  playSetupMode?: Exclude<PlaySetupMode, "MENU">;
  computerStrategy?: AutoTestStrategy;
  whitePlayerName?: string;
  blackPlayerName?: string;
  gameRolls?: number;
  gamePlayableRolls?: number;
  gameUnplayableRolls?: number;
  savedAt: string;
  board: Point[];
  bar: BarState;
  off: OffState;
  mode: Mode;
  currentPlayer: Player;
  controller: Player;
  controlState: ControlState;
  gamePhase: GamePhase;
  remainingDice: number[];
  lastMove: Move | null;
  moveLog: MoveLogEntry[];
  turnMoveCount: number;
  openingDice: number[] | null;
  openingWinner: Player | null;
  awaitingModeChoice: boolean;
  openingTurnMoveMade: boolean;
  openingTurnRequiresMove: boolean;
  winner: Player | null;
  finalResult: FinalResult | null;
  message: string;
};

type WinLossModeStats = {
  wins: number;
  losses: number;
};

type HeadToHeadStats = {
  opponentName: string;
  games: number;
  wins: number;
  losses: number;
  totalLoserPipsWhenWon: number;
  totalOwnPipsWhenLost: number;
};

type PlayerStats = {
  name: string;
  games: number;
  wins: number;
  losses: number;
  resignationWins: number;
  resignationLosses: number;
  bearOffWins: number;
  bearOffLosses: number;
  war: WinLossModeStats;
  peace: WinLossModeStats;
  totalLoserPipsWhenWon: number;
  totalOwnPipsWhenLost: number;
  headToHead: Record<string, HeadToHeadStats>;
};

type PlayerGameRecord = {
  id: string;
  playedAt: string;
  whitePlayer: string;
  blackPlayer: string;
  winnerPlayer: string;
  loserPlayer: string;
  winnerColor: Player;
  loserColor: Player;
  mode: Mode;
  reason: WinReason;
  loserPips: number;
  winnerOff: number;
  loserOff: number;
  movesPlayed: number;
};

type PlayerRecordBook = {
  version: 1;
  players: Record<string, PlayerStats>;
  games: PlayerGameRecord[];
};

type AutoTestGameResult = {
  gameNumber: number;
  completedAt: string;
  winner: Player | null;
  openingWinner: Player | null;
  startingMode: Mode | null;
  steps: number; // Internal simulation cycles only. Not a player-facing game-length measure.
  diceRolls?: number;
  playableRolls?: number;
  unplayableRolls?: number;
  noEntryRolls?: number;
  doublesRolled?: number;
  playableDoubles?: number;
  blockedDoubles?: number;
  checkerMoves?: number;
  hits?: number;
  bearOffs?: number;
  noMovePasses: number;
  winnerGreatestDeficitPips: number;
  loserPipsRemaining?: number;
  loserCheckersOff?: number;
  finalPipMargin?: number;
  checkerMargin?: number;
  highestWhitePips?: number;
  highestBlackPips?: number;
  highestPipCount?: number;
  largestPipGap?: number;
  extremePipEvent?: boolean;
  enemyControlTriggers?: number;
  enemyControlMoves?: number;
  whiteGainedEnemyControl?: number;
  blackGainedEnemyControl?: number;
  enemyControlWhileTrailing30?: number;
  enemyControlCausedHits?: number;
  enemyControlBeneficiaryWon?: boolean;
};

type AutoTestReport = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  targetGames: number;
  stopReason: string;
  speedLabel?: string;
  strategyLabel?: string;
  games: AutoTestGameResult[];
};

type AutoTestSummary = {
  targetGames: number;
  completedGames: number;
  whiteWins: number;
  blackWins: number;
  totalSteps: number;
  shortestGameSteps: number;
  longestGameSteps: number;
  averageGameSteps: number;
  totalDiceRolls: number;
  averageDiceRolls: number;
  shortestGameRolls: number;
  longestGameRolls: number;
  playableRolls: number;
  unplayableRolls: number;
  noEntryRolls: number;
  doublesRolled: number;
  playableDoubles: number;
  blockedDoubles: number;
  checkerMoves: number;
  hits: number;
  bearOffs: number;
  noMovePasses: number;
  averageFinalPipMargin: number;
  medianFinalPipMargin: number;
  smallestFinalPipMargin: number;
  largestFinalPipMargin: number;
  averageCheckerMargin: number;
  medianCheckerMargin: number;
  smallestCheckerMargin: number;
  largestCheckerMargin: number;
  averageLoserCheckersOff: number;
  medianLoserCheckersOff: number;
  shutoutGames: number;
  loserOff1To5: number;
  loserOff6To10: number;
  loserOff11To14: number;
  highestPipCount: number;
  largestPipGap: number;
  finalMarginsOver50: number;
  finalMarginsOver100: number;
  highestPipCountsOver200: number;
  highestPipCountsOver300: number;
  largestPipGapsOver100: number;
  largestPipGapsOver150: number;
  largestPipGapsOver200: number;
  largestPipGapsOver300: number;
  openingWinnerWins: number;
  openingWinnerLosses: number;
  warStartGames: number;
  warStartWins: number;
  peaceStartGames: number;
  peaceStartWins: number;
  greatestComebackPips: number;
  greatestComebackSummary: string;
  enemyControlTriggers: number;
  enemyControlMoves: number;
  whiteGainedEnemyControl: number;
  blackGainedEnemyControl: number;
  enemyControlWhileTrailing30: number;
  enemyControlCausedHits: number;
  enemyControlBeneficiaryWins: number;
  enemyControlBeneficiaryWinRate: string;
  stopReason: string;
};

const PLAYER_RECORDS_KEY = "warPeaceBackgammonPlayerRecordsV1";
const AUTO_TEST_REPORT_KEY = "warPeaceBackgammonAutoTestReportV1";
const SAVE_KEY = "warPeaceBackgammonSaveV1";
const BETA_PASSWORD = "warpeace1776";
const PUBLIC_SHOW_TESTING_TOOLS = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testing") === "1";
const BETA_ACCESS_KEY = "warPeaceBackgammonBetaAccessV1";
const AUTO_TEST_SPEED_LABELS: Record<AutoTestSpeed, string> = {
  SLOW: "Slow",
  FAST: "Fast",
  VERY_FAST: "Very Fast",
  SAFE_TURBO: "Safe Batch",
};

const AUTO_TEST_STRATEGY_LABELS: Record<AutoTestStrategy, string> = {
  RANDOM_LEGAL: "Random Legal",
  BALANCED: "Balanced",
  CONTROLLED_COMEBACK: "Aggressive",
};

const AUTO_TEST_BATCH_CHECKPOINT_GAMES = 10;

const AUTO_TEST_DELAY_MS: Record<AutoTestSpeed, number> = {
  SLOW: 850,
  FAST: 220,
  VERY_FAST: 55,
  SAFE_TURBO: 8,
};

const AUTO_TEST_NO_MOVE_DELAY_MS: Record<AutoTestSpeed, number> = {
  SLOW: 2300,
  FAST: 450,
  VERY_FAST: 90,
  SAFE_TURBO: 18,
};

const AUTO_TEST_DICE_DELAY_MS: Record<AutoTestSpeed, number> = {
  SLOW: 650,
  FAST: 90,
  VERY_FAST: 18,
  SAFE_TURBO: 0,
};

function createEmptyAutoTestReport(targetGames = 1, stopReason = "Not started."): AutoTestReport {
  const now = new Date().toISOString();
  return {
    version: 1,
    startedAt: now,
    updatedAt: now,
    targetGames,
    stopReason,
    games: [],
  };
}

function loadAutoTestReport(): AutoTestReport {
  try {
    const stored = readStoredValue(AUTO_TEST_REPORT_KEY);
    if (!stored) return createEmptyAutoTestReport(1);
    const parsed = JSON.parse(stored) as AutoTestReport;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.games)) return createEmptyAutoTestReport(1);
    return parsed;
  } catch {
    return createEmptyAutoTestReport(1);
  }
}

function saveAutoTestReport(report: AutoTestReport): void {
  writeStoredValue(AUTO_TEST_REPORT_KEY, JSON.stringify(report));
}

function summarizeAutoTestReport(report: AutoTestReport): AutoTestSummary {
  const games = report.games;
  const completedGames = games.length;
  const whiteWins = games.filter((game) => game.winner === "White").length;
  const blackWins = games.filter((game) => game.winner === "Black").length;
  const totalSteps = games.reduce((total, game) => total + game.steps, 0);
  const totalDiceRolls = games.reduce((total, game) => total + (game.diceRolls ?? 0), 0);
  const playableRolls = games.reduce((total, game) => total + (game.playableRolls ?? 0), 0);
  const unplayableRolls = games.reduce((total, game) => total + (game.unplayableRolls ?? game.noMovePasses ?? 0), 0);
  const noEntryRolls = games.reduce((total, game) => total + (game.noEntryRolls ?? 0), 0);
  const doublesRolled = games.reduce((total, game) => total + (game.doublesRolled ?? 0), 0);
  const playableDoubles = games.reduce((total, game) => total + (game.playableDoubles ?? 0), 0);
  const blockedDoubles = games.reduce((total, game) => total + (game.blockedDoubles ?? 0), 0);
  const checkerMoves = games.reduce((total, game) => total + (game.checkerMoves ?? 0), 0);
  const hits = games.reduce((total, game) => total + (game.hits ?? 0), 0);
  const bearOffs = games.reduce((total, game) => total + (game.bearOffs ?? 0), 0);
  const finalPipMargins = games
    .map((game) => game.finalPipMargin)
    .filter((value): value is number => typeof value === "number");
  const checkerMargins = games
    .map((game) => game.checkerMargin)
    .filter((value): value is number => typeof value === "number");
  const loserOffValues = games
    .map((game) => game.loserCheckersOff)
    .filter((value): value is number => typeof value === "number");
  const highestPipCount = games.reduce((highest, game) => Math.max(highest, game.highestPipCount ?? 0), 0);
  const largestPipGap = games.reduce((highest, game) => Math.max(highest, game.largestPipGap ?? 0), 0);
  const noMovePasses = unplayableRolls;
  const shortestGameSteps = completedGames === 0 ? 0 : Math.min(...games.map((game) => game.steps));
  const longestGameSteps = completedGames === 0 ? 0 : Math.max(...games.map((game) => game.steps));
  const averageGameSteps = completedGames === 0 ? 0 : Math.round(totalSteps / completedGames);
  const shortestGameRolls = completedGames === 0 ? 0 : Math.min(...games.map((game) => game.diceRolls ?? 0));
  const longestGameRolls = completedGames === 0 ? 0 : Math.max(...games.map((game) => game.diceRolls ?? 0));
  const averageDiceRolls = completedGames === 0 ? 0 : Math.round(totalDiceRolls / completedGames);
  const openingWinnerWins = games.filter((game) => game.openingWinner && game.winner === game.openingWinner).length;
  const openingWinnerLosses = games.filter((game) => game.openingWinner && game.winner && game.winner !== game.openingWinner).length;
  const warStartGames = games.filter((game) => game.startingMode === "WAR").length;
  const warStartWins = games.filter((game) => game.startingMode === "WAR" && game.winner === game.openingWinner).length;
  const peaceStartGames = games.filter((game) => game.startingMode === "PEACE").length;
  const peaceStartWins = games.filter((game) => game.startingMode === "PEACE" && game.winner === game.openingWinner).length;
  const greatestComebackGame = games.reduce<AutoTestGameResult | null>((best, game) => {
    if (!best || game.winnerGreatestDeficitPips > best.winnerGreatestDeficitPips) return game;
    return best;
  }, null);
  const greatestComebackPips = greatestComebackGame?.winnerGreatestDeficitPips ?? 0;
  const greatestComebackSummary = greatestComebackGame && greatestComebackPips > 0
    ? `Game ${greatestComebackGame.gameNumber}: ${greatestComebackGame.winner ?? "Unknown"} won after trailing by ${greatestComebackPips} pips.`
    : "No comeback deficit recorded yet.";
  const enemyControlTriggers = games.reduce((total, game) => total + (game.enemyControlTriggers ?? 0), 0);
  const enemyControlMoves = games.reduce((total, game) => total + (game.enemyControlMoves ?? 0), 0);
  const whiteGainedEnemyControl = games.reduce((total, game) => total + (game.whiteGainedEnemyControl ?? 0), 0);
  const blackGainedEnemyControl = games.reduce((total, game) => total + (game.blackGainedEnemyControl ?? 0), 0);
  const enemyControlWhileTrailing30 = games.reduce((total, game) => total + (game.enemyControlWhileTrailing30 ?? 0), 0);
  const enemyControlCausedHits = games.reduce((total, game) => total + (game.enemyControlCausedHits ?? 0), 0);
  const enemyControlBeneficiaryWins = games.filter((game) => game.enemyControlBeneficiaryWon).length;

  return {
    targetGames: report.targetGames,
    completedGames,
    whiteWins,
    blackWins,
    totalSteps,
    shortestGameSteps,
    longestGameSteps,
    averageGameSteps,
    totalDiceRolls,
    averageDiceRolls,
    shortestGameRolls,
    longestGameRolls,
    playableRolls,
    unplayableRolls,
    noEntryRolls,
    doublesRolled,
    playableDoubles,
    blockedDoubles,
    checkerMoves,
    hits,
    bearOffs,
    noMovePasses,
    averageFinalPipMargin: averageNumber(finalPipMargins),
    medianFinalPipMargin: medianNumber(finalPipMargins),
    smallestFinalPipMargin: finalPipMargins.length === 0 ? 0 : Math.min(...finalPipMargins),
    largestFinalPipMargin: finalPipMargins.length === 0 ? 0 : Math.max(...finalPipMargins),
    averageCheckerMargin: averageNumber(checkerMargins),
    medianCheckerMargin: medianNumber(checkerMargins),
    smallestCheckerMargin: checkerMargins.length === 0 ? 0 : Math.min(...checkerMargins),
    largestCheckerMargin: checkerMargins.length === 0 ? 0 : Math.max(...checkerMargins),
    averageLoserCheckersOff: averageNumber(loserOffValues),
    medianLoserCheckersOff: medianNumber(loserOffValues),
    shutoutGames: games.filter((game) => game.loserCheckersOff === 0).length,
    loserOff1To5: games.filter((game) => typeof game.loserCheckersOff === "number" && game.loserCheckersOff >= 1 && game.loserCheckersOff <= 5).length,
    loserOff6To10: games.filter((game) => typeof game.loserCheckersOff === "number" && game.loserCheckersOff >= 6 && game.loserCheckersOff <= 10).length,
    loserOff11To14: games.filter((game) => typeof game.loserCheckersOff === "number" && game.loserCheckersOff >= 11 && game.loserCheckersOff <= 14).length,
    highestPipCount,
    largestPipGap,
    finalMarginsOver50: games.filter((game) => (game.finalPipMargin ?? 0) >= 50).length,
    finalMarginsOver100: games.filter((game) => (game.finalPipMargin ?? 0) >= 100).length,
    highestPipCountsOver200: games.filter((game) => (game.highestPipCount ?? 0) >= 200).length,
    highestPipCountsOver300: games.filter((game) => (game.highestPipCount ?? 0) >= 300).length,
    largestPipGapsOver100: games.filter((game) => (game.largestPipGap ?? 0) >= 100).length,
    largestPipGapsOver150: games.filter((game) => (game.largestPipGap ?? 0) >= 150).length,
    largestPipGapsOver200: games.filter((game) => (game.largestPipGap ?? 0) >= 200).length,
    largestPipGapsOver300: games.filter((game) => (game.largestPipGap ?? 0) >= 300).length,
    openingWinnerWins,
    openingWinnerLosses,
    warStartGames,
    warStartWins,
    peaceStartGames,
    peaceStartWins,
    greatestComebackPips,
    greatestComebackSummary,
    enemyControlTriggers,
    enemyControlMoves,
    whiteGainedEnemyControl,
    blackGainedEnemyControl,
    enemyControlWhileTrailing30,
    enemyControlCausedHits,
    enemyControlBeneficiaryWins,
    enemyControlBeneficiaryWinRate: formatPercent(enemyControlBeneficiaryWins, games.filter((game) => (game.enemyControlTriggers ?? 0) > 0).length),
    stopReason: report.stopReason,
  };
}

function createAutoTestSummary(targetGames = 1): AutoTestSummary {
  return summarizeAutoTestReport(createEmptyAutoTestReport(targetGames));
}

function averageNumber(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function medianNumber(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "n/a";
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatAutoTestReportText(report: AutoTestReport): string {
  const summary = summarizeAutoTestReport(report);
  const lines = [
    "WAR & PEACE BACKGAMMON AUTO TEST REPORT",
    `Started: ${new Date(report.startedAt).toLocaleString()}`,
    `Updated: ${new Date(report.updatedAt).toLocaleString()}`,
    `Stop reason: ${report.stopReason}`,
    `Speed: ${report.speedLabel ?? "Unknown"}`,
    `Strategy: ${report.strategyLabel ?? "Unknown"}`,
    "",
    `Games completed: ${summary.completedGames}/${summary.targetGames}`,
    `White wins: ${summary.whiteWins}`,
    `Black wins: ${summary.blackWins}`,
    `White win rate: ${formatPercent(summary.whiteWins, summary.completedGames)}`,
    `Black win rate: ${formatPercent(summary.blackWins, summary.completedGames)}`,
    "",
    `Opening roll winner wins: ${summary.openingWinnerWins}`,
    `Opening roll loser wins: ${summary.openingWinnerLosses}`,
    `Opening winner win rate: ${formatPercent(summary.openingWinnerWins, summary.openingWinnerWins + summary.openingWinnerLosses)}`,
    "",
    `WAR-start games: ${summary.warStartGames}`,
    `WAR-start chooser wins: ${summary.warStartWins} (${formatPercent(summary.warStartWins, summary.warStartGames)})`,
    `PEACE-start games: ${summary.peaceStartGames}`,
    `PEACE-start chooser wins: ${summary.peaceStartWins} (${formatPercent(summary.peaceStartWins, summary.peaceStartGames)})`,
    "",
    "Game length and dice-roll flow:",
    `Average game length: ${summary.averageDiceRolls} dice rolls/turns`,
    `Shortest game: ${summary.shortestGameRolls} dice rolls/turns`,
    `Longest game: ${summary.longestGameRolls} dice rolls/turns`,
    `Total dice rolls/turns: ${summary.totalDiceRolls}`,
    `Playable rolls: ${summary.playableRolls}`,
    `Unplayable rolls / auto-passes: ${summary.unplayableRolls}`,
    `No-entry rolls from the bar: ${summary.noEntryRolls}`,
    `Doubles rolled: ${summary.doublesRolled}`,
    `Playable doubles: ${summary.playableDoubles}`,
    `Blocked doubles preserving mode: ${summary.blockedDoubles}`,
    `Checker moves made: ${summary.checkerMoves}`,
    `Hits: ${summary.hits}`,
    `Bear-offs: ${summary.bearOffs}`,
    `Internal simulation cycles: avg ${summary.averageGameSteps}, shortest ${summary.shortestGameSteps}, longest ${summary.longestGameSteps}`,
    `Greatest comeback: ${summary.greatestComebackSummary}`,
    "",
    "Victory margins and volatility:",
    `Average final pip margin: ${summary.averageFinalPipMargin} pips`,
    `Median final pip margin: ${summary.medianFinalPipMargin} pips`,
    `Smallest final pip margin: ${summary.smallestFinalPipMargin} pips`,
    `Largest final pip margin: ${summary.largestFinalPipMargin} pips`,
    `Average checker/off margin: ${summary.averageCheckerMargin} checkers`,
    `Median checker/off margin: ${summary.medianCheckerMargin} checkers`,
    `Largest checker/off margin: ${summary.largestCheckerMargin} checkers`,
    `Average loser checkers borne off: ${summary.averageLoserCheckersOff}`,
    `Median loser checkers borne off: ${summary.medianLoserCheckersOff}`,
    `Shutout games - loser bore off 0: ${summary.shutoutGames}`,
    `Loser bore off 1-5: ${summary.loserOff1To5}`,
    `Loser bore off 6-10: ${summary.loserOff6To10}`,
    `Loser bore off 11-14: ${summary.loserOff11To14}`,
    `Final margins 50+ pips: ${summary.finalMarginsOver50}`,
    `Final margins 100+ pips: ${summary.finalMarginsOver100}`,
    "",
    "Extreme pip events:",
    `Highest pip count reached by any player: ${summary.highestPipCount}`,
    `Largest pip gap during any game: ${summary.largestPipGap}`,
    `Games with highest pip count 200+: ${summary.highestPipCountsOver200}`,
    `Games with highest pip count 300+: ${summary.highestPipCountsOver300}`,
    `Games with pip gap 100+: ${summary.largestPipGapsOver100}`,
    `Games with pip gap 150+: ${summary.largestPipGapsOver150}`,
    `Games with pip gap 200+: ${summary.largestPipGapsOver200}`,
    `Games with pip gap 300+: ${summary.largestPipGapsOver300}`,
    "",
    "Enemy Control / Peace Violation:",
    `Enemy Control triggers: ${summary.enemyControlTriggers}`,
    `Enemy Control moves executed: ${summary.enemyControlMoves}`,
    `White gained Enemy Control: ${summary.whiteGainedEnemyControl}`,
    `Black gained Enemy Control: ${summary.blackGainedEnemyControl}`,
    `Enemy Control while beneficiary trailed by 30+ pips: ${summary.enemyControlWhileTrailing30}`,
    `Enemy Control moves that hit: ${summary.enemyControlCausedHits}`,
    `Games with Enemy Control where beneficiary won: ${summary.enemyControlBeneficiaryWins} (${summary.enemyControlBeneficiaryWinRate})`,
    "",
    "Recent games:",
    ...report.games.slice(-20).map((game) =>
      `Game ${game.gameNumber}: winner=${game.winner ?? "Unknown"}, openingWinner=${game.openingWinner ?? "Unknown"}, start=${game.startingMode ?? "Unknown"}, rolls=${game.diceRolls ?? 0}, playable=${game.playableRolls ?? 0}, unplayable=${game.unplayableRolls ?? game.noMovePasses}, noEntry=${game.noEntryRolls ?? 0}, doubles=${game.doublesRolled ?? 0}, blockedDoubles=${game.blockedDoubles ?? 0}, moves=${game.checkerMoves ?? 0}, hits=${game.hits ?? 0}, bearOffs=${game.bearOffs ?? 0}, comeback=${game.winnerGreatestDeficitPips}, finalMargin=${formatOptionalNumber(game.finalPipMargin)}, loserOff=${formatOptionalNumber(game.loserCheckersOff)}, checkerMargin=${formatOptionalNumber(game.checkerMargin)}, highestPip=${formatOptionalNumber(game.highestPipCount)}, largestGap=${formatOptionalNumber(game.largestPipGap)}, enemyControl=${game.enemyControlTriggers ?? 0}, ecMoves=${game.enemyControlMoves ?? 0}`
    ),
  ];

  return lines.join("\n");
}

const HOME_BAR: BarState = { White: 0, Black: 0 };
const HOME_OFF: OffState = { White: 0, Black: 0 };

function emptyBoard(): Point[] {
  return Array.from({ length: 24 }, () => ({ owner: null, count: 0 }));
}

function createStartingBoard(): Point[] {
  const board = emptyBoard();

  board[0] = { owner: "White", count: 2 };
  board[11] = { owner: "White", count: 5 };
  board[16] = { owner: "White", count: 3 };
  board[18] = { owner: "White", count: 5 };

  board[23] = { owner: "Black", count: 2 };
  board[12] = { owner: "Black", count: 5 };
  board[7] = { owner: "Black", count: 3 };
  board[5] = { owner: "Black", count: 5 };

  return board;
}

function opponent(player: Player): Player {
  return player === "White" ? "Black" : "White";
}

function cloneBoard(board: Point[]): Point[] {
  return board.map((point) => ({ ...point }));
}

function removeDie(dice: number[], usedDie: number): number[] {
  const next = [...dice];
  const index = next.findIndex((die) => die === usedDie);
  if (index >= 0) next.splice(index, 1);
  return next;
}

function uniqueDice(dice: number[]): number[] {
  // Visit every value without giving the higher or first die priority.
  return Array.from(new Set(dice));
}

function getEntryPoint(player: Player, die: number): number {
  return player === "White" ? die - 1 : 24 - die;
}

function allHome(board: Point[], player: Player, bar: BarState): boolean {
  if (bar[player] > 0) return false;

  if (player === "White") {
    for (let i = 0; i < 18; i += 1) {
      if (board[i].owner === "White") return false;
    }
  } else {
    for (let i = 6; i < 24; i += 1) {
      if (board[i].owner === "Black") return false;
    }
  }

  return true;
}

function canBearOff(
  board: Point[],
  player: Player,
  bar: BarState,
  from: number,
  die: number
): boolean {
  if (!allHome(board, player, bar)) return false;

  if (player === "White") {
    if (from + die === 24) return true;
    if (from + die > 24) {
      for (let i = 18; i < from; i += 1) {
        if (board[i].owner === "White") return false;
      }
      return true;
    }
  }

  if (from - die === -1) return true;
  if (from - die < -1) {
    for (let i = from + 1; i <= 5; i += 1) {
      if (board[i].owner === "Black") return false;
    }
    return true;
  }

  return false;
}

function calculatePipCount(board: Point[], player: Player, bar: BarState): number {
  let total = 0;

  for (let i = 0; i < 24; i += 1) {
    const point = board[i];
    if (point.owner !== player || point.count === 0) continue;

    const distance = player === "White" ? 24 - i : i + 1;
    total += distance * point.count;
  }

  total += bar[player] * 25;
  return total;
}

function applyMove(
  board: Point[],
  move: Move,
  player: Player,
  bar: BarState,
  off: OffState
): { board: Point[]; bar: BarState; off: OffState } {
  const next = cloneBoard(board);
  const nextBar = { ...bar };
  const nextOff = { ...off };

  if (move.isBarEntry) {
    nextBar[player] -= 1;
  } else {
    next[move.from].count -= 1;
    if (next[move.from].count === 0) next[move.from].owner = null;
  }

  if (move.isBearOff) {
    nextOff[player] += 1;
    return { board: next, bar: nextBar, off: nextOff };
  }

  const target = next[move.to];

  if (target.owner !== null && target.owner !== player && target.count === 1) {
    nextBar[opponent(player)] += 1;
    target.owner = player;
    target.count = 1;
  } else if (target.owner === player) {
    target.count += 1;
  } else {
    target.owner = player;
    target.count = 1;
  }

  return { board: next, bar: nextBar, off: nextOff };
}

function getRawMoves(
  board: Point[],
  player: Player,
  dice: number[],
  bar: BarState,
  off: OffState
): Move[] {
  const moves: Move[] = [];
  if (dice.length === 0) return moves;

  if (bar[player] > 0) {
    for (const die of uniqueDice(dice)) {
      const to = getEntryPoint(player, die);
      const destination = board[to];
      const blocked =
        destination.owner !== null &&
        destination.owner !== player &&
        destination.count >= 2;

      if (blocked) continue;

      moves.push({
        from: -1,
        to,
        die,
        isBarEntry: true,
        isHit:
          destination.owner !== null &&
          destination.owner !== player &&
          destination.count === 1,
      });
    }

    return moves;
  }

  for (let from = 0; from < 24; from += 1) {
    const point = board[from];
    if (point.owner !== player || point.count === 0) continue;

    for (const die of uniqueDice(dice)) {
      if (canBearOff(board, player, bar, from, die)) {
        moves.push({ from, to: -1, die, isHit: false, isBearOff: true });
        continue;
      }

      const to = player === "White" ? from + die : from - die;
      if (to < 0 || to >= 24) continue;

      const destination = board[to];
      const blocked =
        destination.owner !== null &&
        destination.owner !== player &&
        destination.count >= 2;

      if (blocked) continue;

      moves.push({
        from,
        to,
        die,
        isHit:
          destination.owner !== null &&
          destination.owner !== player &&
          destination.count === 1,
      });
    }
  }

  return moves;
}

function generateSequences(
  board: Point[],
  player: Player,
  dice: number[],
  bar: BarState,
  off: OffState,
  currentMoves: Move[] = [],
  totalHits = 0,
  totalBearOffs = 0,
  diceUsed: number[] = []
): Sequence[] {
  const rawMoves = getRawMoves(board, player, dice, bar, off);

  if (rawMoves.length === 0 || dice.length === 0) {
    return [{ moves: currentMoves, totalHits, totalBearOffs, diceUsed }];
  }

  let sequences: Sequence[] = [];

  for (const move of rawMoves) {
    const result = applyMove(board, move, player, bar, off);
    const nextDice = removeDie(dice, move.die);
    const childSequences = generateSequences(
      result.board,
      player,
      nextDice,
      result.bar,
      result.off,
      [...currentMoves, move],
      totalHits + (move.isHit ? 1 : 0),
      totalBearOffs + (move.isBearOff ? 1 : 0),
      [...diceUsed, move.die]
    );

    sequences = [...sequences, ...childSequences];
  }

  return sequences;
}

function filterByMaximumMoves(sequences: Sequence[]): Sequence[] {
  if (sequences.length === 0) return sequences;
  const maxMovesUsed = Math.max(...sequences.map((sequence) => sequence.moves.length));
  return sequences.filter((sequence) => sequence.moves.length === maxMovesUsed);
}

function filterByWarPeace(
  sequences: Sequence[],
  mode: Mode,
  controlState: ControlState,
  explanation: string[],
  bearOffPriorityAtTurnStart: boolean
): Sequence[] {
  if (sequences.length === 0) return sequences;

  if (controlState === "ENEMY_CONTROL") {
    explanation.push("VENGEANCE: the opponent makes ALL moves; capture and bear-off priorities are suspended.");
    return sequences;
  }

  if (mode === "WAR") {
    const maxHits = Math.max(...sequences.map((sequence) => sequence.totalHits));
    let best = sequences.filter((sequence) => sequence.totalHits === maxHits);

    if (maxHits > 0) explanation.push(`WAR requires maximum hitting: ${maxHits} hit(s).`);

    if (bearOffPriorityAtTurnStart) {
      const maxBearOffs = Math.max(...best.map((sequence) => sequence.totalBearOffs));
      best = best.filter((sequence) => sequence.totalBearOffs === maxBearOffs);
      if (maxBearOffs > 0) explanation.push(`All checkers started home: maximize bearing off (${maxBearOffs}).`);
    }
    return best;
  }

  const minHits = Math.min(...sequences.map((sequence) => sequence.totalHits));
  let best = sequences.filter((sequence) => sequence.totalHits === minHits);

  explanation.push(
    minHits === 0
      ? "PEACE avoids captures among turns that use every playable die."
      : `Use every playable die, even in PEACE: ${minHits} unavoidable capture(s).`
  );

  if (bearOffPriorityAtTurnStart) {
    const maxBearOffs = Math.max(...best.map((sequence) => sequence.totalBearOffs));
    best = best.filter((sequence) => sequence.totalBearOffs === maxBearOffs);
    if (maxBearOffs > 0) explanation.push(`All checkers started home: maximize bearing off (${maxBearOffs}).`);
  }
  return best;
}

function dedupeFirstMoves(sequences: Sequence[]): Move[] {
  const firstMoves: Move[] = [];

  for (const sequence of sequences) {
    const first = sequence.moves[0];
    if (!first) continue;

    const duplicate = firstMoves.some(
      (move) =>
        move.from === first.from &&
        move.to === first.to &&
        move.die === first.die &&
        move.isBarEntry === first.isBarEntry &&
        move.isBearOff === first.isBearOff
    );

    if (!duplicate) firstMoves.push(first);
  }

  return firstMoves;
}

function analyzeLegality(
  board: Point[],
  player: Player,
  dice: number[],
  mode: Mode,
  bar: BarState,
  off: OffState,
  controlState: ControlState,
  bearOffPriorityAtTurnStart = allHome(board, player, bar)
): LegalAnalysis {
  const explanation: string[] = [];

  if (dice.length === 0) {
    return { controlState, controller: controlState === "ENEMY_CONTROL" ? opponent(player) : player, legalSequences: [], legalMoves: [], explanation: ["No dice available."] };
  }

  const generated = generateSequences(board, player, dice, bar, off).filter(
    (sequence) => sequence.moves.length > 0
  );

  if (generated.length === 0) {
    return { controlState, controller: controlState === "ENEMY_CONTROL" ? opponent(player) : player, legalSequences: [], legalMoves: [], explanation: ["No legal moves available."] };
  }

  if (bar[player] > 0) explanation.push(`${player} must enter from the bar before moving other checkers.`);

  let best = filterByMaximumMoves(generated);
  const maxMovesUsed = Math.max(...best.map((sequence) => sequence.moves.length));
  explanation.push(`Maximum dice-use rule: ${maxMovesUsed} move(s) available.`);

  // Assign the entire turn before capture/bear-off priorities are applied.
  const effectiveControl: ControlState = controlState === "ENEMY_CONTROL" ||
    (mode === "PEACE" && best.every(sequence => sequence.totalHits > 0)) ? "ENEMY_CONTROL" : "NORMAL";
  best = filterByWarPeace(best, mode, effectiveControl, explanation, bearOffPriorityAtTurnStart);
  best = filterByMaximumMoves(best);

  return { controlState: effectiveControl, controller: effectiveControl === "ENEMY_CONTROL" ? opponent(player) : player, legalSequences: best, legalMoves: dedupeFirstMoves(best), explanation };
}

function savedTurnStartedAllHome(saved: SavedGameState): boolean {
  if (typeof saved.bearOffPriorityAtTurnStart === "boolean") return saved.bearOffPriorityAtTurnStart;
  if (!allHome(saved.board, saved.currentPlayer, saved.bar)) return false;
  if (saved.turnMoveCount === 0) return true;

  // Older saves have no turn-start flag. A checker cannot leave its home board
  // during its own turn, so any bar entry or move from outside proves this turn
  // began outside. An incomplete historical log must not create a new duty.
  if (saved.moveLog.length < saved.turnMoveCount) return false;
  return saved.moveLog.slice(-saved.turnMoveCount).every((entry) => {
    const from = entry.move.from;
    return entry.player === saved.currentPlayer && !entry.move.isBarEntry &&
      Number.isInteger(from) && from >= 0 && from < 24 &&
      (saved.currentPlayer === "White" ? from >= 18 : from <= 5);
  });
}

function savedDiceDisplay(saved: SavedGameState): { dice: number[]; used: number[] } {
  if (saved.version === 4 && saved.rolledDice && saved.usedDiceIndices) {
    return { dice: [...saved.rolledDice], used: [...saved.usedDiceIndices] };
  }
  const played = saved.turnMoveCount > 0 ? saved.moveLog.slice(-Math.min(4, saved.turnMoveCount)).map(entry => entry.move.die) : [];
  const dice = saved.openingDice ? [...saved.openingDice] : [...played, ...saved.remainingDice].slice(0, 4);
  const remaining = [...saved.remainingDice];
  const used: number[] = [];
  dice.forEach((value, index) => {
    const match = remaining.indexOf(value);
    if (match >= 0) remaining.splice(match, 1);
    else if (!saved.awaitingModeChoice) used.push(index);
  });
  return { dice, used };
}

function rollDie(): number {
  // Reject the four excess values so each face has exactly the same number
  // of possible 32-bit samples. Dice never depend on board state or score.
  const sample = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(sample); } while (sample[0] >= 4294967292);
  return sample[0] % 6 + 1;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioContextClass();
    }
    if (String(sharedAudioContext.state) !== "running") {
      void sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playTone(
  frequency: number,
  duration: number,
  volume = 0.16,
  type: OscillatorType = "sine",
  delay = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playClickSound(): void {
  playTone(620, 0.1, 0.18, "triangle");
}

function playDiceSound(): void {
  playTone(240, 0.055, 0.13, "square", 0);
  playTone(360, 0.055, 0.11, "triangle", 0.055);
  playTone(280, 0.065, 0.1, "square", 0.11);
}

function playErrorSound(): void {
  playTone(155, 0.16, 0.2, "sawtooth", 0);
  playTone(95, 0.18, 0.16, "square", 0.08);
}

function playHitSound(): void {
  playTone(180, 0.07, 0.18, "square", 0);
  playTone(90, 0.12, 0.13, "sawtooth", 0.055);
}

function playCaptureSound(): void {
  // A low strike followed by a metallic chime, with a bounded volume.
  playTone(98, 0.32, 0.15, "triangle");
  playTone(196, 0.24, 0.08, "square");
  playTone(587.33, 0.18, 0.07, "sine", 0.035);
  playTone(293.66, 0.4, 0.1, "triangle", 0.09);
}

function playPeaceViolationSound(): void {
  // A softer descending minor phrase marks the cost of a PEACE capture.
  playTone(220, 0.38, 0.15, "triangle");
  playTone(196, 0.4, 0.13, "sine", 0.2);
  playTone(174.61, 0.65, 0.13, "triangle", 0.42);
  playTone(130.81, 0.85, 0.09, "sine", 0.42);
}

function playVengeanceSound(): void {
  playTone(73.42, 1.8, .13, "triangle");
  playTone(146.83, 1.5, .055, "sawtooth", .04);
  playTone(155.56, 1.4, .045, "sine", .08);
  [587.33, 554.37, 415.30, 293.66, 146.83].forEach((note, index) =>
    playTone(note, .65, .045, "sine", .16 + index * .13));
}

function playWinFanfare(): void {
  const melody = [523, 659, 784, 1046, 1318];
  melody.forEach((frequency, index) => {
    playTone(frequency, 0.24, 0.16, index % 2 === 0 ? "triangle" : "sine", index * 0.13);
  });
}

function playSoundTest(): void {
  playTone(440, 0.09, 0.16, "triangle", 0);
  playTone(660, 0.11, 0.15, "sine", 0.1);
}


function moveKey(move: Move): string {
  return `${move.from}:${move.to}:${move.die}:${move.isBarEntry ? 1 : 0}:${move.isBearOff ? 1 : 0}`;
}

function pointLabel(index: number): string {
  return index < 0 ? "bar" : `${index + 1}`;
}

function formatFinalResult(result: FinalResult): string {
  if (result.reason === "RESIGNATION") {
    return `${result.winner} wins by resignation. ${result.loser} resigned with ${result.loserOff} borne off and ${result.loserPips} pips remaining.`;
  }

  return `${result.winner} wins by bearing off all 15 checkers. ${result.loser} had ${result.loserOff} borne off and ${result.loserPips} pips remaining.`;
}

function describeMove(move: Move): string {
  if (move.isBearOff) return `Bear off from ${pointLabel(move.from)} with ${move.die}`;
  if (move.isBarEntry) return `Enter from bar to ${pointLabel(move.to)} with ${move.die}${move.isHit ? " - Captured" : ""}`;
  return `${pointLabel(move.from)} -> ${pointLabel(move.to)} with ${move.die}${move.isHit ? " - Captured" : ""}`;
}

function describeSequence(sequence: Sequence): string {
  return sequence.moves.map(describeMove).join(" | ");
}

function describeSequenceStats(sequence: Sequence): string {
  const parts = [`${sequence.moves.length} move${sequence.moves.length === 1 ? "" : "s"}`];
  parts.push(sequence.totalHits > 0 ? `${sequence.totalHits} hit${sequence.totalHits === 1 ? "" : "s"}` : "no hits");
  if (sequence.totalBearOffs > 0) parts.push(`${sequence.totalBearOffs} bear-off${sequence.totalBearOffs === 1 ? "" : "s"}`);
  parts.push(`dice: ${sequence.diceUsed.join(", ")}`);
  return parts.join(" | ");
}

function formatMoveLogEntry(entry: MoveLogEntry): string {
  const tags: string[] = [];
  if (entry.move.isHit) tags.push(entry.mode === "WAR" ? "PRISONER OF WAR" : "PRISONER OF PEACE");
  if (entry.move.isBearOff) tags.push("OFF");
  if (entry.move.isBarEntry) tags.push("BAR");
  if (entry.controlState === "ENEMY_CONTROL") tags.push("ENEMY CONTROL");
  const suffix = tags.length > 0 ? ` [${tags.join(" | ")}]` : "";
  return `${entry.id}. ${entry.player} ${entry.mode}: ${describeMove(entry.move)}${suffix}`;
}

function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function playerRecordKey(name: string): string {
  return normalizePlayerName(name).toLowerCase();
}

function createEmptyRecordBook(): PlayerRecordBook {
  return { version: 1, players: {}, games: [] };
}

function createPlayerStats(name: string): PlayerStats {
  return {
    name: normalizePlayerName(name) || "Unnamed Player",
    games: 0,
    wins: 0,
    losses: 0,
    resignationWins: 0,
    resignationLosses: 0,
    bearOffWins: 0,
    bearOffLosses: 0,
    war: { wins: 0, losses: 0 },
    peace: { wins: 0, losses: 0 },
    totalLoserPipsWhenWon: 0,
    totalOwnPipsWhenLost: 0,
    headToHead: {},
  };
}

function ensurePlayerStats(book: PlayerRecordBook, name: string): PlayerStats {
  const cleanName = normalizePlayerName(name) || "Unnamed Player";
  const key = playerRecordKey(cleanName);
  if (!book.players[key]) book.players[key] = createPlayerStats(cleanName);
  book.players[key].name = cleanName;
  return book.players[key];
}

function ensureHeadToHead(stats: PlayerStats, opponentName: string): HeadToHeadStats {
  const key = playerRecordKey(opponentName);
  if (!stats.headToHead[key]) {
    stats.headToHead[key] = {
      opponentName: normalizePlayerName(opponentName) || "Unnamed Player",
      games: 0,
      wins: 0,
      losses: 0,
      totalLoserPipsWhenWon: 0,
      totalOwnPipsWhenLost: 0,
    };
  }
  stats.headToHead[key].opponentName = normalizePlayerName(opponentName) || "Unnamed Player";
  return stats.headToHead[key];
}

function cloneRecordBook(book: PlayerRecordBook): PlayerRecordBook {
  return JSON.parse(JSON.stringify(book)) as PlayerRecordBook;
}

function loadPlayerRecordBook(): PlayerRecordBook {
  if (typeof window === "undefined") return createEmptyRecordBook();

  try {
    const raw = readStoredValue(PLAYER_RECORDS_KEY);
    if (!raw) return createEmptyRecordBook();

    const parsed = JSON.parse(raw) as Partial<PlayerRecordBook>;
    if (parsed.version !== 1 || !parsed.players || !Array.isArray(parsed.games)) {
      return createEmptyRecordBook();
    }

    return {
      version: 1,
      players: parsed.players as Record<string, PlayerStats>,
      games: parsed.games as PlayerGameRecord[],
    };
  } catch {
    return createEmptyRecordBook();
  }
}

function savePlayerRecordBook(book: PlayerRecordBook): void {
  if (typeof window === "undefined") return;
  writeStoredValue(PLAYER_RECORDS_KEY, JSON.stringify(book));
}

function formatWinRate(wins: number, games: number): string {
  if (games === 0) return "—";
  return `${Math.round((wins / games) * 100)}%`;
}

function averagePips(total: number, count: number): string {
  if (count === 0) return "—";
  return (total / count).toFixed(1);
}

function runEngineSelfTests(): string[] {
  const results: string[] = [];

  const assert = (name: string, condition: boolean) => {
    results.push(`${condition ? "PASS" : "FAIL"}: ${name}`);
  };

  const start = createStartingBoard();
  assert("starting white pip count is 167", calculatePipCount(start, "White", HOME_BAR) === 167);
  assert("starting black pip count is 167", calculatePipCount(start, "Black", HOME_BAR) === 167);

  const peaceBoard = emptyBoard();
  peaceBoard[0] = { owner: "White", count: 1 };
  peaceBoard[4] = { owner: "White", count: 1 };
  peaceBoard[5] = { owner: "Black", count: 1 };
  peaceBoard[8] = { owner: "Black", count: 2 };
  const peaceAnalysis = analyzeLegality(peaceBoard, "White", [1, 4], "PEACE", HOME_BAR, HOME_OFF, "NORMAL");
  assert("PEACE uses both dice despite this unavoidable capture", peaceAnalysis.legalSequences.length > 0 &&
    peaceAnalysis.legalSequences.every((sequence) => sequence.moves.length === 2 && sequence.totalHits === 1));

  const barBoard = emptyBoard();
  barBoard[0] = { owner: "Black", count: 1 };
  const barAnalysis = analyzeLegality(barBoard, "White", [1, 2], "WAR", { White: 1, Black: 0 }, HOME_OFF, "NORMAL");
  assert("bar entry is generated when checker is on bar", barAnalysis.legalMoves.every((move) => move.isBarEntry));

  const bearBoard = emptyBoard();
  bearBoard[23] = { owner: "White", count: 15 };
  const bearAnalysis = analyzeLegality(bearBoard, "White", [1, 6], "WAR", HOME_BAR, HOME_OFF, "NORMAL");
  assert("bear-off move is generated when all checkers are home", bearAnalysis.legalMoves.some((move) => move.isBearOff));

  return results;
}

export default function App() {
  const [board, setBoard] = useState<Point[]>(createStartingBoard());
  const [bar, setBar] = useState<BarState>({ White: 0, Black: 0 });
  const [off, setOff] = useState<OffState>({ White: 0, Black: 0 });
  const [mode, setMode] = useState<Mode>("WAR");
  const [currentPlayer, setCurrentPlayer] = useState<Player>("White");
  const [storedController, setController] = useState<Player>("White");
  const [storedControlState, setControlState] = useState<ControlState>("NORMAL");
  const [gamePhase, setGamePhase] = useState<GamePhase>("OPENING_ROLL");
  const [remainingDice, setRemainingDice] = useState<number[]>([]);
  const [rolledDice, setRolledDice] = useState<number[]>([]);
  const [usedDiceIndices, setUsedDiceIndices] = useState<number[]>([]);
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  const [rollHistory, setRollHistory] = useState<RollHistoryEntry[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [pendingBearOffMoves, setPendingBearOffMoves] = useState<Move[]>([]);
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [previewMoveKey, setPreviewMoveKey] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showMoveLog, setShowMoveLog] = useState(true);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [turnMoveCount, setTurnMoveCount] = useState(0);
  const [bearOffPriorityAtTurnStart, setBearOffPriorityAtTurnStart] = useState(false);
  const [turnBanner, setTurnBanner] = useState<string | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [animatingMoveKey, setAnimatingMoveKey] = useState<string | null>(null);
  const [message, setMessage] = useState("Roll opening dice.");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [openingDice, setOpeningDice] = useState<number[] | null>(null);
  const [openingWinner, setOpeningWinner] = useState<Player | null>(null);
  const [awaitingModeChoice, setAwaitingModeChoice] = useState(false);
  const [openingTurnMoveMade, setOpeningTurnMoveMade] = useState(false);
  const [openingTurnRequiresMove, setOpeningTurnRequiresMove] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [legalHelpActive, setLegalHelpActive] = useState(false);
  const [assistSourcePoint, setAssistSourcePoint] = useState<number | null>(null);
  const [whitePlayerName, setWhitePlayerName] = useState("White Player");
  const [blackPlayerName, setBlackPlayerName] = useState("Black Player");
  const [recordBook, setRecordBook] = useState<PlayerRecordBook>(() => loadPlayerRecordBook());
  const [showRecords, setShowRecords] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => readStoredValue("warPeaceBackgammonSoundEnabledV1") !== "off");
  const [narrationEnabled, setNarrationEnabled] = useState(() => readStoredValue("warPeaceBackgammonNarrationEnabledV1") !== "off");
  const [narration, setNarration] = useState<NarrationEvent | null>(null);
  const narrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrationIdRef = useRef(0);
  const [showTestingPanel, setShowTestingPanel] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(() => readStoredValue("warPeaceBackgammonMusicEnabledV1") === "on");
  const [musicVolume, setMusicVolume] = useState(() => {
    const stored = readStoredValue("warPeaceBackgammonMusicVolumeV1");
    const value = stored === null ? .28 : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(.6, value)) : .28;
  });
  const musicRef = useRef<ReturnType<typeof createMusicPlayer> | null>(null);
  const controlAnnouncementRef = useRef("");
  const [saveAvailable, setSaveAvailable] = useState(true);
  const [playSetupMode, setPlaySetupMode] = useState<PlaySetupMode>("MENU");
  const [computerStrategy, setComputerStrategy] = useState<AutoTestStrategy>("BALANCED");
  const [gameRolls, setGameRolls] = useState(0);
  const [gamePlayableRolls, setGamePlayableRolls] = useState(0);
  const [gameUnplayableRolls, setGameUnplayableRolls] = useState(0);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [betaUnlocked, setBetaUnlocked] = useState(() => readStoredValue(BETA_ACCESS_KEY) === "granted");
  const [betaPasswordInput, setBetaPasswordInput] = useState("");
  const [betaError, setBetaError] = useState<string | null>(null);
  const [autoTestRunning, setAutoTestRunning] = useState(false);
  const [autoTestSpeed, setAutoTestSpeed] = useState<AutoTestSpeed>("FAST");
  const [autoTestStrategy, setAutoTestStrategy] = useState<AutoTestStrategy>("BALANCED");
  const [autoTestLog, setAutoTestLog] = useState<string[]>([]);
  const [autoTestError, setAutoTestError] = useState<string | null>(null);
  const [autoTestReport, setAutoTestReport] = useState<AutoTestReport>(() => loadAutoTestReport());
  const [autoTestSummary, setAutoTestSummary] = useState<AutoTestSummary>(() => summarizeAutoTestReport(loadAutoTestReport()));
  const dragCompletionGuard = useRef(false);
  const pendingDragRef = useRef<{ point: number; x: number; y: number } | null>(null);
  const ignorePointClickUntilRef = useRef(0);
  const gameEpochRef = useRef(0);
  const rollLockRef = useRef(false);
  const diagnosticGameRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPassTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTestStepRef = useRef(0);
  const autoTestGameStepRef = useRef(0);
  const autoTestTargetGamesRef = useRef(1);
  const autoTestCompletedGamesRef = useRef(0);
  const autoTestWhiteWinsRef = useRef(0);
  const autoTestBlackWinsRef = useRef(0);
  const autoTestTotalStepsRef = useRef(0);
  const autoTestLongestGameStepsRef = useRef(0);
  const autoTestNoMovePassesRef = useRef(0);
  const autoTestGameNoMovePassesRef = useRef(0);
  const autoTestTotalDiceRollsRef = useRef(0);
  const autoTestGameDiceRollsRef = useRef(0);
  const autoTestPlayableRollsRef = useRef(0);
  const autoTestGamePlayableRollsRef = useRef(0);
  const autoTestUnplayableRollsRef = useRef(0);
  const autoTestGameUnplayableRollsRef = useRef(0);
  const autoTestNoEntryRollsRef = useRef(0);
  const autoTestGameNoEntryRollsRef = useRef(0);
  const autoTestDoublesRolledRef = useRef(0);
  const autoTestGameDoublesRolledRef = useRef(0);
  const autoTestPlayableDoublesRef = useRef(0);
  const autoTestGamePlayableDoublesRef = useRef(0);
  const autoTestBlockedDoublesRef = useRef(0);
  const autoTestGameBlockedDoublesRef = useRef(0);
  const autoTestCheckerMovesRef = useRef(0);
  const autoTestGameCheckerMovesRef = useRef(0);
  const autoTestHitsRef = useRef(0);
  const autoTestGameHitsRef = useRef(0);
  const autoTestBearOffsRef = useRef(0);
  const autoTestGameBearOffsRef = useRef(0);
  const autoTestCurrentStartModeRef = useRef<Mode | null>(null);
  const autoTestCurrentOpeningWinnerRef = useRef<Player | null>(null);
  const autoTestMaxDeficitRef = useRef<Record<Player, number>>({ White: 0, Black: 0 });
  const autoTestHighestPipsRef = useRef<Record<Player, number>>({ White: 0, Black: 0 });
  const autoTestLargestPipGapRef = useRef(0);
  const autoTestGameEnemyControlTriggersRef = useRef(0);
  const autoTestGameEnemyControlMovesRef = useRef(0);
  const autoTestGameWhiteGainedEnemyControlRef = useRef(0);
  const autoTestGameBlackGainedEnemyControlRef = useRef(0);
  const autoTestGameEnemyControlWhileTrailing30Ref = useRef(0);
  const autoTestGameEnemyControlCausedHitsRef = useRef(0);
  const autoTestBatchResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHasSavedGame(Boolean(readStoredValue(SAVE_KEY)));
  }, []);

  useEffect(() => {
    writeStoredValue("warPeaceBackgammonSoundEnabledV1", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    writeStoredValue("warPeaceBackgammonNarrationEnabledV1", narrationEnabled ? "on" : "off");
    if (!narrationEnabled) {
      setNarration(null);
      setTurnBanner(null);
      if (narrationTimerRef.current !== null) clearTimeout(narrationTimerRef.current);
      if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current);
    }
  }, [narrationEnabled]);

  useEffect(() => () => {
    if (narrationTimerRef.current !== null) clearTimeout(narrationTimerRef.current);
  }, []);

  useEffect(() => {
    if (PUBLIC_SHOW_TESTING_TOOLS) console.table(runEngineSelfTests().map((result) => ({ result })));
  }, []);

  useEffect(() => {
    return () => {
      if (autoTestBatchResumeTimerRef.current !== null) {
        clearTimeout(autoTestBatchResumeTimerRef.current);
        autoTestBatchResumeTimerRef.current = null;
      }
    };
  }, []);

  const legalAnalysis = useMemo(
    () => analyzeLegality(board, currentPlayer, remainingDice, mode, bar, off, storedControlState, bearOffPriorityAtTurnStart),
    [board, currentPlayer, remainingDice, mode, bar, off, storedControlState, bearOffPriorityAtTurnStart]
  );

  const legalMoves = legalAnalysis.legalMoves;
  const humanMoves = useMemo(() => selectedDieIndex === null ? legalMoves : legalMoves.filter(move => move.die === rolledDice[selectedDieIndex]),
    [legalMoves, selectedDieIndex, rolledDice]);
  const controlState = legalAnalysis.controlState;
  const controller = controlState === "ENEMY_CONTROL" ? opponent(currentPlayer) : storedController;
  const computerLandmineProfile = useMemo(() => getLandmineProfile({ board, bar, off }, "Black"), [board, bar, off]);
  const legalOriginPoints = useMemo(
    () =>
      Array.from(
        new Set(
          humanMoves
            .filter((move) => !move.isBarEntry)
            .map((move) => move.from)
        )
      ),
    [humanMoves]
  );
  const turnGuidance = useMemo(() => {
    if (winner !== null || awaitingModeChoice || remainingDice.length === 0) return null;

    if (bar[currentPlayer] > 0 && legalMoves.some((move) => move.isBarEntry)) {
      return "Bar entry required.";
    }

    if (legalMoves.length === 1) {
      return "Only legal move available.";
    }

    return null;
  }, [awaitingModeChoice, bar, currentPlayer, legalMoves, remainingDice, winner]);
  const previewSequences = previewMoveKey
    ? legalAnalysis.legalSequences.filter((sequence) => {
        const first = sequence.moves[0];
        return first && moveKey(first) === previewMoveKey;
      })
    : [];

  const displayDice = awaitingModeChoice ? openingDice ?? [] : rolledDice;
  const cleanWhitePlayerName = normalizePlayerName(whitePlayerName);
  const cleanBlackPlayerName = normalizePlayerName(blackPlayerName);
  const playersReady =
    cleanWhitePlayerName.length > 0 &&
    cleanBlackPlayerName.length > 0 &&
    playerRecordKey(cleanWhitePlayerName) !== playerRecordKey(cleanBlackPlayerName);
  const canEditPlayers = gamePhase === "OPENING_ROLL" && openingDice === null && moveLog.length === 0 && !winner;
  const canChooseDoctrine = gamePhase === "MODE_CHOICE" && awaitingModeChoice && openingDice !== null && openingWinner !== null;
  const canRollOpening = !diceRolling && gamePhase === "OPENING_ROLL" && playersReady;
  const openingRollAlreadyUsed = gamePhase !== "OPENING_ROLL" || openingDice !== null;
  const openingChoicePrompt = canChooseDoctrine && openingWinner
    ? `${openingWinner} won the opening roll. ${openingWinner}, select WAR or PEACE.`
    : null;
  const turnIsPlayable = gamePhase === "OPENING_TURN" || gamePhase === "NORMAL_TURN";
  const canSubmitTurn =
    !winner &&
    !diceRolling &&
    turnIsPlayable &&
    !awaitingModeChoice &&
    turnMoveCount > 0 &&
    (remainingDice.length === 0 || legalMoves.length === 0);
  const canResign = !winner && !diceRolling && gamePhase !== "OPENING_ROLL" && gamePhase !== "GAME_OVER";
  const autoTestStatus = autoTestError
    ? "Stopped - error found"
    : autoTestRunning
    ? "Running"
    : "Paused";
  const whitePipCount = calculatePipCount(board, "White", bar);
  const blackPipCount = calculatePipCount(board, "Black", bar);
  const knownPlayers = useMemo(
    () => Object.values(recordBook.players).sort((a, b) => a.name.localeCompare(b.name)),
    [recordBook]
  );
  const leaderboard = useMemo(
    () =>
      Object.values(recordBook.players).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.games !== a.games) return b.games - a.games;
        return a.name.localeCompare(b.name);
      }),
    [recordBook]
  );
  const whiteRecord = recordBook.players[playerRecordKey(cleanWhitePlayerName)];
  const blackRecord = recordBook.players[playerRecordKey(cleanBlackPlayerName)];
  const isComputerGame = playSetupMode === "COMPUTER_BALANCED" || playSetupMode === "COMPUTER_AGGRESSIVE";
  const isComputerController = isComputerGame && controller === "Black" && winner === null;
  const setupComplete = playSetupMode !== "MENU";
  const vengeanceActive = controlState === "ENEMY_CONTROL" && turnIsPlayable && winner === null;
  const musicMode: MusicMode = vengeanceActive ? "VENGEANCE" : mode;
  const tableFit = useTableFit(setupComplete && betaUnlocked, canEditPlayers);

  useEffect(() => {
    writeStoredValue("warPeaceBackgammonMusicEnabledV1", musicEnabled ? "on" : "off");
    writeStoredValue("warPeaceBackgammonMusicVolumeV1", String(musicVolume));
    musicRef.current?.setVolume(musicVolume);
    musicRef.current?.setMode(musicMode);
    if (!musicEnabled || !setupComplete || winner || autoTestRunning) musicRef.current?.stop();
  }, [musicEnabled, musicVolume, musicMode, setupComplete, winner, autoTestRunning]);

  useEffect(() => {
    const stop = () => musicRef.current?.stop();
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("pagehide", stop); };
  }, []);

  useEffect(() => {
    if (!setupComplete || !vengeanceActive || awaitingModeChoice || diceRolling) {
      controlAnnouncementRef.current = "";
      return;
    }
    const key = `${gameRolls}:${currentPlayer}:${gamePhase}`;
    const detail = `${controller} (opponent) makes ALL moves with ${currentPlayer}’s checkers and all playable dice. At least one capture is unavoidable. Choose the minimum or additional captures where legal. No extra roll.`;
    if (controlAnnouncementRef.current === key) {
      if (narrationEnabled) narrate({kind:"vengeance", title:"VENGEANCE — ALL MOVES", detail, player:controller});
      return;
    }
    controlAnnouncementRef.current = key;
    narrate({kind:"vengeance", title:"VENGEANCE — ALL MOVES", detail, player:controller});
    if (soundEnabled && !autoTestRunning) playVengeanceSound();
    if (autoTestRunning) {
      autoTestGameEnemyControlTriggersRef.current += 1;
      if (controller === "White") autoTestGameWhiteGainedEnemyControlRef.current += 1;
      else autoTestGameBlackGainedEnemyControlRef.current += 1;
      if (calculatePipCount(board, controller, bar) - calculatePipCount(board, currentPlayer, bar) >= 30) autoTestGameEnemyControlWhileTrailing30Ref.current += 1;
    }
  }, [setupComplete, vengeanceActive, awaitingModeChoice, diceRolling, gameRolls, currentPlayer, gamePhase, controller, soundEnabled, narrationEnabled, autoTestRunning]);

  function resumeAudio(): void {
    if (soundEnabled) getAudioContext();
    if (!musicEnabled || !setupComplete || winner || autoTestRunning) return;
    musicRef.current ??= createMusicPlayer(getAudioContext);
    musicRef.current.start(musicMode, musicVolume);
  }

  function toggleMusic(): void {
    const next = !musicEnabled;
    setMusicEnabled(next);
    if (next) {
      musicRef.current ??= createMusicPlayer(getAudioContext);
      musicRef.current.start(musicMode, musicVolume);
    } else musicRef.current?.stop();
  }
  const canUndo = setupComplete && !winner && !diceRolling && !confirmResign && !isComputerController && !autoTestRunning &&
    history.length > 0 && history[history.length - 1].controller === controller;

  function invalidatePendingActions(): void {
    gameEpochRef.current += 1;
    rollLockRef.current = false;
    pendingDragRef.current = null;
    setDiceRolling(false);
    setDraggingPoint(null);
    setDragPosition(null);
    setPendingBearOffMoves([]);
    setSelectedDieIndex(null);
    setTurnBanner(null);
    setNarration(null);
    if (narrationTimerRef.current !== null) clearTimeout(narrationTimerRef.current);
    if (autoPassTimerRef.current !== null) clearTimeout(autoPassTimerRef.current);
    if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current);
    if (autoTestBatchResumeTimerRef.current !== null) {
      clearTimeout(autoTestBatchResumeTimerRef.current);
      autoTestBatchResumeTimerRef.current = null;
    }
  }


  function startTwoPlayerGame(): void {
    diagnosticGameRef.current = false;
    setAutoTestRunning(false);
    clearSavedGame();
    setPlaySetupMode("TWO_PLAYERS");
    setWhitePlayerName("White Player");
    setBlackPlayerName("Black Player");
    setComputerStrategy("BALANCED");
    resetNewGame();
    setMessage("Two-player game ready. Share this screen and roll the opening dice.");
  }

  function startComputerGame(strategy: AutoTestStrategy): void {
    diagnosticGameRef.current = false;
    setAutoTestRunning(false);
    clearSavedGame();
    const aggressive = strategy === "CONTROLLED_COMEBACK";
    setPlaySetupMode(aggressive ? "COMPUTER_AGGRESSIVE" : "COMPUTER_BALANCED");
    setComputerStrategy(strategy);
    setWhitePlayerName("Human Player");
    setBlackPlayerName(aggressive ? "Computer 2 - Aggressive" : "Computer 1 - Balanced");
    resetNewGame();
    setMessage(`${aggressive ? "Computer 2 - Aggressive" : "Computer 1 - Balanced"} selected. You are White. Roll opening dice.`);
  }

  function backToGameMenu(): void {
    if (!winner && gamePhase !== "OPENING_ROLL") saveGame(false);
    invalidatePendingActions();
    setAutoTestRunning(false);
    setConfirmResign(false);
    setPlaySetupMode("MENU");
    setMessage("Choose how you want to play.");
  }

  function chooseComputerOpeningMode(): Mode {
    if (computerStrategy === "CONTROLLED_COMEBACK") {
      return Math.random() < 0.65 ? "WAR" : "PEACE";
    }
    return Math.random() < 0.5 ? "WAR" : "PEACE";
  }

  async function animateDiceRoll(): Promise<boolean> {
    if (rollLockRef.current) return false;
    const epoch = gameEpochRef.current;
    rollLockRef.current = true;
    setDiceRolling(true);
    const delay = autoTestRunning ? AUTO_TEST_DICE_DELAY_MS[autoTestSpeed] : 650;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (epoch !== gameEpochRef.current) return false;
    rollLockRef.current = false;
    setDiceRolling(false);
    return true;
  }

  function triggerMoveAnimation(move: Move): void {
    setAnimatingMoveKey(moveKey(move));
    setTimeout(() => setAnimatingMoveKey(null), 420);
  }

  function flashBanner(text: string, duration = 2200): void {
    if (!narrationEnabled) return;
    if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current);
    setTurnBanner(text);
    bannerTimerRef.current = setTimeout(() => setTurnBanner(null), duration);
  }

  function soundClick(): void {
    if (soundEnabled) playClickSound();
  }

  function narrate(event: Omit<NarrationEvent, "id">): void {
    if (!narrationEnabled || autoTestRunning) return;
    // A quick computer capture must not replace the handoff before it can be read.
    if (narration?.kind === "vengeance" && event.kind !== "vengeance" && vengeanceActive) return;
    if (narrationTimerRef.current !== null) clearTimeout(narrationTimerRef.current);
    setTurnBanner(null);
    if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current);
    setNarration({ ...event, id: ++narrationIdRef.current });
    narrationTimerRef.current = setTimeout(() => setNarration(null), 4800);
  }

  function soundError(): void {
    if (soundEnabled) playErrorSound();
  }

  function soundWin(): void {
    if (soundEnabled) playWinFanfare();
  }

  function recordGameRoll(hasLegalMoves: boolean): void {
    setGameRolls((value) => value + 1);
    if (hasLegalMoves) setGamePlayableRolls((value) => value + 1);
    else setGameUnplayableRolls((value) => value + 1);
  }

  function flashWarning(text = "Not permitted — must make a legal move.", duration = 1800): void {
    setWarningMessage(text);
    setTimeout(() => setWarningMessage(null), duration);
  }

  function showLegalMoveHelp(sourcePoint: number | null = selectedPoint): void {
    soundError();
    flashWarning();
    setAssistSourcePoint(sourcePoint);
    setLegalHelpActive(true);
    setTimeout(() => {
      setLegalHelpActive(false);
      setAssistSourcePoint(null);
    }, 2200);
  }

  function saveGame(announce = true): void {
    if (!setupComplete || winner || autoTestRunning || diagnosticGameRef.current) return;
    const savedGame: SavedGameState = {
      version: 4,
      rolledDice: [...rolledDice],
      usedDiceIndices: [...usedDiceIndices],
      rollHistory: rollHistory.map(roll => ({ ...roll, dice: [...roll.dice] as [number, number] })),
      bearOffPriorityAtTurnStart,
      playSetupMode,
      computerStrategy,
      whitePlayerName,
      blackPlayerName,
      gameRolls,
      gamePlayableRolls,
      gameUnplayableRolls,
      savedAt: new Date().toISOString(),
      board: cloneBoard(board),
      bar: { ...bar },
      off: { ...off },
      mode,
      currentPlayer,
      controller,
      controlState,
      gamePhase,
      remainingDice: [...remainingDice],
      lastMove: lastMove ? { ...lastMove } : null,
      moveLog: moveLog.map((entry) => ({
        ...entry,
        move: { ...entry.move },
        remainingDiceAfter: [...entry.remainingDiceAfter],
      })),
      turnMoveCount,
      openingDice: openingDice ? [...openingDice] : null,
      openingWinner,
      awaitingModeChoice,
      openingTurnMoveMade,
      openingTurnRequiresMove,
      winner,
      finalResult,
      message,
    };

    try {
      if (!writeStoredValue(SAVE_KEY, JSON.stringify(savedGame))) throw new Error("Storage unavailable");
      setHasSavedGame(true);
      setSaveAvailable(true);
      if (announce) {
        setMessage("Progress saved on this device.");
        flashBanner("GAME SAVED", 1800);
      }
    } catch {
      setSaveAvailable(false);
      if (announce) setMessage("This browser cannot save progress. You can still keep playing.");
    }
  }

  useEffect(() => {
    if (setupComplete && !winner && !diceRolling && !autoTestRunning && !diagnosticGameRef.current && gamePhase !== "OPENING_ROLL") {
      saveGame(false);
    }
  }, [board, bar, off, mode, currentPlayer, controller, controlState, gamePhase, remainingDice,
    moveLog, turnMoveCount, bearOffPriorityAtTurnStart, openingDice, openingWinner, awaitingModeChoice, winner, diceRolling,
    autoTestRunning, playSetupMode, computerStrategy, whitePlayerName, blackPlayerName,
    gameRolls, gamePlayableRolls, gameUnplayableRolls, rolledDice, usedDiceIndices, rollHistory]);

  function isSavedGameState(value: unknown): value is SavedGameState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<SavedGameState>;
    const isPlayer = (player: unknown): player is Player => player === "White" || player === "Black";
    const isDie = (die: unknown): die is number => typeof die === "number" && Number.isInteger(die) && die >= 1 && die <= 6;
    if (candidate.version === 4) {
      if (!Array.isArray(candidate.rolledDice) || candidate.rolledDice.length > 4 || !candidate.rolledDice.every(isDie) ||
          !Array.isArray(candidate.usedDiceIndices) || new Set(candidate.usedDiceIndices).size !== candidate.usedDiceIndices.length ||
          !candidate.usedDiceIndices.every(index => Number.isInteger(index) && index >= 0 && index < candidate.rolledDice!.length) ||
          !Array.isArray(candidate.rollHistory) || candidate.rollHistory.length > 6 ||
          !candidate.rollHistory.every(roll => roll && Number.isInteger(roll.id) && roll.id > 0 &&
            isPlayer(roll.player) && typeof roll.opening === "boolean" && Array.isArray(roll.dice) && roll.dice.length === 2 && roll.dice.every(isDie))) return false;
      if (candidate.gamePhase === "NORMAL_TURN" || candidate.gamePhase === "OPENING_TURN") {
        const available = candidate.rolledDice.filter((_, index) => !candidate.usedDiceIndices!.includes(index)).sort();
        if (!Array.isArray(candidate.remainingDice) || available.join() !== [...candidate.remainingDice].sort().join()) return false;
      }
    }
    const validOpening = Array.isArray(candidate.openingDice) && candidate.openingDice.length === 2 &&
      candidate.openingDice.every(isDie) && candidate.openingDice[0] !== candidate.openingDice[1];
    if ((candidate.whitePlayerName !== undefined && typeof candidate.whitePlayerName !== "string") ||
        (candidate.blackPlayerName !== undefined && typeof candidate.blackPlayerName !== "string") ||
        (candidate.bearOffPriorityAtTurnStart !== undefined && typeof candidate.bearOffPriorityAtTurnStart !== "boolean") ||
        (candidate.version === 3 && typeof candidate.bearOffPriorityAtTurnStart !== "boolean") ||
        (candidate.openingDice !== null && !validOpening) ||
        (candidate.openingWinner !== null && !isPlayer(candidate.openingWinner)) ||
        (candidate.winner !== null && !isPlayer(candidate.winner)) ||
        typeof candidate.awaitingModeChoice !== "boolean" ||
        typeof candidate.openingTurnMoveMade !== "boolean" ||
        typeof candidate.openingTurnRequiresMove !== "boolean") return false;
    if (candidate.gamePhase === "MODE_CHOICE" && (!candidate.awaitingModeChoice || !validOpening || !isPlayer(candidate.openingWinner))) return false;
    if (candidate.gamePhase !== "MODE_CHOICE" && candidate.awaitingModeChoice) return false;
    if (candidate.gamePhase === "OPENING_TURN" && (!validOpening || candidate.openingWinner !== candidate.currentPlayer)) return false;
    if (candidate.gamePhase === "NORMAL_TURN" && (candidate.openingDice !== null || candidate.openingWinner !== null)) return false;
    if ((candidate.gamePhase === "GAME_OVER") !== (candidate.winner !== null)) return false;
    if (candidate.controlState === "NORMAL" && candidate.controller !== candidate.currentPlayer) return false;
    if (candidate.controlState === "ENEMY_CONTROL" && (candidate.controller === candidate.currentPlayer || candidate.mode !== "PEACE")) return false;
    if (candidate.finalResult !== null && candidate.finalResult !== undefined && (
      !isPlayer(candidate.finalResult.winner) || !isPlayer(candidate.finalResult.loser) ||
      !["BEAR_OFF", "RESIGNATION"].includes(candidate.finalResult.reason)
    )) return false;
    return (
      (candidate.version === 1 || candidate.version === 2 || candidate.version === 3 || candidate.version === 4) &&
      Array.isArray(candidate.board) &&
      candidate.board.length === 24 &&
      candidate.board.every((point) => point && Number.isInteger(point.count) && point.count >= 0 && point.count <= 15 &&
        (point.count === 0 ? point.owner === null : point.owner === "White" || point.owner === "Black")) &&
      candidate.bar !== undefined &&
      candidate.off !== undefined &&
      (["White", "Black"] as const).every((player) => {
        const barCount = candidate.bar?.[player];
        const offCount = candidate.off?.[player];
        return typeof barCount === "number" && Number.isInteger(barCount) && barCount >= 0 && typeof offCount === "number" && Number.isInteger(offCount) && offCount >= 0 &&
          candidate.board!.reduce((total, point) => total + (point.owner === player ? point.count : 0), 0) + barCount + offCount === 15;
      }) &&
      (candidate.currentPlayer === "White" || candidate.currentPlayer === "Black") &&
      (candidate.controller === "White" || candidate.controller === "Black") &&
      (candidate.mode === "WAR" || candidate.mode === "PEACE") &&
      (candidate.controlState === "NORMAL" || candidate.controlState === "ENEMY_CONTROL") &&
      ["OPENING_ROLL", "MODE_CHOICE", "OPENING_TURN", "NORMAL_TURN", "GAME_OVER"].includes(candidate.gamePhase ?? "") &&
      Array.isArray(candidate.remainingDice) && candidate.remainingDice.length <= 4 &&
      candidate.remainingDice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6) &&
      Array.isArray(candidate.moveLog) && candidate.moveLog.every((entry) => entry && entry.move && Array.isArray(entry.remainingDiceAfter)) &&
      typeof candidate.turnMoveCount === "number" && Number.isInteger(candidate.turnMoveCount) && candidate.turnMoveCount >= 0 &&
      (candidate.version === 1 || ["TWO_PLAYERS", "COMPUTER_BALANCED", "COMPUTER_AGGRESSIVE"].includes(candidate.playSetupMode ?? ""))
    );
  }

  function loadSavedGame(): void {
    const rawSave = readStoredValue(SAVE_KEY);
    if (!rawSave) {
      setHasSavedGame(false);
      setMessage("No saved game found on this computer.");
      return;
    }

    try {
      const parsed = JSON.parse(rawSave);
      if (!isSavedGameState(parsed)) {
        throw new Error("Saved game format is not valid.");
      }

      invalidatePendingActions();
      diagnosticGameRef.current = false;
      setAutoTestRunning(false);
      setAutoTestError(null);
      setPlaySetupMode(parsed.playSetupMode ?? "TWO_PLAYERS");
      setComputerStrategy(parsed.computerStrategy === "CONTROLLED_COMEBACK" ? "CONTROLLED_COMEBACK" : "BALANCED");
      setWhitePlayerName(parsed.whitePlayerName || "White Player");
      setBlackPlayerName(parsed.blackPlayerName || "Black Player");
      setGameRolls(parsed.gameRolls ?? 0);
      setGamePlayableRolls(parsed.gamePlayableRolls ?? 0);
      setGameUnplayableRolls(parsed.gameUnplayableRolls ?? 0);

      setBoard(cloneBoard(parsed.board));
      setBar({ ...parsed.bar });
      setOff({ ...parsed.off });
      setMode(parsed.mode);
      setCurrentPlayer(parsed.currentPlayer);
      setController(parsed.controller);
      setControlState(parsed.controlState);
      setGamePhase(parsed.gamePhase);
      setRemainingDice([...parsed.remainingDice]);
      const display = savedDiceDisplay(parsed);
      setRolledDice(display.dice);
      setUsedDiceIndices(display.used);
      setSelectedDieIndex(null);
      setRollHistory(parsed.rollHistory ?? (display.dice.length > 0 ? [{ id: 1, player: parsed.currentPlayer,
        dice: display.dice.slice(0, 2) as [number, number], opening: parsed.openingDice !== null }].filter(roll => roll.dice.length === 2) : []));
      setSelectedPoint(null);
      setDraggingPoint(null);
      setHoverPoint(null);
      setDragPosition(null);
      setPreviewMoveKey(null);
      setLastMove(parsed.lastMove ? { ...parsed.lastMove } : null);
      setShowAnalysis(false);
      setMoveLog(parsed.moveLog.map((entry) => ({
        ...entry,
        move: { ...entry.move },
        remainingDiceAfter: [...entry.remainingDiceAfter],
      })));
      setTurnMoveCount(parsed.turnMoveCount);
      setBearOffPriorityAtTurnStart(savedTurnStartedAllHome(parsed));
      setTurnBanner(null);
      setDiceRolling(false);
      setAnimatingMoveKey(null);
      setMessage(parsed.message || "Saved game loaded.");
      setHistory([]);
      setOpeningDice(parsed.openingDice ? [...parsed.openingDice] : null);
      setOpeningWinner(parsed.openingWinner);
      setAwaitingModeChoice(parsed.awaitingModeChoice);
      setOpeningTurnMoveMade(parsed.openingTurnMoveMade);
      setOpeningTurnRequiresMove(parsed.openingTurnRequiresMove);
      setWinner(parsed.winner);
      setFinalResult(parsed.finalResult ?? null);
      setConfirmResign(false);
      setWarningMessage(null);
      setLegalHelpActive(false);
      setAssistSourcePoint(null);
      setHasSavedGame(true);
      flashBanner("GAME LOADED", 1800);
    } catch {
      removeStoredValue(SAVE_KEY);
      setHasSavedGame(false);
      setMessage("Saved game was damaged and has been cleared.");
      flashWarning("Saved game could not be loaded.");
    }
  }

  function clearSavedGame(): void {
    removeStoredValue(SAVE_KEY);
    setHasSavedGame(false);
    setConfirmResign(false);
    setMessage("Saved game cleared from this computer.");
  }

  function handleBetaUnlock(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (betaPasswordInput.trim() === BETA_PASSWORD) {
      writeStoredValue(BETA_ACCESS_KEY, "granted");
      setBetaUnlocked(true);
      setBetaError(null);
      setBetaPasswordInput("");
      soundClick();
      return;
    }

    setBetaError("Incorrect beta password. Please try again.");
    soundError();
  }

  function clearBetaAccess(): void {
    removeStoredValue(BETA_ACCESS_KEY);
    setBetaUnlocked(false);
    setBetaPasswordInput("");
    setBetaError(null);
  }

  function recordCompletedGame(result: FinalResult): void {
    const whiteName = cleanWhitePlayerName || "White Player";
    const blackName = cleanBlackPlayerName || "Black Player";
    const winnerName = result.winner === "White" ? whiteName : blackName;
    const loserName = result.loser === "White" ? whiteName : blackName;

    if (playerRecordKey(winnerName) === playerRecordKey(loserName)) return;

    setRecordBook((currentBook) => {
      const nextBook = cloneRecordBook(currentBook);
      const winnerStats = ensurePlayerStats(nextBook, winnerName);
      const loserStats = ensurePlayerStats(nextBook, loserName);
      const winnerHeadToHead = ensureHeadToHead(winnerStats, loserName);
      const loserHeadToHead = ensureHeadToHead(loserStats, winnerName);
      const gameRecord: PlayerGameRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        playedAt: new Date().toISOString(),
        whitePlayer: whiteName,
        blackPlayer: blackName,
        winnerPlayer: winnerName,
        loserPlayer: loserName,
        winnerColor: result.winner,
        loserColor: result.loser,
        mode: result.modeAtFinish,
        reason: result.reason,
        loserPips: result.loserPips,
        winnerOff: result.winnerOff,
        loserOff: result.loserOff,
        movesPlayed: result.movesPlayed,
      };

      winnerStats.games += 1;
      winnerStats.wins += 1;
      winnerStats.totalLoserPipsWhenWon += result.loserPips;
      loserStats.games += 1;
      loserStats.losses += 1;
      loserStats.totalOwnPipsWhenLost += result.loserPips;

      if (result.reason === "RESIGNATION") {
        winnerStats.resignationWins += 1;
        loserStats.resignationLosses += 1;
      } else {
        winnerStats.bearOffWins += 1;
        loserStats.bearOffLosses += 1;
      }

      if (result.modeAtFinish === "WAR") {
        winnerStats.war.wins += 1;
        loserStats.war.losses += 1;
      } else {
        winnerStats.peace.wins += 1;
        loserStats.peace.losses += 1;
      }

      winnerHeadToHead.games += 1;
      winnerHeadToHead.wins += 1;
      winnerHeadToHead.totalLoserPipsWhenWon += result.loserPips;
      loserHeadToHead.games += 1;
      loserHeadToHead.losses += 1;
      loserHeadToHead.totalOwnPipsWhenLost += result.loserPips;

      nextBook.games = [gameRecord, ...nextBook.games].slice(0, 200);
      savePlayerRecordBook(nextBook);
      return nextBook;
    });
  }

  function checkForWinner(nextOff: OffState): Player | null {
    if (nextOff.White >= 15) return "White";
    if (nextOff.Black >= 15) return "Black";
    return null;
  }

  function buildFinalResult(
    player: Player,
    reason: WinReason,
    finalBoard: Point[] = board,
    finalBar: BarState = bar,
    finalOff: OffState = off
  ): FinalResult {
    const loser = opponent(player);

    return {
      winner: player,
      loser,
      reason,
      winnerOff: finalOff[player],
      loserOff: finalOff[loser],
      winnerPips: calculatePipCount(finalBoard, player, finalBar),
      loserPips: calculatePipCount(finalBoard, loser, finalBar),
      movesPlayed: moveLog.length + (reason === "BEAR_OFF" ? 1 : 0),
      modeAtFinish: mode,
    };
  }

  function endGame(
    player: Player,
    reason: WinReason = "BEAR_OFF",
    finalBoard: Point[] = board,
    finalBar: BarState = bar,
    finalOff: OffState = off
  ): void {
    invalidatePendingActions();
    const result = buildFinalResult(player, reason, finalBoard, finalBar, finalOff);

    setWinner(player);
    setFinalResult(result);
    if (!autoTestRunning && !diagnosticGameRef.current) {
      recordCompletedGame(result);
      clearSavedGame();
    }
    setMessage(formatFinalResult(result));
    soundWin();
    flashBanner(`${player.toUpperCase()} WINS`, 3000);
    setRemainingDice([]);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
    setConfirmResign(false);
    setWarningMessage(null);
    setLegalHelpActive(false);
    setAssistSourcePoint(null);
    setGamePhase("GAME_OVER");
  }

  function resignGame(): void {
    if (winner !== null) {
      setMessage(`${winner} has already won. Game over.`);
      return;
    }

    if (!canResign) {
      setMessage("No active game to resign.");
      setConfirmResign(false);
      return;
    }

    if (!confirmResign) {
      setConfirmResign(true);
      setMessage(`${isComputerGame ? "White" : currentPlayer}, confirm resignation to forfeit this game.`);
      return;
    }

    endGame(opponent(isComputerGame ? "White" : currentPlayer), "RESIGNATION", board, bar, off);
  }

  function resetNewGame(): void {
    invalidatePendingActions();
    setBoard(createStartingBoard());
    setGameRolls(0);
    setGamePlayableRolls(0);
    setGameUnplayableRolls(0);
    setBar({ White: 0, Black: 0 });
    setOff({ White: 0, Black: 0 });
    setMode("WAR");
    setCurrentPlayer("White");
    setController("White");
    setControlState("NORMAL");
    setGamePhase("OPENING_ROLL");
    setRemainingDice([]);
    setRolledDice([]);
    setUsedDiceIndices([]);
    setSelectedDieIndex(null);
    setRollHistory([]);
    setSelectedPoint(null);
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setShowAnalysis(false);
    setMoveLog([]);
    setTurnMoveCount(0);
    setBearOffPriorityAtTurnStart(false);
    setTurnBanner(null);
    setDiceRolling(false);
    setAnimatingMoveKey(null);
    setMessage("Roll opening dice.");
    setHistory([]);
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
    setOpeningTurnMoveMade(false);
    setOpeningTurnRequiresMove(false);
    setWinner(null);
    setFinalResult(null);
    setConfirmResign(false);
    setWarningMessage(null);
    setLegalHelpActive(false);
    setAssistSourcePoint(null);
    setGameRolls(0);
    setGamePlayableRolls(0);
    setGameUnplayableRolls(0);
    setAutoTestError(null);
  }

  async function rollOpening(): Promise<void> {
    if (!setupComplete) {
      setMessage("Choose Play Computer 1, Play Computer 2, or Two Players first.");
      flashWarning("Choose a game type first.");
      return;
    }

    if (!playersReady) {
      setMessage("Enter two different player names before rolling opening dice.");
      flashWarning("Enter two different player names.");
      return;
    }

    if (!canRollOpening) {
      if (gamePhase === "MODE_CHOICE") {
        setMessage("Choose WAR or PEACE before rolling again.");
      } else {
        setMessage("Opening dice have already been rolled for this game.");
      }
      return;
    }

    setMessage("Rolling opening dice...");
    if (!(await animateDiceRoll())) return;
    if (soundEnabled) playDiceSound();

    let whiteDie = rollDie();
    let blackDie = rollDie();
    while (whiteDie === blackDie) {
      whiteDie = rollDie();
      blackDie = rollDie();
    }

    const winner: Player = whiteDie > blackDie ? "White" : "Black";

    setBoard(createStartingBoard());
    setBar({ White: 0, Black: 0 });
    setOff({ White: 0, Black: 0 });
    setCurrentPlayer(winner);
    setController(winner);
    setControlState("NORMAL");
    setRemainingDice([]);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setHistory([]);
    setMoveLog([]);
    setTurnMoveCount(0);
    setBearOffPriorityAtTurnStart(false);
    setOpeningDice([whiteDie, blackDie]);
    setRolledDice([whiteDie, blackDie]);
    setUsedDiceIndices([]);
    setSelectedDieIndex(null);
    setRollHistory([{ id: 1, player: winner, dice: [whiteDie, blackDie], opening: true }]);
    setOpeningWinner(winner);
    setAwaitingModeChoice(true);
    setGamePhase("MODE_CHOICE");
    setOpeningTurnMoveMade(false);
    setOpeningTurnRequiresMove(false);
    setWinner(null);
    setFinalResult(null);
    setConfirmResign(false);
    soundWin();
    flashBanner(`${winner.toUpperCase()} WINS OPENING ROLL`, 3500);
    setMessage(`Opening roll - White: ${whiteDie}, Black: ${blackDie}. ${winner} chooses WAR or PEACE.`);
  }

  function loadBearOffTest(): void {
    const testBoard = emptyBoard();
    testBoard[21] = { owner: "White", count: 1 };
    testBoard[22] = { owner: "White", count: 2 };
    testBoard[23] = { owner: "White", count: 12 };

    setBoard(testBoard);
    setBar({ White: 0, Black: 0 });
    setOff({ White: 0, Black: 0 });
    setMode("WAR");
    setCurrentPlayer("White");
    setController("White");
    setControlState("NORMAL");
    setRemainingDice([2, 6]);
    setRolledDice([2, 6]); setUsedDiceIndices([]); setSelectedDieIndex(null); setRollHistory([]);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setHistory([]);
    setMoveLog([]);
    setTurnMoveCount(0);
    setBearOffPriorityAtTurnStart(true);
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
    setOpeningTurnMoveMade(true);
    setOpeningTurnRequiresMove(false);
    setGamePhase("NORMAL_TURN");
    setWinner(null);
    setFinalResult(null);
    setConfirmResign(false);
    setMessage("BEAR-OFF TEST: White began this turn with all checkers home; maximize bearing off.");
  }

  function loadPeaceControlTest(): void {
    const testBoard = emptyBoard();
    testBoard[0] = { owner: "White", count: 1 };
    testBoard[4] = { owner: "White", count: 1 };
    testBoard[5] = { owner: "Black", count: 1 };
    testBoard[8] = { owner: "Black", count: 2 };

    setBoard(testBoard);
    setBar({ White: 0, Black: 0 });
    setOff({ White: 0, Black: 0 });
    setMode("PEACE");
    setCurrentPlayer("White");
    setController("White");
    setControlState("NORMAL");
    setRemainingDice([1, 4]);
    setRolledDice([1, 4]); setUsedDiceIndices([]); setSelectedDieIndex(null); setRollHistory([]);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setHistory([]);
    setMoveLog([]);
    setTurnMoveCount(0);
    setBearOffPriorityAtTurnStart(false);
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
    setOpeningTurnMoveMade(true);
    setOpeningTurnRequiresMove(false);
    setGamePhase("NORMAL_TURN");
    setWinner(null);
    setFinalResult(null);
    setConfirmResign(false);
    setMessage("PEACE TEST: Use both dice. One capture is unavoidable; Enemy Control then applies.");
  }

  function chooseMode(chosenMode: Mode, automated = false): void {
    if (isComputerController && !automated) { setMessage("Computer is thinking."); return; }

    if (!awaitingModeChoice || !openingDice || !openingWinner) {
      setMessage("Roll opening dice first, then choose WAR or PEACE.");
      return;
    }

    const openingAllHome = allHome(board, openingWinner, bar);
    const openingTurnAnalysis = analyzeLegality(board, openingWinner, openingDice, chosenMode, bar, off, "NORMAL", openingAllHome);
    recordGameRoll(openingTurnAnalysis.legalMoves.length > 0);
    recordAutoTestRoll(openingWinner, openingDice, openingTurnAnalysis.legalMoves.length > 0, bar);

    setMode(chosenMode);
    setCurrentPlayer(openingWinner);
    setController(openingWinner);
    setControlState("NORMAL");
    setRemainingDice(openingDice);
    setRolledDice([...openingDice]); setUsedDiceIndices([]); setSelectedDieIndex(null);
    setBearOffPriorityAtTurnStart(openingAllHome);
    setAwaitingModeChoice(false);
    setGamePhase("OPENING_TURN");
    setOpeningTurnMoveMade(false);
    setOpeningTurnRequiresMove(true);
    setHistory([]);
    setMoveLog([]);
    setTurnMoveCount(0);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    flashBanner(chosenMode);
    setMessage(`${openingWinner} chose ${chosenMode}. Opening turn uses the opening dice ${openingDice.join(", ")}. Select a ${openingWinner} checker, then select a legal destination.`);
  }

  async function nextTurn(): Promise<void> {
    if (!setupComplete || winner !== null || confirmResign) return;
    if (!(await animateDiceRoll())) return;
    if (soundEnabled) playDiceSound();

    const nextPlayer = opponent(currentPlayer);
    const nextTurnAllHome = allHome(board, nextPlayer, bar);
    const d1 = rollDie();
    const d2 = rollDie();

    const rolledDoubles = d1 === d2;
    const dice = rolledDoubles ? [d1, d1, d1, d1] : [d1, d2];
    let nextMode = mode;

    if (rolledDoubles) {
      const switchedMode: Mode = mode === "WAR" ? "PEACE" : "WAR";
      const switchedModeAnalysis = analyzeLegality(board, nextPlayer, dice, switchedMode, bar, off, "NORMAL", nextTurnAllHome);

      if (switchedModeAnalysis.legalMoves.length > 0) {
        nextMode = switchedMode;
        setMode(nextMode);
        flashBanner(`DOUBLES - ${nextMode}`, 3000);
      } else {
        // Blocked doubles do not change doctrine/theme. The dice still display,
        // then the automatic no-move pass effect will advance the game.
        nextMode = mode;
        flashBanner("BLOCKED DOUBLES - THEME HOLDS", 1800);
      }
    }

    const nextLegalAnalysis = analyzeLegality(board, nextPlayer, dice, nextMode, bar, off, "NORMAL", nextTurnAllHome);
    const noLegalMoves = nextLegalAnalysis.legalMoves.length === 0;
    recordGameRoll(!noLegalMoves);
    recordAutoTestRoll(nextPlayer, dice, !noLegalMoves, bar);

    setCurrentPlayer(nextPlayer);
    setGamePhase("NORMAL_TURN");
    setController(nextPlayer);
    setControlState("NORMAL");
    setRemainingDice(dice);
    setRolledDice([...dice]);
    setUsedDiceIndices([]);
    setSelectedDieIndex(null);
    setRollHistory(previous => [...previous, { id: (previous.at(-1)?.id ?? 0) + 1,
      player: nextPlayer, dice: [d1, d2] as [number, number], opening: false }].slice(-6));
    setBearOffPriorityAtTurnStart(nextTurnAllHome);
    setOpeningDice(null);
    setOpeningWinner(null);
    setOpeningTurnMoveMade(false);
    setOpeningTurnRequiresMove(false);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setHistory([]);
    setTurnMoveCount(0);
    setMessage(
      noLegalMoves
        ? rolledDoubles
          ? `${nextPlayer} rolled doubles ${d1}-${d2}, but has no legal move. Theme stays ${nextMode}; turn passes.`
          : `${nextPlayer} rolled ${dice.join(", ")}. No legal moves — turn passes.`
        : `${nextPlayer}'s turn. Rolled ${dice.join(", ")}.`
    );
  }

  function undoMove(): void {
    if (!canUndo || rollLockRef.current) return;

    setPendingBearOffMoves([]);
    setNarration(null);
    if (narrationTimerRef.current !== null) clearTimeout(narrationTimerRef.current);

    const previous = history[history.length - 1];
    setBoard(previous.board);
    setRemainingDice(previous.dice);
    setUsedDiceIndices(previous.usedDiceIndices);
    setSelectedDieIndex(null);
    setBar(previous.bar);
    setOff(previous.off);
    setController(previous.controller);
    setControlState(previous.controlState);
    setMoveLog(previous.moveLog);
    setTurnMoveCount(previous.turnMoveCount);
    setBearOffPriorityAtTurnStart(previous.bearOffPriorityAtTurnStart);
    setOpeningTurnMoveMade(!(openingDice !== null && previous.moveLog.length === 0));
    setOpeningTurnRequiresMove(openingDice !== null && previous.moveLog.length === 0);
    setLastMove(previous.lastMove);
    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setMessage("Move undone.");
  }

  function submitTurn(): void {
    if (confirmResign) return;
    if (gamePhase === "OPENING_ROLL") {
      setMessage("Roll opening dice first.");
      return;
    }

    if (gamePhase === "MODE_CHOICE" || awaitingModeChoice) {
      setMessage("Choose WAR or PEACE before ending a turn.");
      return;
    }

    if (gamePhase === "OPENING_TURN" && turnMoveCount === 0 && legalMoves.length > 0) {
      setMessage("Make the first opening move before ending the turn.");
      return;
    }

    if (!turnIsPlayable) {
      setMessage("End Turn is not available yet.");
      return;
    }

    if (!canSubmitTurn) {
      if (turnMoveCount === 0 && legalMoves.length > 0) {
        setMessage("Make at least one legal move before ending the turn.");
      } else if (remainingDice.length > 0 && legalMoves.length > 0) {
        setMessage("Use remaining legal moves or undo before submitting.");
      } else {
        setMessage("End Turn is not available yet.");
      }
      return;
    }

    const completedWinner = winner ?? checkForWinner(off);
    if (completedWinner) {
      if (winner === null) endGame(completedWinner, "BEAR_OFF", board, bar, off);
      setMessage(finalResult ? formatFinalResult(finalResult) : `${completedWinner} has already won. Game over.`);
      return;
    }

    void nextTurn();
  }

  function executeMove(move: Move): void {
    if (winner !== null || confirmResign || rollLockRef.current || !setupComplete || !legalMoves.some((legal) => moveKey(legal) === moveKey(move))) return;
    setHistory((currentHistory) => [
      ...currentHistory,
      {
        board: cloneBoard(board),
        dice: [...remainingDice],
        usedDiceIndices: [...usedDiceIndices],
        bar: { ...bar },
        off: { ...off },
        controller,
        controlState,
        moveLog: [...moveLog],
        lastMove,
        turnMoveCount,
        bearOffPriorityAtTurnStart,
      },
    ]);

    const enemyControlMoveBeforeThisMove = autoTestRunning && controlState === "ENEMY_CONTROL";

    if (autoTestRunning) {
      autoTestCheckerMovesRef.current += 1;
      autoTestGameCheckerMovesRef.current += 1;
      if (move.isHit) {
        autoTestHitsRef.current += 1;
        autoTestGameHitsRef.current += 1;
      }
      if (move.isBearOff) {
        autoTestBearOffsRef.current += 1;
        autoTestGameBearOffsRef.current += 1;
      }
    }

    if (autoTestRunning && enemyControlMoveBeforeThisMove) {
      autoTestGameEnemyControlMovesRef.current += 1;
      if (move.isHit) autoTestGameEnemyControlCausedHitsRef.current += 1;
    }

    const result = applyMove(board, move, currentPlayer, bar, off);
    const nextDice = removeDie(remainingDice, move.die);
    const usedIndex = selectedDieIndex !== null && !usedDiceIndices.includes(selectedDieIndex) && rolledDice[selectedDieIndex] === move.die
      ? selectedDieIndex : rolledDice.findIndex((value, index) => value === move.die && !usedDiceIndices.includes(index));
    if (usedIndex >= 0) setUsedDiceIndices(previous => [...previous, usedIndex]);
    setSelectedDieIndex(null);
    const nextControlState = controlState;
    const nextController = controller;

    const nextLegalAnalysis = analyzeLegality(
      result.board,
      currentPlayer,
      nextDice,
      mode,
      result.bar,
      result.off,
      nextControlState,
      bearOffPriorityAtTurnStart
    );

    setLastMove(move);
    setMoveLog((log) => [
      ...log,
      {
        id: log.length + 1,
        player: currentPlayer,
        mode,
        controlState: nextControlState,
        controller: nextController,
        move,
        remainingDiceAfter: nextDice,
      },
    ]);
    setTurnMoveCount((count) => count + 1);
    setBoard(result.board);
    setBar(result.bar);
    setOff(result.off);
    setRemainingDice(nextDice);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setWarningMessage(null);
    setLegalHelpActive(false);
    setAssistSourcePoint(null);
    setOpeningTurnMoveMade(true);
    setOpeningTurnRequiresMove(false);
    setController(nextController);
    setControlState(nextControlState);
    if (soundEnabled) {
      if (move.isHit && mode === "PEACE") playPeaceViolationSound();
      else if (move.isHit) playCaptureSound();
      else playClickSound();
    }
    triggerMoveAnimation(move);

    if (move.isHit) {
      const controlDetail = controlState === "ENEMY_CONTROL"
        ? `${controller} (opponent) chose this move with ${currentPlayer}’s checker. ALL moves in this turn belong to ${controller}.`
        : `${opponent(currentPlayer)} must re-enter from the bar.`;
      narrate({kind: mode === "WAR" ? "war-capture" : "peace-capture",
        title: mode === "WAR" ? "Prisoner of War" : "Prisoner of Peace",
        detail: `${currentPlayer} captures on point ${move.to + 1}. ${controlDetail}`, player: opponent(currentPlayer)});
    } else if (move.isBearOff) {
      narrate({ kind: "bear-off", title: "Checker borne off", detail: `${currentPlayer} has borne off ${result.off[currentPlayer]} of 15 checkers.`, player: currentPlayer });
    } else if (mode === "PEACE" && controlState === "NORMAL" && narrationEnabled && !autoTestRunning) {
      const profile = getLandmineProfile(result, currentPlayer);
      if (profile.exposureAllowed) {
        const newBlots = result.board.flatMap((point, index) => point.owner === currentPlayer && point.count === 1 &&
          (board[index].owner !== currentPlayer || board[index].count !== 1) ? [index] : []);
        const reachable = getRawMoves(result.board, opponent(currentPlayer), [1, 2, 3, 4, 5, 6], result.bar, result.off)
          .some((candidate) => candidate.isHit && newBlots.includes(candidate.to));
        if (reachable) narrate({
          kind: "landmine", title: "A possible PEACE landmine",
          detail: `${currentPlayer} is ${profile.deficit} pips behind. An unavoidable PEACE capture gives them all enemy moves from the start of that roll. ${profile.openEntryPoints} re-entry points are open.`,
          player: currentPlayer,
        });
      }
    }

    const completedWinner = checkForWinner(result.off);
    if (completedWinner) {
      endGame(completedWinner, "BEAR_OFF", result.board, result.bar, result.off);
      return;
    }

    if (nextDice.length > 0 && nextLegalAnalysis.legalMoves.length === 0) {
      setMessage("No further legal moves. Submit turn.");
      return;
    }

    if (nextControlState === "ENEMY_CONTROL") {
      setMessage(`VENGEANCE: ${nextController} (opponent) makes ALL moves with ${currentPlayer}’s checkers. Choose more or fewer captures; use every playable die.`);
      return;
    }

    setMessage(
      move.isBearOff
        ? "Checker borne off."
        : move.isHit
        ? "Hit staged."
        : move.isBarEntry
        ? "Bar entry staged."
        : "Move staged."
    );
  }

  function appendAutoTestLog(line: string): void {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setAutoTestLog((log) => [`${time} - ${line}`, ...log].slice(0, 120));
  }

  function publishAutoTestReport(report: AutoTestReport): void {
    const updatedReport = { ...report, updatedAt: new Date().toISOString() };
    saveAutoTestReport(updatedReport);
    setAutoTestReport(updatedReport);
    setAutoTestSummary(summarizeAutoTestReport(updatedReport));
  }

  function updateAutoTestSummary(): void {
    setAutoTestSummary(summarizeAutoTestReport(autoTestReport));
  }

  function setAutoTestStopReason(stopReason: string): void {
    publishAutoTestReport({ ...autoTestReport, stopReason });
  }

  function updateAutoTestPipDeficits(): void {
    const whitePips = calculatePipCount(board, "White", bar);
    const blackPips = calculatePipCount(board, "Black", bar);
    autoTestMaxDeficitRef.current = {
      White: Math.max(autoTestMaxDeficitRef.current.White, Math.max(0, whitePips - blackPips)),
      Black: Math.max(autoTestMaxDeficitRef.current.Black, Math.max(0, blackPips - whitePips)),
    };
    autoTestHighestPipsRef.current = {
      White: Math.max(autoTestHighestPipsRef.current.White, whitePips),
      Black: Math.max(autoTestHighestPipsRef.current.Black, blackPips),
    };
    autoTestLargestPipGapRef.current = Math.max(autoTestLargestPipGapRef.current, Math.abs(whitePips - blackPips));
  }

  function recordAutoTestRoll(player: Player, dice: number[], hasLegalMoves: boolean, barState: BarState): void {
    if (!autoTestRunning) return;

    const isDoubles = dice.length >= 2 && dice.every((die) => die === dice[0]);

    autoTestTotalDiceRollsRef.current += 1;
    autoTestGameDiceRollsRef.current += 1;

    if (hasLegalMoves) {
      autoTestPlayableRollsRef.current += 1;
      autoTestGamePlayableRollsRef.current += 1;
    } else {
      autoTestUnplayableRollsRef.current += 1;
      autoTestGameUnplayableRollsRef.current += 1;
      autoTestNoMovePassesRef.current += 1;
      autoTestGameNoMovePassesRef.current += 1;

      if (barState[player] > 0) {
        autoTestNoEntryRollsRef.current += 1;
        autoTestGameNoEntryRollsRef.current += 1;
      }
    }

    if (isDoubles) {
      autoTestDoublesRolledRef.current += 1;
      autoTestGameDoublesRolledRef.current += 1;

      if (hasLegalMoves) {
        autoTestPlayableDoublesRef.current += 1;
        autoTestGamePlayableDoublesRef.current += 1;
      } else {
        autoTestBlockedDoublesRef.current += 1;
        autoTestGameBlockedDoublesRef.current += 1;
      }
    }

    setAutoTestSummary((current) => ({
      ...current,
      totalDiceRolls: autoTestTotalDiceRollsRef.current,
      playableRolls: autoTestPlayableRollsRef.current,
      unplayableRolls: autoTestUnplayableRollsRef.current,
      noEntryRolls: autoTestNoEntryRollsRef.current,
      doublesRolled: autoTestDoublesRolledRef.current,
      playableDoubles: autoTestPlayableDoublesRef.current,
      blockedDoubles: autoTestBlockedDoublesRef.current,
      noMovePasses: autoTestNoMovePassesRef.current,
    }));
  }

  function resetAutoTestCurrentGameTrackers(): void {
    autoTestGameStepRef.current = 0;
    autoTestGameNoMovePassesRef.current = 0;
    autoTestGameDiceRollsRef.current = 0;
    autoTestGamePlayableRollsRef.current = 0;
    autoTestGameUnplayableRollsRef.current = 0;
    autoTestGameNoEntryRollsRef.current = 0;
    autoTestGameDoublesRolledRef.current = 0;
    autoTestGamePlayableDoublesRef.current = 0;
    autoTestGameBlockedDoublesRef.current = 0;
    autoTestGameCheckerMovesRef.current = 0;
    autoTestGameHitsRef.current = 0;
    autoTestGameBearOffsRef.current = 0;
    autoTestCurrentStartModeRef.current = null;
    autoTestCurrentOpeningWinnerRef.current = null;
    autoTestMaxDeficitRef.current = { White: 0, Black: 0 };
    autoTestHighestPipsRef.current = { White: 167, Black: 167 };
    autoTestLargestPipGapRef.current = 0;
    autoTestGameEnemyControlTriggersRef.current = 0;
    autoTestGameEnemyControlMovesRef.current = 0;
    autoTestGameWhiteGainedEnemyControlRef.current = 0;
    autoTestGameBlackGainedEnemyControlRef.current = 0;
    autoTestGameEnemyControlWhileTrailing30Ref.current = 0;
    autoTestGameEnemyControlCausedHitsRef.current = 0;
  }

  function resetAutoTestCounters(targetGames: number): void {
    autoTestStepRef.current = 0;
    resetAutoTestCurrentGameTrackers();
    autoTestTargetGamesRef.current = targetGames;
    autoTestCompletedGamesRef.current = 0;
    autoTestWhiteWinsRef.current = 0;
    autoTestBlackWinsRef.current = 0;
    autoTestTotalStepsRef.current = 0;
    autoTestLongestGameStepsRef.current = 0;
    autoTestNoMovePassesRef.current = 0;
    autoTestTotalDiceRollsRef.current = 0;
    autoTestPlayableRollsRef.current = 0;
    autoTestUnplayableRollsRef.current = 0;
    autoTestNoEntryRollsRef.current = 0;
    autoTestDoublesRolledRef.current = 0;
    autoTestPlayableDoublesRef.current = 0;
    autoTestBlockedDoublesRef.current = 0;
    autoTestCheckerMovesRef.current = 0;
    autoTestHitsRef.current = 0;
    autoTestBearOffsRef.current = 0;
    const freshReport: AutoTestReport = {
      ...createEmptyAutoTestReport(targetGames, "Running."),
      speedLabel: AUTO_TEST_SPEED_LABELS[autoTestSpeed],
      strategyLabel: AUTO_TEST_STRATEGY_LABELS[autoTestStrategy],
    };
    publishAutoTestReport(freshReport);
    setAutoTestSummary(createAutoTestSummary(targetGames));
  }

  async function copyAutoTestReport(): Promise<void> {
    const reportText = formatAutoTestReportText(autoTestReport);
    try {
      await navigator.clipboard.writeText(reportText);
      appendAutoTestLog("Auto Test report copied to clipboard.");
      setMessage("Auto Test report copied. Paste it into an email, text, or ChatGPT.");
    } catch {
      appendAutoTestLog("Could not copy automatically. Browser clipboard permission was denied.");
      setMessage("Copy failed. Browser clipboard permission was denied.");
    }
  }

  function clearAutoTestReport(): void {
    const freshReport = createEmptyAutoTestReport(1, "Cleared.");
    saveAutoTestReport(freshReport);
    setAutoTestReport(freshReport);
    setAutoTestSummary(summarizeAutoTestReport(freshReport));
    setAutoTestLog([]);
    setAutoTestError(null);
    appendAutoTestLog("Auto Test report cleared.");
  }

  function validateAutoTestBoard(): string | null {
    for (let index = 0; index < board.length; index += 1) {
      const point = board[index];
      if (point.count < 0) return `Point ${index + 1} has a negative checker count.`;
      if (point.owner === null && point.count !== 0) return `Point ${index + 1} has ${point.count} checkers but no owner.`;
      if (point.owner !== null && point.count <= 0) return `Point ${index + 1} is owned by ${point.owner} but has no checkers.`;
    }

    const whiteTotal =
      board.reduce((total, point) => total + (point.owner === "White" ? point.count : 0), 0) +
      bar.White +
      off.White;
    const blackTotal =
      board.reduce((total, point) => total + (point.owner === "Black" ? point.count : 0), 0) +
      bar.Black +
      off.Black;

    if (whiteTotal !== 15) return `White has ${whiteTotal} total checkers instead of 15.`;
    if (blackTotal !== 15) return `Black has ${blackTotal} total checkers instead of 15.`;
    if (off.White > 15 || off.Black > 15) return `Bear-off count exceeded 15. White off ${off.White}, Black off ${off.Black}.`;
    return null;
  }

  function chooseAutoTestMove(strategyOverride: AutoTestStrategy = autoTestStrategy): Move | null {
    return chooseStrategicMove({
      position: { board, bar, off },
      player: currentPlayer,
      controller,
      mode,
      dice: remainingDice,
      strategy: strategyOverride,
      legalSequences: legalAnalysis.legalSequences,
      applyMove,
      rawMoves: getRawMoves,
      controlledContinuations: (position, dice) => analyzeLegality(
        position.board, currentPlayer, dice, mode, position.bar, position.off,
        "ENEMY_CONTROL", bearOffPriorityAtTurnStart
      ).legalSequences,
    });
  }

  function stopAutoTestWithError(reason: string): void {
    setAutoTestError(reason);
    setAutoTestRunning(false);
    setAutoTestStopReason(`ERROR: ${reason}`);
    appendAutoTestLog(`AUTO TEST STOPPED: ${reason}`);
    setMessage(`AUTO TEST STOPPED: ${reason}`);
  }

  function completeAutoTestGame(winningPlayer: Player | null): void {
    const resolvedWinner = winningPlayer ?? finalResult?.winner ?? null;
    const resolvedLoser: Player | null = resolvedWinner === "White" ? "Black" : resolvedWinner === "Black" ? "White" : null;
    const loserPipsRemaining = resolvedLoser ? calculatePipCount(board, resolvedLoser, bar) : undefined;
    const loserCheckersOff = resolvedLoser ? off[resolvedLoser] : undefined;
    const checkerMargin = typeof loserCheckersOff === "number" ? 15 - loserCheckersOff : undefined;
    const highestWhitePips = Math.max(autoTestHighestPipsRef.current.White, calculatePipCount(board, "White", bar));
    const highestBlackPips = Math.max(autoTestHighestPipsRef.current.Black, calculatePipCount(board, "Black", bar));
    const highestPipCount = Math.max(highestWhitePips, highestBlackPips);
    const largestPipGap = autoTestLargestPipGapRef.current;
    autoTestCompletedGamesRef.current += 1;
    autoTestLongestGameStepsRef.current = Math.max(autoTestLongestGameStepsRef.current, autoTestGameStepRef.current);

    if (resolvedWinner === "White") autoTestWhiteWinsRef.current += 1;
    if (resolvedWinner === "Black") autoTestBlackWinsRef.current += 1;

    const gameResult: AutoTestGameResult = {
      gameNumber: autoTestCompletedGamesRef.current,
      completedAt: new Date().toISOString(),
      winner: resolvedWinner,
      openingWinner: autoTestCurrentOpeningWinnerRef.current ?? openingWinner,
      startingMode: autoTestCurrentStartModeRef.current,
      steps: autoTestGameStepRef.current,
      diceRolls: autoTestGameDiceRollsRef.current,
      playableRolls: autoTestGamePlayableRollsRef.current,
      unplayableRolls: autoTestGameUnplayableRollsRef.current,
      noEntryRolls: autoTestGameNoEntryRollsRef.current,
      doublesRolled: autoTestGameDoublesRolledRef.current,
      playableDoubles: autoTestGamePlayableDoublesRef.current,
      blockedDoubles: autoTestGameBlockedDoublesRef.current,
      checkerMoves: autoTestGameCheckerMovesRef.current,
      hits: autoTestGameHitsRef.current,
      bearOffs: autoTestGameBearOffsRef.current,
      noMovePasses: autoTestGameUnplayableRollsRef.current,
      winnerGreatestDeficitPips: resolvedWinner ? autoTestMaxDeficitRef.current[resolvedWinner] : 0,
      loserPipsRemaining,
      loserCheckersOff,
      finalPipMargin: loserPipsRemaining,
      checkerMargin,
      highestWhitePips,
      highestBlackPips,
      highestPipCount,
      largestPipGap,
      extremePipEvent: highestPipCount >= 300 || largestPipGap >= 200 || (loserPipsRemaining ?? 0) >= 100,
      enemyControlTriggers: autoTestGameEnemyControlTriggersRef.current,
      enemyControlMoves: autoTestGameEnemyControlMovesRef.current,
      whiteGainedEnemyControl: autoTestGameWhiteGainedEnemyControlRef.current,
      blackGainedEnemyControl: autoTestGameBlackGainedEnemyControlRef.current,
      enemyControlWhileTrailing30: autoTestGameEnemyControlWhileTrailing30Ref.current,
      enemyControlCausedHits: autoTestGameEnemyControlCausedHitsRef.current,
      enemyControlBeneficiaryWon:
        resolvedWinner === "White"
          ? autoTestGameWhiteGainedEnemyControlRef.current > 0
          : resolvedWinner === "Black"
          ? autoTestGameBlackGainedEnemyControlRef.current > 0
          : false,
    };

    const nextReport: AutoTestReport = {
      ...autoTestReport,
      stopReason:
        autoTestCompletedGamesRef.current >= autoTestTargetGamesRef.current
          ? `Completed requested ${autoTestTargetGamesRef.current} game(s).`
          : `Running. Completed ${autoTestCompletedGamesRef.current} of ${autoTestTargetGamesRef.current}.`,
      games: [...autoTestReport.games, gameResult],
    };
    publishAutoTestReport(nextReport);

    appendAutoTestLog(
      `Game ${autoTestCompletedGamesRef.current}/${autoTestTargetGamesRef.current} complete. ${
        resolvedWinner ? `${resolvedWinner} won` : "Winner already recorded"
      }. Rolls: ${gameResult.diceRolls ?? 0}. Moves: ${gameResult.checkerMoves ?? 0}. Final margin: ${gameResult.finalPipMargin ?? 0} pips. Comeback: ${gameResult.winnerGreatestDeficitPips} pips. Enemy Control: ${gameResult.enemyControlTriggers ?? 0}.`
    );

    if (autoTestCompletedGamesRef.current >= autoTestTargetGamesRef.current) {
      setAutoTestRunning(false);
      setMessage(
        `Auto Test complete: ${autoTestCompletedGamesRef.current} game(s), White ${autoTestWhiteWinsRef.current}, Black ${autoTestBlackWinsRef.current}, errors 0. Report saved.`
      );
      appendAutoTestLog("Auto Test batch complete. Report saved in this browser.");
      return;
    }

    resetAutoTestCurrentGameTrackers();
    resetNewGame();
    appendAutoTestLog(`Starting game ${autoTestCompletedGamesRef.current + 1}/${autoTestTargetGamesRef.current}.`);

    if (
      autoTestSpeed === "SAFE_TURBO" &&
      autoTestCompletedGamesRef.current > 0 &&
      autoTestCompletedGamesRef.current % AUTO_TEST_BATCH_CHECKPOINT_GAMES === 0
    ) {
      setAutoTestRunning(false);
      setMessage(`Auto Test checkpoint saved after ${autoTestCompletedGamesRef.current} game(s). Resuming shortly.`);
      appendAutoTestLog(`Checkpoint saved after ${autoTestCompletedGamesRef.current} game(s). Browser breath before next batch.`);
      if (autoTestBatchResumeTimerRef.current !== null) clearTimeout(autoTestBatchResumeTimerRef.current);
      autoTestBatchResumeTimerRef.current = setTimeout(() => {
        autoTestBatchResumeTimerRef.current = null;
        setAutoTestRunning(true);
      }, 450);
    }
  }

  function runAutoTestStep(): void {
    if (diceRolling || autoTestError) return;

    const boardProblem = validateAutoTestBoard();
    if (boardProblem) {
      stopAutoTestWithError(boardProblem);
      return;
    }

    updateAutoTestPipDeficits();
    autoTestStepRef.current += 1;
    autoTestGameStepRef.current += 1;
    autoTestTotalStepsRef.current += 1;
    setAutoTestSummary((current) => ({
      ...current,
      totalSteps: autoTestTotalStepsRef.current,
      noMovePasses: autoTestNoMovePassesRef.current,
      longestGameSteps: Math.max(current.longestGameSteps, autoTestGameStepRef.current),
    }));

    if (autoTestGameStepRef.current > 1200) {
      stopAutoTestWithError("Auto test reached 1200 steps in one game without a winner. Possible loop or very long game.");
      return;
    }

    if (winner || gamePhase === "GAME_OVER") {
      completeAutoTestGame(winner);
      return;
    }

    if (gamePhase === "OPENING_ROLL") {
      appendAutoTestLog(`Game ${autoTestCompletedGamesRef.current + 1}: rolling opening dice.`);
      void rollOpening();
      return;
    }

    if (canChooseDoctrine) {
      const chosenMode: Mode = autoTestStepRef.current % 2 === 0 ? "WAR" : "PEACE";
      autoTestCurrentStartModeRef.current = chosenMode;
      autoTestCurrentOpeningWinnerRef.current = openingWinner;
      appendAutoTestLog(`${openingWinner ?? "Opening winner"} chooses ${chosenMode}.`);
      chooseMode(chosenMode, true);
      return;
    }

    if (!turnIsPlayable || awaitingModeChoice) return;

    if (canSubmitTurn) {
      appendAutoTestLog(`${currentPlayer} ends turn.`);
      submitTurn();
      return;
    }

    if (remainingDice.length > 0 && legalMoves.length === 0) {
      appendAutoTestLog(`${currentPlayer} has no legal moves with dice ${remainingDice.join(", ")}. Auto-pass will advance.`);
      return;
    }

    const move = chooseAutoTestMove();
    if (!move) {
      appendAutoTestLog(`${currentPlayer} has no move to select.`);
      return;
    }

    appendAutoTestLog(`${currentPlayer} ${mode}: ${describeMove(move)}`);
    executeMove(move);
  }

  function startAutoTest(targetGames = 1): void {
    diagnosticGameRef.current = true;
    setPlaySetupMode("TWO_PLAYERS");
    setAutoTestError(null);
    setAutoTestLog([]);
    resetAutoTestCounters(targetGames);
    setAutoTestRunning(true);
    setShowMoveLog(true);
    if (gamePhase !== "OPENING_ROLL" || moveLog.length > 0 || winner || finalResult) {
      resetNewGame();
    }
    appendAutoTestLog(`Auto Test started: ${targetGames} game(s), speed ${AUTO_TEST_SPEED_LABELS[autoTestSpeed]}, strategy ${AUTO_TEST_STRATEGY_LABELS[autoTestStrategy]}. Report will be saved after every completed game.`);
  }

  function pauseAutoTest(): void {
    if (autoTestBatchResumeTimerRef.current !== null) {
      clearTimeout(autoTestBatchResumeTimerRef.current);
      autoTestBatchResumeTimerRef.current = null;
    }
    setAutoTestRunning(false);
    setAutoTestStopReason(`Paused after ${autoTestCompletedGamesRef.current} completed game(s).`);
    appendAutoTestLog("Auto Test paused. Current report saved.");
  }

  function stopAutoTest(): void {
    if (autoTestBatchResumeTimerRef.current !== null) {
      clearTimeout(autoTestBatchResumeTimerRef.current);
      autoTestBatchResumeTimerRef.current = null;
    }
    setAutoTestRunning(false);
    setAutoTestError(null);
    autoTestStepRef.current = 0;
    resetAutoTestCurrentGameTrackers();
    setAutoTestStopReason(`Stopped by user after ${autoTestCompletedGamesRef.current} completed game(s).`);
    appendAutoTestLog("Auto Test stopped. Current report saved.");
  }

  function stepAutoTestOnce(): void {
    diagnosticGameRef.current = true;
    setAutoTestError(null);
    appendAutoTestLog("Manual auto-test step.");
    runAutoTestStep();
  }


  function beginDrag(index: number, event?: React.PointerEvent<HTMLDivElement>): void {
    if (!event || !setupComplete || winner || diceRolling || confirmResign || isComputerController || autoTestRunning || awaitingModeChoice || bar[currentPlayer] > 0) return;
    if (board[index].owner !== currentPlayer || !humanMoves.some((move) => move.from === index)) return;
    setPendingBearOffMoves([]);
    pendingDragRef.current = { point: index, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function finishDragAt(clientX: number, clientY: number): void {
    pendingDragRef.current = null;
    if (draggingPoint === null || dragCompletionGuard.current) return;
    dragCompletionGuard.current = true;
    ignorePointClickUntilRef.current = performance.now() + 250;
    const element = document.elementFromPoint(clientX, clientY);
    const tray = element?.closest("[data-bear-off-player]") as HTMLElement | null;
    const point = element?.closest("[data-point-index]") as HTMLElement | null;
    const dropIndex = point?.dataset.pointIndex === undefined ? null : Number(point.dataset.pointIndex);
    const moves = humanMoves.filter((candidate) => candidate.from === draggingPoint && (
      candidate.isBearOff ? tray?.dataset.bearOffPlayer === currentPlayer : candidate.to === dropIndex
    ));
    const source = draggingPoint;
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
    if (moves.length > 0) { chooseHumanMove(moves); return; }
    setSelectedPoint(source);
    if (dropIndex !== source) {
      showLegalMoveHelp(source);
      setMessage("Choose a highlighted destination, or drop a home checker into its OFF tray.");
    }
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>): void {
    pendingDragRef.current = null;
    if (draggingPoint === null) return;
    event.preventDefault();
    finishDragAt(event.clientX, event.clientY);
  }

  function cancelDrag(): void {
    pendingDragRef.current = null;
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
  }

  function updateDragPosition(event: React.PointerEvent<HTMLDivElement>): void {
    const pending = pendingDragRef.current;
    if (draggingPoint === null) {
      if (!pending || Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 8) return;
      event.preventDefault();
      dragCompletionGuard.current = false;
      setDraggingPoint(pending.point);
      setSelectedPoint(pending.point);
      setPreviewMoveKey(null);
      setDragPosition({ x: event.clientX, y: event.clientY });
      return;
    }
    event.preventDefault();
    updateDragPositionAt(event.clientX, event.clientY);
  }

  function updateDragPositionAt(clientX: number, clientY: number): void {
    if (draggingPoint === null) return;
    setDragPosition({ x: clientX, y: clientY });
    const element = document.elementFromPoint(clientX, clientY)?.closest("[data-point-index]") as HTMLElement | null;
    setHoverPoint(element?.dataset.pointIndex === undefined ? null : Number(element.dataset.pointIndex));
  }

  useEffect(() => {
    if (draggingPoint === null) return;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    function handleWindowPointerMove(event: PointerEvent): void {
      event.preventDefault();
      updateDragPositionAt(event.clientX, event.clientY);
    }

    function handleWindowPointerUp(event: PointerEvent): void {
      event.preventDefault();
      finishDragAt(event.clientX, event.clientY);
    }

    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") cancelDrag();
    }

    window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", handleWindowPointerUp, { passive: false });
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [draggingPoint, humanMoves]);

  useEffect(() => {
    if (autoPassTimerRef.current !== null) {
      clearTimeout(autoPassTimerRef.current);
      autoPassTimerRef.current = null;
    }

    const shouldAutoPassNoMoveTurn =
      setupComplete && !showRules && !showSoundSettings && !confirmResign &&
      winner === null &&
      !diceRolling &&
      turnIsPlayable &&
      !awaitingModeChoice &&
      remainingDice.length > 0 &&
      legalMoves.length === 0 &&
      turnMoveCount === 0;

    if (!shouldAutoPassNoMoveTurn) return;

    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLegalHelpActive(false);
    setAssistSourcePoint(null);
    setMessage(`${currentPlayer} rolled ${remainingDice.join(", ")}. No legal moves — turn passes.`);
    flashBanner("NO MOVES", 1800);

    autoPassTimerRef.current = setTimeout(() => {
      autoPassTimerRef.current = null;
      void nextTurn();
    }, autoTestRunning ? AUTO_TEST_NO_MOVE_DELAY_MS[autoTestSpeed] : 2000);

    return () => {
      if (autoPassTimerRef.current !== null) {
        clearTimeout(autoPassTimerRef.current);
        autoPassTimerRef.current = null;
      }
    };
  }, [setupComplete, showRules, showSoundSettings, confirmResign, awaitingModeChoice, currentPlayer, diceRolling, legalMoves.length, remainingDice, turnIsPlayable, turnMoveCount, winner, autoTestRunning, autoTestSpeed]);

  useEffect(() => {
    if (!autoTestRunning || autoTestError || diceRolling || draggingPoint !== null) return;

    const delay =
      remainingDice.length > 0 && legalMoves.length === 0 && turnMoveCount === 0
        ? AUTO_TEST_NO_MOVE_DELAY_MS[autoTestSpeed]
        : AUTO_TEST_DELAY_MS[autoTestSpeed];
    const timer = window.setTimeout(() => {
      runAutoTestStep();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    autoTestRunning,
    autoTestError,
    diceRolling,
    draggingPoint,
    gamePhase,
    awaitingModeChoice,
    canChooseDoctrine,
    canSubmitTurn,
    turnIsPlayable,
    currentPlayer,
    mode,
    winner,
    remainingDice,
    legalMoves.length,
    turnMoveCount,
    board,
    bar,
    off,
  ]);

  useEffect(() => {
    if (!setupComplete || showRules || showSoundSettings || confirmResign || autoTestRunning || autoTestError || diceRolling || draggingPoint !== null) return;
    if (!isComputerController || winner !== null) return;

    const delay = remainingDice.length > 0 && legalMoves.length === 0 && turnMoveCount === 0 ? 1150 : 650;
    const timer = window.setTimeout(() => {
      if (winner || diceRolling) return;

      if (canChooseDoctrine && openingWinner === "Black") {
        const chosenMode = chooseComputerOpeningMode();
        setMessage(`Computer chooses ${chosenMode}.`);
        chooseMode(chosenMode, true);
        return;
      }

      if (!turnIsPlayable || awaitingModeChoice) return;

      if (canSubmitTurn) {
        submitTurn();
        return;
      }

      if (remainingDice.length > 0 && legalMoves.length === 0) return;

      const move = chooseAutoTestMove(computerStrategy);
      if (move) executeMove(move);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    setupComplete,
    showRules,
    showSoundSettings,
    confirmResign,
    autoTestRunning,
    autoTestError,
    diceRolling,
    draggingPoint,
    isComputerController,
    winner,
    gamePhase,
    canChooseDoctrine,
    openingWinner,
    turnIsPlayable,
    awaitingModeChoice,
    canSubmitTurn,
    remainingDice,
    legalMoves.length,
    turnMoveCount,
    computerStrategy,
    currentPlayer,
    controller,
    mode,
    board,
    bar,
    off,
  ]);

  function handlePointClick(index: number): void {
    if (performance.now() < ignorePointClickUntilRef.current || !setupComplete || diceRolling || confirmResign || autoTestRunning) return;
    if (isComputerController) { setMessage("Computer is thinking."); return; }
    setPendingBearOffMoves([]);

    const completedWinner = winner ?? checkForWinner(off);
    if (completedWinner) {
      if (winner === null) endGame(completedWinner, "BEAR_OFF", board, bar, off);
      setMessage(finalResult ? formatFinalResult(finalResult) : `${completedWinner} has already won. Game over.`);
      return;
    }

    if (awaitingModeChoice) {
      setMessage("Choose WAR or PEACE first.");
      return;
    }

    if (remainingDice.length === 0) {
      setMessage(awaitingModeChoice ? "Choose WAR or PEACE first." : "No dice available. Roll opening dice or submit turn when appropriate.");
      return;
    }

    if (bar[currentPlayer] > 0) {
      const barMove = humanMoves.find((move) => move.isBarEntry && move.to === index);
      if (!barMove) {
        showLegalMoveHelp(null);
        setMessage("Bar entry required.");
        return;
      }
      executeMove(barMove);
      return;
    }

    if (selectedPoint === null) {
      const point = board[index];
      const hasLegalMoveFromPoint = humanMoves.some((move) => !move.isBarEntry && move.from === index);

      if (point.owner !== currentPlayer || !hasLegalMoveFromPoint) {
        showLegalMoveHelp(null);
        setMessage(`It is ${currentPlayer}'s turn. Select a highlighted ${currentPlayer} checker.`);
        return;
      }
      setSelectedPoint(index);
      setAssistSourcePoint(index);
      setLegalHelpActive(false);
      setPreviewMoveKey(null);
      setWarningMessage(null);
      soundClick();
      setMessage(`Selected point ${index + 1}. Now select a highlighted legal destination.`);
      return;
    }

    const moves = humanMoves.filter((candidate) => {
      if (candidate.isBearOff) return candidate.from === selectedPoint && index === selectedPoint;
      return candidate.from === selectedPoint && candidate.to === index;
    });

    if (moves.length === 0) {
      if (board[index].owner === currentPlayer && humanMoves.some((candidate) => candidate.from === index)) {
        setSelectedPoint(index === selectedPoint ? null : index);
        setAssistSourcePoint(null);
        return;
      }
      setPreviewMoveKey(null);
      showLegalMoveHelp(selectedPoint);
      setMessage("Not permitted — must make a legal move.");
      return;
    }

    chooseHumanMove(moves);
  }

  function chooseHumanMove(moves: Move[]): void {
    if (isComputerController || diceRolling || confirmResign || autoTestRunning || !setupComplete || winner !== null) return;
    const candidates = moves.filter((move) => humanMoves.some((legal) => moveKey(legal) === moveKey(move)));
    if (candidates.length === 0) { setPendingBearOffMoves([]); return; }
    if (candidates.length > 1 && candidates.every((move) => move.isBearOff)) {
      const options = [...new Map(candidates.map((move) => [move.die, move])).values()].sort((a, b) => a.die - b.die);
      if (options.length > 1) {
        setPendingBearOffMoves(options);
        setSelectedPoint(options[0].from);
        setMessage(`Choose which die to use to bear off from point ${options[0].from + 1}. Either highlighted choice is legal.`);
        return;
      }
    }
    setPendingBearOffMoves([]);
    executeMove(candidates[0]);
  }

  function handleBearOffTrayClick(player: Player): void {
    if (isComputerController || diceRolling || confirmResign || autoTestRunning || !setupComplete) return;
    if (player !== currentPlayer || remainingDice.length === 0 || awaitingModeChoice || winner !== null) return;

    const bearOffMoves = selectedPoint === null
      ? []
      : humanMoves.filter((move) => move.isBearOff && move.from === selectedPoint);

    if (bearOffMoves.length === 0) {
      showLegalMoveHelp(selectedPoint);
      setMessage("Select a highlighted checker that can bear off.");
      return;
    }

    chooseHumanMove(bearOffMoves);
  }

  function getDieOwnerForDisplay(value: number, index: number): Player {
    if (openingDice !== null) {
      if (awaitingModeChoice) return index === 0 ? "White" : "Black";

      // During the opening player's first turn, keep the original opening dice visually distinct:
      // White's opening die remains white; Black's opening die remains black.
      if (value === openingDice[0]) return "White";
      if (value === openingDice[1]) return "Black";
    }

    return currentPlayer;
  }


  function moveDestinationColor(point: Point, player: Player): string {
    if (point.owner !== null && point.owner !== player && point.count === 1) {
      return "radial-gradient(circle, #ff5a4d 0%, #7a0000 75%)";
    }

    return "radial-gradient(circle, #7de2ff 0%, #006d9c 75%)";
  }


  function renderPoint(index: number, isTop: boolean) {
    const point = board[index];
    const source = draggingPoint ?? selectedPoint ?? assistSourcePoint;
    const canShowMoves = setupComplete && humanCanAct && !winner && !awaitingModeChoice;
    const isSelected = canShowMoves && source === index;
    const isOrigin = canShowMoves && legalOriginPoints.includes(index);
    const isRequiredOrigin = isOrigin && legalOriginPoints.length === 1;
    const destination = canShowMoves && humanMoves.find((move) =>
      bar[currentPlayer] > 0 ? move.isBarEntry && move.to === index :
      source !== null && move.from === source && !move.isBearOff && move.to === index
    );
    const wasOrigin = lastMove !== null && !lastMove.isBarEntry && lastMove.from === index;
    const wasDestination = lastMove !== null && !lastMove.isBearOff && lastMove.to === index;
    const visibleCount = Math.min(point.count, 5) - (draggingPoint === index ? 1 : 0);
    const moveDescription = destination ? ", legal destination" + (destination.isHit ? ", capture" : "") :
      isSelected ? ", selected source" : isRequiredOrigin ? ", required source" : isOrigin ? ", available to move" : "";
    return (
      <div key={index} data-point-index={index} data-selected={isSelected} data-legal-origin={isOrigin}
        data-legal-destination={Boolean(destination)} data-last-origin={wasOrigin} data-last-destination={wasDestination}
        role="button" tabIndex={setupComplete ? 0 : -1}
        aria-label={"Point " + (index + 1) + ": " + (point.owner ? point.count + " " + point.owner + " checkers" : "empty") + moveDescription + (wasOrigin ? ", last move started here" : wasDestination ? ", last move ended here" : "")}
        aria-pressed={isSelected}
        onClick={() => handlePointClick(index)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handlePointClick(index); } }}
        onPointerDown={(event) => beginDrag(index, event)}
        onPointerMove={updateDragPosition} onPointerUp={finishDrag} onPointerCancel={cancelDrag}
        className={"board-point " + (isTop ? "point-top" : "point-bottom") + (isOrigin ? " point-origin" : "") + (isSelected ? " point-selected" : "") + (destination ? " point-destination" + (destination.isHit ? " point-capture" : "") : "") + (hoverPoint === index && destination ? " point-hover" : "")}>
        <span className={"point-triangle " + (index % 2 === 0 ? "point-ivory" : "point-copper")} aria-hidden="true" />
        <span className="point-number" aria-hidden="true">{index + 1}</span>
        <div className="checker-stack" aria-hidden="true">
          {Array.from({ length: Math.max(0, visibleCount) }, (_, n) =>
            <span key={n} className={"board-checker " + (point.owner === "White" ? "checker-light" : "checker-dark") +
              (lastMove?.to === index && n === visibleCount - 1 ? " checker-arrived" : "")}>
              {n === visibleCount - 1 && point.count > 5 && <span className="checker-count">{point.count}</span>}
            </span>)}
        </div>
        {(wasOrigin || wasDestination) && <span className={"last-move-frame " + (wasDestination ? "last-move-to" : "last-move-from")} aria-hidden="true"><i>{wasDestination ? "TO" : "FROM"}</i></span>}
        {(isOrigin || destination || isSelected) && <span className="point-move-frame" aria-hidden="true">
          {(destination || isSelected) && <i>{destination ? destination.isHit ? "×" : "↓" : "✓"}</i>}
        </span>}
      </div>
    );
  }


  function renderQuadrant(points: number[], isTop: boolean) {
    return <div className="point-quadrant">{points.map((index) => renderPoint(index, isTop))}</div>;
  }

  function renderBar(player: Player) {
    const required = setupComplete && humanCanAct && !winner && !awaitingModeChoice && currentPlayer === player && humanMoves.some((move) => move.isBarEntry);
    const wasOrigin = Boolean(lastMove?.isBarEntry && moveLog[moveLog.length - 1]?.player === player);
    return <button type="button" className={"board-bar " + (bar[player] > 0 ? "bar-occupied" : "") + (required ? " bar-required" : "") + (wasOrigin ? " bar-last-origin" : "")}
      data-legal-origin={required} data-last-origin={wasOrigin}
      aria-label={player + " bar: " + bar[player] + " captured checkers" + (required ? ", required source; enter onto a cyan framed point" : "") + (wasOrigin ? ", last move started here" : "")}
      onClick={() => { if (required) {
        setSelectedPoint(null); setLegalHelpActive(true); setMessage("Enter from the bar onto a highlighted point.");
      } }}>
      {bar[player] === 0 ? <span className="bar-word">BAR</span> :
        <span className="bar-stack" style={{"--bar-count":bar[player]} as React.CSSProperties} aria-hidden="true">
          {Array.from({length:bar[player]},(_,index)=><span key={index} className={"bar-checker " + (player === "White" ? "checker-light" : "checker-dark")} />)}
        </span>}
    </button>;
  }

  function renderOffTray(player: Player) {
    const source = draggingPoint ?? selectedPoint ?? assistSourcePoint;
    const available = player === currentPlayer && setupComplete && humanCanAct && !winner && source !== null && humanMoves.some((move) => move.isBearOff && move.from === source);
    const wasDestination = Boolean(lastMove?.isBearOff && moveLog[moveLog.length - 1]?.player === player);
    return <button type="button" data-bear-off-player={player}
      data-legal-destination={available} data-last-destination={wasDestination}
      className={"off-tray " + (available ? "off-tray-available" : "") + (wasDestination ? " off-tray-last-destination" : "")}
      aria-label={player + " bear-off tray: " + off[player] + " of 15 off" + (available ? ", legal destination for selected checker" : "") + (wasDestination ? ", last move ended here" : "")}
      onClick={() => handleBearOffTrayClick(player)}>
      <span className={"tray-color " + (player === "White" ? "checker-light" : "checker-dark")} aria-hidden="true" />
      <span>OFF</span><strong>{off[player]}</strong><small>/ 15</small>
    </button>;
  }

  const topLeftRow = [12, 13, 14, 15, 16, 17];
  const topRightRow = [18, 19, 20, 21, 22, 23];
  const bottomLeftRow = [11, 10, 9, 8, 7, 6];
  const bottomRightRow = [5, 4, 3, 2, 1, 0];

  const modeIsWar = mode === "WAR";
  const enemyControl = vengeanceActive;
  const neutralModeState = awaitingModeChoice || (!openingDice && remainingDice.length === 0 && moveLog.length === 0);
  const shellWidth = "min(calc(100vw - 12px), 1420px)";
  const activeTurnIsWhite = currentPlayer === "White";
  const activeTurnGlowBackground = enemyControl
    ? "linear-gradient(145deg, #ffe76a, #d77b00 58%, #3b1000)"
    : activeTurnIsWhite
    ? "linear-gradient(145deg, #fffef3, #f0d98d 52%, #6f4a16)"
    : "linear-gradient(145deg, #7a431e, #321304 60%, #050201)";
  const activeTurnGlowBorder = enemyControl
    ? "3px solid #ffe94a"
    : activeTurnIsWhite
    ? "3px solid #fff6b8"
    : "3px solid #c4792b";
  const activeTurnGlowColor = activeTurnIsWhite && !enemyControl ? "#1a0900" : "#fff1c0";

  const doctrineBannerText = enemyControl
    ? "ENEMY CONTROL"
    : neutralModeState
    ? "WAR & PEACE"
    : modeIsWar
    ? "WAR!"
    : "PEACE!";

  const doctrineBannerBackground = enemyControl
    ? "linear-gradient(145deg, #ffd000, #ff5c00)"
    : neutralModeState
    ? "linear-gradient(135deg, #1d1209 0%, #b88a45 42%, #e8c979 50%, #5b3615 62%, #140905 100%)"
    : modeIsWar
    ? "linear-gradient(145deg, #750000, #ff2020)"
    : "linear-gradient(145deg, #003a8c, #28a8ff)";

  const doctrineBannerShadow = enemyControl
    ? "0 0 24px rgba(255, 215, 0, 0.9)"
    : neutralModeState
    ? "0 0 20px rgba(232,201,121,0.38)"
    : modeIsWar
    ? "0 0 18px rgba(255,0,0,0.25)"
    : "0 0 18px rgba(0,160,255,0.2)";

  const doctrineBannerAnimation = enemyControl
    ? "enemyFlash 1s infinite"
    : neutralModeState
    ? "neutralGlow 3.5s infinite"
    : modeIsWar
    ? "warPulse 2s infinite"
    : "peaceGlow 3s infinite";

  const luxuryButton: React.CSSProperties = {
    background: "linear-gradient(145deg, #201812, #050302)",
    color: "#f3d18b",
    border: "2px solid #9a6328",
    borderRadius: 999,
    padding: "8px 18px",
    fontWeight: 800,
    fontSize: 10,
    boxShadow: "inset 0 1px 0 rgba(255,220,150,0.25), 0 5px 14px rgba(0,0,0,0.55)",
    cursor: "pointer",
  };

  if (!betaUnlocked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "radial-gradient(circle at 50% 0%, #3a1d0d 0%, #120704 48%, #020100 100%)",
          color: "#f9e8bd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <form
          onSubmit={handleBetaUnlock}
          style={{
            width: "min(560px, 94vw)",
            borderRadius: 28,
            border: "3px solid #b8792f",
            background: "linear-gradient(145deg, rgba(45,20,8,0.96), rgba(8,3,1,0.98))",
            boxShadow: "0 24px 70px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,225,150,0.22)",
            padding: "clamp(24px, 4vw, 42px)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 900, letterSpacing: 1.2 }}>
            War &amp; Peace Backgammon
          </div>
          <div
            style={{
              marginTop: 10,
              color: "#d7ba7a",
              fontSize: "clamp(18px, 2vw, 24px)",
              fontWeight: 800,
            }}
          >
            Private Beta
          </div>
          <div style={{ marginTop: 24, fontSize: "clamp(16px, 1.5vw, 20px)", lineHeight: 1.45, color: "#f0d9a4" }}>
            Enter the beta password to open the game. Access will be remembered on this browser.
          </div>
          <input
            type="password"
            value={betaPasswordInput}
            onChange={(event) => {
              setBetaPasswordInput(event.target.value);
              setBetaError(null);
            }}
            autoFocus
            aria-label="Beta password"
            style={{
              marginTop: 28,
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 18,
              border: "2px solid #c8944b",
              background: "#fff8e6",
              color: "#201000",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              padding: "15px 18px",
              outline: "none",
              fontFamily: "Georgia, 'Times New Roman', serif",
              textAlign: "center",
              fontWeight: 800,
            }}
          />
          {betaError && (
            <div style={{ marginTop: 14, color: "#ff9a89", fontWeight: 900, fontSize: "clamp(15px, 1.4vw, 18px)" }}>
              {betaError}
            </div>
          )}
          <button
            type="submit"
            style={{
              ...luxuryButton,
              marginTop: 24,
              fontSize: "clamp(18px, 1.7vw, 23px)",
              padding: "14px 30px",
              width: "100%",
              background: "linear-gradient(145deg, #f4d38e, #a35d1e)",
              color: "#1a0900",
            }}
          >
            Enter Game
          </button>
        </form>
      </div>
    );
  }


  const humanCanAct = !isComputerController && !autoTestRunning && !diceRolling && !confirmResign;
  const canChooseHere = canChooseDoctrine && humanCanAct;
  const statusText = winner && finalResult ? formatFinalResult(finalResult) :
    diceRolling ? "Rolling dice…" : vengeanceActive ? `${controller}: ALL MOVES. ${remainingDice.length === 0 || legalMoves.length === 0 ? "Roll complete — end turn." : "At least one capture; extras optional."}` : isComputerController ? "Computer is thinking…" :
    canChooseHere ? "You won the opening roll. Choose WAR or PEACE." : message;

  return (
    <main ref={tableFit.appRef} className={"game-app theme-" + (enemyControl ? "vengeance vengeance-sweep" : modeIsWar ? "war" : "peace")}
      data-music-mode={musicMode} onDragStart={(event) => event.preventDefault()}
      onPointerDownCapture={resumeAudio} onTouchEndCapture={resumeAudio} onClickCapture={resumeAudio} onKeyDownCapture={resumeAudio}>
      <RulesDialog open={showRules} onClose={() => setShowRules(false)} />
      <SoundSettings open={showSoundSettings} onClose={() => setShowSoundSettings(false)} soundEnabled={soundEnabled}
        onSoundToggle={() => { const next = !soundEnabled; setSoundEnabled(next); if (next) playSoundTest(); }}
        onSoundTest={() => { setSoundEnabled(true); playSoundTest(); }}
        narrationEnabled={narrationEnabled} onNarrationToggle={() => setNarrationEnabled(value => !value)}
        musicEnabled={musicEnabled} onMusicToggle={toggleMusic} volume={musicVolume} onVolumeChange={setMusicVolume} />
      {!setupComplete ? <GameIntro
        onPlayBalanced={() => startComputerGame("BALANCED")}
        onPlayAggressive={() => startComputerGame("CONTROLLED_COMEBACK")}
        onPlayTwoPlayers={startTwoPlayerGame}
        onShowRules={() => setShowRules(true)}
        onResume={hasSavedGame ? loadSavedGame : undefined}
      /> : <>
        <div className="game-table-shell" ref={tableFit.shellRef}>
        <header className="game-header">
          <div className="game-brand"><span className="brand-pieces" aria-hidden="true"><i className="checker-dark" /><i className="checker-light" /></span>
            <div><h1>War <span>&amp;</span> Peace</h1><p>BACKGAMMON</p></div>
          </div>
          <p className="game-opponent">{playSetupMode === "TWO_PLAYERS" ? "Two players · pass & play" : playSetupMode === "COMPUTER_AGGRESSIVE" ? "Computer 2 · Aggressive" : "Computer 1 · Balanced"}</p>
        {canEditPlayers && <section className="player-setup" aria-label="Player names">
          <label><span className="tiny-checker checker-light" aria-hidden="true" />White
            <input aria-label="White player name" maxLength={30} value={whitePlayerName} onChange={(event) => setWhitePlayerName(event.target.value)} />
          </label>
          <label><span className="tiny-checker checker-dark" aria-hidden="true" />Black
            <input aria-label="Black player name" maxLength={30} value={blackPlayerName} disabled={isComputerGame} onChange={(event) => setBlackPlayerName(event.target.value)} />
          </label>
        </section>}
          <nav className="game-nav" aria-label="Game navigation">
            <button type="button" onClick={() => setShowRules(true)}>How to play</button>
            <button type="button" className="messages-toggle" aria-pressed={narrationEnabled}
              title="Show or hide game pop-up messages" onClick={() => setNarrationEnabled(value => !value)}>
              Messages {narrationEnabled ? "on" : "off"}
            </button>
            <button type="button" aria-label="Sound" onClick={() => setShowSoundSettings(true)}>Sound <span aria-hidden="true">{soundEnabled ? "on" : "off"}</span></button>
            <button type="button" onClick={backToGameMenu}>Menu</button>
          </nav>
        </header>



        <section className="game-layout" aria-label="Backgammon table">
          <div className="table-toolbar">
            <div className={"mode-badge " + (enemyControl ? "badge-control" : neutralModeState ? "badge-neutral" : modeIsWar ? "badge-war" : "badge-peace")} data-testid="mode">
              <small>{enemyControl ? "PEACE · ENEMY CONTROL" : "CURRENT MODE"}</small>
              <strong>{enemyControl ? "VENGEANCE" : neutralModeState ? "WAR & PEACE" : mode}</strong>
            </div>
            <div className="turn-summary" data-testid="turn">
              <span className={"tiny-checker " + (currentPlayer === "White" ? "checker-light" : "checker-dark")} aria-hidden="true" />
              <div><strong>{winner ? winner + " wins" : enemyControl ? controller.toUpperCase() + " MAKES ALL MOVES" : currentPlayer + " to move"}</strong>
                <small>{enemyControl ? currentPlayer + "’s checkers · THIS ROLL" : currentPlayer === "White" ? whitePlayerName : blackPlayerName}</small></div>
            </div>
            <div className="pip-summary" aria-label="Pip counts">
              <div><small>WHITE</small><strong>{whitePipCount}</strong></div>
              <span>PIPS</span><div><small>BLACK</small><strong>{blackPipCount}</strong></div>
            </div>
          </div>
          <div className="board-frame" data-testid="board">
            <div className="board-half">
              {renderQuadrant(topLeftRow, true)}
              {renderBar("White")}
              {renderQuadrant(topRightRow, true)}
              {renderOffTray("White")}
            </div>
            <div className="board-center-line" aria-hidden="true" />
            <div className="board-half">
              {renderQuadrant(bottomLeftRow, false)}
              {renderBar("Black")}
              {renderQuadrant(bottomRightRow, false)}
              {renderOffTray("Black")}
            </div>
            {narrationEnabled && narration && <GameNarration key={narration.id} event={narration} onDismiss={() => setNarration(null)} />}
            {narrationEnabled && !narration && turnBanner && <div className={"turn-toast " + (turnBanner.includes("PEACE VIOLATION") ? "toast-control" : "")} role="status">
              <span className={"tiny-checker " + (currentPlayer === "White" ? "checker-light" : "checker-dark")} aria-hidden="true" />
              <div><strong>{turnBanner.startsWith("PEACE VIOLATION") ? enemyControl ? "VENGEANCE" : "Prisoner of Peace" : turnBanner}</strong>
                {turnBanner.startsWith("PEACE VIOLATION") && <small>{enemyControl ? `${controller} commands ${currentPlayer}’s unused moves` : "Capture complete · no borrowed moves remain"}</small>}</div>
            </div>}
          </div>

          <aside className="game-console" aria-label="Game controls">
            <DicePanel dice={displayDice} used={usedDiceIndices} selected={selectedDieIndex}
              selectable={humanCanAct && turnIsPlayable && !awaitingModeChoice && !winner}
              playableValues={legalMoves.map(move => move.die)} rolling={diceRolling} opening={awaitingModeChoice}
              history={rollHistory} owner={getDieOwnerForDisplay}
              onSelect={index => {
                setSelectedDieIndex(previous => previous === index ? null : index);
                setPendingBearOffMoves([]); setSelectedPoint(null); setAssistSourcePoint(null); setPreviewMoveKey(null);
                setMessage(selectedDieIndex === index ? "Either die may be used first. Choose a checker and destination." : `Use the ${rolledDice[index]}. Tap that die again to show moves for either die.`);
              }} />
            <div className="main-actions">
              {gamePhase === "OPENING_ROLL" && <button className="primary-action" type="button" disabled={!canRollOpening || autoTestRunning} onClick={rollOpening}>Roll opening dice</button>}
              {canChooseHere && <div className="mode-choices"><button type="button" className="choose-war" onClick={() => chooseMode("WAR")}>Choose WAR</button><button type="button" className="choose-peace" onClick={() => chooseMode("PEACE")}>Choose PEACE</button></div>}
              {turnIsPlayable && <button type="button" className="primary-action" disabled={!canSubmitTurn || !humanCanAct} onClick={submitTurn}>{diceRolling ? "Rolling…" : isComputerController ? "Computer’s turn" : "End turn"}</button>}
              {winner && <button type="button" className="primary-action" onClick={() => { diagnosticGameRef.current = false; resetNewGame(); }}>Play again</button>}
            </div>
            {humanCanAct && !winner && pendingBearOffMoves.length > 1 && <fieldset className="bear-off-choice" data-testid="bear-off-choice">
              <legend>Choose a die to bear off</legend>
              <div>{pendingBearOffMoves.map((move) => <button key={move.die} type="button" className="primary-action" onClick={() => chooseHumanMove([move])}>Use {move.die}</button>)}</div>
              <button type="button" className="cancel-resign" onClick={() => { setPendingBearOffMoves([]); setMessage("Bearing-off choice cancelled. Choose a move."); }}>Cancel die choice</button>
            </fieldset>}
            <div className="game-status" role="status" aria-live="polite" data-testid="status">
              {statusText}
              {turnGuidance && !winner && !diceRolling && <small>{turnGuidance}</small>}
            </div>
            <div className="secondary-actions">
              <button type="button" disabled={!canUndo} onClick={undoMove}>Undo move</button>
              <button type="button" aria-expanded={showRecords} onClick={() => setShowRecords((value) => !value)}>Records</button>
              <button type="button" disabled={!canResign || autoTestRunning} onClick={resignGame}>{confirmResign ? "Confirm resign" : "Resign"}</button>
            </div>
            {narrationEnabled && !winner && playSetupMode.startsWith("COMPUTER_") && computerLandmineProfile.tier !== "NONE" && <section className="tactic-note" aria-label="Computer tactics" data-testid="computer-tactics">
              <strong>Computer: {computerLandmineProfile.exposureAllowed ? computerLandmineProfile.label : "landmines on hold"}</strong>
              <p>{computerLandmineProfile.explanation}</p>
              {mode === "WAR" && <small>WAR captures do not grant Enemy Control.</small>}
            </section>}
            {confirmResign && <button type="button" className="cancel-resign" onClick={() => { setConfirmResign(false); setMessage("Resignation cancelled. Continue playing."); }}>Keep playing</button>}
            <p className="save-note">{diagnosticGameRef.current ? "Diagnostic game · personal save preserved" : saveAvailable ? "Progress saves on this device." : "Saving unavailable in this browser."}</p>
          </aside>
        </section>
        <details className="move-guide"><summary>Move guide</summary>
        <div className="move-legend" aria-label="Move highlight guide">
          <span><i className="legend-source" aria-hidden="true" />Gold dashes: move from</span>
          <span><i className="legend-selected" aria-hidden="true">✓</i>Selected</span>
          <span><i className="legend-destination" aria-hidden="true">↓</i>Cyan: move to</span>
          <span><i className="legend-capture" aria-hidden="true">×</i>Coral: capture</span>
          <span><i className="legend-last" aria-hidden="true" />Violet: last move</span>
        </div>
        </details>
        <footer className="game-footer"><span>Tap a source and destination, or drag. Progress saves here.</span><span>White → 24 · Black → 1</span><span className="release-version">v0.5.0</span></footer>
        </div>

        {showRecords && <section className="records-panel">
          <div className="section-heading"><h2>Player records</h2><button type="button" onClick={() => setShowRecords(false)}>Close</button></div>
          {leaderboard.length === 0 ? <p>Completed games on this device will appear here.</p> : <table><thead><tr><th>Player</th><th>Wins</th><th>Losses</th><th>Win rate</th></tr></thead><tbody>{leaderboard.map((player) => <tr key={player.name}><th>{player.name}</th><td>{player.wins}</td><td>{player.losses}</td><td>{formatWinRate(player.wins, player.games)}</td></tr>)}</tbody></table>}
          <p className="record-device-note">Records and saved progress stay in this browser.</p>
        </section>}
      </>}

      {setupComplete && draggingPoint !== null && dragPosition && <div className={"drag-checker " + (currentPlayer === "White" ? "checker-light" : "checker-dark")} aria-hidden="true" style={{ left: dragPosition.x, top: dragPosition.y }} />}
      {warningMessage && <div className="game-warning" role="alert">{warningMessage}</div>}
      {PUBLIC_SHOW_TESTING_TOOLS && <section className="testing-panel" aria-label="Developer testing tools">
        <button className="testing-toggle" type="button" aria-expanded={showTestingPanel} onClick={() => setShowTestingPanel((value) => !value)}>{showTestingPanel ? "Hide testing tools" : "Testing tools"}</button>
        {showTestingPanel && <>
          <h2>Gameplay diagnostics</h2>
          <p>{autoTestStatus} · {autoTestSummary.completedGames}/{autoTestSummary.targetGames} games</p>
          <div className="test-actions">
            <label>Speed <select aria-label="Test speed" value={autoTestSpeed} disabled={autoTestRunning} onChange={(event) => setAutoTestSpeed(event.target.value as AutoTestSpeed)}><option value="SLOW">Slow</option><option value="FAST">Fast</option><option value="VERY_FAST">Very fast</option><option value="SAFE_TURBO">Safe batch</option></select></label>
            <label>Strategy <select aria-label="Test strategy" value={autoTestStrategy} disabled={autoTestRunning} onChange={(event) => setAutoTestStrategy(event.target.value as AutoTestStrategy)}><option value="RANDOM_LEGAL">Random legal</option><option value="BALANCED">Balanced</option><option value="CONTROLLED_COMEBACK">Aggressive</option></select></label>
            {[1, 10, 100].map((count) => <button key={count} type="button" disabled={autoTestRunning} onClick={() => startAutoTest(count)}>Run {count}</button>)}
            <button type="button" disabled={!autoTestRunning} onClick={pauseAutoTest}>Pause</button>
            <button type="button" onClick={stopAutoTest}>Stop</button>
            <button type="button" onClick={() => void copyAutoTestReport()}>Copy report</button>
          </div>
          <div className="test-summary"><span>Average: {autoTestSummary.averageDiceRolls} rolls</span><span>Passes: {autoTestSummary.unplayableRolls}</span><span>Blocked doubles: {autoTestSummary.blockedDoubles}</span><span>Enemy Control: {autoTestSummary.enemyControlTriggers}</span></div>
          <p>{autoTestSummary.stopReason}</p>
          {autoTestError && <p className="test-error" role="alert">{autoTestError}</p>}
        </>}
      </section>}
    </main>
  );
}
