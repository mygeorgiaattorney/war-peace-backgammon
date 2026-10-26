import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function compile(source, filename) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  vm.runInNewContext(compiled.outputText, { exports, console }, { filename });
  return exports;
}

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
let pure = app.slice(0, app.indexOf('export default function App()'));
const parsed = ts.createSourceFile('App.tsx', pure, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
for (const statement of [...parsed.statements].reverse()) {
  if (ts.isImportDeclaration(statement)) pure = pure.slice(0, statement.getFullStart()) + pure.slice(statement.end);
}
const engine = compile(`${pure}\nexport { emptyBoard, createStartingBoard, allHome, getRawMoves, analyzeLegality, applyMove };`, 'engine.js');
const strategy = compile(readFileSync(new URL('../src/game/strategy.ts', import.meta.url), 'utf8'), 'strategy.js');
const { getLandmineProfile, scoreStrategicPosition, chooseStrategicMove } = strategy;

function position(white, black, bar = { White: 0, Black: 0 }) {
  const board = engine.emptyBoard();
  for (const [index, count] of Object.entries(white)) board[Number(index)] = { owner: 'White', count };
  for (const [index, count] of Object.entries(black)) {
    assert.equal(board[Number(index)].count, 0, 'fixture points cannot overlap');
    board[Number(index)] = { owner: 'Black', count };
  }
  const off = Object.fromEntries(['White', 'Black'].map(player => [player,
    15 - bar[player] - board.reduce((sum, p) => sum + (p.owner === player ? p.count : 0), 0),
  ]));
  assert.ok(off.White >= 0 && off.Black >= 0);
  return { board, bar, off };
}

function mirror(state) {
  return {
    board: [...state.board].reverse().map(p => ({ count: p.count, owner: p.owner === 'White' ? 'Black' : p.owner === 'Black' ? 'White' : null })),
    bar: { White: state.bar.Black, Black: state.bar.White },
    off: { White: state.off.Black, Black: state.off.White },
  };
}

function choose(state, dice, { player = 'White', controller = player, mode = 'PEACE', computer = 'BALANCED' } = {}) {
  const controlState = player === controller ? 'NORMAL' : 'ENEMY_CONTROL';
  const priority = engine.allHome(state.board, player, state.bar);
  const analysis = engine.analyzeLegality(state.board, player, dice, mode, state.bar, state.off, controlState, priority);
  const chosen = chooseStrategicMove({
    position: state, player, controller: analysis.controller, mode, dice, strategy: computer,
    legalSequences: analysis.legalSequences,
    applyMove: engine.applyMove, rawMoves: engine.getRawMoves,
    controlledContinuations: (next, left) => engine.analyzeLegality(
      next.board, player, left, mode, next.bar, next.off, 'ENEMY_CONTROL', priority,
    ).legalSequences,
  });
  if (chosen) assert.ok(analysis.legalMoves.some(move => move.from === chosen.from && move.to === chosen.to && move.die === chosen.die));
  return chosen;
}

test('50 pips activates cautious landmines; stronger landmines require more than 75', () => {
  const cases = [
    [position({ 0: 3 }, { 22: 1 }), 49, 'NONE'],
    [position({ 0: 3 }, { 21: 1 }), 50, 'CAUTIOUS'],
    [position({ 0: 4 }, { 20: 1 }), 75, 'CAUTIOUS'],
    [position({ 0: 4 }, { 19: 1 }), 76, 'STRONG'],
  ];
  for (const [state, deficit, tier] of cases) {
    const profile = getLandmineProfile(state, 'White');
    assert.equal(profile.deficit, deficit);
    assert.equal(profile.tier, tier);
    const reflected = getLandmineProfile(mirror(state), 'Black');
    assert.equal(reflected.deficit, deficit);
    assert.equal(reflected.tier, tier);
  }
});

test('home-board assessment uses the opponent home, and blocks suppress sacrifice', () => {
  const closed = position({ 6: 15 }, { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 23: 1 });
  const profile = getLandmineProfile(closed, 'White');
  assert.equal(profile.tier, 'STRONG');
  assert.equal(profile.opponentHomeMadePoints, 6);
  assert.equal(profile.openEntryPoints, 0);
  assert.equal(profile.exposureAllowed, false);
  const weak = position({ 6: 15 }, { 0: 1, 1: 1, 2: 1, 23: 1 });
  const open = getLandmineProfile(weak, 'White');
  assert.equal(open.opponentHomeMadePoints, 0);
  assert.equal(open.opponentHomeBlots, 3);
  assert.equal(open.openEntryPoints, 6);
  assert.equal(open.exposureAllowed, true);
});

test('below the landmine threshold both computers cover a vulnerable checker', () => {
  const state = position({ 6: 1, 8: 1, 9: 2, 23: 11 }, { 0: 14, 11: 1 });
  assert.equal(getLandmineProfile(state, 'White').deficit, 49);
  for (const computer of ['BALANCED', 'CONTROLLED_COMEBACK']) {
    const move = choose(state, [1], { computer });
    assert.equal(move.from, 8);
    assert.equal(move.to, 9);
  }
});

test('both landmine tiers can deliberately split a point when a PEACE trap has safe re-entry', () => {
  for (const homePoint of [22, 20]) {
    const state = position({ 5: 1, 7: 1, 9: 2, [homePoint]: 11 }, { 0: 14, 11: 1 });
    assert.equal(getLandmineProfile(state, 'White').tier, homePoint === 22 ? 'CAUTIOUS' : 'STRONG');
    for (const computer of ['BALANCED', 'CONTROLLED_COMEBACK']) {
      const move = choose(state, [1], { computer });
      // Splitting the pair exposes points9 and10 to the opposing checker at11.
      // The other legal choices preserve the pair. Five re-entry points are open.
      assert.equal(move.from, 9);
      assert.equal(move.to, 10);
      const reflected = choose(mirror(state), [1], { player: 'Black', computer });
      assert.equal(reflected.from, 14);
      assert.equal(reflected.to, 13);
    }
  }
});

test('a stronger deficit does not make either computer sacrifice into a closed home', () => {
  const state = position({ 6: 1, 8: 1, 9: 2, 18: 11 }, { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 11: 1 });
  assert.equal(getLandmineProfile(state, 'White').deficit, 76);
  for (const computer of ['BALANCED', 'CONTROLLED_COMEBACK']) {
    const move = choose(state, [1], { computer });
    assert.equal(move.from, 8);
    assert.equal(move.to, 9);
  }
});

test('a large racing deficit does not activate landmines after contact is gone', () => {
  const state = position({ 18: 15 }, { 0: 1 });
  const profile = getLandmineProfile(state, 'White');
  assert.equal(profile.deficit, 89);
  assert.equal(profile.hasContact, false);
  assert.equal(profile.tier, 'NONE');
  assert.equal(profile.exposureAllowed, false);
});

test('no phantom bar-entry threat penalizes exposed checkers in a pure race', () => {
  const exposed = position({ 20: 1, 22: 1 }, { 0: 1 });
  const stacked = position({ 21: 2 }, { 0: 1 });
  const evaluate = state => scoreStrategicPosition(state, exposed, 'White', 'PEACE', 'BALANCED', engine.getRawMoves);
  assert.equal(evaluate(exposed), evaluate(stacked));
});

test('Enemy Control chooses from the controlling side and protects its own blot', () => {
  const state = position({ 0: 1, 4: 14 }, { 1: 2, 2: 1 }, { White: 0, Black: 1 });
  for (const computer of ['BALANCED', 'CONTROLLED_COMEBACK']) {
    const move = choose(state, [2], { controller: 'Black', computer });
    assert.equal(move.from, 4);
    assert.equal(move.to, 6);
    assert.equal(move.isHit, false);
    const reflected = choose(mirror(state), [2], { player: 'Black', controller: 'White', computer });
    assert.equal(reflected.from, 19);
    assert.equal(reflected.to, 17);
    assert.equal(reflected.isHit, false);
  }
});

test('both computer strategies remain inside mandatory full-turn PEACE legality', () => {
  const state = position({ 0: 1 }, { 1: 1, 3: 1 });
  for (const computer of ['BALANCED', 'CONTROLLED_COMEBACK']) {
    const move = choose(state, [1, 2], { computer });
    assert.equal(move.from, 0);
    assert.ok([1,2].includes(move.to));
    const next = engine.applyMove(state.board, move, 'White', state.bar, state.off);
    const follow=choose(next,[move.die===1?2:1],{computer,controller:'Black'});
    assert.ok(follow);
    assert.equal(Number(move.isHit)+Number(follow.isHit)>=1,true);
  }
});

test('computer respects a turn that requires the smaller die first to use both dice', () => {
  const state = position({ 22: 1 }, { 0: 1 });
  for (const computer of ['BALANCED', 'CONTROLLED_COMEBACK']) {
    const move = choose(state, [1, 2], { mode: 'WAR', computer });
    assert.equal(move.to, 23);
    assert.equal(move.die, 1);
  }
});

test('strategic choices are deterministic and preserve the supplied position', () => {
  const state = { board: engine.createStartingBoard(), bar: { White: 0, Black: 0 }, off: { White: 0, Black: 0 } };
  const before = JSON.stringify(state);
  const first = choose(state, [3, 3, 3, 3], { mode: 'WAR' });
  assert.deepEqual(choose(state, [3, 3, 3, 3], { mode: 'WAR' }), first);
  assert.equal(JSON.stringify(state), before);
});
