import React, { useEffect, useMemo, useState } from "react";

type Player = "White" | "Black";
type Mode = "WAR" | "PEACE";
type ControlState = "NORMAL" | "ENEMY_CONTROL";

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
  const [turnBanner, setTurnBanner] = useState<string | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [animatingMoveKey, setAnimatingMoveKey] = useState<string | null>(null);
  const [message, setMessage] = useState("Roll opening dice.");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [openingDice, setOpeningDice] = useState<number[] | null>(null);
  const [openingWinner, setOpeningWinner] = useState<Player | null>(null);
  const [awaitingModeChoice, setAwaitingModeChoice] = useState(false);

  useEffect(() => {
    console.table(runEngineSelfTests().map((result) => ({ result })));
  }, []);

  const legalAnalysis = useMemo(
    () => analyzeLegality(board, currentPlayer, remainingDice, mode, bar, off, controlState),
    [board, currentPlayer, remainingDice, mode, bar, off, controlState]
  );

  const legalMoves = legalAnalysis.legalMoves;
  const previewSequences = previewMoveKey
    ? legalAnalysis.legalSequences.filter((sequence) => {
        const first = sequence.moves[0];
        return first && moveKey(first) === previewMoveKey;
      })
    : [];

  const displayDice = remainingDice.length > 0 ? remainingDice : openingDice ?? [];
  const canChooseDoctrine = awaitingModeChoice && openingDice !== null && openingWinner !== null;
  const gameInProgress = remainingDice.length > 0 || moveLog.length > 0;
  const canRollOpening = !diceRolling && !awaitingModeChoice && !gameInProgress;
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

  function flashBanner(text: string): void {
    setTurnBanner(text);
    setTimeout(() => setTurnBanner(null), 1300);
  }

  async function rollOpening(): Promise<void> {
    if (!canRollOpening) {
      if (awaitingModeChoice) {
        setMessage("Choose WAR or PEACE before rolling again.");
      } else if (gameInProgress) {
        setMessage("Game already started. Finish or reset before rolling opening dice again.");
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
    setOpeningDice([whiteDie, blackDie]);
    setOpeningWinner(winner);
    setAwaitingModeChoice(true);
    flashBanner(`${winner.toUpperCase()} WINS OPENING ROLL`);
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
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
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
    setOpeningDice(null);
    setOpeningWinner(null);
    setAwaitingModeChoice(false);
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
    setHistory([]);
    setMoveLog([]);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    flashBanner(chosenMode);
    setMessage(`${openingWinner} chose ${chosenMode}. Opening turn begins. Select a ${openingWinner} checker, then select a legal destination.`);
  }

  async function nextTurn(): Promise<void> {
    await animateDiceRoll();

    const nextPlayer = opponent(currentPlayer);
    const d1 = rollDie();
    const d2 = rollDie();
    let dice: number[];
    let nextMode = mode;

    if (d1 === d2) {
      dice = [d1, d1, d1, d1];
      nextMode = mode === "WAR" ? "PEACE" : "WAR";
      setMode(nextMode);
      flashBanner(`DOUBLES - ${nextMode}`);
    } else {
      dice = [d1, d2];
    }

    setCurrentPlayer(nextPlayer);
    setController(nextPlayer);
    setControlState("NORMAL");
    setRemainingDice(dice);
    setOpeningDice(null);
    setOpeningWinner(null);
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
    setLastMove(previous.lastMove);
    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setMessage("Move undone.");
  }

  function submitTurn(): void {
    if (remainingDice.length > 0 && legalMoves.length > 0) {
      setMessage("Use remaining legal moves or undo before submitting.");
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
    setBoard(result.board);
    setBar(result.bar);
    setOff(result.off);
    setRemainingDice(nextDice);
    setSelectedPoint(null);
    setPreviewMoveKey(null);
    setController(nextController);
    setControlState(nextControlState);
    playClickSound();
    triggerMoveAnimation(move);

    if (move.isHit) flashBanner("HIT");
    if (move.isBearOff) flashBanner("BEAR OFF");

    if (result.off[currentPlayer] >= 15) {
      setMessage(`${currentPlayer} wins!`);
      setRemainingDice([]);
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

    setDraggingPoint(null);
    setHoverPoint(null);
    setDragPosition(null);

    if (!move) {
      setSelectedPoint(null);
      setMessage("Illegal drop. Use a highlighted destination.");
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
        setMessage(`${currentPlayer} must enter from the bar.`);
        return;
      }
      executeMove(barMove);
      return;
    }

    if (selectedPoint === null) {
      const point = board[index];
      if (point.owner !== currentPlayer) {
        setMessage(`It is ${currentPlayer}'s turn. Select a ${currentPlayer} checker first.`);
        return;
      }
      setSelectedPoint(index);
      setPreviewMoveKey(null);
      playClickSound();
      setMessage(`Selected point ${index + 1}. Now select a highlighted legal destination.`);
      return;
    }

    const move = legalMoves.find((candidate) => {
      if (candidate.isBearOff) return candidate.from === selectedPoint && index === selectedPoint;
      return candidate.from === selectedPoint && candidate.to === index;
    });

    if (!move) {
      setSelectedPoint(null);
      setPreviewMoveKey(null);
      setMessage("Illegal move. Select one of the highlighted legal destinations.");
      return;
    }

    executeMove(move);
  }

  function renderDie(value: number, index: number) {
    const dotPositions: Record<number, string[]> = {
      1: ["center"],
      2: ["top-left", "bottom-right"],
      3: ["top-left", "center", "bottom-right"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: ["top-left", "top-right", "mid-left", "mid-right", "bottom-left", "bottom-right"],
    };

    const positions: Record<string, React.CSSProperties> = {
      "top-left": { top: 5, left: 5 },
      "top-right": { top: 5, right: 5 },
      "mid-left": { top: 13, left: 5 },
      "mid-right": { top: 13, right: 5 },
      center: { top: 13, left: 13 },
      "bottom-left": { bottom: 5, left: 5 },
      "bottom-right": { bottom: 5, right: 5 },
    };

    return (
      <div
        key={index}
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: "linear-gradient(145deg, #fff9df, #d0bd8d)",
          boxShadow:
            "inset -5px -5px 9px rgba(0,0,0,0.24), inset 4px 4px 7px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,0,0.5)",
          position: "relative",
          marginRight: 6,
        }}
      >
        {dotPositions[value].map((position, dotIndex) => (
          <div
            key={dotIndex}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#111",
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
    const legalOrigins = Array.from(
      new Set(
        legalMoves
          .filter((move) => !move.isBarEntry)
          .map((move) => move.from)
      )
    );
    const isLegalOrigin = selectedPoint === null && legalOrigins.includes(index);
    const activeSource = draggingPoint ?? selectedPoint;
    const legalDestinations =
      bar[currentPlayer] > 0
        ? legalMoves.filter((move) => move.isBarEntry).map((move) => move.to)
        : legalMoves
            .filter((move) => move.from === activeSource)
            .map((move) => (move.isBearOff ? activeSource! : move.to));

    const isLegalDestination = legalDestinations.includes(index);
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
          height: "clamp(185px, 24vh, 275px)",
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
            height: "clamp(172px, 22vh, 255px)",
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
              ? "0 0 0 4px rgba(0,200,255,0.98), 0 0 24px rgba(0,200,255,0.75)"
              : isLegalOrigin
              ? "0 0 0 3px rgba(255,215,0,0.95), 0 0 20px rgba(255,215,0,0.7)"
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
          {isLegalDestination && activeSource !== null && (
            <div
              style={{
                width: "clamp(20px, 2vw, 28px)",
                height: "clamp(20px, 2vw, 28px)",
                borderRadius: "50%",
                background: moveDestinationColor(point, currentPlayer),
                border: "2px solid rgba(255,255,255,0.85)",
                boxShadow: "0 0 18px rgba(0,200,255,0.95)",
                marginBottom: isTop ? 0 : 4,
                marginTop: isTop ? 4 : 0,
              }}
            />
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
                borderRadius: 10,
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
    return (
      <div
        style={{
          background: light
            ? "linear-gradient(145deg, #fff3cf, #c29249)"
            : "linear-gradient(145deg, #17120d, #030201)",
          color: light ? "#111" : "#f4d493",
          border: "2px solid #9a6328",
          borderRadius: 10,
          padding: "5px 9px",
          minWidth: 90,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: "bold" }}>{label}</div>
        <div style={{ fontSize: "clamp(16px, 1.7vw, 21px)", fontWeight: "bold" }}>{value}</div>
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
    return (
      <div
        style={{
          width: "clamp(58px, 5vw, 76px)",
          minWidth: 56,
          borderRadius: 28,
          background: "linear-gradient(145deg, #5b3219, #1a0904)",
          border: "3px solid #7c461f",
          boxShadow: "inset 0 0 24px rgba(0,0,0,0.72), 0 8px 18px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#f3d18b",
          fontWeight: 900,
          textAlign: "center",
          overflow: "hidden",
          padding: "8px 4px",
        }}
      >
        <div style={{ fontSize: 11 }}>{player.toUpperCase()}</div>
        <div style={{ fontSize: 11, marginBottom: 4 }}>OFF</div>
        <TrayCheckers player={player} count={off[player]} />
        <div style={{ fontSize: 18, marginTop: 4 }}>{off[player]}</div>
      </div>
    );
  }

  function CenterHinge() {
    return (
      <div
        style={{
          width: "clamp(40px, 3.4vw, 54px)",
          minWidth: 40,
          background: "linear-gradient(90deg, #241006, #9c632c, #241006)",
          borderLeft: "2px solid rgba(255,210,120,0.35)",
          borderRight: "2px solid rgba(0,0,0,0.65)",
          boxShadow: "inset 0 0 18px rgba(0,0,0,0.72)",
          display: "grid",
          gridTemplateRows: "1fr auto 1fr",
          alignItems: "center",
          justifyItems: "center",
          color: "#f0c36f",
          fontSize: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 132 }}>
          <div style={{ fontSize: 11, marginBottom: 2 }}>W BAR</div>
          <TrayCheckers player="White" count={bar.White} />
        </div>

        <div style={{ width: "100%", height: 4, background: "#e0a34f" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 132 }}>
          <TrayCheckers player="Black" count={bar.Black} />
          <div style={{ fontSize: 11, marginTop: 2 }}>B BAR</div>
        </div>
      </div>
    );
  }

  function PointQuadrant({ points, isTop }: { points: number[]; isTop: boolean }) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(58px, 1fr))",
          gap: 0,
          minWidth: 0,
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
  const shellWidth = "min(100%, 1420px)";

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
            animation: "cinematicFade 1.3s ease forwards",
          }}
        >
          <div
            style={{
              padding: "24px 38px",
              borderRadius: 22,
              background: enemyControl
                ? "linear-gradient(145deg,#ffcc00,#ff6a00)"
                : modeIsWar
                ? "linear-gradient(145deg,#5f0000,#ff1a1a)"
                : "linear-gradient(145deg,#003a8c,#39b7ff)",
              color: "white",
              fontSize: "clamp(30px,5vw,68px)",
              fontWeight: 900,
              letterSpacing: 2,
              boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
              textShadow: "0 3px 12px rgba(0,0,0,0.6)",
            }}
          >
            {turnBanner}
          </div>
        </div>
      )}

      <h1
        style={{
          width: shellWidth,
          margin: "0 auto clamp(6px, 0.8vw, 10px)",
          fontSize: "clamp(26px, 2.8vw, 42px)",
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
          gridTemplateColumns: "1.3fr 0.85fr 0.9fr 0.9fr 0.95fr",
          gap: 10,
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
            minHeight: 46,
            fontSize: enemyControl
              ? "clamp(12px, 1.4vw, 16px)"
              : neutralModeState
              ? "clamp(14px, 1.8vw, 22px)"
              : "clamp(21px, 2.4vw, 30px)",
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
            borderRadius: 12,
            padding: 4,
            textAlign: "center",
            minHeight: 46,
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 1, fontSize: 9 }}>DICE</div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              animation: diceRolling ? "diceShake 0.6s infinite" : "none",
            }}
          >
            {displayDice.length > 0 ? displayDice.slice(0, 4).map((die, index) => renderDie(die, index)) : "-"}
          </div>
        </div>

        <PipPanel label="WHITE PIPS" value={whitePipCount} light />
        <PipPanel label="BLACK PIPS" value={blackPipCount} />

        <div
          style={{
            background: enemyControl ? "linear-gradient(145deg, #3b1f00, #ff9a00)" : "linear-gradient(145deg, #17120d, #030201)",
            border: enemyControl ? "3px solid #ffd000" : "2px solid #6f4a22",
            borderRadius: 12,
            padding: 5,
            textAlign: "center",
            color: enemyControl ? "#fff7c0" : "white",
            minHeight: 46,
          }}
        >
          <div style={{ fontSize: 9 }}>TURN</div>
          <div style={{ fontSize: "clamp(14px, 1.55vw, 18px)", fontWeight: "bold" }}>{currentPlayer}</div>
          <div style={{ fontSize: 9 }}>CONTROLLER</div>
          <div style={{ fontSize: "clamp(13px, 1.45vw, 17px)", fontWeight: "bold" }}>{controller}</div>
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
        <button style={luxuryButton} onClick={submitTurn}>Submit</button>
      </div>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(7px, 0.8vw, 10px)",
          fontSize: "clamp(13px, 1.35vw, 15px)",
          fontWeight: 700,
        }}
      >
        {message}
        {canChooseDoctrine && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 10,
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
          padding: 16,
          borderRadius: 30,
          border: "14px solid #2a1408",
          boxShadow: "inset 0 0 0 2px rgba(231,160,72,0.24), inset 0 0 38px rgba(0,0,0,0.65), 0 24px 52px rgba(0,0,0,0.72)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px minmax(0, 1fr) 48px minmax(0, 1fr) 70px",
            gap: 10,
          }}
        >
          <SideTray player="White" />

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "10px 8px 0",
            }}
          >
            <PointQuadrant points={topLeftRow} isTop={true} />
          </div>

          <CenterHinge />

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "10px 8px 0"
            }}
          >
            <PointQuadrant points={topRightRow} isTop={true} />
          </div>

          <SideTray player="Black" />
        </div>

        <div
          style={{
            height: 42,
            margin: "8px 0",
            borderRadius: 14,
            background: "linear-gradient(90deg, #050704, #172714, #050704)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            fontWeight: 700,
            border: "1px solid rgba(255,210,130,0.16)",
          }}
        >
          <div style={{ fontSize: 13 }}>White Off: {off.White}</div>
          <div style={{ fontSize: 13 }}>Center bar holds hit checkers</div>
          <div style={{ fontSize: 13 }}>Black Off: {off.Black}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px minmax(0, 1fr) 48px minmax(0, 1fr) 70px",
            gap: 10,
          }}
        >
          <SideTray player="White" />

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "0 8px 10px"
            }}
          >
            <PointQuadrant points={bottomLeftRow} isTop={false} />
          </div>

          <CenterHinge />

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(90deg, #243b1d, #4b642f 50%, #243b1d)",
              padding: "0 8px 10px"
            }}
          >
            <PointQuadrant points={bottomRightRow} isTop={false} />
          </div>

          <SideTray player="Black" />
        </div>
      </div>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto clamp(10px, 1vw, 14px)",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid #6f4a22",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setShowMoveLog((value) => !value)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            background: "rgba(0,0,0,0.35)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Move History (Optional Debug Panel)</span>
          <span>{showMoveLog ? "▲" : "▼"}</span>
        </button>

        {showMoveLog && moveLog.length > 0 && (
          <div style={{ padding: 10, maxHeight: "clamp(92px, 18vh, 170px)", overflowY: "auto" }}>
            {moveLog.length === 0 ? (
              <div style={{ color: "#f4d493", fontSize: 13 }}>No moves recorded yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 6 }}>
                {moveLog.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: entry.controlState === "ENEMY_CONTROL" ? "rgba(255, 174, 0, 0.16)" : "rgba(0,0,0,0.28)",
                      border: entry.move.isHit ? "1px solid #ff4b4b" : "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      padding: "6px 8px",
                      fontSize: 12,
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>{formatMoveLogEntry(entry)}</div>
                    <div style={{ color: "#f4d493" }}>
                      Controller: {entry.controller} | Dice left: {entry.remainingDiceAfter.length ? entry.remainingDiceAfter.join(", ") : "none"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          width: shellWidth,
          margin: "0 auto",
          background: enemyControl ? "rgba(255, 174, 0, 0.14)" : "rgba(0,0,0,0.25)",
          border: enemyControl ? "2px solid #ffd000" : "1px solid #6f4a22",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setShowAnalysis((value) => !value)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            background: "rgba(0,0,0,0.35)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Rules, Legal Analysis & Forced-Sequence Visualizer</span>
          <span>{showAnalysis ? "▲" : "▼"}</span>
        </button>

        {showAnalysis && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
              padding: 12,
            }}
          >
            <div
              style={{
                background: enemyControl ? "rgba(255, 174, 0, 0.18)" : "rgba(0,0,0,0.25)",
                border: enemyControl ? "2px solid #ffd000" : "1px solid #6f4a22",
                borderRadius: 12,
                padding: 10,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 6 }}>RULE STATUS</div>
              <div>
                Mode: <strong>{neutralModeState ? "UNDECIDED" : mode}</strong> | Control: <strong>{controlState}</strong>
              </div>
              {enemyControl && (
                <div style={{ color: "#ffd86b", fontWeight: "bold", marginTop: 6 }}>
                  Enemy controller may make any legal backgammon move. WAR/PEACE tactical filters are off until the turn ends.
                </div>
              )}
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid #6f4a22",
                borderRadius: 12,
                padding: 10,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 6 }}>LEGAL ANALYSIS</div>
              {legalAnalysis.explanation.map((line, index) => (
                <div key={index} style={{ fontSize: 13, marginBottom: 3 }}>
                  - {line}
                </div>
              ))}
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid #6f4a22",
                borderRadius: 12,
                padding: 10,
                gridColumn: "1 / -1",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 6 }}>FORCED-SEQUENCE VISUALIZER</div>
              {legalAnalysis.legalSequences.length === 0 ? (
                <div style={{ fontSize: 13 }}>No legal sequence to preview.</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#f4d493", marginBottom: 6 }}>
                    Legal first moves are shown below. Hover or click to preview the complete forced sequence tree.
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 6,
                      maxHeight: "clamp(96px, 18vh, 160px)",
                      overflowY: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {legalMoves.map((move) => {
                      const key = moveKey(move);
                      const related = legalAnalysis.legalSequences.filter((sequence) => {
                        const first = sequence.moves[0];
                        return first && moveKey(first) === key;
                      });
                      const selected = previewMoveKey === key;

                      return (
                        <button
                          key={key}
                          onMouseEnter={() => setPreviewMoveKey(key)}
                          onClick={() => {
                            setPreviewMoveKey(key);
                            setSelectedPoint(move.from >= 0 ? move.from : null);
                          }}
                          style={{
                            textAlign: "left",
                            borderRadius: 8,
                            border: selected ? "2px solid #4cff4c" : "1px solid #6f4a22",
                            background: selected ? "rgba(76,255,76,0.18)" : "rgba(0,0,0,0.35)",
                            color: "white",
                            padding: "6px 8px",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontWeight: "bold", fontSize: 12 }}>{describeMove(move)}</div>
                          <div style={{ fontSize: 11, color: "#f4d493" }}>
                            Opens {related.length} legal continuation{related.length === 1 ? "" : "s"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {previewSequences.length > 0 && (
                    <div style={{ marginTop: 8, background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontWeight: "bold", marginBottom: 5 }}>Previewed Continuations</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "clamp(72px, 14vh, 120px)", overflowY: "auto" }}>
                        {previewSequences.map((sequence, index) => (
                          <div key={index} style={{ fontSize: 12, lineHeight: 1.35 }}>
                            <div style={{ color: "#f4d493" }}>{describeSequenceStats(sequence)}</div>
                            <div>{describeSequence(sequence)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}