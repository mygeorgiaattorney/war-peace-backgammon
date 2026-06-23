import React, { useEffect, useMemo, useState } from "react";

type Player = "White" | "Black";
type Mode = "WAR" | "PEACE";
type ControlState = "NORMAL" | "ENEMY_CONTROL";
type GamePhase = "OPENING_ROLL" | "MODE_CHOICE" | "OPENING_TURN" | "NORMAL_TURN" | "GAME_OVER";

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

function playClickSound(): void {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 520;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.08);
}

function playErrorSound(): void {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const first = ctx.createOscillator();
  const second = ctx.createOscillator();
  const gain = ctx.createGain();

  first.type = "square";
  second.type = "sawtooth";
  first.frequency.setValueAtTime(160, ctx.currentTime);
  first.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.18);
  second.frequency.setValueAtTime(120, ctx.currentTime);
  second.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  first.connect(gain);
  second.connect(gain);
  gain.connect(ctx.destination);
  first.start();
  second.start();
  first.stop(ctx.currentTime + 0.22);
  second.stop(ctx.currentTime + 0.22);
}


function playWinFanfare(): void {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const melody = [523, 659, 784, 1046, 1318];

  melody.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + index * 0.13;

    oscillator.type = index % 2 === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.31);
  });
}

function moveKey(move: Move): string {
  return `${move.from}:${move.to}:${move.die}:${move.isBarEntry ? 1 : 0}:${move.isBearOff ? 1 : 0}`;
}

function pointLabel(index: number): string {
  return index < 0 ? "bar" : `${index + 1}`;
}

function describeMove(move: Move): string {
  if (move.isBearOff) return `Bear off from ${pointLabel(move.from)} with ${move.die}`;
  if (move.isBarEntry) return `Enter from bar to ${pointLabel(move.to)} with ${move.die}${move.isHit ? " - HIT" : ""}`;
  return `${pointLabel(move.from)} -> ${pointLabel(move.to)} with ${move.die}${move.isHit ? " - HIT" : ""}`;
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
  if (entry.move.isHit) tags.push("HIT");
  if (entry.move.isBearOff) tags.push("OFF");
  if (entry.move.isBarEntry) tags.push("BAR");
  if (entry.controlState === "ENEMY_CONTROL") tags.push("ENEMY CONTROL");
  const suffix = tags.length > 0 ? ` [${tags.join(" | ")}]` : "";
  return `${entry.id}. ${entry.player} ${entry.mode}: ${describeMove(entry.move)}${suffix}`;
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
  const [confirmResign, setConfirmResign] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [legalHelpActive, setLegalHelpActive] = useState(false);
  const [assistSourcePoint, setAssistSourcePoint] = useState<number | null>(null);

  useEffect(() => {
    console.table(runEngineSelfTests().map((result) => ({ result })));
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
  const canChooseDoctrine = gamePhase === "MODE_CHOICE" && awaitingModeChoice && openingDice !== null && openingWinner !== null;
  const canRollOpening = !diceRolling && gamePhase === "OPENING_ROLL";
  const turnIsPlayable = gamePhase === "OPENING_TURN" || gamePhase === "NORMAL_TURN";
  const canSubmitTurn =
    !winner &&
    !diceRolling &&
    turnIsPlayable &&
    !awaitingModeChoice &&
    (
      (turnMoveCount > 0 && (remainingDice.length === 0 || legalMoves.length === 0)) ||
      (turnMoveCount === 0 && remainingDice.length > 0 && legalMoves.length === 0)
    );
  const canResign = !winner && gamePhase !== "OPENING_ROLL" && gamePhase !== "GAME_OVER";
  const whitePipCount = calculatePipCount(board, "White", bar);
  const blackPipCount = calculatePipCount(board, "Black", bar);

  async function animateDiceRoll(): Promise<void> {
    setDiceRolling(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
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

  function flashWarning(text = "Not permitted — must make a legal move.", duration = 1800): void {
    setWarningMessage(text);
    setTimeout(() => setWarningMessage(null), duration);
  }

  function showLegalMoveHelp(sourcePoint: number | null = selectedPoint): void {
    playErrorSound();
    flashWarning();
    setAssistSourcePoint(sourcePoint);
    setLegalHelpActive(true);
    setTimeout(() => {
      setLegalHelpActive(false);
      setAssistSourcePoint(null);
    }, 2200);
  }

  function checkForWinner(nextOff: OffState): Player | null {
    if (nextOff.White >= 15) return "White";
    if (nextOff.Black >= 15) return "Black";
    return null;
  }

  function endGame(player: Player): void {
    setWinner(player);
    setMessage(`${player} wins! Game over.`);
    playWinFanfare();
    flashBanner(`${player.toUpperCase()} WINS`, 3000);
    setRemainingDice([]);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
    setConfirmResign(false);
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

    endGame(opponent(currentPlayer));
  }

  async function rollOpening(): Promise<void> {
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
    playWinFanfare();
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
    setMessage("PEACE TEST: no-hit sequence should be preferred if available.");
  }

  function chooseMode(chosenMode: Mode): void {
    if (!awaitingModeChoice || !openingDice || !openingWinner) {
      setMessage("Roll opening dice first, then choose WAR or PEACE.");
      return;
    }

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

    let dice: number[];
    let nextMode = mode;

    if (d1 === d2) {
      dice = [d1, d1, d1, d1];
      nextMode = mode === "WAR" ? "PEACE" : "WAR";
      setMode(nextMode);
      flashBanner(`DOUBLES - ${nextMode}`, 3000);
    } else {
      dice = [d1, d2];
    }

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
    setMessage(`${nextPlayer}'s turn. Rolled ${dice.join(", ")}.`);
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
      if (winner === null) endGame(completedWinner);
      setMessage(`${completedWinner} has already won. Game over.`);
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

    const result = applyMove(board, move, currentPlayer, bar, off);
    const nextDice = removeDie(remainingDice, move.die);
    let nextControlState = controlState;
    let nextController = controller;

    if (mode === "PEACE" && controlState === "NORMAL" && move.isHit) {
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
    playClickSound();
    triggerMoveAnimation(move);

    if (move.isHit) flashBanner("HIT");
    if (move.isBearOff) flashBanner("BEAR OFF");

    const completedWinner = checkForWinner(result.off);
    if (completedWinner) {
      endGame(completedWinner);
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

  function beginDrag(index: number, event?: React.PointerEvent<HTMLDivElement>): void {
    if (awaitingModeChoice || remainingDice.length === 0 || bar[currentPlayer] > 0) return;

    const point = board[index];
    const canDragFromPoint = point.owner === currentPlayer && legalMoves.some((move) => move.from === index);

    if (!canDragFromPoint) return;

    event?.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingPoint(index);
    setSelectedPoint(index);
    setPreviewMoveKey(null);
    setDragPosition(event ? { x: event.clientX, y: event.clientY } : null);
    setMessage(`Dragging from point ${index + 1}. Release on a highlighted destination.`);
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (draggingPoint === null) return;

    const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
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

  function cancelDrag(): void {
    if (draggingPoint === null) return;
    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);
  }

  function updateDragPosition(event: React.PointerEvent<HTMLDivElement>): void {
    if (draggingPoint === null) return;

    setDragPosition({ x: event.clientX, y: event.clientY });

    const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
    const pointElement = elementUnderPointer?.closest("[data-point-index]") as HTMLElement | null;
    const hoverIndexText = pointElement?.dataset.pointIndex;
    setHoverPoint(hoverIndexText === undefined ? null : Number(hoverIndexText));
  }

  function handlePointClick(index: number): void {
    const completedWinner = winner ?? checkForWinner(off);
    if (completedWinner) {
      if (winner === null) endGame(completedWinner);
      setMessage(`${completedWinner} has already won. Game over.`);
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
      playClickSound();
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
          height: "clamp(190px, 26vh, 300px)",
          cursor: isLegalOrigin || isLegalDestination || isSelected ? "grab" : "pointer",
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
          width: "clamp(62px, 5vw, 74px)",
          minWidth: 62,
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
  const shellWidth = "min(92vw, 1060px)";

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

  return (
    <div
      onDragStart={(event) => event.preventDefault()}
      style={{
        background: "radial-gradient(circle at 50% 0%, #3a1d0d 0%, #120704 48%, #020100 100%)",
        minHeight: "100vh",
        color: "white",
        padding: "clamp(8px, 1.2vw, 16px)",
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
      `}</style>

      {draggingPoint !== null && dragPosition && board[draggingPoint]?.owner && (
        <div
          style={{
            position: "fixed",
            left: dragPosition.x,
            top: dragPosition.y,
            width: "clamp(32px, 3.6vw, 42px)",
            height: "clamp(32px, 3.6vw, 42px)",
            borderRadius: "50%",
            transform: "translate(-50%, -50%) scale(1.08)",
            pointerEvents: "none",
            zIndex: 10000,
            background:
              board[draggingPoint].owner === "White"
                ? "radial-gradient(circle at 32% 24%, #ffffff 0%, #f8eed7 30%, #c8b081 58%, #7e6b4a 82%, #3b3020 100%)"
                : "radial-gradient(circle at 32% 24%, #7f7f7f 0%, #2f2f2f 34%, #0b0b0b 72%, #000 100%)",
            border: board[draggingPoint].owner === "White" ? "2px solid #f6e6bd" : "2px solid #050505",
            boxShadow: "0 16px 26px rgba(0,0,0,0.65), 0 0 22px rgba(255,230,150,0.35)",
          }}
        />
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
            animation: turnBanner.startsWith("DOUBLES - ") ? "doublesSuck 3s cubic-bezier(.18,.82,.24,1) forwards" : turnBanner.includes("WINS") ? "winSpectacle 3s ease forwards" : "cinematicFade 1.3s ease forwards",
          }}
        >
          <div
            style={{
              padding: "24px 38px",
              borderRadius: 22,
              background: turnBanner.includes("WAR")
                ? "linear-gradient(145deg,#620000,#e51b1b)"
                : turnBanner.includes("PEACE")
                ? "linear-gradient(145deg,#003a8c,#2298e6)"
                : turnBanner.includes("WINS")
                ? "linear-gradient(135deg,#fff7c7 0%,#f4cf5e 22%,#b87816 48%,#fff0a8 66%,#6e3f08 100%)"
                : "linear-gradient(145deg,#1b1207,#7b5524,#d4a14d)",
              color: "white",
              fontSize: turnBanner.includes("DOUBLES") ? "clamp(17px,2.6vw,32px)" : turnBanner.includes("WINS OPENING ROLL") ? "clamp(20px,3vw,36px)" : "clamp(30px,5vw,68px)",
              fontWeight: 900,
              letterSpacing: 2,
              boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
              textShadow: "0 3px 12px rgba(0,0,0,0.6)",
            }}
          >
            {turnBanner.includes("WINS") ? (
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

      <h1
        style={{
          width: shellWidth,
          margin: "0 auto clamp(6px, 0.8vw, 10px)",
          fontSize: "clamp(25px, 2.55vw, 38px)",
          letterSpacing: 0.4,
          textShadow: "0 3px 8px rgba(0,0,0,0.7)",
          color: "#f0cf8a",
        }}
      >
        War & Peace Backgammon
      </h1>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(7px, 0.8vw, 10px)",
          display: "grid",
          gridTemplateColumns: "1.18fr 0.7fr 1.05fr 0.72fr 0.5fr",
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

        <div
          style={{
            background: enemyControl ? "linear-gradient(145deg, #3b1f00, #ff9a00)" : "linear-gradient(145deg, #17120d, #030201)",
            border: enemyControl ? "3px solid #ffd000" : "2px solid #6f4a22",
            borderRadius: 16,
            padding: 5,
            textAlign: "center",
            color: enemyControl ? "#fff7c0" : "white",
            minHeight: 46,
          }}
        >
          <div style={{ fontSize: 9 }}>TURN</div>
          <div style={{ fontSize: "clamp(17px, 1.75vw, 22px)", fontWeight: "bold" }}>{currentPlayer}</div>
          <div style={{ fontSize: 9 }}>CONTROLLER</div>
          <div style={{ fontSize: "clamp(16px, 1.65vw, 20px)", fontWeight: "bold" }}>{controller}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            minHeight: 58,
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
          margin: "0 auto clamp(7px, 0.8vw, 10px)",
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

        <button style={luxuryButton} onClick={undoMove}>Undo</button>
        <button
          style={{
            ...luxuryButton,
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
          End Turn
        </button>
      </div>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(7px, 0.8vw, 10px)",
          fontSize: "clamp(13px, 1.35vw, 15px)",
          fontWeight: 700,
        }}
      >
        {winner ? `${winner} wins! Game over.` : message}
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

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(10px, 1vw, 14px)",
          background: "linear-gradient(145deg, #5a3218, #2a1207 58%, #120603)",
          padding: 8,
          borderRadius: 24,
          border: "7px solid #2a1408",
          boxShadow: "inset 0 0 0 2px rgba(231,160,72,0.24), inset 0 0 38px rgba(0,0,0,0.65), 0 24px 52px rgba(0,0,0,0.72)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 44px minmax(0, 1fr) 74px",
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
            gridTemplateColumns: "minmax(0, 1fr) 44px minmax(0, 1fr) 74px",
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