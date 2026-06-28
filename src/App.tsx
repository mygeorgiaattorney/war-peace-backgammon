import React, { useEffect, useMemo, useRef, useState } from "react";

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
  bar: BarState;
  off: OffState;
  controller: Player;
  controlState: ControlState;
  moveLog: MoveLogEntry[];
  lastMove: Move | null;
  turnMoveCount: number;
};

type SavedGameState = {
  version: 1;
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
const PUBLIC_SHOW_TESTING_TOOLS = false;
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
    const stored = window.localStorage.getItem(AUTO_TEST_REPORT_KEY);
    if (!stored) return createEmptyAutoTestReport(1);
    const parsed = JSON.parse(stored) as AutoTestReport;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.games)) return createEmptyAutoTestReport(1);
    return parsed;
  } catch {
    return createEmptyAutoTestReport(1);
  }
}

function saveAutoTestReport(report: AutoTestReport): void {
  window.localStorage.setItem(AUTO_TEST_REPORT_KEY, JSON.stringify(report));
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
  return Array.from(new Set(dice)).sort((a, b) => b - a);
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

function sequenceUsesDie(sequence: Sequence, die: number): boolean {
  return sequence.diceUsed.includes(die);
}

function filterByMaximumMoves(sequences: Sequence[]): Sequence[] {
  if (sequences.length === 0) return sequences;
  const maxMovesUsed = Math.max(...sequences.map((sequence) => sequence.moves.length));
  return sequences.filter((sequence) => sequence.moves.length === maxMovesUsed);
}

function enforceLargerDieRule(
  board: Point[],
  player: Player,
  dice: number[],
  bar: BarState,
  off: OffState,
  sequences: Sequence[],
  explanation: string[]
): Sequence[] {
  const distinctDice = uniqueDice(dice);
  if (distinctDice.length !== 2 || dice.length !== 2 || sequences.length === 0) return sequences;

  const [largerDie, smallerDie] = distinctDice;
  const rawStartMoves = getRawMoves(board, player, dice, bar, off);
  const largerPlayableNow = rawStartMoves.some((move) => move.die === largerDie);
  const smallerPlayableNow = rawStartMoves.some((move) => move.die === smallerDie);
  const maxMovesUsed = Math.max(...sequences.map((sequence) => sequence.moves.length));

  if (maxMovesUsed === 1 && largerPlayableNow && smallerPlayableNow) {
    const largerSequences = sequences.filter((sequence) => sequenceUsesDie(sequence, largerDie));
    if (largerSequences.length > 0) {
      explanation.push(`Only one die can be played. Larger die rule forces the ${largerDie}.`);
      return largerSequences;
    }
  }

  return sequences;
}

function filterByWarPeace(
  sequences: Sequence[],
  mode: Mode,
  controlState: ControlState,
  explanation: string[]
): Sequence[] {
  if (sequences.length === 0) return sequences;

  if (controlState === "ENEMY_CONTROL") {
    explanation.push("ENEMY CONTROL: WAR/PEACE restrictions are suspended.");
    return sequences;
  }

  if (mode === "WAR") {
    const maxHits = Math.max(...sequences.map((sequence) => sequence.totalHits));
    let best = sequences.filter((sequence) => sequence.totalHits === maxHits);

    if (maxHits > 0) explanation.push(`WAR requires maximum hitting: ${maxHits} hit(s).`);

    const maxBearOffs = Math.max(...best.map((sequence) => sequence.totalBearOffs));
    best = best.filter((sequence) => sequence.totalBearOffs === maxBearOffs);

    if (maxBearOffs > 0) explanation.push(`Bear-off priority applied: ${maxBearOffs} checker(s) off.`);
    return best;
  }

  const minHits = Math.min(...sequences.map((sequence) => sequence.totalHits));
  let best = sequences.filter((sequence) => sequence.totalHits === minHits);

  explanation.push(
    minHits === 0
      ? "PEACE requires a no-hit sequence where available."
      : `PEACE requires the fewest unavoidable hits: ${minHits}.`
  );

  const maxBearOffs = Math.max(...best.map((sequence) => sequence.totalBearOffs));
  best = best.filter((sequence) => sequence.totalBearOffs === maxBearOffs);

  if (maxBearOffs > 0) explanation.push(`Bear-off priority applied: ${maxBearOffs} checker(s) off.`);
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
  controlState: ControlState
): LegalAnalysis {
  const explanation: string[] = [];

  if (dice.length === 0) {
    return { legalSequences: [], legalMoves: [], explanation: ["No dice available."] };
  }

  const generated = generateSequences(board, player, dice, bar, off).filter(
    (sequence) => sequence.moves.length > 0
  );

  if (generated.length === 0) {
    return { legalSequences: [], legalMoves: [], explanation: ["No legal moves available."] };
  }

  if (bar[player] > 0) explanation.push(`${player} must enter from the bar before moving other checkers.`);

  let best = filterByMaximumMoves(generated);
  const maxMovesUsed = Math.max(...best.map((sequence) => sequence.moves.length));
  explanation.push(`Maximum dice-use rule: ${maxMovesUsed} move(s) available.`);

  best = enforceLargerDieRule(board, player, dice, bar, off, best, explanation);
  best = filterByWarPeace(best, mode, controlState, explanation);
  best = filterByMaximumMoves(best);

  return { legalSequences: best, legalMoves: dedupeFirstMoves(best), explanation };
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume();
  }

  return sharedAudioContext;
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
  playTone(140, 0.055, 0.2, "square", 0);
  playTone(72, 0.14, 0.16, "sawtooth", 0.045);
  playTone(220, 0.055, 0.12, "triangle", 0.13);
}

function playPeaceViolationSound(): void {
  playTone(560, 0.08, 0.18, "square", 0);
  playTone(280, 0.11, 0.16, "sawtooth", 0.075);
  playTone(760, 0.12, 0.14, "triangle", 0.18);
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
  if (move.isBarEntry) return `Enter from bar to ${pointLabel(move.to)} with ${move.die}${move.isHit ? " - POW! Captured" : ""}`;
  return `${pointLabel(move.from)} -> ${pointLabel(move.to)} with ${move.die}${move.isHit ? " - POW! Captured" : ""}`;
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
  if (entry.move.isHit) tags.push("POW! CAPTURED");
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
    const raw = window.localStorage.getItem(PLAYER_RECORDS_KEY);
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
  window.localStorage.setItem(PLAYER_RECORDS_KEY, JSON.stringify(book));
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
  assert("PEACE prefers no-hit first moves where available", peaceAnalysis.legalMoves.every((move) => !move.isHit));

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
  const [controller, setController] = useState<Player>("White");
  const [controlState, setControlState] = useState<ControlState>("NORMAL");
  const [gamePhase, setGamePhase] = useState<GamePhase>("OPENING_ROLL");
  const [remainingDice, setRemainingDice] = useState<number[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [previewMoveKey, setPreviewMoveKey] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showMoveLog, setShowMoveLog] = useState(true);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [turnMoveCount, setTurnMoveCount] = useState(0);
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
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem("warPeaceBackgammonSoundEnabledV1") !== "off");
  const [showTestingPanel, setShowTestingPanel] = useState(false);
  const [playSetupMode, setPlaySetupMode] = useState<PlaySetupMode>("MENU");
  const [computerStrategy, setComputerStrategy] = useState<AutoTestStrategy>("BALANCED");
  const [gameRolls, setGameRolls] = useState(0);
  const [gamePlayableRolls, setGamePlayableRolls] = useState(0);
  const [gameUnplayableRolls, setGameUnplayableRolls] = useState(0);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [betaUnlocked, setBetaUnlocked] = useState(() => window.localStorage.getItem(BETA_ACCESS_KEY) === "granted");
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
    setHasSavedGame(Boolean(window.localStorage.getItem(SAVE_KEY)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("warPeaceBackgammonSoundEnabledV1", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    console.table(runEngineSelfTests().map((result) => ({ result })));
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
    () => analyzeLegality(board, currentPlayer, remainingDice, mode, bar, off, controlState),
    [board, currentPlayer, remainingDice, mode, bar, off, controlState]
  );

  const legalMoves = legalAnalysis.legalMoves;
  const legalOriginPoints = useMemo(
    () =>
      Array.from(
        new Set(
          legalMoves
            .filter((move) => !move.isBarEntry)
            .map((move) => move.from)
        )
      ),
    [legalMoves]
  );
  const turnGuidance = useMemo(() => {
    if (winner !== null || awaitingModeChoice || remainingDice.length === 0) return null;

    if (bar[currentPlayer] > 0 && legalMoves.some((move) => move.isBarEntry)) {
      return "Bar entry required.";
    }

    if (legalMoves.length === 1) {
      return "Only legal move available.";
    }

    const availableDice = uniqueDice(remainingDice);
    const legalDice = uniqueDice(legalMoves.map((move) => move.die));

    if (availableDice.length > 1 && legalDice.length === 1 && legalDice[0] === availableDice[0]) {
      return `Must use ${legalDice[0]} first.`;
    }

    return null;
  }, [awaitingModeChoice, bar, currentPlayer, legalMoves, remainingDice, winner]);
  const previewSequences = previewMoveKey
    ? legalAnalysis.legalSequences.filter((sequence) => {
        const first = sequence.moves[0];
        return first && moveKey(first) === previewMoveKey;
      })
    : [];

  const displayDice = remainingDice.length > 0 ? remainingDice : openingDice ?? [];
  const cleanWhitePlayerName = normalizePlayerName(whitePlayerName);
  const cleanBlackPlayerName = normalizePlayerName(blackPlayerName);
  const playersReady =
    cleanWhitePlayerName.length > 0 &&
    cleanBlackPlayerName.length > 0 &&
    playerRecordKey(cleanWhitePlayerName) !== playerRecordKey(cleanBlackPlayerName);
  const canEditPlayers = gamePhase === "OPENING_ROLL" && openingDice === null && moveLog.length === 0 && !winner;
  const canChooseDoctrine = gamePhase === "MODE_CHOICE" && awaitingModeChoice && openingDice !== null && openingWinner !== null;
  const canRollOpening = !diceRolling && gamePhase === "OPENING_ROLL" && playersReady;
  const turnIsPlayable = gamePhase === "OPENING_TURN" || gamePhase === "NORMAL_TURN";
  const canSubmitTurn =
    !winner &&
    !diceRolling &&
    turnIsPlayable &&
    !awaitingModeChoice &&
    turnMoveCount > 0 &&
    (remainingDice.length === 0 || legalMoves.length === 0);
  const canResign = !winner && gamePhase !== "OPENING_ROLL" && gamePhase !== "GAME_OVER";
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


  function startTwoPlayerGame(): void {
    setPlaySetupMode("TWO_PLAYERS");
    setWhitePlayerName("White Player");
    setBlackPlayerName("Black Player");
    setComputerStrategy("BALANCED");
    resetNewGame();
    setMessage("Two-player game selected. Enter player names, then roll opening dice.");
  }

  function startComputerGame(strategy: AutoTestStrategy): void {
    const aggressive = strategy === "CONTROLLED_COMEBACK";
    setPlaySetupMode(aggressive ? "COMPUTER_AGGRESSIVE" : "COMPUTER_BALANCED");
    setComputerStrategy(strategy);
    setWhitePlayerName("Human Player");
    setBlackPlayerName(aggressive ? "Computer 2 - Aggressive" : "Computer 1 - Balanced");
    resetNewGame();
    setMessage(`${aggressive ? "Computer 2 - Aggressive" : "Computer 1 - Balanced"} selected. You are White. Roll opening dice.`);
  }

  function backToGameMenu(): void {
    setPlaySetupMode("MENU");
    resetNewGame();
    setMessage("Choose how you want to play.");
  }

  function chooseComputerOpeningMode(): Mode {
    if (computerStrategy === "CONTROLLED_COMEBACK") {
      return Math.random() < 0.65 ? "WAR" : "PEACE";
    }
    return Math.random() < 0.5 ? "WAR" : "PEACE";
  }

  async function animateDiceRoll(): Promise<void> {
    setDiceRolling(true);
    const delay = autoTestRunning ? AUTO_TEST_DICE_DELAY_MS[autoTestSpeed] : 650;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    setDiceRolling(false);
  }

  function triggerMoveAnimation(move: Move): void {
    setAnimatingMoveKey(moveKey(move));
    setTimeout(() => setAnimatingMoveKey(null), 420);
  }

  function flashBanner(text: string, duration = 1300): void {
    setTurnBanner(text);
    setTimeout(() => setTurnBanner(null), duration);
  }

  function soundClick(): void {
    if (soundEnabled) playClickSound();
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

  function saveGame(): void {
    const savedGame: SavedGameState = {
      version: 1,
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

    window.localStorage.setItem(SAVE_KEY, JSON.stringify(savedGame));
    setHasSavedGame(true);
    setConfirmResign(false);
    setMessage("Game saved on this computer.");
    flashBanner("GAME SAVED", 900);
  }

  function isSavedGameState(value: unknown): value is SavedGameState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<SavedGameState>;
    return (
      candidate.version === 1 &&
      Array.isArray(candidate.board) &&
      candidate.board.length === 24 &&
      candidate.bar !== undefined &&
      candidate.off !== undefined &&
      (candidate.currentPlayer === "White" || candidate.currentPlayer === "Black") &&
      (candidate.controller === "White" || candidate.controller === "Black") &&
      (candidate.mode === "WAR" || candidate.mode === "PEACE") &&
      typeof candidate.gamePhase === "string" &&
      Array.isArray(candidate.remainingDice)
    );
  }

  function loadSavedGame(): void {
    const rawSave = window.localStorage.getItem(SAVE_KEY);
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

      setBoard(cloneBoard(parsed.board));
      setBar({ ...parsed.bar });
      setOff({ ...parsed.off });
      setMode(parsed.mode);
      setCurrentPlayer(parsed.currentPlayer);
      setController(parsed.controller);
      setControlState(parsed.controlState);
      setGamePhase(parsed.gamePhase);
      setRemainingDice([...parsed.remainingDice]);
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
      flashBanner("GAME LOADED", 900);
    } catch {
      window.localStorage.removeItem(SAVE_KEY);
      setHasSavedGame(false);
      setMessage("Saved game was damaged and has been cleared.");
      flashWarning("Saved game could not be loaded.");
    }
  }

  function clearSavedGame(): void {
    window.localStorage.removeItem(SAVE_KEY);
    setHasSavedGame(false);
    setConfirmResign(false);
    setMessage("Saved game cleared from this computer.");
  }

  function handleBetaUnlock(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (betaPasswordInput.trim() === BETA_PASSWORD) {
      window.localStorage.setItem(BETA_ACCESS_KEY, "granted");
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
    window.localStorage.removeItem(BETA_ACCESS_KEY);
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
    const result = buildFinalResult(player, reason, finalBoard, finalBar, finalOff);

    setWinner(player);
    setFinalResult(result);
    if (!autoTestRunning) recordCompletedGame(result);
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
      setMessage(`${currentPlayer}, click Confirm Resign to forfeit the game.`);
      return;
    }

    endGame(opponent(currentPlayer), "RESIGNATION", board, bar, off);
  }

  function resetNewGame(): void {
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
    setSelectedPoint(null);
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setShowAnalysis(false);
    setMoveLog([]);
    setTurnMoveCount(0);
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
    await animateDiceRoll();
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
    setOpeningDice([whiteDie, blackDie]);
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
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setHistory([]);
    setMoveLog([]);
    setTurnMoveCount(0);
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
    setOpeningTurnMoveMade(true);
    setOpeningTurnRequiresMove(false);
    setGamePhase("NORMAL_TURN");
    setWinner(null);
    setFinalResult(null);
    setConfirmResign(false);
    setMessage("BEAR-OFF TEST: White should bear off as many as possible.");
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
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setLastMove(null);
    setHistory([]);
    setMoveLog([]);
    setTurnMoveCount(0);
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
    setOpeningTurnMoveMade(true);
    setOpeningTurnRequiresMove(false);
    setGamePhase("NORMAL_TURN");
    setWinner(null);
    setFinalResult(null);
    setConfirmResign(false);
    setMessage("PEACE TEST: no-hit sequence should be preferred if available.");
  }

  function chooseMode(chosenMode: Mode): void {
    if (isComputerController && openingWinner !== "Black") { setMessage("Computer is thinking."); return; }

    if (!awaitingModeChoice || !openingDice || !openingWinner) {
      setMessage("Roll opening dice first, then choose WAR or PEACE.");
      return;
    }

    const openingTurnAnalysis = analyzeLegality(board, openingWinner, openingDice, chosenMode, bar, off, "NORMAL");
    recordGameRoll(openingTurnAnalysis.legalMoves.length > 0);
    recordAutoTestRoll(openingWinner, openingDice, openingTurnAnalysis.legalMoves.length > 0, bar);

    setMode(chosenMode);
    setCurrentPlayer(openingWinner);
    setController(openingWinner);
    setControlState("NORMAL");
    setRemainingDice(openingDice);
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
    await animateDiceRoll();
    if (soundEnabled) playDiceSound();

    const nextPlayer = opponent(currentPlayer);
    let d1 = rollDie();
    let d2 = rollDie();

    // Safety guard: the first playable turn must use the original non-double opening dice.
    // If the first transition somehow reaches a new roll before any move is logged,
    // do not allow that first playable roll to become doubles.
    if (openingDice !== null && moveLog.length === 0) {
      while (d1 === d2) {
        d1 = rollDie();
        d2 = rollDie();
      }
    }

    const rolledDoubles = d1 === d2;
    const dice = rolledDoubles ? [d1, d1, d1, d1] : [d1, d2];
    let nextMode = mode;

    if (rolledDoubles) {
      const switchedMode: Mode = mode === "WAR" ? "PEACE" : "WAR";
      const switchedModeAnalysis = analyzeLegality(board, nextPlayer, dice, switchedMode, bar, off, "NORMAL");

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

    const nextLegalAnalysis = analyzeLegality(board, nextPlayer, dice, nextMode, bar, off, "NORMAL");
    const noLegalMoves = nextLegalAnalysis.legalMoves.length === 0;
    recordGameRoll(!noLegalMoves);
    recordAutoTestRoll(nextPlayer, dice, !noLegalMoves, bar);

    setCurrentPlayer(nextPlayer);
    setGamePhase("NORMAL_TURN");
    setController(nextPlayer);
    setControlState("NORMAL");
    setRemainingDice(dice);
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
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    setBoard(previous.board);
    setRemainingDice(previous.dice);
    setBar(previous.bar);
    setOff(previous.off);
    setController(previous.controller);
    setControlState(previous.controlState);
    setMoveLog(previous.moveLog);
    setTurnMoveCount(previous.turnMoveCount);
    setOpeningTurnMoveMade(!(openingDice !== null && previous.moveLog.length === 0));
    setOpeningTurnRequiresMove(openingDice !== null && previous.moveLog.length === 0);
    setLastMove(previous.lastMove);
    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setMessage("Move undone.");
  }

  function submitTurn(): void {
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
    setHistory((currentHistory) => [
      ...currentHistory,
      {
        board: cloneBoard(board),
        dice: [...remainingDice],
        bar: { ...bar },
        off: { ...off },
        controller,
        controlState,
        moveLog: [...moveLog],
        lastMove,
        turnMoveCount,
      },
    ]);

    const enemyControlMoveBeforeThisMove = autoTestRunning && controlState === "ENEMY_CONTROL";
    const peaceViolationTriggersEnemyControl = mode === "PEACE" && controlState === "NORMAL" && move.isHit;

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

    if (autoTestRunning && peaceViolationTriggersEnemyControl) {
      const beneficiary = opponent(currentPlayer);
      const beneficiaryPips = calculatePipCount(board, beneficiary, bar);
      const violatingPlayerPips = calculatePipCount(board, currentPlayer, bar);
      autoTestGameEnemyControlTriggersRef.current += 1;
      if (beneficiary === "White") autoTestGameWhiteGainedEnemyControlRef.current += 1;
      if (beneficiary === "Black") autoTestGameBlackGainedEnemyControlRef.current += 1;
      if (beneficiaryPips - violatingPlayerPips >= 30) {
        autoTestGameEnemyControlWhileTrailing30Ref.current += 1;
      }
    }

    const result = applyMove(board, move, currentPlayer, bar, off);
    const nextDice = removeDie(remainingDice, move.die);
    let nextControlState = controlState;
    let nextController = controller;

    if (peaceViolationTriggersEnemyControl) {
      nextControlState = "ENEMY_CONTROL";
      nextController = opponent(currentPlayer);
    }

    const nextLegalAnalysis = analyzeLegality(
      result.board,
      currentPlayer,
      nextDice,
      mode,
      result.bar,
      result.off,
      nextControlState
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
      if (peaceViolationTriggersEnemyControl) playPeaceViolationSound();
      else if (move.isHit) playCaptureSound();
      else playClickSound();
    }
    triggerMoveAnimation(move);

    if (peaceViolationTriggersEnemyControl) flashBanner("PEACE VIOLATION - ENEMY CONTROL", 2200);
    else if (move.isHit) flashBanner("POW! CAPTURED", 1300);
    if (move.isBearOff) flashBanner("BEAR OFF");

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
      setMessage(`ENEMY CONTROL: ${nextController} controls the rest of this turn. WAR/PEACE restrictions are suspended.`);
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

  function isOpponentHomePoint(player: Player, pointIndex: number): boolean {
    return player === "White" ? pointIndex >= 18 : pointIndex <= 5;
  }

  function countSingleBlots(testBoard: Point[], player: Player): number {
    return testBoard.filter((point) => point.owner === player && point.count === 1).length;
  }

  function hasOpponentHomeAnchor(testBoard: Point[], player: Player): boolean {
    return testBoard.some((point, index) =>
      point.owner === player && point.count >= 2 && isOpponentHomePoint(player, index)
    );
  }

  function isPlayerEntryZone(player: Player, pointIndex: number): boolean {
    return player === "White" ? pointIndex >= 0 && pointIndex <= 5 : pointIndex >= 18 && pointIndex <= 23;
  }

  function isPlayerHomeBoard(player: Player, pointIndex: number): boolean {
    return player === "White" ? pointIndex >= 18 && pointIndex <= 23 : pointIndex >= 0 && pointIndex <= 5;
  }

  function countOpponentBlotsInEntryZone(testBoard: Point[], player: Player): number {
    const enemy = opponent(player);
    return testBoard.filter((point, index) =>
      isPlayerEntryZone(player, index) && point.owner === enemy && point.count === 1
    ).length;
  }

  function countOpenEntryPoints(testBoard: Point[], player: Player): number {
    const enemy = opponent(player);
    let open = 0;
    for (let die = 1; die <= 6; die += 1) {
      const entry = getEntryPoint(player, die);
      const point = testBoard[entry];
      if (!(point.owner === enemy && point.count >= 2)) open += 1;
    }
    return open;
  }

  function isPointHittableByOpponent(testBoard: Point[], player: Player, pointIndex: number): boolean {
    const enemy = opponent(player);

    for (let die = 1; die <= 6; die += 1) {
      if (getEntryPoint(enemy, die) === pointIndex) return true;

      const from = enemy === "White" ? pointIndex - die : pointIndex + die;
      if (from < 0 || from > 23) continue;
      const point = testBoard[from];
      if (point.owner === enemy && point.count > 0) return true;
    }

    return false;
  }

  function calculateReturnShotPotential(testBoard: Point[], player: Player): number {
    const entryBlots = countOpponentBlotsInEntryZone(testBoard, player);
    const openEntries = countOpenEntryPoints(testBoard, player);
    const closedPenalty = openEntries <= 1 ? -35 : openEntries === 2 ? -18 : 0;

    return entryBlots * 18 + openEntries * 4 + closedPenalty;
  }

  function getOnePointIndex(player: Player): number {
    return player === "White" ? 23 : 0;
  }

  function countCheckersOnOnePoint(testBoard: Point[], player: Player): number {
    const onePoint = testBoard[getOnePointIndex(player)];
    return onePoint.owner === player ? onePoint.count : 0;
  }

  function countDirectShotBlots(testBoard: Point[], player: Player): number {
    return testBoard.reduce((total, point, index) => {
      if (point.owner !== player || point.count !== 1) return total;
      return total + (isPointHittableByOpponent(testBoard, player, index) ? 1 : 0);
    }, 0);
  }

  function isLateBearoffRace(testBoard: Point[], testBar: BarState, testOff: OffState, player: Player): boolean {
    const enemy = opponent(player);
    const playerAllHome = allHome(testBoard, player, testBar);
    const enemyAllHome = allHome(testBoard, enemy, testBar);
    const playerMostlyHomeOrOff = testOff[player] >= 6 || playerAllHome;
    const enemyMostlyHomeOrOff = testOff[enemy] >= 6 || enemyAllHome;

    return (
      playerAllHome ||
      (playerMostlyHomeOrOff && enemyMostlyHomeOrOff) ||
      (testOff[player] + testOff[enemy] >= 12)
    );
  }

  function scoreAutoTestMove(move: Move, strategyOverride: AutoTestStrategy = autoTestStrategy): number {
    const activeStrategy = strategyOverride;
    const beforePips = calculatePipCount(board, currentPlayer, bar);
    const opponentPips = calculatePipCount(board, opponent(currentPlayer), bar);
    const deficit = Math.max(0, beforePips - opponentPips);
    const beforeBlots = countSingleBlots(board, currentPlayer);
    const beforeOnePointCheckers = countCheckersOnOnePoint(board, currentPlayer);
    const beforeDirectShotBlots = countDirectShotBlots(board, currentPlayer);
    const applied = applyMove(board, move, currentPlayer, bar, off);
    const afterPips = calculatePipCount(applied.board, currentPlayer, applied.bar);
    const afterBlots = countSingleBlots(applied.board, currentPlayer);
    const afterOnePointCheckers = countCheckersOnOnePoint(applied.board, currentPlayer);
    const afterDirectShotBlots = countDirectShotBlots(applied.board, currentPlayer);
    const pipGain = beforePips - afterPips;
    const onePointReduction = Math.max(0, beforeOnePointCheckers - afterOnePointCheckers);
    const newDirectShotBlots = Math.max(0, afterDirectShotBlots - beforeDirectShotBlots);
    const lateBearoffRace = isLateBearoffRace(board, bar, off, currentPlayer);
    const playerIsBehind = deficit > 0;
    const landingPoint =
      move.isBearOff || move.to < 0 || move.to > 23 ? null : applied.board[move.to];

    let score = pipGain * 2;

    if (move.isBearOff) score += 80;
    if (move.isBarEntry) score += 45;
    if (move.isHit) score += mode === "WAR" ? 95 : 45;

    // Late bear-off/race correction:
    // A trailing computer must not cling to a safe stack on the 1-point.
    // When behind, speed and clearing the 1-point outrank ordinary blot fear.
    if (lateBearoffRace && playerIsBehind) {
      score += pipGain * 8;
      if (move.isBearOff) score += deficit >= 15 ? 220 : 150;
      score += onePointReduction * (deficit >= 15 ? 160 : 110);
      score -= afterOnePointCheckers * (deficit >= 15 ? 28 : 18);
      score -= newDirectShotBlots * (deficit >= 15 ? 35 : 70);

      if (beforeOnePointCheckers >= 3 && onePointReduction > 0) score += 90;
      if (beforeOnePointCheckers >= 3 && afterOnePointCheckers === 1) score += 65;
      if (deficit >= 25 && move.isBearOff) score += 110;
    }

    if (activeStrategy === "RANDOM_LEGAL") {
      score += Math.random() * 100;
      return score;
    }

    if (mode === "PEACE" && move.isHit) score -= 40;

    const newBlots = Math.max(0, afterBlots - beforeBlots);
    const createsLandingBlot =
      landingPoint !== null &&
      landingPoint.owner === currentPlayer &&
      landingPoint.count === 1;

    if (activeStrategy === "BALANCED") {
      score -= newBlots * 16;
      if (createsLandingBlot && move.to >= 0 && isOpponentHomePoint(currentPlayer, move.to)) score -= 25;
      if (deficit >= 40 && createsLandingBlot && move.to >= 0 && isOpponentHomePoint(currentPlayer, move.to)) score += 18;
    }

    if (activeStrategy === "CONTROLLED_COMEBACK") {
      const landingInMyHome = createsLandingBlot && move.to >= 0 && isPlayerHomeBoard(currentPlayer, move.to);
      const landingInMyEntryZone = createsLandingBlot && move.to >= 0 && isPlayerEntryZone(currentPlayer, move.to);
      const landingCanBeHit = createsLandingBlot && move.to >= 0 && isPointHittableByOpponent(applied.board, currentPlayer, move.to);
      const lateBearingOffPhase =
        off[currentPlayer] >= 5 ||
        off[opponent(currentPlayer)] >= 5 ||
        allHome(board, currentPlayer, bar) ||
        allHome(board, opponent(currentPlayer), bar);
      const currentPipGap = Math.abs(beforePips - opponentPips);
      const runawayRisk = currentPipGap >= 120 || beforePips >= 220 || opponentPips >= 220;
      const hasAnchor = hasOpponentHomeAnchor(board, currentPlayer);
      const openEntryPoints = countOpenEntryPoints(board, currentPlayer);
      const opponentEntryBlots = countOpponentBlotsInEntryZone(board, currentPlayer);
      const returnShotPotential = calculateReturnShotPotential(board, currentPlayer);
      const exposureMayBeBait =
        landingCanBeHit &&
        deficit >= 50 &&
        openEntryPoints >= 3 &&
        (opponentEntryBlots > 0 || returnShotPotential >= 20 || hasAnchor || deficit >= 90);

      // Controlled Comeback is now risk-adjusted, not merely reckless.
      // About one roll in six is a double, so the mode may change soon; a trailing player
      // may accept exposure, but only when being hit can create return-shot/contact value.
      score -= newBlots * (lateBearingOffPhase || runawayRisk ? 26 : 14);
      if (landingInMyHome) score -= lateBearingOffPhase || runawayRisk ? 55 : 18;
      if (landingInMyEntryZone && deficit < 60) score -= 10;

      if (exposureMayBeBait && !lateBearingOffPhase && !runawayRisk) {
        score += Math.min(46, 14 + returnShotPotential);
        if (mode === "WAR") score += 14;
        if (mode === "PEACE" && deficit >= 70) score += 7;
      }

      if (!lateBearingOffPhase && !runawayRisk && deficit >= 40 && createsLandingBlot && mode === "WAR") score += 8;
      if (!lateBearingOffPhase && !runawayRisk && deficit >= 70 && createsLandingBlot && exposureMayBeBait) score += 12;
      if (!lateBearingOffPhase && !runawayRisk && deficit >= 95 && exposureMayBeBait) score += 16;

      if (deficit < 40 && landingCanBeHit) score -= 28;
      if (deficit < 60 && newBlots >= 2) score -= 24;
      if (openEntryPoints <= 2 && landingCanBeHit) score -= 30;
      if (lateBearingOffPhase && !move.isBearOff && createsLandingBlot) score -= 35;
      if (runawayRisk && !move.isBearOff && landingCanBeHit) score -= 38;
      if (runawayRisk && move.isBearOff) score += 35;
    }

    score += Math.random() * 8;
    return score;
  }

  function chooseAutoTestMove(strategyOverride: AutoTestStrategy = autoTestStrategy): Move | null {
    if (legalMoves.length === 0) return null;

    const barEntryMoves = legalMoves.filter((move) => move.isBarEntry);
    const candidateMoves = barEntryMoves.length > 0 ? barEntryMoves : legalMoves;

    let bestMove = candidateMoves[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const move of candidateMoves) {
      const score = scoreAutoTestMove(move, strategyOverride);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
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
      chooseMode(chosenMode);
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
    setAutoTestError(null);
    appendAutoTestLog("Manual auto-test step.");
    runAutoTestStep();
  }

  function beginDrag(index: number, event?: React.PointerEvent<HTMLDivElement>): void {
    if (isComputerController) { setMessage("Computer is thinking."); return; }
    if (awaitingModeChoice || remainingDice.length === 0 || bar[currentPlayer] > 0) return;

    const point = board[index];
    const canDragFromPoint = point.owner === currentPlayer && legalMoves.some((move) => move.from === index);

    if (!canDragFromPoint) return;

    event?.preventDefault();
    event?.currentTarget.setPointerCapture?.(event.pointerId);
    dragCompletionGuard.current = false;
    setDraggingPoint(index);
    setSelectedPoint(index);
    setPreviewMoveKey(null);
    setDragPosition(event ? { x: event.clientX, y: event.clientY } : null);
    setMessage(`Dragging from point ${index + 1}. Release on a highlighted destination.`);
  }

  function finishDragAt(clientX: number, clientY: number): void {
    if (draggingPoint === null || dragCompletionGuard.current) return;
    dragCompletionGuard.current = true;

    const elementUnderPointer = document.elementFromPoint(clientX, clientY);
    const pointElement = elementUnderPointer?.closest("[data-point-index]") as HTMLElement | null;
    const dropIndexText = pointElement?.dataset.pointIndex;
    const dropIndex = dropIndexText === undefined ? null : Number(dropIndexText);

    const move = legalMoves.find((candidate) => {
      if (dropIndex === null || Number.isNaN(dropIndex)) return false;
      if (candidate.isBearOff) return candidate.from === draggingPoint && dropIndex === draggingPoint;
      return candidate.from === draggingPoint && candidate.to === dropIndex;
    });

    const sourcePoint = draggingPoint;
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);

    if (!move) {
      setSelectedPoint(sourcePoint);
      setPreviewMoveKey(null);
      showLegalMoveHelp(sourcePoint);
      setMessage("Not permitted — must make a legal move.");
      return;
    }

    executeMove(move);
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    finishDragAt(event.clientX, event.clientY);
  }

  function cancelDrag(): void {
    if (draggingPoint === null) return;
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
  }

  function updateDragPosition(event: React.PointerEvent<HTMLDivElement>): void {
    if (draggingPoint === null) return;
    event.preventDefault();
    updateDragPositionAt(event.clientX, event.clientY);
  }

  function updateDragPositionAt(clientX: number, clientY: number): void {
    if (draggingPoint === null) return;

    setDragPosition({ x: clientX, y: clientY });

    const elementUnderPointer = document.elementFromPoint(clientX, clientY);
    const pointElement = elementUnderPointer?.closest("[data-point-index]") as HTMLElement | null;
    const hoverIndexText = pointElement?.dataset.pointIndex;
    setHoverPoint(hoverIndexText === undefined ? null : Number(hoverIndexText));
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
  }, [draggingPoint, legalMoves]);

  useEffect(() => {
    if (autoPassTimerRef.current !== null) {
      clearTimeout(autoPassTimerRef.current);
      autoPassTimerRef.current = null;
    }

    const shouldAutoPassNoMoveTurn =
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
  }, [awaitingModeChoice, currentPlayer, diceRolling, legalMoves.length, remainingDice, turnIsPlayable, turnMoveCount, winner, autoTestRunning, autoTestSpeed]);

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
    if (autoTestRunning || autoTestError || diceRolling || draggingPoint !== null) return;
    if (!isComputerController || winner !== null) return;

    const delay = remainingDice.length > 0 && legalMoves.length === 0 && turnMoveCount === 0 ? 1150 : 650;
    const timer = window.setTimeout(() => {
      if (winner || diceRolling) return;

      if (canChooseDoctrine && openingWinner === "Black") {
        const chosenMode = chooseComputerOpeningMode();
        setMessage(`Computer chooses ${chosenMode}.`);
        chooseMode(chosenMode);
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
    if (isComputerController) { setMessage("Computer is thinking."); return; }

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
      const barMove = legalMoves.find((move) => move.isBarEntry && move.to === index);
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
      const hasLegalMoveFromPoint = legalMoves.some((move) => !move.isBarEntry && move.from === index);

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

    const move = legalMoves.find((candidate) => {
      if (candidate.isBearOff) return candidate.from === selectedPoint && index === selectedPoint;
      return candidate.from === selectedPoint && candidate.to === index;
    });

    if (!move) {
      setPreviewMoveKey(null);
      showLegalMoveHelp(selectedPoint);
      setMessage("Not permitted — must make a legal move.");
      return;
    }

    executeMove(move);
  }

  function handleBearOffTrayClick(player: Player): void {
    if (player !== currentPlayer || remainingDice.length === 0 || awaitingModeChoice || winner !== null) return;

    const bearOffMove = selectedPoint === null
      ? null
      : legalMoves.find((move) => move.isBearOff && move.from === selectedPoint);

    if (!bearOffMove) {
      showLegalMoveHelp(selectedPoint);
      setMessage("Select a highlighted checker that can bear off.");
      return;
    }

    executeMove(bearOffMove);
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

  function renderDie(value: number, index: number) {
    const dieOwner = getDieOwnerForDisplay(value, index);

    const dotPositions: Record<number, string[]> = {
      1: ["center"],
      2: ["top-left", "bottom-right"],
      3: ["top-left", "center", "bottom-right"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: ["top-left", "top-right", "mid-left", "mid-right", "bottom-left", "bottom-right"],
    };

    const positions: Record<string, React.CSSProperties> = {
      "top-left": { top: 7, left: 7 },
      "top-right": { top: 7, right: 7 },
      "mid-left": { top: 18, left: 7 },
      "mid-right": { top: 18, right: 7 },
      center: { top: 18, left: 18 },
      "bottom-left": { bottom: 7, left: 7 },
      "bottom-right": { bottom: 7, right: 7 },
    };

    return (
      <div
        key={index}
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          background:
            dieOwner === "Black"
              ? "linear-gradient(145deg, #343434, #050505 72%, #000)"
              : "linear-gradient(145deg, #fff9df, #d0bd8d)",
          border:
            dieOwner === "Black"
              ? "2px solid #111"
              : "2px solid #ead9a8",
          boxShadow:
            dieOwner === "Black"
              ? "inset -5px -5px 9px rgba(0,0,0,0.5), inset 4px 4px 7px rgba(255,255,255,0.16), 0 4px 10px rgba(0,0,0,0.5)"
              : "inset -5px -5px 9px rgba(0,0,0,0.24), inset 4px 4px 7px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,0,0.5)",
          position: "relative",
          marginRight: 10,
        }}
      >
        {dotPositions[value].map((position, dotIndex) => (
          <div
            key={dotIndex}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background:
                dieOwner === "Black"
                  ? "#f7f1df"
                  : "#111",
              position: "absolute",
              ...positions[position],
            }}
          />
        ))}
      </div>
    );
  }

  function moveDestinationColor(point: Point, player: Player): string {
    if (point.owner !== null && point.owner !== player && point.count === 1) {
      return "radial-gradient(circle, #ff5a4d 0%, #7a0000 75%)";
    }

    return "radial-gradient(circle, #7de2ff 0%, #006d9c 75%)";
  }

  function renderCheckers(
    owner: Player,
    count: number,
    wasLastMoveFrom: boolean,
    wasLastMoveTo: boolean,
    isPreviewDestination: boolean,
    hideTopChecker = false
  ) {
    const visibleCount = hideTopChecker ? Math.max(0, Math.min(count, 5) - 1) : Math.min(count, 5);

    return Array.from({ length: visibleCount }).map((_, index) => {
      const checkerStyle: React.CSSProperties = {
        width: "clamp(36px, 3vw, 46px)",
        height: "clamp(36px, 3vw, 46px)",
        borderRadius: "50%",
        background:
          owner === "White"
            ? "radial-gradient(circle at 32% 24%, #ffffff 0%, #f8eed7 30%, #c8b081 58%, #7e6b4a 82%, #3b3020 100%)"
            : "radial-gradient(circle at 32% 24%, #7f7f7f 0%, #2f2f2f 34%, #0b0b0b 72%, #000 100%)",
        border: owner === "White" ? "2px solid #f6e6bd" : "2px solid #050505",
        marginTop: "clamp(-13px, -0.8vw, -8px)",
        zIndex: 10 + index,
        boxShadow:
          "0 9px 13px rgba(0,0,0,0.55)" +
          (wasLastMoveTo
            ? ", 0 0 22px rgba(0,255,120,0.9)"
            : wasLastMoveFrom
            ? ", 0 0 18px rgba(255,210,0,0.7)"
            : ""),
        transition: "transform 0.18s ease, box-shadow 0.22s ease",
        transform: wasLastMoveTo
          ? "translateY(-4px) scale(1.1)"
          : isPreviewDestination
          ? "scale(1.05)"
          : animatingMoveKey
          ? "scale(1.02)"
          : "scale(1)",
      };

      return <div key={index} style={checkerStyle} />;
    });
  }

  function renderPoint(index: number, isTop: boolean) {
    const point = board[index];
    const isSelected = selectedPoint === index;
    const isDraggingOrigin = draggingPoint === index;
    const isDragHover = hoverPoint === index;
    const legalOrigins = legalOriginPoints;
    const isLegalOrigin = selectedPoint === null && legalOrigins.includes(index);
    const activeSource = draggingPoint ?? selectedPoint ?? assistSourcePoint;
    const legalDestinations =
      bar[currentPlayer] > 0
        ? legalMoves.filter((move) => move.isBarEntry).map((move) => move.to)
        : activeSource !== null
        ? legalMoves
            .filter((move) => move.from === activeSource)
            .map((move) => (move.isBearOff ? activeSource : move.to))
        : legalHelpActive
        ? legalMoves.map((move) => (move.isBearOff ? move.from : move.to))
        : [];

    const isLegalDestination = legalDestinations.includes(index);
    const legalDestinationMove = legalMoves.find((move) => {
      if (bar[currentPlayer] > 0) return move.isBarEntry && move.to === index;
      if (activeSource !== null) {
        if (move.isBearOff) return move.from === activeSource && index === activeSource;
        return move.from === activeSource && move.to === index;
      }
      if (!legalHelpActive) return false;
      if (move.isBearOff) return move.from === index;
      return move.to === index;
    });
    const isBearOffDestination = !!legalDestinationMove?.isBearOff;
    const triangleColor =
      index % 2 === 0
        ? "linear-gradient(180deg, #ead7a1 0%, #c9a05b 56%, #7b5a24 100%)"
        : "linear-gradient(180deg, #8f3d1f 0%, #b65425 48%, #4d1d0b 100%)";

    const previewedMoves = previewMoveKey ? legalMoves.filter((move) => moveKey(move) === previewMoveKey) : [];
    const isPreviewOrigin = previewedMoves.some((move) => move.from === index);
    const isPreviewDestination = previewedMoves.some((move) => (move.isBearOff ? move.from : move.to) === index);
    const wasLastMoveFrom = lastMove?.from === index;
    const wasLastMoveTo = !!lastMove && !lastMove.isBearOff && lastMove.to === index;

    return (
      <div
        key={index}
        data-point-index={index}
        onClick={() => handlePointClick(index)}
        onPointerDown={(event) => beginDrag(index, event)}
        onPointerEnter={() => setHoverPoint(index)}
        onPointerLeave={() => setHoverPoint(null)}
        onPointerUp={(event) => finishDrag(event)}
        onPointerMove={updateDragPosition}
        onPointerCancel={cancelDrag}
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(220px, 30vh, 340px)",
          cursor: isDraggingOrigin ? "grabbing" : isLegalOrigin || isLegalDestination || isSelected ? "grab" : "pointer",
          touchAction: "none",
          userSelect: "none",
          display: "flex",
          flexDirection: isTop ? "column" : "column-reverse",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "100%",
            maxWidth: "clamp(44px, 4.1vw, 58px)",
            height: "clamp(180px, 24vh, 286px)",
            top: isTop ? 0 : undefined,
            bottom: isTop ? undefined : 0,
            background: triangleColor,
            clipPath: isTop ? "polygon(0 0, 100% 0, 50% 100%)" : "polygon(50% 0, 0 100%, 100% 100%)",
            outline: "none",
            filter:
              isSelected || isDraggingOrigin || isDragHover || isLegalOrigin || isLegalDestination || isPreviewOrigin || isPreviewDestination
                ? "brightness(1.22) saturate(1.14)"
                : "none",
            boxShadow: isDraggingOrigin
              ? "0 0 0 4px rgba(255,255,255,0.95), 0 0 28px rgba(255,255,255,0.65)"
              : isDragHover && isLegalDestination
              ? "0 0 0 5px rgba(0,255,180,1), 0 0 30px rgba(0,255,180,0.85)"
              : isSelected
              ? "0 0 0 4px rgba(76,255,76,0.98), 0 0 24px rgba(76,255,76,0.75)"
              : isLegalDestination
              ? legalHelpActive
                ? "0 0 0 6px rgba(0,255,200,1), 0 0 34px rgba(0,220,255,0.95)"
                : "0 0 0 4px rgba(0,200,255,0.98), 0 0 24px rgba(0,200,255,0.75)"
              : isLegalOrigin
              ? legalHelpActive
                ? "0 0 0 5px rgba(255,235,80,1), 0 0 30px rgba(255,215,0,0.9)"
                : "0 0 0 3px rgba(255,215,0,0.95), 0 0 20px rgba(255,215,0,0.7)"
              : isPreviewOrigin
              ? "0 0 0 3px rgba(255,210,0,0.95), 0 0 18px rgba(255,210,0,0.65)"
              : isPreviewDestination
              ? "0 0 0 3px rgba(0,200,255,0.95), 0 0 18px rgba(0,200,255,0.65)"
              : "none",
            transition: "filter 0.18s ease, box-shadow 0.18s ease",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 20,
            display: "flex",
            flexDirection: isTop ? "column" : "column-reverse",
            alignItems: "center",
            marginTop: isTop ? 8 : 0,
            marginBottom: isTop ? 0 : 8,
          }}
        >
          {isLegalDestination && (activeSource !== null || legalHelpActive) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                marginBottom: isTop ? 0 : 4,
                marginTop: isTop ? 4 : 0,
              }}
            >
              <div
                style={{
                  width: "clamp(22px, 2.2vw, 32px)",
                  height: "clamp(22px, 2.2vw, 32px)",
                  borderRadius: "50%",
                  background: isBearOffDestination ? "radial-gradient(circle, #ffe98a 0%, #b56a00 75%)" : moveDestinationColor(point, currentPlayer),
                  border: "3px solid rgba(255,255,255,0.92)",
                  boxShadow: legalHelpActive ? "0 0 24px rgba(0,255,200,1)" : "0 0 18px rgba(0,200,255,0.95)",
                }}
              />
              {isBearOffDestination && (
                <div
                  style={{
                    background: "rgba(20,8,0,0.86)",
                    color: "#ffe28a",
                    border: "1px solid rgba(255,226,138,0.72)",
                    borderRadius: 999,
                    padding: "2px 5px",
                    fontSize: "clamp(8px, 0.75vw, 10px)",
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  OFF
                </div>
              )}
            </div>
          )}
          {point.owner &&
            renderCheckers(
              point.owner,
              point.count,
              !!wasLastMoveFrom,
              !!wasLastMoveTo,
              isPreviewDestination || isLegalDestination || isDraggingOrigin,
              isDraggingOrigin
            )}
          {point.count > 5 && (
            <div
              style={{
                background: "white",
                color: "black",
                padding: "2px 6px",
                borderRadius: 16,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              +{point.count - 5}
            </div>
          )}
        </div>
      </div>
    );
  }

  function PipPanel({ label, value, light }: { label: string; value: number; light?: boolean }) {
    const shortLabel = label.includes("WHITE") ? "WHITE" : "BLACK";

    return (
      <div
        style={{
          background: light
            ? "linear-gradient(145deg, #fff4ca, #c99137 58%, #6f3d09)"
            : "linear-gradient(145deg, #251811, #050302 70%, #000)",
          color: light ? "#16100a" : "#f6d58b",
          border: "3px solid #b47a2a",
          borderRadius: 14,
          padding: "7px 12px",
          minWidth: 112,
          minHeight: 58,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 1px 0 rgba(255,230,170,0.32), 0 7px 16px rgba(0,0,0,0.42)",
        }}
      >
        <div style={{ fontSize: "clamp(13px, 1.15vw, 16px)", fontWeight: 900, letterSpacing: 1.2 }}>{shortLabel}</div>
        <div style={{ fontSize: "clamp(26px, 2.45vw, 34px)", fontWeight: 900, lineHeight: 1 }}>{value}</div>
      </div>
    );
  }

  function CombinedPipPanel() {
    return (
      <div
        style={{
          background: "linear-gradient(145deg, #2b1a10, #050302 72%, #000)",
          color: "#f6d58b",
          border: "3px solid #b47a2a",
          borderRadius: 16,
          padding: "7px 12px",
          minWidth: 220,
          minHeight: 58,
          textAlign: "center",
          display: "grid",
          gridTemplateColumns: "1fr 1px 1fr",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 1px 0 rgba(255,230,170,0.32), 0 7px 16px rgba(0,0,0,0.42)",
        }}
      >
        <div>
          <div style={{ fontSize: "clamp(14px, 1.2vw, 17px)", fontWeight: 900, letterSpacing: 1.4 }}>WHITE</div>
          <div style={{ fontSize: "clamp(26px, 2.35vw, 34px)", fontWeight: 900, lineHeight: 1 }}>{whitePipCount}</div>
        </div>

        <div
          style={{
            width: 1,
            height: "80%",
            background: "linear-gradient(180deg, transparent, #d6a847, transparent)",
          }}
        />

        <div>
          <div style={{ fontSize: "clamp(14px, 1.2vw, 17px)", fontWeight: 900, letterSpacing: 1.4 }}>BLACK</div>
          <div style={{ fontSize: "clamp(26px, 2.35vw, 34px)", fontWeight: 900, lineHeight: 1 }}>{blackPipCount}</div>
        </div>
      </div>
    );
  }

  function GameFlowPanel() {
    return (
      <div
        style={{
          background: "linear-gradient(145deg, #21140c, #050302 72%, #000)",
          color: "#f6d58b",
          border: "2px solid rgba(180,122,42,0.9)",
          borderRadius: 16,
          padding: "6px 10px",
          minHeight: 46,
          textAlign: "center",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 5,
          alignItems: "center",
          boxShadow: "inset 0 1px 0 rgba(255,230,170,0.22), 0 7px 16px rgba(0,0,0,0.32)",
        }}
      >
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9 }}>ROLLS</div>
          <div style={{ fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 900 }}>{gameRolls}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9 }}>PLAYABLE</div>
          <div style={{ fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 900 }}>{gamePlayableRolls}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9 }}>PASSES</div>
          <div style={{ fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 900 }}>{gameUnplayableRolls}</div>
        </div>
      </div>
    );
  }


  function TrayCheckers({ player, count }: { player: Player; count: number }) {
    const checkerStyle = (index: number): React.CSSProperties => ({
      width: "clamp(22px, 2vw, 28px)",
      height: "clamp(22px, 2vw, 28px)",
      borderRadius: "50%",
      marginTop: index === 0 ? 0 : -7,
      background:
        player === "White"
          ? "radial-gradient(circle at 32% 24%, #ffffff 0%, #f8eed7 35%, #8a744a 100%)"
          : "radial-gradient(circle at 32% 24%, #777 0%, #222 45%, #000 100%)",
      border: player === "White" ? "2px solid #f6e6bd" : "2px solid #050505",
      boxShadow: "0 7px 10px rgba(0,0,0,0.55)",
      zIndex: 20 + index,
    });

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 58,
        }}
      >
        {Array.from({ length: Math.min(count, 5) }).map((_, index) => (
          <div key={index} style={checkerStyle(index)} />
        ))}
        {count > 5 && (
          <div style={{ marginTop: 4, color: "#f3d18b", fontSize: 12, fontWeight: 900 }}>
            +{count - 5}
          </div>
        )}
      </div>
    );
  }

  function SideTray({ player }: { player: Player }) {
    const canBearOffForPlayer = player === currentPlayer && legalMoves.some((move) => move.isBearOff);

    return (
      <div
        onClick={() => handleBearOffTrayClick(player)}
        style={{
          width: "clamp(58px, 4.6vw, 68px)",
          minWidth: 58,
          borderRadius: 18,
          background: "linear-gradient(145deg, #5b3219, #1a0904)",
          border: "3px solid #7c461f",
          boxShadow: canBearOffForPlayer
            ? "inset 0 0 24px rgba(0,0,0,0.72), 0 0 0 5px rgba(255,226,138,0.95), 0 0 28px rgba(255,190,60,0.9)"
            : "inset 0 0 24px rgba(0,0,0,0.72), 0 8px 18px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#f3d18b",
          fontWeight: 900,
          textAlign: "center",
          overflow: "hidden",
          padding: "8px 4px",
          cursor: canBearOffForPlayer ? "pointer" : "default",
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          transform: canBearOffForPlayer ? "scale(1.02)" : "scale(1)",
        }}
      >
        <div style={{ fontSize: 12 }}>{player.toUpperCase()}</div>
        <div style={{ fontSize: 12, marginBottom: 5 }}>OFF</div>
        <TrayCheckers player={player} count={off[player]} />
        <div style={{ fontSize: 30, marginTop: 6, lineHeight: 1, color: "#ffd77f" }}>{off[player]}</div>
      </div>
    );
  }

  function CenterHinge({ section }: { section: "top" | "bottom" }) {
    const player: Player = section === "top" ? "White" : "Black";
    const count = bar[player];

    return (
      <div
        aria-label={`${section === "top" ? "White" : "Black"} hit-checker bar`}
        style={{
          width: "clamp(38px, 3vw, 48px)",
          minWidth: 38,
          background: "linear-gradient(90deg, #120804, #7a481f 35%, #b27937 50%, #7a481f 65%, #120804)",
          borderLeft: "2px solid rgba(255,210,120,0.25)",
          borderRight: "2px solid rgba(0,0,0,0.65)",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.78), 0 0 8px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: section === "top" ? "flex-end" : "flex-start",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: 4,
          paddingTop: section === "bottom" ? 8 : 0,
          paddingBottom: section === "top" ? 8 : 0,
        }}
      >
        <TrayCheckers player={player} count={count} />
      </div>
    );
  }

  function PointQuadrant({ points, isTop }: { points: number[]; isTop: boolean }) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 0,
          minWidth: 0,
          width: "100%",
        }}
      >
        {points.map((index) => renderPoint(index, isTop))}
      </div>
    );
  }

  const topLeftRow = [12, 13, 14, 15, 16, 17];
  const topRightRow = [18, 19, 20, 21, 22, 23];
  const bottomLeftRow = [11, 10, 9, 8, 7, 6];
  const bottomRightRow = [5, 4, 3, 2, 1, 0];

  const modeIsWar = mode === "WAR";
  const enemyControl = controlState === "ENEMY_CONTROL";
  const neutralModeState = awaitingModeChoice || (!openingDice && remainingDice.length === 0 && moveLog.length === 0);
  const shellWidth = "min(98vw, 1220px)";

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

  return (
    <div
      onDragStart={(event) => event.preventDefault()}
      style={{
        background: "radial-gradient(circle at 50% 0%, #3a1d0d 0%, #120704 48%, #020100 100%)",
        minHeight: "100vh",
        color: "white",
        padding: "clamp(4px, 0.7vw, 10px)",
        fontFamily: "Georgia, 'Times New Roman', serif",
        overflowX: "hidden",
        maxWidth: "100vw",
      }}
    >
      <style>{`
        * {
          user-select: none;
          -webkit-user-select: none;
          -webkit-user-drag: none;
        }

        button {
          user-select: none;
          -webkit-user-select: none;
        }

        [data-point-index] {
          user-select: none;
          -webkit-user-select: none;
          -webkit-user-drag: none;
        }
        @keyframes diceShake {
          0% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-8deg) scale(1.08); }
          40% { transform: rotate(8deg) scale(1.12); }
          60% { transform: rotate(-6deg) scale(1.08); }
          80% { transform: rotate(4deg) scale(1.03); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes cinematicFade {
          0% { opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes winSpectacle {
          0% { opacity: 0; transform: scale(0.72) rotate(-2deg); }
          14% { opacity: 1; transform: scale(1.06) rotate(1deg); }
          28% { transform: scale(1) rotate(0deg); }
          82% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.18); }
        }
        @keyframes sparkleFall {
          0% { opacity: 0; transform: translateY(-20px) scale(0.2) rotate(0deg); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translateY(120px) scale(1) rotate(180deg); }
        }
        @keyframes doublesSuck {
          0% { opacity: 0; transform: translateY(0) scale(0.82); }
          14% { opacity: 1; transform: translateY(0) scale(1); }
          64% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-34vh) translateX(-30vw) scale(0.18); }
        }
        @keyframes warPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        @keyframes peaceGlow {
          0% { box-shadow: 0 0 0 rgba(80,180,255,0); }
          50% { box-shadow: 0 0 28px rgba(80,180,255,0.65); }
          100% { box-shadow: 0 0 0 rgba(80,180,255,0); }
        }
        @keyframes enemyFlash {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
          100% { filter: brightness(1); }
        }
        @keyframes neutralGlow {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.14); }
          100% { filter: brightness(1); }
        }
        @keyframes warningFade {
          0% { opacity: 0; transform: translateY(-10px) scale(0.98); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          82% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.99); }
        }
        @keyframes capturePop {
          0% { opacity: 0; transform: scale(0.45) rotate(-8deg); filter: blur(3px); }
          18% { opacity: 1; transform: scale(1.16) rotate(3deg); filter: blur(0); }
          42% { opacity: 1; transform: scale(0.98) rotate(0); }
          82% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.08) translateY(-18px); }
        }
        @keyframes peaceViolationBlast {
          0% { opacity: 0; transform: scale(0.72); filter: saturate(1.8) blur(2px); }
          12% { opacity: 1; transform: scale(1.08); filter: saturate(1.5) blur(0); }
          28% { transform: scale(0.98); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05) translateY(-26px); }
        }
        @keyframes dragPulse {
          0% { filter: brightness(1); }
          100% { filter: brightness(1.2); }
        }
      `}</style>

      {draggingPoint !== null && dragPosition && board[draggingPoint]?.owner && (
        <div
          style={{
            position: "fixed",
            left: dragPosition.x,
            top: dragPosition.y,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
          }}
        >
          <div
            style={{
              width: "clamp(44px, 4.2vw, 58px)",
              height: "clamp(44px, 4.2vw, 58px)",
              borderRadius: "50%",
              transform: "scale(1.12)",
              background:
                board[draggingPoint].owner === "White"
                  ? "radial-gradient(circle at 32% 24%, #ffffff 0%, #f8eed7 30%, #c8b081 58%, #7e6b4a 82%, #3b3020 100%)"
                  : "radial-gradient(circle at 32% 24%, #7f7f7f 0%, #2f2f2f 34%, #0b0b0b 72%, #000 100%)",
              border: board[draggingPoint].owner === "White" ? "3px solid #fff0c8" : "3px solid #050505",
              boxShadow: "0 20px 32px rgba(0,0,0,0.78), 0 0 0 5px rgba(255,230,150,0.48), 0 0 30px rgba(255,210,80,0.52)",
              animation: "dragPulse 0.75s ease-in-out infinite alternate",
            }}
          />
          <div
            style={{
              background: "rgba(10, 4, 0, 0.88)",
              color: "#ffeab0",
              border: "1px solid rgba(255, 220, 130, 0.85)",
              borderRadius: 999,
              padding: "4px 9px",
              fontSize: "clamp(10px, 0.9vw, 13px)",
              fontWeight: 900,
              boxShadow: "0 8px 14px rgba(0,0,0,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            Release on glow
          </div>
        </div>
      )}

      {warningMessage && (
        <div
          style={{
            position: "fixed",
            top: "clamp(12px, 2.2vw, 28px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            pointerEvents: "none",
            background: "linear-gradient(145deg, #5b0000, #d71919 58%, #ff6b35)",
            color: "white",
            border: "3px solid #ffd18a",
            borderRadius: 18,
            boxShadow: "0 14px 34px rgba(0,0,0,0.58), 0 0 22px rgba(255,74,44,0.58)",
            padding: "clamp(10px, 1.4vw, 14px) clamp(16px, 2.4vw, 28px)",
            fontSize: "clamp(16px, 1.9vw, 24px)",
            fontWeight: 900,
            letterSpacing: 0.3,
            textAlign: "center",
            animation: "warningFade 1.8s ease forwards",
          }}
        >
          {warningMessage}
        </div>
      )}

      {turnBanner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            pointerEvents: "none",
            animation: turnBanner.startsWith("DOUBLES - ")
              ? "doublesSuck 3s cubic-bezier(.18,.82,.24,1) forwards"
              : turnBanner.startsWith("PEACE VIOLATION")
              ? "peaceViolationBlast 2.2s ease forwards"
              : turnBanner.startsWith("POW!")
              ? "capturePop 1.3s ease forwards"
              : turnBanner.includes("WINS")
              ? "winSpectacle 3s ease forwards"
              : "cinematicFade 1.3s ease forwards",
          }}
        >
          <div
            style={{
              padding: "24px 38px",
              borderRadius: 22,
              background: turnBanner.startsWith("PEACE VIOLATION")
                ? "linear-gradient(135deg,#003a8c 0%,#1b75ff 38%,#ffe66d 50%,#ff4a1c 62%,#6a0000 100%)"
                : turnBanner.startsWith("POW!")
                ? "radial-gradient(circle at 50% 35%,#fff7b8 0%,#ffb11f 28%,#b13c00 56%,#330800 100%)"
                : turnBanner.includes("WAR")
                ? "linear-gradient(145deg,#620000,#e51b1b)"
                : turnBanner.includes("PEACE")
                ? "linear-gradient(145deg,#003a8c,#2298e6)"
                : turnBanner.includes("WINS")
                ? "linear-gradient(135deg,#fff7c7 0%,#f4cf5e 22%,#b87816 48%,#fff0a8 66%,#6e3f08 100%)"
                : "linear-gradient(145deg,#1b1207,#7b5524,#d4a14d)",
              color: "white",
              fontSize: turnBanner.startsWith("PEACE VIOLATION")
                ? "clamp(26px,4.6vw,58px)"
                : turnBanner.startsWith("POW!")
                ? "clamp(34px,6vw,78px)"
                : turnBanner.includes("DOUBLES")
                ? "clamp(17px,2.6vw,32px)"
                : turnBanner.includes("WINS OPENING ROLL")
                ? "clamp(20px,3vw,36px)"
                : "clamp(30px,5vw,68px)",
              fontWeight: 900,
              letterSpacing: 2,
              boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
              textShadow: "0 3px 12px rgba(0,0,0,0.6)",
            }}
          >
            {turnBanner.startsWith("PEACE VIOLATION") ? (
              <div style={{ position: "relative", minWidth: "clamp(280px, 44vw, 650px)", textAlign: "center", padding: "10px 18px" }}>
                <div style={{ fontSize: "0.42em", letterSpacing: 3, color: "#d8f0ff", marginBottom: 2 }}>PEACE VIOLATION</div>
                <div style={{ lineHeight: 0.95, textShadow: "0 0 18px rgba(255,238,120,0.9), 0 4px 10px rgba(0,0,0,0.75)" }}>ENEMY CONTROL</div>
                <div style={{ fontSize: "0.3em", marginTop: 8, letterSpacing: 1.6, color: "#fff0aa" }}>Opponent controls the remaining moves</div>
              </div>
            ) : turnBanner.startsWith("POW!") ? (
              <div style={{ position: "relative", minWidth: "clamp(230px, 34vw, 520px)", textAlign: "center", padding: "4px 14px" }}>
                <div style={{ fontSize: "1.05em", lineHeight: 0.9, textShadow: "0 0 20px rgba(255,244,120,0.95), 0 5px 12px rgba(0,0,0,0.8)" }}>POW!</div>
                <div style={{ fontSize: "0.38em", letterSpacing: 3, marginTop: 8 }}>CAPTURED</div>
              </div>
            ) : turnBanner.includes("WINS") ? (
              <div style={{ position: "relative", minWidth: "clamp(240px, 36vw, 520px)", textAlign: "center", padding: "8px 16px" }}>
                {Array.from({ length: 18 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      position: "absolute",
                      left: `${8 + ((index * 37) % 84)}%`,
                      top: `${-24 + ((index * 19) % 22)}px`,
                      fontSize: index % 3 === 0 ? "0.62em" : "0.42em",
                      animation: `sparkleFall ${1.1 + (index % 5) * 0.18}s ease-in ${index * 0.035}s infinite`,
                      color: index % 2 === 0 ? "#fff6b0" : "#ffffff",
                    }}
                  >
                    ✦
                  </span>
                ))}
                <div style={{ fontSize: "0.38em", letterSpacing: 3, marginBottom: 4 }}>VICTORY</div>
                <div>{turnBanner}</div>
              </div>
            ) : turnBanner.startsWith("DOUBLES - ") ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 }}>
                <span style={{ fontSize: "0.5em", letterSpacing: 1 }}>DOUBLES</span>
                <span>{turnBanner.replace("DOUBLES - ", "")}</span>
              </div>
            ) : (
              turnBanner
            )}
          </div>
        </div>
      )}

      {playSetupMode === "MENU" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            background: "radial-gradient(circle at 50% 18%, rgba(70,35,12,0.97), rgba(8,3,1,0.98) 58%, rgba(0,0,0,0.99))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(92vw, 760px)",
              borderRadius: 26,
              padding: "clamp(20px, 3vw, 34px)",
              background: "linear-gradient(145deg, rgba(255,235,180,0.18), rgba(20,8,2,0.96))",
              border: "3px solid rgba(255,213,128,0.75)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,235,180,0.22)",
              color: "#ffe6ad",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "clamp(30px, 5vw, 58px)", fontWeight: 900, color: "#f0cf8a", textShadow: "0 5px 18px rgba(0,0,0,0.8)", marginBottom: 8 }}>
              War & Peace Backgammon
            </div>
            <div style={{ fontSize: "clamp(14px, 1.5vw, 19px)", fontWeight: 800, color: "#fff2c8", marginBottom: 22, lineHeight: 1.35 }}>
              Choose a game type. You can still open developer testing tools at the bottom in the testing version.
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <button type="button" style={{ ...luxuryButton, fontSize: "clamp(18px, 2vw, 25px)", padding: "16px 20px", background: "linear-gradient(145deg,#fff0b8,#b87321 62%,#3b1605)", color: "#1a0900" }} onClick={() => startComputerGame("BALANCED")}>
                Play Computer 1 - Balanced
              </button>
              <div style={{ color: "rgba(255,231,183,0.74)", fontSize: 13, fontWeight: 800, marginTop: -6 }}>Solid, careful, normal computer opponent.</div>

              <button type="button" style={{ ...luxuryButton, fontSize: "clamp(18px, 2vw, 25px)", padding: "16px 20px", background: "linear-gradient(145deg,#ffd6b0,#b73221 58%,#2d0500)", color: "#210400" }} onClick={() => startComputerGame("CONTROLLED_COMEBACK")}>
                Play Computer 2 - Aggressive
              </button>
              <div style={{ color: "rgba(255,231,183,0.74)", fontSize: 13, fontWeight: 800, marginTop: -6 }}>Riskier War & Peace specialist. Looks for comeback chances when behind.</div>

              <button type="button" style={{ ...luxuryButton, fontSize: "clamp(18px, 2vw, 25px)", padding: "16px 20px" }} onClick={startTwoPlayerGame}>
                Two Players
              </button>
              <div style={{ color: "rgba(255,231,183,0.74)", fontSize: 13, fontWeight: 800, marginTop: -6 }}>Two people on the same computer or screen.</div>
            </div>
          </div>
        </div>
      )}

      <h1
        style={{
          width: shellWidth,
          margin: "0 auto clamp(3px, 0.45vw, 6px)",
          fontSize: "clamp(20px, 2vw, 30px)",
          letterSpacing: 0.4,
          textShadow: "0 3px 8px rgba(0,0,0,0.7)",
          color: "#f0cf8a",
        }}
      >
        War & Peace Backgammon
      </h1>

      {setupComplete && (
        <div style={{ width: shellWidth, margin: "0 auto 4px", display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ color: "#ffe6ad", fontSize: "clamp(12px, 1.1vw, 15px)", fontWeight: 900, padding: "8px 12px", border: "1px solid rgba(255,213,128,0.45)", borderRadius: 999, background: "rgba(0,0,0,0.28)" }}>
            {playSetupMode === "TWO_PLAYERS" ? "Two Players" : playSetupMode === "COMPUTER_AGGRESSIVE" ? "Human vs Computer 2 - Aggressive" : "Human vs Computer 1 - Balanced"}
          </div>
          <button type="button" style={{ ...luxuryButton, minWidth: 142, padding: "8px 12px" }} onClick={backToGameMenu}>
            Change Game Type
          </button>
        </div>
      )}

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(4px, 0.5vw, 7px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 6,
          alignItems: "stretch",
        }}
      >
        {([
          ["White", whitePlayerName, setWhitePlayerName, whiteRecord] as const,
          ["Black", blackPlayerName, setBlackPlayerName, blackRecord] as const,
        ]).map(([color, value, setter, stats]) => (
          <div
            key={color}
            style={{
              background: "linear-gradient(145deg, rgba(255,238,190,0.16), rgba(20,8,2,0.86))",
              border: "2px solid rgba(226,171,87,0.55)",
              borderRadius: 13,
              padding: "5px 8px",
              boxShadow: "inset 0 1px 0 rgba(255,230,170,0.16), 0 8px 18px rgba(0,0,0,0.34)",
            }}
          >
            <label
              style={{
                display: "block",
                color: color === "White" ? "#fff2c8" : "#d7d7d7",
                fontSize: "clamp(11px, 1vw, 13px)",
                fontWeight: 900,
                letterSpacing: 0.7,
                marginBottom: 3,
              }}
            >
              {color} Player
            </label>
            <input
              value={value}
              onChange={(event) => setter(event.target.value)}
              disabled={!canEditPlayers || (isComputerGame && color === "Black")}
              list="war-peace-known-players"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 12,
                border: "2px solid rgba(255,226,138,0.68)",
                background: canEditPlayers && !(isComputerGame && color === "Black") ? "#fff8df" : "rgba(255,248,223,0.72)",
                color: "#1b0b03",
                padding: "5px 8px",
                fontSize: "clamp(12px, 1.1vw, 16px)",
                fontWeight: 900,
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            />
            <div
              style={{
                marginTop: 3,
                color: "#f3d18b",
                fontSize: "clamp(10px, 0.85vw, 12px)",
                fontWeight: 800,
              }}
            >
              {stats
                ? `${stats.wins}-${stats.losses} • ${formatWinRate(stats.wins, stats.games)} wins • avg margin ${averagePips(stats.totalLoserPipsWhenWon, stats.wins)} pips`
                : "No prior games recorded."}
            </div>
          </div>
        ))}
        <datalist id="war-peace-known-players">
          {knownPlayers.map((player) => (
            <option key={player.name} value={player.name} />
          ))}
        </datalist>
      </div>

      {!playersReady && gamePhase === "OPENING_ROLL" && (
        <div
          style={{
            width: shellWidth,
            margin: "0 auto clamp(7px, 0.8vw, 10px)",
            color: "#fff2bc",
            fontSize: "clamp(13px, 1.2vw, 15px)",
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          Enter two different player names to begin.
        </div>
      )}

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(7px, 0.8vw, 10px)",
          display: "grid",
          gridTemplateColumns: "1.08fr 0.66fr 1fr 0.74fr 0.86fr",
          gap: 6,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            background: doctrineBannerBackground,
            borderRadius: 14,
            border: "2px solid #9a6328",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 58,
            fontSize: enemyControl
              ? "clamp(13px, 1.45vw, 17px)"
              : neutralModeState
              ? "clamp(18px, 2.2vw, 28px)"
              : "clamp(30px, 3.8vw, 54px)",
            fontWeight: "900",
            color: enemyControl || neutralModeState ? "#1b0b00" : "white",
            textAlign: "center",
            padding: 4,
            boxShadow: doctrineBannerShadow,
            animation: doctrineBannerAnimation,
            textShadow: neutralModeState ? "0 1px 2px rgba(255,255,255,0.28)" : "0 3px 8px rgba(0,0,0,0.5)",
          }}
        >
          {doctrineBannerText}
        </div>

        <div
          style={{
            background: "linear-gradient(145deg, #17120d, #030201)",
            border: "2px solid #9a6328",
            borderRadius: 16,
            padding: 4,
            textAlign: "center",
            minHeight: 58,
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 1, fontSize: 9 }}>DICE</div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              animation: diceRolling ? "diceShake 0.6s infinite" : "none",
              minHeight: 66,
              alignItems: "center",
            }}
          >
            {displayDice.length > 0 ? displayDice.slice(0, 4).map((die, index) => renderDie(die, index)) : "-"}
          </div>
        </div>

        <CombinedPipPanel />

        <GameFlowPanel />

        <div
          style={{
            background: enemyControl ? "linear-gradient(145deg, #3b1f00, #ff9a00)" : "linear-gradient(145deg, #17120d, #030201)",
            border: enemyControl ? "3px solid #ffd000" : "2px solid #6f4a22",
            borderRadius: 16,
            padding: "5px 7px",
            textAlign: "center",
            color: enemyControl ? "#fff7c0" : "white",
            minHeight: 58,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9 }}>TURN</div>
          <div style={{ fontSize: "clamp(18px, 1.9vw, 25px)", fontWeight: 900, lineHeight: 1 }}>{currentPlayer}</div>
          <div
            style={{
              marginTop: 2,
              alignSelf: "center",
              borderRadius: 999,
              border: enemyControl || controller !== currentPlayer ? "2px solid #ffe66d" : "1px solid rgba(255,226,138,0.38)",
              background: enemyControl || controller !== currentPlayer ? "linear-gradient(145deg,#fff0a8,#d17c00 68%,#4a1600)" : "rgba(255,226,138,0.12)",
              color: enemyControl || controller !== currentPlayer ? "#210700" : "#f6d58b",
              padding: "3px 8px",
              fontSize: "clamp(8px, 0.78vw, 11px)",
              fontWeight: 900,
              letterSpacing: 0.4,
              lineHeight: 1.05,
              boxShadow: enemyControl || controller !== currentPlayer ? "0 0 14px rgba(255,211,60,0.72)" : "none",
            }}
          >
            {enemyControl || controller !== currentPlayer ? "OPPONENT MAKES ALL MOVES" : "NORMAL CONTROL"}
          </div>
        </div>

        <div
          style={{
            display: "none",
          }}
        >
          <button
            style={{
              ...luxuryButton,
              minWidth: 66,
              padding: "7px 10px",
              fontSize: 10,
              background: confirmResign
                ? "linear-gradient(145deg, #ff9a7a, #7a0000 72%, #210000)"
                : "linear-gradient(145deg, #2a120c, #090302 72%, #000)",
              color: confirmResign ? "#fff3d0" : "#f3d18b",
              border: confirmResign ? "2px solid #ffcf8a" : "2px solid #7a3f22",
              boxShadow: confirmResign
                ? "0 0 18px rgba(255,80,40,0.65), inset 0 1px 0 rgba(255,220,150,0.25)"
                : "inset 0 1px 0 rgba(255,220,150,0.18), 0 5px 14px rgba(0,0,0,0.55)",
              opacity: canResign ? 1 : 0.45,
              cursor: canResign ? "pointer" : "not-allowed",
            }}
            disabled={!canResign}
            onClick={resignGame}
            title={confirmResign ? "Confirm resignation" : "Resign game"}
          >
            {confirmResign ? "Confirm" : "Resign"}
          </button>
        </div>
      </div>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(4px, 0.5vw, 7px)",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <button
          style={{
            ...luxuryButton,
            opacity: canRollOpening ? 1 : 0.45,
            cursor: canRollOpening ? "pointer" : "not-allowed",
          }}
          disabled={!canRollOpening}
          onClick={rollOpening}
        >
          Roll Opening Dice
        </button>

        {canChooseDoctrine && (
          <>
            <button
              style={{
                ...luxuryButton,
                background: "linear-gradient(145deg, #ffdbb0, #a00000)",
                color: "white",
                minWidth: 112,
              }}
              onClick={() => chooseMode("WAR")}
            >
              Choose WAR
            </button>
            <button
              style={{
                ...luxuryButton,
                background: "linear-gradient(145deg, #d9efff, #005aa8)",
                color: "white",
                minWidth: 112,
              }}
              onClick={() => chooseMode("PEACE")}
            >
              Choose PEACE
            </button>
          </>
        )}

        <button
          style={{
            ...luxuryButton,
            minWidth: 76,
            padding: "9px 14px",
          }}
          onClick={undoMove}
        >
          Undo
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 76,
            padding: "9px 14px",
            background: confirmResign
              ? "linear-gradient(145deg, #ff9a7a, #7a0000 72%, #210000)"
              : "linear-gradient(145deg, #2a120c, #090302 72%, #000)",
            color: confirmResign ? "#fff3d0" : "#f3d18b",
            border: confirmResign ? "2px solid #ffcf8a" : "2px solid #7a3f22",
            opacity: canResign ? 1 : 0.45,
            cursor: canResign ? "pointer" : "not-allowed",
          }}
          disabled={!canResign}
          onClick={resignGame}
          title={confirmResign ? "Confirm resignation" : "Resign game"}
        >
          {confirmResign ? "Confirm" : "Resign"}
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 142,
            padding: "11px 24px",
            fontSize: 13,
            letterSpacing: 0.8,
            background: canSubmitTurn
              ? "linear-gradient(145deg, #fff5c8, #d89024 55%, #653000)"
              : "linear-gradient(145deg, #201812, #050302)",
            color: canSubmitTurn ? "#1a0900" : "#f3d18b",
            border: canSubmitTurn ? "3px solid #ffe08a" : "2px solid #9a6328",
            boxShadow: canSubmitTurn
              ? "0 0 18px rgba(255,210,90,0.58), inset 0 1px 0 rgba(255,255,230,0.5)"
              : "inset 0 1px 0 rgba(255,220,150,0.25), 0 5px 14px rgba(0,0,0,0.55)",
            opacity: canSubmitTurn ? 1 : 0.45,
            cursor: canSubmitTurn ? "pointer" : "not-allowed",
            pointerEvents: canSubmitTurn ? "auto" : "none",
          }}
          type="button"
          disabled={!canSubmitTurn}
          aria-disabled={!canSubmitTurn}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (canSubmitTurn) submitTurn(); else setMessage(gamePhase === "OPENING_ROLL" ? "Roll opening dice first." : "End Turn is not available yet."); }}
          title={canSubmitTurn ? "End turn" : "Roll opening dice, choose WAR or PEACE, then make the first legal move."}
        >
          END TURN
        </button>

        {gamePhase === "GAME_OVER" && (
          <button
            style={{
              ...luxuryButton,
              background: "linear-gradient(145deg, #fff2bc, #9d641d 70%, #321403)",
              color: "#1a0900",
              minWidth: 110,
            }}
            type="button"
            onClick={resetNewGame}
            title="Start a new game from the opening roll."
          >
            New Game
          </button>
        )}

        <button
          style={{
            ...luxuryButton,
            minWidth: 92,
            background: showRecords
              ? "linear-gradient(145deg, #fff2bc, #9d641d 70%, #321403)"
              : luxuryButton.background,
            color: showRecords ? "#1a0900" : luxuryButton.color,
          }}
          type="button"
          onClick={() => setShowRecords((visible) => !visible)}
          title="Show player records and recent game history"
        >
          Records
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 104,
            background: soundEnabled
              ? "linear-gradient(145deg, #fff2bc, #9d641d 70%, #321403)"
              : luxuryButton.background,
            color: soundEnabled ? "#1a0900" : luxuryButton.color,
          }}
          type="button"
          onClick={() => {
            setSoundEnabled((enabled) => {
              const next = !enabled;
              if (next) playSoundTest();
              return next;
            });
          }}
          title="Turn game sounds on or off. Turning sound on plays a quick test tone."
        >
          Sound {soundEnabled ? "On" : "Off"}
        </button>

        {false && showTestingPanel && (
          <>
        <select
          value={autoTestSpeed}
          onChange={(event) => setAutoTestSpeed(event.target.value as AutoTestSpeed)}
          disabled={autoTestRunning}
          title="Auto Test speed"
          style={{
            ...luxuryButton,
            minWidth: 116,
            padding: "8px 10px",
            opacity: autoTestRunning ? 0.58 : 1,
            cursor: autoTestRunning ? "not-allowed" : "pointer",
          }}
        >
          <option value="SLOW">Slow</option>
          <option value="FAST">Fast</option>
          <option value="VERY_FAST">Very Fast</option>
          <option value="SAFE_TURBO">Safe Turbo</option>
        </select>

        <select
          value={autoTestStrategy}
          onChange={(event) => setAutoTestStrategy(event.target.value as AutoTestStrategy)}
          disabled={autoTestRunning}
          title="Auto Test computer strategy"
          style={{
            ...luxuryButton,
            minWidth: 178,
            padding: "8px 10px",
            opacity: autoTestRunning ? 0.58 : 1,
            cursor: autoTestRunning ? "not-allowed" : "pointer",
          }}
        >
          <option value="RANDOM_LEGAL">Random Legal</option>
          <option value="BALANCED">Balanced</option>
          <option value="CONTROLLED_COMEBACK">Aggressive</option>
        </select>

        <button
          style={{
            ...luxuryButton,
            minWidth: 104,
            background: autoTestRunning
              ? "linear-gradient(145deg, #ffefb0, #b06100 72%, #3a1600)"
              : luxuryButton.background,
            color: autoTestRunning ? "#180700" : luxuryButton.color,
          }}
          type="button"
          onClick={autoTestRunning ? pauseAutoTest : () => startAutoTest(1)}
          title="Let the computer play both sides for one game."
        >
          {autoTestRunning ? "Pause Auto Test" : "Run 1 Game"}
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 104,
            opacity: autoTestRunning ? 0.45 : 1,
            cursor: autoTestRunning ? "not-allowed" : "pointer",
          }}
          type="button"
          onClick={() => startAutoTest(10)}
          disabled={autoTestRunning}
          title="Run 10 automated games for bug testing."
        >
          Run 10
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 104,
            opacity: autoTestRunning ? 0.45 : 1,
            cursor: autoTestRunning ? "not-allowed" : "pointer",
          }}
          type="button"
          onClick={() => startAutoTest(100)}
          disabled={autoTestRunning}
          title="Run 100 automated games for bug testing."
        >
          Run 100
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 92,
            opacity: diceRolling || autoTestRunning ? 0.45 : 1,
            cursor: diceRolling || autoTestRunning ? "not-allowed" : "pointer",
          }}
          type="button"
          onClick={stepAutoTestOnce}
          disabled={diceRolling || autoTestRunning}
          title="Run one automated testing step."
        >
          Step Test
        </button>

        <button
          style={{ ...luxuryButton, minWidth: 82 }}
          type="button"
          onClick={stopAutoTest}
          title="Stop Auto Test and save the current auto-test report."
        >
          Stop Test
        </button>

        <button
          style={{ ...luxuryButton, minWidth: 122 }}
          type="button"
          onClick={() => void copyAutoTestReport()}
          title="Copy the saved Auto Test report so you can paste it into an email, text, or ChatGPT."
        >
          Copy Report
        </button>

        <button
          style={{
            ...luxuryButton,
            minWidth: 118,
            opacity: autoTestRunning ? 0.45 : 1,
            cursor: autoTestRunning ? "not-allowed" : "pointer",
          }}
          type="button"
          onClick={clearAutoTestReport}
          disabled={autoTestRunning}
          title="Clear the saved Auto Test report."
        >
          Clear Report
        </button>
          </>
        )}
      </div>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(7px, 0.8vw, 10px)",
          fontSize: "clamp(13px, 1.35vw, 15px)",
          fontWeight: 700,
        }}
      >
        {winner && finalResult ? formatFinalResult(finalResult) : winner ? `${winner} wins! Game over.` : message}
        {winner && finalResult && (
          <div
            style={{
              margin: "9px auto 0",
              width: "fit-content",
              maxWidth: "min(92vw, 760px)",
              background: "linear-gradient(145deg, #fff7c7, #b87816 58%, #5a2c05)",
              color: "#1a0900",
              border: "3px solid #ffe28a",
              borderRadius: 18,
              padding: "9px 16px",
              fontSize: "clamp(14px, 1.45vw, 18px)",
              fontWeight: 900,
              boxShadow: "0 10px 22px rgba(0,0,0,0.45)",
            }}
          >
            <div>Final: {finalResult.winner === "White" ? cleanWhitePlayerName : cleanBlackPlayerName} defeated {finalResult.loser === "White" ? cleanWhitePlayerName : cleanBlackPlayerName} in {mode} mode.</div>
            <div style={{ fontSize: "0.9em", marginTop: 3 }}>
              {finalResult.winner} off: {finalResult.winnerOff} • {finalResult.loser} off: {finalResult.loserOff} • {finalResult.loser} pips remaining: {finalResult.loserPips}
            </div>
          </div>
        )}
        {turnGuidance && !winner && (
          <div
            style={{
              margin: "7px auto 0",
              width: "fit-content",
              maxWidth: "min(92vw, 720px)",
              background: "linear-gradient(145deg, #fff3b0, #c57b16)",
              color: "#1a0900",
              border: "2px solid #ffe28a",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: "clamp(14px, 1.45vw, 18px)",
              fontWeight: 900,
              boxShadow: "0 8px 18px rgba(0,0,0,0.38)",
            }}
          >
            {turnGuidance}
          </div>
        )}
        {canChooseDoctrine && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 6,
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              style={{
                ...luxuryButton,
                background: "linear-gradient(145deg, #ffdfbf, #8f0000)",
                color: "white",
                fontSize: 14,
                padding: "8px 16px",
                minWidth: 140,
              }}
              onClick={() => chooseMode("WAR")}
            >
              WAR
            </button>
            <button
              style={{
                ...luxuryButton,
                background: "linear-gradient(145deg, #d7f1ff, #004f9e)",
                color: "white",
                fontSize: 14,
                padding: "8px 16px",
                minWidth: 140,
              }}
              onClick={() => chooseMode("PEACE")}
            >
              PEACE
            </button>
          </div>
        )}
      </div>

      {false && showTestingPanel && (autoTestLog.length > 0 || autoTestError || autoTestRunning || autoTestSummary.completedGames > 0) && (
        <div
          style={{
            margin: "10px auto 0",
            width: "min(94vw, 940px)",
            background: autoTestError
              ? "linear-gradient(145deg, rgba(90,0,0,0.92), rgba(20,0,0,0.96))"
              : "linear-gradient(145deg, rgba(35,20,8,0.94), rgba(8,3,1,0.96))",
            border: autoTestError ? "3px solid #ffb08e" : "2px solid rgba(255,213,128,0.55)",
            borderRadius: 18,
            padding: "10px 14px",
            boxShadow: "0 12px 28px rgba(0,0,0,0.55)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              color: autoTestError ? "#ffe8d4" : "#ffe6ad",
              fontWeight: 900,
              fontSize: "clamp(14px, 1.4vw, 18px)",
              marginBottom: 6,
            }}
          >
            <span>Computer vs Computer Auto Test: {autoTestStatus}</span>
            <span>
              Speed: {AUTO_TEST_SPEED_LABELS[autoTestSpeed]} • Strategy: {AUTO_TEST_STRATEGY_LABELS[autoTestStrategy]} • Games: {autoTestSummary.completedGames}/{autoTestSummary.targetGames} • Rolls: {autoTestSummary.totalDiceRolls} • Internal cycles: {autoTestSummary.totalSteps}
            </span>
          </div>
          {autoTestError && (
            <div
              style={{
                color: "#fff4d6",
                background: "rgba(255,0,0,0.18)",
                border: "1px solid rgba(255,210,160,0.5)",
                borderRadius: 12,
                padding: "7px 10px",
                marginBottom: 7,
                fontWeight: 900,
              }}
            >
              AUTO TEST STOPPED — {autoTestError}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
              gap: 6,
              marginBottom: 8,
              color: "#fff1c9",
              fontSize: "clamp(12px, 1.1vw, 14px)",
              fontWeight: 800,
            }}
          >
            <div>White wins: {autoTestSummary.whiteWins} ({formatPercent(autoTestSummary.whiteWins, autoTestSummary.completedGames)})</div>
            <div>Black wins: {autoTestSummary.blackWins} ({formatPercent(autoTestSummary.blackWins, autoTestSummary.completedGames)})</div>
            <div>Opening winner wins: {autoTestSummary.openingWinnerWins} ({formatPercent(autoTestSummary.openingWinnerWins, autoTestSummary.openingWinnerWins + autoTestSummary.openingWinnerLosses)})</div>
            <div>WAR chooser wins: {autoTestSummary.warStartWins}/{autoTestSummary.warStartGames}</div>
            <div>PEACE chooser wins: {autoTestSummary.peaceStartWins}/{autoTestSummary.peaceStartGames}</div>
            <div>Average game: {autoTestSummary.averageDiceRolls} dice rolls/turns</div>
            <div>Shortest game: {autoTestSummary.shortestGameRolls} dice rolls/turns</div>
            <div>Longest game: {autoTestSummary.longestGameRolls} dice rolls/turns</div>
            <div>Playable rolls: {autoTestSummary.playableRolls}</div>
            <div>Unplayable rolls / auto-passes: {autoTestSummary.unplayableRolls}</div>
            <div>No-entry rolls from bar: {autoTestSummary.noEntryRolls}</div>
            <div>Doubles: {autoTestSummary.doublesRolled} total / {autoTestSummary.playableDoubles} playable / {autoTestSummary.blockedDoubles} blocked</div>
            <div>Checker moves: {autoTestSummary.checkerMoves} • Hits: {autoTestSummary.hits} • Bear-offs: {autoTestSummary.bearOffs}</div>
            <div>Internal cycles: avg {autoTestSummary.averageGameSteps}, longest {autoTestSummary.longestGameSteps}</div>
            <div>Greatest comeback: {autoTestSummary.greatestComebackPips} pips</div>
            <div>Avg final margin: {autoTestSummary.averageFinalPipMargin} pips</div>
            <div>Median final margin: {autoTestSummary.medianFinalPipMargin} pips</div>
            <div>Largest final margin: {autoTestSummary.largestFinalPipMargin} pips</div>
            <div>Avg bear-off margin: {autoTestSummary.averageCheckerMargin} checkers</div>
            <div>Avg loser off: {autoTestSummary.averageLoserCheckersOff} • Shutouts: {autoTestSummary.shutoutGames}</div>
            <div>Loser off buckets: 1-5 {autoTestSummary.loserOff1To5} • 6-10 {autoTestSummary.loserOff6To10} • 11-14 {autoTestSummary.loserOff11To14}</div>
            <div>Highest pip count: {autoTestSummary.highestPipCount}</div>
            <div>Largest pip gap: {autoTestSummary.largestPipGap}</div>
            <div>Extreme games: margin 100+ {autoTestSummary.finalMarginsOver100} • pip count 300+ {autoTestSummary.highestPipCountsOver300} • gap 200+ {autoTestSummary.largestPipGapsOver200}</div>
            <div>Enemy Control triggers: {autoTestSummary.enemyControlTriggers}</div>
            <div>Enemy Control moves: {autoTestSummary.enemyControlMoves}</div>
            <div>EC beneficiary wins: {autoTestSummary.enemyControlBeneficiaryWins} ({autoTestSummary.enemyControlBeneficiaryWinRate})</div>
            <div>EC while trailing 30+: {autoTestSummary.enemyControlWhileTrailing30}</div>
          </div>
          <div
            style={{
              color: "#ffe7b7",
              fontSize: "clamp(12px, 1.1vw, 14px)",
              fontWeight: 850,
              marginBottom: 8,
              background: "rgba(255,230,173,0.08)",
              border: "1px solid rgba(255,226,138,0.22)",
              borderRadius: 12,
              padding: "6px 9px",
            }}
          >
            Saved report: {autoTestSummary.stopReason} • Avg final margin {autoTestSummary.averageFinalPipMargin} pips • Median {autoTestSummary.medianFinalPipMargin} pips • {autoTestSummary.greatestComebackSummary}
          </div>

          <div
            style={{
              maxHeight: 135,
              overflowY: "auto",
              fontSize: "clamp(12px, 1.15vw, 14px)",
              lineHeight: 1.35,
              color: "#ffe7b7",
              textAlign: "left",
            }}
          >
            {autoTestLog.length === 0 ? (
              <div>Start Auto Test to let the computer play both sides and look for rule-engine errors.</div>
            ) : (
              autoTestLog.slice(0, 12).map((entry, index) => (
                <div key={`${entry}-${index}`}>{entry}</div>
              ))
            )}
          </div>
        </div>
      )}

      {showRecords && (
        <div
          style={{
            width: shellWidth,
            margin: "0 auto clamp(10px, 1vw, 14px)",
            background: "linear-gradient(145deg, rgba(255,242,188,0.14), rgba(32,14,4,0.94))",
            border: "3px solid rgba(226,171,87,0.72)",
            borderRadius: 20,
            padding: "10px 12px",
            boxShadow: "0 12px 26px rgba(0,0,0,0.48)",
            color: "#ffeab0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: "clamp(16px, 1.5vw, 21px)", fontWeight: 900 }}>Player Records</div>
            <div style={{ fontSize: "clamp(11px, 1vw, 13px)", opacity: 0.9 }}>
              Records are saved automatically on this browser when a game ends.
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div style={{ fontWeight: 800 }}>No completed games yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
              {leaderboard.slice(0, 8).map((player) => (
                <div
                  key={playerRecordKey(player.name)}
                  style={{
                    border: "1px solid rgba(255,226,138,0.38)",
                    borderRadius: 14,
                    padding: "8px 10px",
                    background: "rgba(0,0,0,0.22)",
                  }}
                >
                  <div style={{ fontSize: "clamp(14px, 1.35vw, 18px)", fontWeight: 900, color: "#fff4c7" }}>{player.name}</div>
                  <div style={{ fontSize: "clamp(12px, 1.1vw, 14px)", fontWeight: 800, marginTop: 3 }}>
                    Record: {player.wins}-{player.losses} • Win rate: {formatWinRate(player.wins, player.games)}
                  </div>
                  <div style={{ fontSize: "clamp(11px, 1vw, 13px)", marginTop: 3, opacity: 0.92 }}>
                    Avg winning margin: {averagePips(player.totalLoserPipsWhenWon, player.wins)} pips • WAR {player.war.wins}-{player.war.losses} • PEACE {player.peace.wins}-{player.peace.losses}
                  </div>
                  {Object.values(player.headToHead).length > 0 && (
                    <div style={{ fontSize: "clamp(11px, 1vw, 13px)", marginTop: 3, opacity: 0.9 }}>
                      Vs. {Object.values(player.headToHead).sort((a, b) => b.games - a.games)[0].opponentName}: {Object.values(player.headToHead).sort((a, b) => b.games - a.games)[0].wins}-{Object.values(player.headToHead).sort((a, b) => b.games - a.games)[0].losses}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {recordBook.games.length > 0 && (
            <div style={{ marginTop: 10, fontSize: "clamp(11px, 1vw, 13px)", opacity: 0.95 }}>
              <strong>Recent:</strong>{" "}
              {recordBook.games.slice(0, 3).map((game) => `${game.winnerPlayer} beat ${game.loserPlayer} (${game.mode}, ${game.reason === "RESIGNATION" ? "resignation" : "bear-off"}, ${game.loserPips} pips left)`).join("  •  ")}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(6px, 0.7vw, 10px)",
          background: "linear-gradient(145deg, #5a3218, #2a1207 58%, #120603)",
          padding: 6,
          borderRadius: 22,
          border: "5px solid #2a1408",
          boxShadow: "inset 0 0 0 2px rgba(231,160,72,0.24), inset 0 0 38px rgba(0,0,0,0.65), 0 24px 52px rgba(0,0,0,0.72)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 44px minmax(0, 1fr) 68px",
            gap: 6,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "7px 5px 0",
            }}
          >
            <PointQuadrant points={topLeftRow} isTop={true} />
          </div>

          <CenterHinge section="top" />

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "7px 5px 0"
            }}
          >
            <PointQuadrant points={topRightRow} isTop={true} />
          </div>

          <SideTray player="White" />
        </div>

        <div
          aria-hidden="true"
          style={{
            height: 12,
            margin: "5px 0",
            borderRadius: 10,
            background: "linear-gradient(90deg, rgba(0,0,0,0.86), rgba(26,38,20,0.95), rgba(0,0,0,0.86))",
            border: "1px solid rgba(255,210,130,0.12)",
            boxShadow: "inset 0 1px 0 rgba(255,220,150,0.06), 0 2px 6px rgba(0,0,0,0.36)",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 44px minmax(0, 1fr) 68px",
            gap: 6,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "0 5px 7px"
            }}
          >
            <PointQuadrant points={bottomLeftRow} isTop={false} />
          </div>

          <CenterHinge section="bottom" />

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "0 5px 7px"
            }}
          >
            <PointQuadrant points={bottomRightRow} isTop={false} />
          </div>

          <SideTray player="Black" />
        </div>
      </div>

      {PUBLIC_SHOW_TESTING_TOOLS && (
      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(12px, 1.2vw, 18px)",
          textAlign: "center",
        }}
      >
        <button
          style={{
            ...luxuryButton,
            minWidth: 190,
            opacity: autoTestRunning || showTestingPanel ? 1 : 0.72,
          }}
          type="button"
          onClick={() => setShowTestingPanel((visible) => !visible)}
          title="Show or hide computer testing tools."
        >
          {showTestingPanel ? "Hide Testing Tools" : "Testing Tools"}
        </button>
        {!showTestingPanel && (
          <div style={{ marginTop: 5, color: "rgba(255,231,183,0.68)", fontSize: 12, fontWeight: 800 }}>
            Public game controls stay clean. Auto Test remains available here for continued development.
          </div>
        )}

        {showTestingPanel && (
          <div
            style={{
              marginTop: 10,
              background: autoTestError
                ? "linear-gradient(145deg, rgba(90,0,0,0.92), rgba(20,0,0,0.96))"
                : "linear-gradient(145deg, rgba(35,20,8,0.94), rgba(8,3,1,0.96))",
              border: autoTestError ? "3px solid #ffb08e" : "2px solid rgba(255,213,128,0.55)",
              borderRadius: 18,
              padding: "10px 14px",
              boxShadow: "0 12px 28px rgba(0,0,0,0.55)",
              color: "#ffe6ad",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: "clamp(15px, 1.4vw, 19px)", marginBottom: 8 }}>
              Developer Testing Panel: {autoTestStatus}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 10 }}>
              <select
                value={autoTestSpeed}
                onChange={(event) => setAutoTestSpeed(event.target.value as AutoTestSpeed)}
                disabled={autoTestRunning}
                title="Auto Test speed"
                style={{ ...luxuryButton, minWidth: 116, padding: "8px 10px", opacity: autoTestRunning ? 0.58 : 1 }}
              >
                <option value="SLOW">Slow</option>
                <option value="FAST">Fast</option>
                <option value="VERY_FAST">Very Fast</option>
                <option value="SAFE_TURBO">Safe Turbo</option>
              </select>
              <select
                value={autoTestStrategy}
                onChange={(event) => setAutoTestStrategy(event.target.value as AutoTestStrategy)}
                disabled={autoTestRunning}
                title="Auto Test computer strategy"
                style={{ ...luxuryButton, minWidth: 168, padding: "8px 10px", opacity: autoTestRunning ? 0.58 : 1 }}
              >
                <option value="RANDOM_LEGAL">Random Legal</option>
                <option value="BALANCED">Balanced</option>
                <option value="CONTROLLED_COMEBACK">Aggressive</option>
              </select>
              <button style={{ ...luxuryButton, minWidth: 104 }} type="button" onClick={autoTestRunning ? pauseAutoTest : () => startAutoTest(1)}>
                {autoTestRunning ? "Pause" : "Run 1 Game"}
              </button>
              <button style={{ ...luxuryButton, minWidth: 96, opacity: autoTestRunning ? 0.45 : 1 }} type="button" onClick={() => startAutoTest(10)} disabled={autoTestRunning}>Run 10</button>
              <button style={{ ...luxuryButton, minWidth: 96, opacity: autoTestRunning ? 0.45 : 1 }} type="button" onClick={() => startAutoTest(100)} disabled={autoTestRunning}>Run 100</button>
              <button style={{ ...luxuryButton, minWidth: 92, opacity: diceRolling || autoTestRunning ? 0.45 : 1 }} type="button" onClick={stepAutoTestOnce} disabled={diceRolling || autoTestRunning}>Step Test</button>
              <button style={{ ...luxuryButton, minWidth: 82 }} type="button" onClick={stopAutoTest}>Stop Test</button>
              <button style={{ ...luxuryButton, minWidth: 116 }} type="button" onClick={() => void copyAutoTestReport()}>Copy Report</button>
              <button style={{ ...luxuryButton, minWidth: 112, opacity: autoTestRunning ? 0.45 : 1 }} type="button" onClick={clearAutoTestReport} disabled={autoTestRunning}>Clear Report</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6, color: "#fff1c9", fontSize: "clamp(12px, 1.1vw, 14px)", fontWeight: 800, textAlign: "center" }}>
              <div>Strategy: {AUTO_TEST_STRATEGY_LABELS[autoTestStrategy]}</div>
              <div>Games: {autoTestSummary.completedGames}/{autoTestSummary.targetGames}</div>
              <div>Average game: {autoTestSummary.averageDiceRolls} rolls</div>
              <div>Playable rolls: {autoTestSummary.playableRolls}</div>
              <div>Unplayable passes: {autoTestSummary.unplayableRolls}</div>
              <div>Final margin avg/median: {autoTestSummary.averageFinalPipMargin}/{autoTestSummary.medianFinalPipMargin}</div>
              <div>Highest pip count: {autoTestSummary.highestPipCount}</div>
              <div>Largest pip gap: {autoTestSummary.largestPipGap}</div>
              <div>Shutouts: {autoTestSummary.shutoutGames}</div>
              <div>Enemy Control: {autoTestSummary.enemyControlTriggers}</div>
            </div>

            <div style={{ marginTop: 8, color: "#ffe7b7", fontSize: 13, fontWeight: 850, background: "rgba(255,230,173,0.08)", border: "1px solid rgba(255,226,138,0.22)", borderRadius: 12, padding: "7px 9px" }}>
              Saved report: {autoTestSummary.stopReason} • {autoTestSummary.greatestComebackSummary}
            </div>

            {autoTestError && (
              <div style={{ marginTop: 8, color: "#fff4d6", background: "rgba(255,0,0,0.18)", borderRadius: 12, padding: "7px 10px", fontWeight: 900 }}>
                AUTO TEST STOPPED — {autoTestError}
              </div>
            )}
          </div>
        )}
      </div>
      )}

            <div style={{ display: "none" }}>
        {showMoveLog && moveLog.length > 0 && (
          <div>
            {moveLog.map((entry) => (
              <div key={entry.id}>{formatMoveLogEntry(entry)}</div>
            ))}
          </div>
        )}
        {showAnalysis && (
          <div>
            {legalAnalysis.explanation.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}