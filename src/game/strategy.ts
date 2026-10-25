/** Computer evaluation only. The rule engine supplies every permitted move. */
export type StrategyPlayer = "White" | "Black";
export type StrategyMode = "WAR" | "PEACE";
export type ComputerStrategy = "RANDOM_LEGAL" | "BALANCED" | "CONTROLLED_COMEBACK";

export interface StrategyPoint { owner: StrategyPlayer | null; count: number }
export interface StrategyMove {
  from: number; to: number; die: number; isHit: boolean;
  isBarEntry?: boolean; isBearOff?: boolean;
}
export interface StrategyPosition {
  board: StrategyPoint[];
  bar: Record<StrategyPlayer, number>;
  off: Record<StrategyPlayer, number>;
}
export interface StrategySequence { moves: StrategyMove[] }
export interface LandmineProfile {
  tier: "NONE" | "CAUTIOUS" | "STRONG";
  deficit: number;
  hasContact: boolean;
  openEntryPoints: number;
  opponentHomeMadePoints: number;
  opponentHomeBlots: number;
  exposureAllowed: boolean;
  label: string;
  explanation: string;
}

type ApplyMove = (board: StrategyPoint[], move: StrategyMove, player: StrategyPlayer,
  bar: StrategyPosition["bar"], off: StrategyPosition["off"]) => StrategyPosition;
type RawMoves = (board: StrategyPoint[], player: StrategyPlayer, dice: number[],
  bar: StrategyPosition["bar"], off: StrategyPosition["off"]) => StrategyMove[];

const enemyOf = (player: StrategyPlayer): StrategyPlayer => player === "White" ? "Black" : "White";
const inHome = (player: StrategyPlayer, index: number): boolean => player === "White" ? index >= 18 : index <= 5;

function pipCount(position: StrategyPosition, player: StrategyPlayer): number {
  return position.board.reduce((total, point, index) => total + (point.owner === player
    ? point.count * (player === "White" ? 24 - index : index + 1) : 0), position.bar[player] * 25);
}

/** Once both sides have passed one another, exposure cannot create a landmine. */
function hasContact(position: StrategyPosition): boolean {
  if (position.off.White === 15 || position.off.Black === 15) return false;
  if (position.bar.White > 0 || position.bar.Black > 0) return true;
  const firstWhite = position.board.findIndex(point => point.owner === "White" && point.count > 0);
  let lastBlack = -1;
  for (let i = 23; i >= 0; i -= 1) {
    if (position.board[i].owner === "Black" && position.board[i].count > 0) { lastBlack = i; break; }
  }
  return firstWhite >= 0 && lastBlack >= firstWhite;
}

export function getLandmineProfile(position: StrategyPosition, player: StrategyPlayer): LandmineProfile {
  const enemy = enemyOf(player);
  const deficit = Math.max(0, pipCount(position, player) - pipCount(position, enemy));
  const contact = hasContact(position);
  let opponentHomeMadePoints = 0;
  let opponentHomeBlots = 0;
  for (let i = 0; i < 24; i += 1) {
    const point = position.board[i];
    if (!inHome(enemy, i) || point.owner !== enemy) continue;
    if (point.count >= 2) opponentHomeMadePoints += 1;
    if (point.count === 1) opponentHomeBlots += 1;
  }
  const openEntryPoints = 6 - opponentHomeMadePoints;
  const tier = !contact || deficit < 50 ? "NONE" : deficit > 75 ? "STRONG" : "CAUTIOUS";
  const exposureAllowed = tier !== "NONE" && openEntryPoints >= 3;
  const label = tier === "NONE" ? "Balanced play" : tier === "CAUTIOUS" ? "Cautious landmines" : "Strong landmines";
  const explanation = !contact
    ? "The checkers have passed one another; race home instead of setting traps."
    : tier === "NONE"
      ? "Keep a sound position; landmine play begins at a 50-pip deficit."
      : !exposureAllowed
        ? `${deficit} pips behind, but ${opponentHomeMadePoints} opposing home points are blocked. Preserve safety until re-entry improves.`
        : `${deficit} pips behind; ${openEntryPoints} open re-entry points and ${opponentHomeBlots} exposed opposing home checker${opponentHomeBlots === 1 ? "" : "s"}. Look for a PEACE trap and a return shot.`;
  return { tier, deficit, hasContact: contact, openEntryPoints, opponentHomeMadePoints,
    opponentHomeBlots, exposureAllowed, label, explanation };
}

type ReplyPressure = {
  captureChances: Map<number, number>;
  forcedPeaceChance: number;
  peacePressure: number;
};

/**
 * Probe the six die faces using the real movement generator. A forced-first-hit
 * roll has no quiet initial move on either die. This is a conservative signal:
 * a later forced hit after a quiet move is not counted as guaranteed.
 * Playable doubles switch WAR/PEACE before the reply, as in the rule engine.
 */
function replyPressure(position: StrategyPosition, player: StrategyPlayer,
  mode: StrategyMode, rawMoves: RawMoves): ReplyPressure {
  const enemy = enemyOf(player);
  const faces = Array.from({ length: 6 }, (_, i) => {
    const moves = rawMoves(position.board, enemy, [i + 1], position.bar, position.off);
    const quiet = moves.filter(move => !move.isHit).length;
    const hits = moves.filter(move => move.isHit);
    return { quiet, hits };
  });
  const hitRolls = new Map<number, number>();
  let forcedPeaceRolls = 0;
  let pressure = 0;
  for (let a = 0; a < 6; a += 1) {
    for (let b = 0; b < 6; b += 1) {
      const hits = [...faces[a].hits, ...faces[b].hits];
      for (const point of new Set(hits.map(move => move.to))) hitRolls.set(point, (hitRolls.get(point) ?? 0) + 1);
      if (hits.length === 0) continue;
      const replyMode = a === b ? (mode === "WAR" ? "PEACE" : "WAR") : mode;
      if (replyMode !== "PEACE") continue;
      const quiet = faces[a].quiet + faces[b].quiet;
      if (quiet === 0) forcedPeaceRolls += 1;
      // Quiet alternatives sharply reduce a prospective trap's value.
      pressure += hits.length / (hits.length + quiet * 4);
    }
  }
  return {
    captureChances: new Map([...hitRolls].map(([point, count]) => [point, count / 36])),
    forcedPeaceChance: forcedPeaceRolls / 36,
    peacePressure: pressure / 36,
  };
}

function madePointValue(position: StrategyPosition, player: StrategyPlayer): number {
  let value = 0;
  let anchors = 0;
  position.board.forEach((point, index) => {
    if (point.owner !== player) return;
    if (point.count >= 2) {
      value += inHome(player, index) ? 14 : 5;
      if (inHome(enemyOf(player), index)) anchors += 1;
    }
    value -= Math.max(0, point.count - 5) * 2;
  });
  return value + Math.min(2, anchors) * 12;
}

/** Static, deterministic evaluation from the decision maker's perspective. */
export function scoreStrategicPosition(position: StrategyPosition, initial: StrategyPosition,
  player: StrategyPlayer, mode: StrategyMode, strategy: ComputerStrategy, rawMoves: RawMoves): number {
  const enemy = enemyOf(player);
  if (position.off[player] >= 15) return 1_000_000;
  if (position.off[enemy] >= 15) return -1_000_000;
  let score = (position.off[player] - position.off[enemy]) * 180
    + (pipCount(position, enemy) - pipCount(position, player)) * 1.6
    + (position.bar[enemy] - position.bar[player]) * 24;

  const profile = getLandmineProfile(position, player);
  if (!profile.hasContact) return score;

  score += madePointValue(position, player) - madePointValue(position, enemy) * 0.7;
  const pressure = replyPressure(position, player, mode, rawMoves);
  const startTier = getLandmineProfile(initial, player).tier;
  const canBait = startTier !== "NONE" && profile.openEntryPoints >= 3;
  let exposure = 0;
  for (const [index, chance] of pressure.captureChances) {
    const point = position.board[index];
    if (point.owner !== player || point.count !== 1) continue;
    exposure += chance;
    const lostProgress = player === "White" ? index + 1 : 24 - index;
    const entryDanger = 0.65 + profile.opponentHomeMadePoints * 0.3;
    const modeRisk = mode === "WAR" ? 0.9 : 0.5;
    score -= chance * (8 + lostProgress * 1.4) * entryDanger * modeRisk;
  }
  score -= position.bar[player] * profile.opponentHomeMadePoints * 8;

  if (canBait) {
    const strength = (startTier === "STRONG" ? 1.15 : 0.65)
      * (strategy === "CONTROLLED_COMEBACK" ? 1.35 : 1);
    const reentryOpportunity = Math.min(1.6, (profile.openEntryPoints - 2) / 4
      + profile.opponentHomeBlots * 0.18);
    const exposureBudget = startTier === "STRONG" ? 4 : 2;
    score += strength * reentryOpportunity * (
      pressure.forcedPeaceChance * 130 + pressure.peacePressure * 48
      + Math.min(exposure, exposureBudget) * 8
    );
    score -= Math.max(0, exposure - exposureBudget) * 16;
  }
  return score;
}

function positionKey(position: StrategyPosition): string {
  return position.board.map(point => `${point.owner === "White" ? "w" : point.owner === "Black" ? "b" : "_"}${point.count}`).join(",")
    + `/${position.bar.White},${position.bar.Black}/${position.off.White},${position.off.Black}`;
}

function moveKey(move: StrategyMove): string {
  return `${move.from}/${move.to}/${move.die}/${Number(!!move.isBarEntry)}/${Number(!!move.isBearOff)}`;
}

export interface StrategicChoiceOptions {
  position: StrategyPosition;
  player: StrategyPlayer;
  controller: StrategyPlayer;
  mode: StrategyMode;
  dice: number[];
  strategy: ComputerStrategy;
  legalSequences: StrategySequence[];
  applyMove: ApplyMove;
  rawMoves: RawMoves;
  /** Actual rule-engine continuations after a PEACE capture transfers control. */
  controlledContinuations: (position: StrategyPosition, dice: number[]) => StrategySequence[];
}

/**
 * Choose among complete legal turns, not an isolated greedy first move.
 * A PEACE capture hands the remaining choices to the enemy, so use that
 * enemy's least favorable continuation instead of planning its moves for it.
 */
export function chooseStrategicMove(options: StrategicChoiceOptions): StrategyMove | null {
  const { position, player, controller, mode, dice, strategy, legalSequences, applyMove, rawMoves } = options;
  const sequences = legalSequences.filter(sequence => sequence.moves.length > 0);
  if (sequences.length === 0) return null;
  const firstMoves = new Map<string, StrategyMove>();
  sequences.forEach(sequence => firstMoves.set(moveKey(sequence.moves[0]), sequence.moves[0]));
  if (strategy === "RANDOM_LEGAL") {
    const choices = [...firstMoves.values()];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  const scoreCache = new Map<string, number>();
  const score = (state: StrategyPosition): number => {
    const key = positionKey(state);
    if (!scoreCache.has(key)) scoreCache.set(key, scoreStrategicPosition(state, position, controller, mode, strategy, rawMoves));
    return scoreCache.get(key)!;
  };
  const transferCache = new Map<string, number>();
  const bestByFirstMove = new Map<string, number>();
  for (const sequence of sequences) {
    let state = position;
    const left = [...dice];
    let value: number | undefined;
    for (const move of sequence.moves) {
      state = applyMove(state.board, move, player, state.bar, state.off);
      const dieIndex = left.indexOf(move.die);
      if (dieIndex >= 0) left.splice(dieIndex, 1);
      if (controller === player && mode === "PEACE" && move.isHit && left.length > 0) {
        const transferKey = `${positionKey(state)}/${left.join(",")}`;
        if (!transferCache.has(transferKey)) {
          const controlled = options.controlledContinuations(state, left);
          let worst = Number.POSITIVE_INFINITY;
          for (const tail of controlled) {
            let end = state;
            for (const next of tail.moves) end = applyMove(end.board, next, player, end.bar, end.off);
            worst = Math.min(worst, score(end));
          }
          transferCache.set(transferKey, Number.isFinite(worst) ? worst : score(state));
        }
        value = transferCache.get(transferKey)!;
        break;
      }
    }
    value ??= score(state);
    const firstKey = moveKey(sequence.moves[0]);
    bestByFirstMove.set(firstKey, Math.max(bestByFirstMove.get(firstKey) ?? Number.NEGATIVE_INFINITY, value));
  }

  let best: StrategyMove | null = null;
  let highest = Number.NEGATIVE_INFINITY;
  for (const [key, move] of firstMoves) {
    const value = bestByFirstMove.get(key)!;
    if (value > highest) { highest = value; best = move; }
  }
  return best;
}
