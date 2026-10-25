import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Exercise the actual pure rule engine without mounting the UI or maintaining
// a second implementation of backgammon. TypeScript is already a dev dependency.
const appPath = fileURLToPath(new URL('../src/App.tsx', import.meta.url));
const source = readFileSync(appPath, 'utf8');
const componentStart = source.indexOf('export default function App()');
assert.ok(componentStart > 0, 'App must retain a separable pure rule-engine section');
let pureSource = source.slice(0, componentStart);
const parsedSource = ts.createSourceFile('App.tsx', pureSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
// Skip UI and stylesheet imports, including multiline declarations, while
// preserving all pure definitions exactly as they appear in the application.
for (const statement of [...parsedSource.statements].reverse()) {
  if (ts.isImportDeclaration(statement)) {
    pureSource = pureSource.slice(0, statement.getFullStart()) + pureSource.slice(statement.end);
  }
}
const exportNames = [
  'emptyBoard', 'createStartingBoard', 'calculatePipCount', 'allHome',
  'canBearOff', 'getRawMoves', 'analyzeLegality', 'applyMove', 'removeDie',
  'savedTurnStartedAllHome',
];
const compiled = ts.transpileModule(`${pureSource}\nexport { ${exportNames.join(', ')} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const engineExports = {};
vm.runInNewContext(compiled.outputText, { exports: engineExports, console }, { filename: 'rule-engine.test.js' });
const {
  emptyBoard, createStartingBoard, calculatePipCount, allHome, canBearOff,
  getRawMoves, analyzeLegality, applyMove, removeDie,
  savedTurnStartedAllHome,
} = engineExports;

function position(white, black, bar = { White: 0, Black: 0 }) {
  const board = emptyBoard();
  for (const [index, count] of Object.entries(white)) board[Number(index)] = { owner: 'White', count };
  for (const [index, count] of Object.entries(black)) {
    assert.equal(board[Number(index)].count, 0, 'fixture points cannot have both owners');
    board[Number(index)] = { owner: 'Black', count };
  }
  const off = Object.fromEntries(['White', 'Black'].map(player => [
    player, 15 - bar[player] - board.reduce((sum, point) => sum + (point.owner === player ? point.count : 0), 0),
  ]));
  assert.ok(off.White >= 0 && off.Black >= 0, 'each fixture uses at most 15 checkers per player');
  return { board, bar, off };
}

function analyze(state, player, dice, mode = 'WAR', control = 'NORMAL', startedAllHome = allHome(state.board, player, state.bar)) {
  return analyzeLegality(state.board, player, dice, mode, state.bar, state.off, control, startedAllHome);
}

function totalCheckers(state, player) {
  return state.bar[player] + state.off[player] + state.board.reduce(
    (sum, point) => sum + (point.owner === player ? point.count : 0), 0,
  );
}

function moveValues(moves) {
  return Array.from(moves, move => `${move.from}>${move.to}:${move.die}`).sort();
}

test('standard opening has 15 checkers and 167 pips for each player', () => {
  const board = createStartingBoard();
  const bar = { White: 0, Black: 0 };
  const off = { White: 0, Black: 0 };
  for (const player of ['White', 'Black']) {
    assert.equal(totalCheckers({ board, bar, off }, player), 15);
    assert.equal(calculatePipCount(board, player, bar), 167);
  }
});

test('a checker on the bar must enter before any checker already on the board moves', () => {
  const state = position({ 10: 14 }, { 0: 2, 1: 1 }, { White: 1, Black: 0 });
  const result = analyze(state, 'White', [1, 2]);
  assert.equal(result.legalMoves.length, 1);
  assert.equal(result.legalMoves[0].isBarEntry, true);
  assert.equal(result.legalMoves[0].die, 2);
  assert.equal(result.legalMoves[0].isHit, true);
  const next = applyMove(state.board, result.legalMoves[0], 'White', state.bar, state.off);
  assert.equal(next.bar.White, 0);
  assert.equal(next.bar.Black, 1);
  assert.equal(next.board[1].owner, 'White');
  for (const player of ['White', 'Black']) assert.equal(totalCheckers(next, player), 15);
});

test('a second checker still on the bar prevents ordinary moves after the only available entry', () => {
  const state = position({ 10: 13 }, { 0: 2 }, { White: 2, Black: 0 });
  const result = analyze(state, 'White', [1, 2]);
  assert.equal(result.legalMoves.length, 1);
  assert.equal(result.legalMoves[0].die, 2);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 1));
  const next = applyMove(state.board, result.legalMoves[0], 'White', state.bar, state.off);
  assert.equal(next.bar.White, 1);
  assert.equal(analyze(next, 'White', [1]).legalMoves.length, 0);
});

test('blocked bar entries yield no moves even when ordinary board moves would be available', () => {
  const state = position({ 10: 14 }, { 1: 2, 2: 2 }, { White: 1, Black: 0 });
  for (const mode of ['WAR', 'PEACE']) {
    assert.equal(analyze(state, 'White', [2, 3], mode).legalMoves.length, 0);
    assert.equal(analyze(state, 'White', [2, 2, 2, 2], mode).legalMoves.length, 0);
  }
});

test('using both dice takes priority over immediately bearing off the last checker', () => {
  const state = position({ 22: 1 }, { 0: 15 });
  const result = analyze(state, 'White', [1, 2]);
  assert.deepEqual(moveValues(result.legalMoves), ['22>23:1']);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2));
  assert.ok(result.legalSequences.every(sequence => sequence.moves[1].isBearOff));
});

test('either die may be used when only one move is possible and the capture/off priorities are equal', () => {
  const state = position({ 23: 1 }, { 0: 15 });
  for (const mode of ['WAR', 'PEACE']) {
    const result = analyze(state, 'White', [1, 6], mode);
    assert.deepEqual(moveValues(result.legalMoves), ['23>-1:1', '23>-1:6']);
    assert.ok(result.legalMoves.every(move => move.isBearOff));
  }
});

test('neither bar-entry die is privileged when both work but neither can be followed', () => {
  const state = position({}, { 2: 2 }, { White: 1, Black: 0 });
  const result = analyze(state, 'White', [1, 2]);
  assert.deepEqual(moveValues(result.legalMoves), ['-1>0:1', '-1>1:2']);
});

test('WAR chooses the full-turn continuation with the most captures', () => {
  const state = position({ 0: 1 }, { 1: 1, 3: 1 });
  const result = analyze(state, 'White', [1, 2], 'WAR');
  assert.deepEqual(moveValues(result.legalMoves), ['0>1:1']);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalHits === 2));
});

test('PEACE chooses a complete no-hit turn when one is possible', () => {
  const state = position({ 0: 1 }, { 1: 1 });
  const result = analyze(state, 'White', [1, 2], 'PEACE');
  assert.deepEqual(moveValues(result.legalMoves), ['0>2:2']);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalHits === 0));
});

test('PEACE minimizes unavoidable captures across the complete maximum-length turn', () => {
  const state = position({ 0: 1 }, { 1: 1, 3: 1 });
  const result = analyze(state, 'White', [1, 2], 'PEACE');
  assert.deepEqual(moveValues(result.legalMoves), ['0>2:2']);
  assert.ok(result.legalSequences.every(sequence => sequence.totalHits === 1));
  assert.ok(result.legalSequences.every(sequence => sequence.moves[1].isHit));
});

test('a forced PEACE bar capture stays legal, and Enemy Control permits additional captures', () => {
  const state = position({ 4: 14 }, { 0: 1, 1: 2, 2: 1 }, { White: 1, Black: 0 });
  const initial = analyze(state, 'White', [1, 2], 'PEACE');
  assert.equal(initial.legalMoves.length, 1);
  const forcedHit = initial.legalMoves[0];
  assert.equal(forcedHit.isBarEntry, true);
  assert.equal(forcedHit.isHit, true);
  assert.equal(forcedHit.die, 1);
  const next = applyMove(state.board, forcedHit, 'White', state.bar, state.off);
  const remaining = removeDie([1, 2], forcedHit.die);
  const normal = analyze(next, 'White', remaining, 'PEACE');
  const controlled = analyze(next, 'White', remaining, 'PEACE', 'ENEMY_CONTROL');
  assert.deepEqual(moveValues(normal.legalMoves), ['4>6:2']);
  assert.deepEqual(moveValues(controlled.legalMoves), ['0>2:2', '4>6:2']);
  assert.ok(controlled.legalMoves.some(move => move.isHit));
});

test('Enemy Control suspends doctrine, retains maximum dice-use, and has no higher-die preference', () => {
  const lastTwoPips = position({ 22: 1 }, { 0: 15 });
  assert.deepEqual(moveValues(analyze(lastTwoPips, 'White', [1, 2], 'PEACE', 'ENEMY_CONTROL').legalMoves), ['22>23:1']);
  const lastPip = position({ 23: 1 }, { 0: 15 });
  assert.deepEqual(moveValues(analyze(lastPip, 'White', [1, 6], 'WAR', 'ENEMY_CONTROL').legalMoves), ['23>-1:1', '23>-1:6']);
});

test('bearing off requires all active checkers home and an empty own bar', () => {
  const outside = position({ 17: 1, 23: 1 }, { 0: 15 });
  assert.equal(allHome(outside.board, 'White', outside.bar), false);
  assert.equal(canBearOff(outside.board, 'White', outside.bar, 23, 1), false);
  const onBar = position({ 23: 1 }, { 0: 15 }, { White: 1, Black: 0 });
  assert.equal(allHome(onBar.board, 'White', onBar.bar), false);
  assert.equal(canBearOff(onBar.board, 'White', onBar.bar, 23, 1), false);
});

test('White may use an oversized die only on its farthest remaining checker', () => {
  const state = position({ 18: 1, 23: 1 }, { 0: 15 });
  assert.equal(canBearOff(state.board, 'White', state.bar, 23, 6), false);
  assert.equal(canBearOff(state.board, 'White', state.bar, 18, 6), true);
  const result = analyze(state, 'White', [6, 6, 6, 6]);
  assert.equal(result.legalMoves[0].from, 18);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalBearOffs === 2));
});

test('Black bearing off and oversized-die restrictions are symmetric', () => {
  const state = position({ 23: 15 }, { 0: 1, 5: 1 });
  assert.equal(canBearOff(state.board, 'Black', state.bar, 0, 6), false);
  assert.equal(canBearOff(state.board, 'Black', state.bar, 5, 6), true);
  const result = analyze(state, 'Black', [6, 6, 6, 6]);
  assert.equal(result.legalMoves[0].from, 5);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalBearOffs === 2));
});

test('bear-off priority chooses two checkers off over one off when both use two dice', () => {
  const state = position({ 22: 1, 23: 1 }, { 0: 15 });
  for (const mode of ['WAR', 'PEACE']) {
    const result = analyze(state, 'White', [1, 2], mode);
    assert.ok(result.legalSequences.length > 0);
    assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalBearOffs === 2));
    assert.ok(result.legalMoves.every(move => move.isBearOff));
  }
});

test('6-4 may move a home checker with 4 before bringing the last outside checker home with 6', () => {
  for (const player of ['White', 'Black']) {
    const state = player === 'White'
      ? position({ 17: 1, 18: 1, 20: 13 }, { 0: 15 })
      : position({ 23: 15 }, { 6: 1, 5: 1, 3: 13 });
    const homeFrom = player === 'White' ? 18 : 5;
    const outsideFrom = player === 'White' ? 17 : 6;
    for (const mode of ['WAR', 'PEACE']) {
      const result = analyze(state, player, [6, 4], mode);
      assert.equal(allHome(state.board, player, state.bar), false);
      assert.ok(result.legalMoves.some(move => move.from === homeFrom && move.die === 4));
      assert.ok(result.legalMoves.some(move => move.from === outsideFrom && move.die === 6));
      assert.ok(result.legalSequences.some(sequence =>
        sequence.moves[0].from === homeFrom && sequence.moves[0].die === 4 &&
        sequence.moves[1].from === outsideFrom && sequence.moves[1].die === 6 &&
        sequence.totalBearOffs === 0));
      assert.ok(result.legalSequences.some(sequence => sequence.totalBearOffs === 1));
      assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2));
    }
  }
});

test('bringing the final checker home does not start mandatory bearing off midway through that turn', () => {
  for (const player of ['White', 'Black']) {
    const state = player === 'White'
      ? position({ 17: 1, 18: 1, 20: 13 }, { 0: 15 })
      : position({ 23: 15 }, { 6: 1, 5: 1, 3: 13 });
    const outsideFrom = player === 'White' ? 17 : 6;
    for (const mode of ['WAR', 'PEACE']) {
      const first = analyze(state, player, [6, 4], mode).legalMoves.find(move => move.from === outsideFrom && move.die === 6);
      assert.ok(first);
      const next = applyMove(state.board, first, player, state.bar, state.off);
      assert.equal(allHome(next.board, player, next.bar), true);
      const remaining = analyze(next, player, [4], mode, 'NORMAL', false);
      assert.ok(remaining.legalMoves.some(move => move.isBearOff));
      assert.ok(remaining.legalMoves.some(move => !move.isBearOff));
      const laterTurn = analyze(next, player, [4], mode, 'NORMAL', true);
      assert.ok(laterTurn.legalMoves.every(move => move.isBearOff));
    }
  }
});

test('WAR maximizes captures before maximizing bear-offs when the turn began with all checkers home', () => {
  const state = position({ 18: 1, 20: 1, 23: 13 }, { 0: 14, 19: 1 });
  const war = analyze(state, 'White', [1, 4], 'WAR');
  assert.ok(war.legalSequences.length > 0);
  assert.ok(war.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalHits === 1 && sequence.totalBearOffs === 1));
  const peace = analyze(state, 'White', [1, 4], 'PEACE');
  assert.ok(peace.legalSequences.every(sequence => sequence.totalHits === 0 && sequence.totalBearOffs === 2));
});

test('PEACE rejects a quiet first move that strands the second die when a complete turn requires a capture', () => {
  const state = position({ 0: 1, 5: 1 }, { 1: 1, 2: 2, 7: 2, 8: 2 });
  const rawQuiet = getRawMoves(state.board, 'White', [1, 2], state.bar, state.off)
    .find(move => move.from === 5 && move.to === 6);
  assert.ok(rawQuiet && !rawQuiet.isHit);
  const quietNext = applyMove(state.board, rawQuiet, 'White', state.bar, state.off);
  assert.equal(getRawMoves(quietNext.board, 'White', [2], quietNext.bar, quietNext.off).length, 0);
  const result = analyze(state, 'White', [1, 2], 'PEACE');
  assert.deepEqual(moveValues(result.legalMoves), ['0>1:1']);
  assert.ok(result.legalSequences.every(sequence => sequence.moves.length === 2 && sequence.totalHits === 1));
});

test('PEACE must use all four playable double moves even when the last move forces a capture', () => {
  const state = position({ 0: 1 }, { 4: 1 });
  const result = analyze(state, 'White', [1, 1, 1, 1], 'PEACE');
  assert.equal(result.legalSequences.length, 1);
  const sequence = result.legalSequences[0];
  assert.equal(sequence.moves.length, 4);
  assert.equal(sequence.totalHits, 1);
  assert.equal(sequence.moves[3].isHit, true);
});

test('older saved turns recover bearing-off eligibility from the turn history without imposing it mid-turn', () => {
  const state = position({ 18: 1, 20: 13, 23: 1 }, { 0: 15 });
  const saved = { ...state, currentPlayer: 'White', turnMoveCount: 1, moveLog: [
    { player: 'White', move: { from: 17, to: 23, die: 6, isHit: false } },
  ] };
  assert.equal(savedTurnStartedAllHome(saved), false);
  assert.equal(savedTurnStartedAllHome({ ...saved, bearOffPriorityAtTurnStart: false }), false);
  assert.equal(savedTurnStartedAllHome({ ...saved, turnMoveCount: 0, moveLog: [] }), true);
  assert.equal(savedTurnStartedAllHome({ ...saved, moveLog: [] }), false);
  assert.equal(savedTurnStartedAllHome({ ...saved, moveLog: [
    { player: 'White', move: { from: 18, to: 20, die: 2, isHit: false } },
  ] }), true);
  assert.equal(savedTurnStartedAllHome({ ...saved, moveLog: [
    { player: 'White', move: { from: -1, to: 5, die: 6, isHit: false, isBarEntry: true } },
  ] }), false);
});

test('doubles supply four moves, including repeated movement of one checker', () => {
  const state = position({ 0: 1 }, { 23: 15 });
  const result = analyze(state, 'White', [2, 2, 2, 2]);
  assert.equal(result.legalSequences.length, 1);
  assert.deepEqual(Array.from(result.legalSequences[0].moves, move => move.to), [2, 4, 6, 8]);
  let next = state;
  for (const move of result.legalSequences[0].moves) next = applyMove(next.board, move, 'White', next.bar, next.off);
  assert.equal(next.board[8].owner, 'White');
  for (const player of ['White', 'Black']) assert.equal(totalCheckers(next, player), 15);
});

test('blocked final dice may remain unused after all possible moves have been made', () => {
  const state = position({ 0: 1 }, { 4: 2 });
  const result = analyze(state, 'White', [2, 2, 2, 2]);
  assert.equal(result.legalSequences.length, 1);
  assert.equal(result.legalSequences[0].moves.length, 1);
  assert.equal(result.legalMoves[0].to, 2);
  const next = applyMove(state.board, result.legalMoves[0], 'White', state.bar, state.off);
  assert.equal(analyze(next, 'White', [2, 2, 2]).legalMoves.length, 0);
});

test('rule analysis leaves caller state unchanged and produced turns conserve all checkers', () => {
  const state = position({ 0: 1, 8: 2, 18: 12 }, { 1: 1, 3: 1, 7: 2, 23: 11 });
  const before = JSON.stringify(state);
  for (const mode of ['WAR', 'PEACE']) {
    const result = analyze(state, 'White', [1, 2], mode);
    assert.ok(result.legalSequences.length > 0);
    for (const sequence of result.legalSequences) {
      let next = state;
      for (const move of sequence.moves) {
        assert.ok(getRawMoves(next.board, 'White', [move.die], next.bar, next.off).some(
          legal => legal.from === move.from && legal.to === move.to && legal.die === move.die,
        ));
        next = applyMove(next.board, move, 'White', next.bar, next.off);
        for (const player of ['White', 'Black']) assert.equal(totalCheckers(next, player), 15);
        for (const point of next.board) assert.equal(point.owner === null, point.count === 0);
      }
    }
  }
  assert.equal(JSON.stringify(state), before);
});
