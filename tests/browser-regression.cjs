const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let chromium, webkit;
try {
  ({ chromium, webkit } = require('playwright'));
} catch {
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtimeModules) throw new Error('Install Playwright, or set CODEX_PRIMARY_RUNTIME_NODE_MODULES.');
  ({ chromium, webkit } = require(path.join(runtimeModules, 'playwright')));
}

const BASE_URL = process.env.BACKGAMMON_TEST_URL || 'http://127.0.0.1:5173/war-peace-backgammon/';
const SAVE_KEY = 'warPeaceBackgammonSaveV1';
const source = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
const betaPassword = source.match(/const BETA_PASSWORD\s*=\s*"([^"]+)"/)?.[1];
assert.ok(betaPassword, 'Read the existing beta gate configuration without logging it.');
const failuresDirectory = '/tmp/backgammon-browser-regression';
const filter = process.env.BACKGAMMON_TEST_FILTER ? new RegExp(process.env.BACKGAMMON_TEST_FILTER, 'i') : null;
const tests = [];
const register = (name, run) => tests.push({ name, run });

function makeSave({ white, black, bar = { White: 0, Black: 0 }, ...overrides }) {
  const board = Array.from({ length: 24 }, () => ({ owner: null, count: 0 }));
  for (const [index, count] of Object.entries(white)) board[Number(index)] = { owner: 'White', count };
  for (const [index, count] of Object.entries(black)) {
    assert.equal(board[Number(index)].count, 0, 'Test fixture points cannot overlap.');
    board[Number(index)] = { owner: 'Black', count };
  }
  const off = Object.fromEntries(['White', 'Black'].map(player => [player,
    15 - bar[player] - board.reduce((total, point) => total + (point.owner === player ? point.count : 0), 0),
  ]));
  assert.ok(off.White >= 0 && off.Black >= 0, 'Each fixture has 15 checkers per side.');
  return {
    version: 2, savedAt: new Date().toISOString(),
    playSetupMode: 'TWO_PLAYERS', computerStrategy: 'BALANCED',
    whitePlayerName: 'Test White', blackPlayerName: 'Test Black',
    gameRolls: 3, gamePlayableRolls: 3, gameUnplayableRolls: 0,
    board, bar, off, mode: 'WAR', currentPlayer: 'White', controller: 'White',
    controlState: 'NORMAL', gamePhase: 'NORMAL_TURN', remainingDice: [2, 3],
    lastMove: null, moveLog: [], turnMoveCount: 0,
    openingDice: null, openingWinner: null, awaitingModeChoice: false,
    openingTurnMoveMade: true, openingTurnRequiresMove: false,
    winner: null, finalResult: null, message: 'Browser regression position.',
    ...overrides,
  };
}

const moveFixture = overrides => makeSave({ white: { 0: 1, 18: 14 }, black: { 23: 15 }, ...overrides });

function completedTurnFixture(overrides = {}) {
  const move = { from: 0, to: 1, die: 1, isHit: false };
  return makeSave({
    white: { 0: 12, 1: 1, 22: 2 }, black: { 5: 14 }, bar: { White: 0, Black: 1 },
    remainingDice: [], turnMoveCount: 1, lastMove: move,
    moveLog: [{ id: 1, player: 'White', mode: 'WAR', controlState: 'NORMAL', controller: 'White', move, remainingDiceAfter: [] }],
    ...overrides,
  });
}

const point = (page, index) => page.locator(`[data-point-index="${index}"]`);
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function soundSettings(page, action) {
  await button(page, 'Sound').click();
  await page.getByRole('dialog', { name: 'Sound & messages', exact: true }).waitFor({ state: 'visible' });
  await action();
  await button(page, 'Close sound settings').click();
}

async function saved(page) {
  return page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || 'null'), SAVE_KEY);
}

async function waitSaved(page, predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let state;
  while (Date.now() < deadline) {
    state = await saved(page);
    if (state && predicate(state)) return state;
    await page.waitForTimeout(35);
  }
  throw new Error(`Saved-state condition timed out. Phase=${state?.gamePhase}, player=${state?.currentPlayer}, dice=${JSON.stringify(state?.remainingDice)}, moves=${state?.moveLog?.length}`);
}

async function loadFixture(page, fixture) {
  await page.evaluate(({ key, fixture }) => {
    window.localStorage.setItem(key, JSON.stringify(fixture));
    window.localStorage.setItem('warPeaceBackgammonSoundEnabledV1', 'off');
  }, { key: SAVE_KEY, fixture });
  await page.reload({ waitUntil: 'networkidle' });
  await button(page, 'Continue saved game').click();
  await page.getByTestId('board').waitFor({ state: 'visible' });
}

async function chooseTwoPlayers(page) {
  await page.getByRole('button', { name: /Pass & play.*Two players/ }).click();
  await button(page, 'Roll opening dice').waitFor({ state: 'visible' });
}

async function queueDice(page, dice) {
  // Test-only samples for the actual secure dice generator. Normal play uses
  // the browser's unmodified crypto API; no production seeding hook is added.
  await page.evaluate(values => {
    const original = crypto.getRandomValues.bind(crypto);
    const queued = values.map(die => die - 1);
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => {
      if (array instanceof Uint32Array && array.length === 1 && queued.length) { array[0] = queued.shift(); return array; }
      return original(array);
    }});
  }, dice);
}

register('tap selection moves a checker and Undo restores the full move', async page => {
  const fixture = moveFixture();
  await loadFixture(page, fixture);
  await point(page, 0).click();
  assert.equal(await point(page, 0).getAttribute('data-selected'), 'true');
  assert.equal(await point(page, 2).getAttribute('data-legal-destination'), 'true');
  await point(page, 2).click();
  await waitSaved(page, s => s.board[2].owner === 'White' && s.board[0].count === 0);
  assert.equal(await button(page, 'Undo move').isEnabled(), true);
  await button(page, 'Undo move').click();
  const restored = await waitSaved(page, s => s.board[0].count === 1 && s.board[2].count === 0);
  assert.deepEqual(restored.board, fixture.board);
  assert.deepEqual(restored.remainingDice, fixture.remainingDice);
  assert.equal(restored.moveLog.length, 0);
});

register('keyboard selection keeps focus and can complete a legal move', async page => {
  await loadFixture(page, moveFixture());
  await point(page, 0).focus();
  await page.keyboard.press('Enter');
  assert.equal(await point(page, 0).getAttribute('data-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-point-index')), '0');
  await point(page, 2).focus();
  await page.keyboard.press('Enter');
  await waitSaved(page, s => s.board[2].owner === 'White' && s.board[0].count === 0);
});

register('dragging across the board executes exactly one legal move', async page => {
  await loadFixture(page, moveFixture());
  const from = await point(page, 0).boundingBox();
  const to = await point(page, 2).boundingBox();
  assert.ok(from && to);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  const next = await waitSaved(page, s => s.board[2].owner === 'White' && s.board[0].count === 0);
  assert.equal(next.moveLog.length, 1);
  assert.deepEqual(next.remainingDice, [3]);
});

register('forced PEACE capture hands control to the computer, which protects its own blot', async page => {
  await loadFixture(page, makeSave({
    white: { 4: 14 }, black: { 0: 1, 1: 2, 2: 1 }, bar: { White: 1, Black: 0 },
    playSetupMode: 'COMPUTER_BALANCED', blackPlayerName: 'Computer 1 - Balanced',
    mode: 'PEACE', remainingDice: [1, 2],
  }));
  await point(page, 0).click();
  const controlled = await waitSaved(page, s => s.controlState === 'ENEMY_CONTROL' && s.moveLog.length === 1);
  assert.equal(controlled.controller, 'Black');
  assert.equal(controlled.currentPlayer, 'White');
  assert.deepEqual(controlled.remainingDice, [2]);
  const moved = await waitSaved(page, s => s.moveLog.length >= 2);
  assert.equal(moved.moveLog[1].move.from, 4);
  assert.equal(moved.moveLog[1].move.to, 6);
  assert.equal(moved.moveLog[1].move.isHit, false);
  assert.equal(moved.board[2].owner, 'Black');
  assert.equal(moved.bar.Black, 1);
});

register('menu and reload resume preserve computer selection, names, board, dice and counters', async page => {
  await loadFixture(page, moveFixture({
    playSetupMode: 'COMPUTER_AGGRESSIVE', computerStrategy: 'CONTROLLED_COMEBACK',
    whitePlayerName: 'Resume White', blackPlayerName: 'Computer 2 - Aggressive', gameRolls: 9,
    gamePlayableRolls: 8, gameUnplayableRolls: 1,
  }));
  await point(page, 0).click();
  await point(page, 2).click();
  const before = await waitSaved(page, s => s.board[2].count === 1);
  await button(page, 'Menu').click();
  await button(page, 'Continue saved game').click();
  assert.match(await page.locator('.game-opponent').innerText(), /Computer 2.*Aggressive/);
  await page.reload({ waitUntil: 'networkidle' });
  await button(page, 'Continue saved game').click();
  await page.getByTestId('board').waitFor({ state: 'visible' });
  const after = await saved(page);
  for (const key of ['playSetupMode', 'computerStrategy', 'whitePlayerName', 'blackPlayerName', 'gameRolls', 'gamePlayableRolls', 'gameUnplayableRolls']) assert.equal(after[key], before[key], key);
  assert.deepEqual(after.board, before.board);
  assert.deepEqual(after.remainingDice, before.remainingDice);
});

register('Menu cancels an opening roll before starting a different game', async page => {
  await page.getByRole('button', { name: /Computer 1.*Balanced/ }).click();
  await button(page, 'Roll opening dice').click();
  await button(page, 'Menu').click();
  await chooseTwoPlayers(page);
  await page.waitForTimeout(850);
  assert.equal(await button(page, 'Roll opening dice').isEnabled(), true);
  assert.equal(await button(page, 'Choose WAR').count(), 0);
  assert.match(await point(page, 0).getAttribute('aria-label'), /2 White/);
  assert.match(await point(page, 23).getAttribute('aria-label'), /2 Black/);
});

register('Menu cancels an ordinary next-turn roll before resetting the game', async page => {
  await loadFixture(page, completedTurnFixture());
  await button(page, 'End turn').click();
  await button(page, 'Menu').click();
  await chooseTwoPlayers(page);
  await page.waitForTimeout(850);
  assert.equal(await button(page, 'Roll opening dice').isEnabled(), true);
  assert.equal(await button(page, 'Choose WAR').count(), 0);
  assert.match(await point(page, 0).getAttribute('aria-label'), /2 White/);
  assert.match(await point(page, 23).getAttribute('aria-label'), /2 Black/);
});

register('human resignation during the computer turn awards the win to Black', async page => {
  await loadFixture(page, makeSave({
    white: { 0: 15 }, black: { 23: 1, 5: 14 }, currentPlayer: 'Black', controller: 'Black',
    playSetupMode: 'COMPUTER_BALANCED', blackPlayerName: 'Computer 1 - Balanced',
  }));
  await button(page, 'Resign').click();
  await button(page, 'Confirm resign').click();
  await page.getByText('Black wins', { exact: true }).waitFor({ state: 'visible' });
  assert.match(await page.getByTestId('status').innerText(), /White resigned/);
  assert.equal(await button(page, 'Undo move').isDisabled(), true);
});

register('resignation confirmation cannot transfer from White to Black', async page => {
  await loadFixture(page, completedTurnFixture({ bar: { White: 0, Black: 0 }, black: { 5: 15 } }));
  await button(page, 'Resign').click();
  const end = button(page, 'End turn');
  if (await end.isDisabled()) {
    await button(page, 'Keep playing').click();
    assert.equal(await button(page, 'Confirm resign').count(), 0);
    await end.click();
  } else {
    await end.click();
  }
  await waitSaved(page, s => s.currentPlayer === 'Black');
  assert.equal(await button(page, 'Confirm resign').count(), 0);
  assert.equal(await button(page, 'Resign').isEnabled(), true);
});

register('bearing off the last checker ends the game and disables Undo', async page => {
  await loadFixture(page, makeSave({ white: { 23: 1 }, black: { 0: 15 }, remainingDice: [6] }));
  await point(page, 23).click();
  await page.locator('[data-bear-off-player="White"]').click();
  await page.getByText('White wins', { exact: true }).waitFor({ state: 'visible' });
  assert.match(await page.getByTestId('status').innerText(), /bearing off all 15/);
  assert.equal(await button(page, 'Undo move').isDisabled(), true);
  assert.equal(await saved(page), null);
});

register('a checker can be dragged directly into its OFF tray', async page => {
  await loadFixture(page, makeSave({ white: { 22: 2 }, black: { 0: 15 }, remainingDice: [2] }));
  const from = await point(page, 22).boundingBox();
  const to = await page.locator('[data-bear-off-player="White"]').boundingBox();
  assert.ok(from && to);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  const next = await waitSaved(page, s => s.off.White === 14 && s.board[22].count === 1);
  assert.equal(next.moveLog.length, 1);
  assert.equal(next.moveLog[0].move.isBearOff, true);
});

register('blocked doubles preserve WAR and a blocked bar turn automatically passes', async page => {
  await loadFixture(page, completedTurnFixture());
  await queueDice(page, [2, 2, 3, 4]);
  await button(page, 'End turn').click();
  const blocked = await waitSaved(page, s => s.currentPlayer === 'Black' && s.remainingDice.length === 4);
  assert.deepEqual(blocked.remainingDice, [2, 2, 2, 2]);
  assert.equal(blocked.mode, 'WAR');
  assert.equal(blocked.bar.Black, 1);
  assert.match(await page.getByTestId('mode').innerText(), /WAR/);
  const passed = await waitSaved(page, s => s.currentPlayer === 'White' && s.gameRolls === blocked.gameRolls + 1, 6000);
  assert.equal(passed.mode, 'WAR');
  assert.equal(passed.bar.Black, 1);
  assert.deepEqual(passed.remainingDice, [3, 4]);
});

register('public game hides diagnostics and the testing URL exposes them', async page => {
  assert.equal(await page.getByRole('region', { name: 'Developer testing tools' }).count(), 0);
  const testingUrl = new URL(BASE_URL);
  testingUrl.searchParams.set('testing', '1');
  await page.goto(testingUrl.href, { waitUntil: 'networkidle' });
  await chooseTwoPlayers(page);
  await button(page, 'Testing tools').click();
  assert.equal(await button(page, 'Run 1').isVisible(), true);
  assert.equal(await button(page, 'Run 10').isVisible(), true);
});

register('six-four permits moving a home four before bringing the last outside checker home', async page => {
  await loadFixture(page, makeSave({ white: { 17: 1, 18: 1, 20: 13 }, black: { 0: 15 }, remainingDice: [6, 4], mode: 'PEACE' }));
  await point(page, 18).click();
  assert.equal(await point(page, 22).getAttribute('data-legal-destination'), 'true');
  await point(page, 22).click();
  const first = await waitSaved(page, s => s.turnMoveCount === 1);
  assert.equal(first.moveLog[0].move.die, 4);
  assert.equal(first.bearOffPriorityAtTurnStart, false);
  assert.equal(await button(page, 'End turn').isDisabled(), true);
  await point(page, 17).click();
  await point(page, 23).click();
  const finished = await waitSaved(page, s => s.remainingDice.length === 0);
  assert.equal(finished.off.White, 0);
  assert.equal(finished.board[22].count, 1);
  assert.equal(finished.board[23].count, 1);
  assert.equal(await button(page, 'End turn').isEnabled(), true);
});

register('entering home with six does not force a bear-off after reload, undo, or legacy save migration', async page => {
  const fixture = makeSave({ white: { 17: 1, 18: 1, 20: 13 }, black: { 0: 15 }, remainingDice: [6, 4] });
  await loadFixture(page, fixture);
  await point(page, 17).click();
  await point(page, 23).click();
  const entered = await waitSaved(page, s => s.turnMoveCount === 1 && s.board[17].count === 0);
  assert.equal(entered.bearOffPriorityAtTurnStart, false);
  assert.equal(entered.version, 4);
  await button(page, 'Menu').click();
  await button(page, 'Continue saved game').click();
  await point(page, 18).click();
  assert.equal(await point(page, 22).getAttribute('data-legal-destination'), 'true');
  await point(page, 22).click();
  await waitSaved(page, s => s.remainingDice.length === 0 && s.off.White === 0);
  await button(page, 'Undo move').click();
  const undone = await waitSaved(page, s => s.remainingDice.length === 1);
  assert.equal(undone.bearOffPriorityAtTurnStart, false);
  await point(page, 18).click();
  assert.equal(await point(page, 22).getAttribute('data-legal-destination'), 'true');

  const legacy = { ...entered, version: 2 };
  delete legacy.bearOffPriorityAtTurnStart;
  await loadFixture(page, legacy);
  assert.equal((await saved(page)).bearOffPriorityAtTurnStart, false);
  await point(page, 18).click();
  assert.equal(await point(page, 22).getAttribute('data-legal-destination'), 'true');
});

register('PEACE cannot choose a quiet partial turn or end before a remaining playable die', async page => {
  await loadFixture(page, makeSave({ white: { 0: 1, 5: 1 }, black: { 1: 1, 2: 2, 7: 2, 8: 2 }, remainingDice: [1, 2], mode: 'PEACE' }));
  assert.equal(await point(page, 5).getAttribute('data-legal-origin'), 'false', 'The quiet move would strand the second die.');
  await point(page, 0).click();
  assert.equal(await point(page, 1).getAttribute('data-legal-destination'), 'true');
  await point(page, 1).click();
  const controlled = await waitSaved(page, s => s.controlState === 'ENEMY_CONTROL');
  assert.equal(controlled.controller, 'Black');
  assert.deepEqual(controlled.remainingDice, [2]);
  assert.equal(await button(page, 'End turn').isDisabled(), true);
  await point(page, 1).click();
  await point(page, 3).click();
  await waitSaved(page, s => s.remainingDice.length === 0);
  assert.equal(await button(page, 'End turn').isEnabled(), true);
});

register('ambiguous bearing-off lets the human choose either die for tray taps, drags, and repeated source taps', async page => {
  const fixture = () => makeSave({ white: { 23: 2 }, black: { 0: 15 }, remainingDice: [4, 6] });
  for (const input of ['tray', 'drag', 'source']) {
    if (input === 'source') await page.setViewportSize({ width: 390, height: 844 });
    await loadFixture(page, fixture());
    if (input === 'drag') {
      const from = await point(page, 23).boundingBox();
      const to = await page.locator('[data-bear-off-player="White"]').boundingBox();
      assert.ok(from && to);
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
      await page.mouse.up();
    } else {
      await point(page, 23).click();
      if (input === 'tray') await page.locator('[data-bear-off-player="White"]').click();
      else await point(page, 23).click();
    }
    assert.equal(await button(page, 'Use 4').isVisible(), true, input);
    assert.equal(await button(page, 'Use 6').isVisible(), true, input);
    assert.equal((await saved(page)).off.White, 13, 'Requesting a choice must not consume a die.');
    if (input === 'tray') {
      await button(page, 'Cancel die choice').click();
      assert.equal(await page.getByTestId('bear-off-choice').count(), 0);
      assert.equal((await saved(page)).off.White, 13);
      await page.locator('[data-bear-off-player="White"]').click();
      assert.equal(await button(page, 'Use 4').isVisible(), true);
    }
    const chosen = input === 'drag' ? 6 : 4;
    await button(page, `Use ${chosen}`).click();
    const next = await waitSaved(page, s => s.off.White === 14);
    assert.deepEqual(next.remainingDice, [chosen === 4 ? 6 : 4]);
    assert.equal(next.moveLog[0].move.die, chosen);
    await button(page, 'Undo move').click();
    await waitSaved(page, s => s.off.White === 13);
    assert.equal(await button(page, 'Use 4').count(), 0);
  }
});

register('full-point frames distinguish legal sources, selected destination, and completed move', async page => {
  await loadFixture(page, moveFixture());
  assert.equal(await point(page, 0).getAttribute('data-legal-origin'), 'true');
  assert.equal(await page.locator('.origin-mark,.destination-mark').count(), 0);
  assert.equal(await point(page, 2).getAttribute('data-legal-destination'), 'false', 'Destinations wait for a selected source.');
  const originFrame = await point(page, 0).locator('.point-move-frame').evaluate(el => ({ color: getComputedStyle(el).borderColor, width: getComputedStyle(el).borderTopWidth }));
  assert.ok(parseFloat(originFrame.width) >= 2, 'The origin frame is visible at tablet size.');
  await point(page, 0).click();
  const destinationFrame = await point(page, 2).locator('.point-move-frame').evaluate(el => ({ color: getComputedStyle(el).borderColor, width: getComputedStyle(el).borderTopWidth }));
  assert.notEqual(destinationFrame.color, originFrame.color);
  assert.ok(parseFloat(destinationFrame.width) >= 2);
  await point(page, 2).click();
  await waitSaved(page, s => s.board[2].count === 1);
  assert.equal(await point(page, 0).getAttribute('data-last-origin'), 'true');
  assert.equal(await point(page, 2).getAttribute('data-last-destination'), 'true');
  assert.equal(await page.locator('.last-move-frame').count(), 2);
});

register('centered game messages have a visible toggle and remember the off setting', async page => {
  const capture = mode => makeSave({ white: { 0: 1, 18: 14 }, black: { 1: 1, 5: 14 }, remainingDice: [1], mode });
  async function centeredMessage(selector) {
    await page.locator(selector).waitFor({state:'visible'});
    const initial = await page.locator(selector).evaluate(node => {
      const m=node.getBoundingClientRect(),b=node.closest('[data-testid="board"]').getBoundingClientRect();
      return {message:{x:m.x,y:m.y,width:m.width,height:m.height},board:{x:b.x,y:b.y,width:b.width,height:b.height}};
    });
    await page.waitForFunction(selector => {
      const message = document.querySelector(selector);
      const board = message?.closest('[data-testid="board"]');
      if (!message || !board) return false;
      const m = message.getBoundingClientRect(), b = board.getBoundingClientRect();
      return Math.abs(m.left + m.width / 2 - b.left - b.width / 2) < 1 &&
        Math.abs(m.top + m.height / 2 - b.top - b.height / 2) < 1 &&
        m.left >= b.left && m.right <= b.right && m.top >= b.top && m.bottom <= b.bottom;
    }, selector).catch(error => { throw new Error(`${error.message}; initial geometry=${JSON.stringify(initial)}`); });
  }
  for (const viewport of [{width:1366,height:900}, {width:1024,height:768}, {width:912,height:590}, {width:768,height:1024}, {width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await loadFixture(page, capture('WAR'));
    assert.equal(await button(page, 'Messages on').isVisible(), true);
    await centeredMessage('.turn-toast');
    await point(page, 0).click();
    await point(page, 1).click();
    await page.getByTestId('game-narration').waitFor({ state: 'visible' });
    assert.match(await page.getByTestId('game-narration').innerText(), /Prisoner of War/);
    await centeredMessage('[data-testid="game-narration"]');
    assert.equal(await page.locator('.turn-toast').count(), 0, 'Only one message appears at a time.');
    if (process.env.BACKGAMMON_SCREENSHOT_DIRECTORY) {
      fs.mkdirSync(process.env.BACKGAMMON_SCREENSHOT_DIRECTORY, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BACKGAMMON_SCREENSHOT_DIRECTORY, `centered-messages-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
  }
  await button(page, 'Dismiss game narration').click();
  assert.equal(await page.getByTestId('game-narration').count(), 0);
  await button(page, 'Messages on').click();
  await page.waitForFunction(() => localStorage.getItem('warPeaceBackgammonNarrationEnabledV1') === 'off');
  await loadFixture(page, capture('WAR'));
  assert.equal(await button(page, 'Messages off').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.turn-toast').count(), 0, 'The preference also hides ordinary turn notices after reload.');
  await soundSettings(page, async () => assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Messages off', exact: true }).isVisible(), true));
  await point(page, 0).click();
  await point(page, 1).click();
  await waitSaved(page, s => s.bar.Black === 1);
  assert.equal(await page.getByTestId('game-narration').count(), 0);
  await soundSettings(page, async () => { await page.getByRole('dialog').getByRole('button', { name: 'Messages off', exact: true }).click(); });
  assert.equal(await button(page, 'Messages on').getAttribute('aria-pressed'), 'true');
  await loadFixture(page, makeSave({ white: { 4: 14 }, black: { 0: 1, 1: 2, 2: 1 }, bar: { White: 1, Black: 0 }, remainingDice: [1, 2], mode: 'PEACE' }));
  await point(page, 0).click();
  await page.getByTestId('game-narration').waitFor({ state: 'visible' });
  assert.match(await page.getByTestId('game-narration').innerText(), /VENGEANCE — ALL MOVES/);
  assert.match(await page.getByTestId('game-narration').innerText(), /Black \(opponent\).*ALL moves/s);
  await soundSettings(page, async () => assert.equal(await button(page, 'Sound off').isVisible(), true, 'Narration does not enable sound.'));
  await button(page, 'Messages on').click();
  assert.equal(await page.getByTestId('game-narration').count(), 0, 'Switching off dismisses the current message immediately.');
  await button(page, 'Messages off').click();
  await page.getByTestId('game-narration').waitFor({ state: 'visible' });
  assert.match(await page.getByTestId('game-narration').innerText(), /VENGEANCE — ALL MOVES/, 'Switching on explains the active VENGEANCE turn.');
});

register('malformed saved player names and opening dice are rejected without breaking the menu', async page => {
  for (const malformed of [
    moveFixture({ whitePlayerName: 42 }),
    moveFixture({ openingDice: [9, 9] }),
  ]) {
    await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: SAVE_KEY, fixture: malformed });
    await page.reload({ waitUntil: 'networkidle' });
    await button(page, 'Continue saved game').click();
    await page.waitForFunction(key => localStorage.getItem(key) === null, SAVE_KEY);
    assert.equal(await button(page, 'Continue saved game').count(), 0);
    assert.equal(await page.getByTestId('board').count(), 0);
    assert.equal(await page.getByRole('button', { name: /Computer 1.*Balanced/ }).isEnabled(), true);
    await chooseTwoPlayers(page);
    assert.equal(await button(page, 'Roll opening dice').isEnabled(), true);
    await button(page, 'Menu').click();
  }
});

register('returning-player sound unlocks a native AudioContext and off/on choices persist', async page => {
  // Preserve the real native implementation and observe its state. This checks
  // browser audio activation, not whether a particular device produces sound.
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    window.__backgammonAudioContexts = [];
    if (!NativeAudioContext) return;
    class ObservedAudioContext extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        window.__backgammonAudioContexts.push(this);
      }
    }
    window.AudioContext = ObservedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = ObservedAudioContext;
  });
  await page.evaluate(() => localStorage.setItem('warPeaceBackgammonSoundEnabledV1', 'on'));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('Beta password').count(), 0, 'The legitimate earlier beta login is remembered.');
  assert.equal(await page.evaluate(() => window.__backgammonAudioContexts.length), 0, 'Reload starts without an old audio context.');
  await chooseTwoPlayers(page);
  await page.waitForFunction(() => window.__backgammonAudioContexts.some(context => context.state === 'running'));
  await soundSettings(page, async () => assert.equal(await button(page, 'Sound on').isVisible(), true));

  await soundSettings(page, async () => { await button(page, 'Sound on').click(); });
  await page.waitForFunction(() => localStorage.getItem('warPeaceBackgammonSoundEnabledV1') === 'off');
  await page.reload({ waitUntil: 'networkidle' });
  await chooseTwoPlayers(page);
  await soundSettings(page, async () => assert.equal(await button(page, 'Sound off').isVisible(), true));
  assert.equal(await page.evaluate(() => window.__backgammonAudioContexts.length), 0, 'Sound-off play must not initialize audio.');

  await soundSettings(page, async () => { await button(page, 'Sound off').click(); });
  await page.waitForFunction(() => window.__backgammonAudioContexts.some(context => context.state === 'running'));
  await page.waitForFunction(() => localStorage.getItem('warPeaceBackgammonSoundEnabledV1') === 'on');
  await page.reload({ waitUntil: 'networkidle' });
  await chooseTwoPlayers(page);
  await soundSettings(page, async () => assert.equal(await button(page, 'Sound on').isVisible(), true));
  await page.waitForFunction(() => window.__backgammonAudioContexts.some(context => context.state === 'running'));
});

register('VENGEANCE changes the whole table and leaves ownership with the moving side', async page => {
  await loadFixture(page, makeSave({ white: { 4: 14 }, black: { 0: 1, 1: 2, 2: 1 }, bar: { White: 1, Black: 0 }, remainingDice: [1, 2], mode: 'PEACE' }));
  await point(page, 0).click();
  await waitSaved(page, s => s.controlState === 'ENEMY_CONTROL' && s.remainingDice[0] === 2);
  assert.equal(await page.locator('.theme-vengeance').count(), 1);
  assert.match(await page.getByTestId('mode').innerText(), /VENGEANCE/);
  assert.match(await page.getByTestId('turn').innerText(), /BLACK MAKES ALL MOVES.*White’s checkers/s);
  assert.equal(await point(page, 0).locator('.checker-light').count(), 1);
  assert.match(await page.getByTestId('game-narration').innerText(), /VENGEANCE — ALL MOVES/);
  await button(page, 'Dismiss game narration').click();
  await point(page, 4).click();
  await point(page, 6).click();
  const result = await waitSaved(page, s => s.remainingDice.length === 0);
  assert.equal(result.board[6].owner, 'White');
  assert.equal(result.controller, 'Black');
  assert.equal(await page.locator('.theme-vengeance').count(), 1, 'The opponent owns the entire turn until it ends.');
});

register('a forced final-die PEACE capture belongs to the opponent before that move', async page => {
  await loadFixture(page, makeSave({ white: { 2: 1, 4: 2, 18: 4, 20: 4, 22: 4 }, black: { 3: 1, 5: 14 }, currentPlayer:'Black',controller:'Black',remainingDice: [1], mode: 'PEACE' }));
  assert.equal((await saved(page)).controller,'White');
  assert.match(await page.getByTestId('turn').innerText(),/WHITE MAKES ALL MOVES/);
  await point(page, 3).click(); await point(page, 2).click();
  await waitSaved(page, s => s.bar.White === 1 && s.remainingDice.length === 0);
  assert.equal(await page.locator('.theme-vengeance').count(), 1);
  assert.match(await page.getByTestId('mode').innerText(), /VENGEANCE/);
  assert.match(await page.getByTestId('game-narration').innerText(), /ALL moves/);
});

register('illustrated rules assign all moves before an unavoidable PEACE capture', async page => {
  await chooseTwoPlayers(page);
  await button(page, 'How to play').click();
  await page.getByRole('tab', {name:'Watch the rules'}).click();
  const examples=page.locator('.rule-examples');
  await examples.getByRole('button',{name:'VENGEANCE',exact:true}).click();
  assert.match(await examples.innerText(), /White commands BEFORE the first move/);
  await examples.getByRole('button',{name:'White chooses the bar capture',exact:true}).click();
  assert.match(await examples.innerText(), /White chose Black/);
  assert.match(await examples.locator('.example-caption').innerText(), /White commands Black/);
  await examples.getByRole('button',{name:'When the capture uses the last die',exact:true}).click();
  await examples.getByRole('button',{name:'Use the quiet 2',exact:true}).click();
  await examples.getByRole('button',{name:'Capture with the last 1',exact:true}).click();
  assert.match(await examples.innerText(), /White chose the entire roll/i);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
});

register('tablet rotation keeps the board and controls visible without overlapping checkers', async page => {
  await loadFixture(page, moveFixture());
  for(const viewport of [{width:1024,height:768},{width:1024,height:650},{width:912,height:590},{width:768,height:1024},{width:1366,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport); await page.waitForTimeout(180);
    const layout=await page.evaluate(()=>{
      const board=document.querySelector('[data-testid=board]').getBoundingClientRect();
      const controls=document.querySelector('.game-console').getBoundingClientRect();
      let overlap=false;
      document.querySelectorAll('.checker-stack').forEach(stack=>{
        const pieces=[...stack.children].map(n=>n.getBoundingClientRect()).sort((a,b)=>a.top-b.top);
        for(let i=1;i<pieces.length;i++)if(pieces[i].top<pieces[i-1].bottom+1)overlap=true;
      });
      return {ratio:board.width/board.height,boardWidth:board.width,appWidth:document.querySelector('main').getBoundingClientRect().width,controlsBottom:controls.bottom,overlap,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(Math.abs(layout.ratio-4/3)<.01);
    assert.equal(layout.overlap,false);
    assert.equal(layout.overflow,false);
    if(viewport.width>=768)assert.ok(layout.controlsBottom<=viewport.height+1,JSON.stringify({viewport,layout}));
    if(viewport.width>=800&&viewport.width/viewport.height>=1.2){
      assert.ok(layout.appWidth>=viewport.width*.85,JSON.stringify({viewport,layout}));
      assert.ok(layout.boardWidth>=viewport.width*.68,JSON.stringify({viewport,layout}));
    }
  }
});

register('name entry and pinch zoom do not shrink the landscape table',async page=>{
  await page.setViewportSize({width:912,height:590});
  await chooseTwoPlayers(page);
  await page.waitForTimeout(180);
  const board=page.getByTestId('board');
  const before=await board.evaluate(n=>n.getBoundingClientRect().width);
  assert.ok(before>=620,'The opening board should use the landscape space.');
  await page.getByLabel('White player name').focus();
  await page.evaluate(()=>{
    Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>260});
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(120);
  assert.ok(Math.abs((await board.evaluate(n=>n.getBoundingClientRect().width))-before)<1,'Typing must not shrink the board.');
  await page.evaluate(()=>document.activeElement.blur());
  await page.waitForTimeout(150);
  const beforeZoom=await board.evaluate(n=>n.getBoundingClientRect().width);
  await page.evaluate(()=>{
    Object.defineProperty(visualViewport,'scale',{configurable:true,get:()=>2});
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(120);
  assert.ok(Math.abs((await board.evaluate(n=>n.getBoundingClientRect().width))-beforeZoom)<1,'Pinch zoom must not shrink the layout.');
  await page.evaluate(()=>{
    delete visualViewport.height;delete visualViewport.scale;
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(120);
  assert.ok((await board.evaluate(n=>n.getBoundingClientRect().width))>=620);
});

register('music is opt-in, survives closing settings, and follows WAR PEACE and VENGEANCE', async page => {
  await loadFixture(page, makeSave({ white: { 4: 14 }, black: { 0: 1, 1: 2, 2: 1 }, bar: { White: 1, Black: 0 }, remainingDice: [1, 2], mode: 'PEACE' }));
  assert.equal(await page.evaluate(()=>localStorage.getItem('warPeaceBackgammonMusicEnabledV1')),'off');
  await soundSettings(page,async()=>{await button(page,'Play music').click();});
  assert.equal(await page.evaluate(()=>localStorage.getItem('warPeaceBackgammonMusicEnabledV1')),'on');
  assert.equal(await page.locator('main').getAttribute('data-music-mode'),'VENGEANCE');
  await point(page,0).click();await waitSaved(page,s=>s.controller==='Black');
  assert.equal(await page.locator('main').getAttribute('data-music-mode'),'VENGEANCE');
  await soundSettings(page,async()=>{assert.equal(await button(page,'Pause music').isVisible(),true);await button(page,'Pause music').click();});
  await loadFixture(page,moveFixture());
  assert.equal(await page.locator('main').getAttribute('data-music-mode'),'WAR');
  assert.equal(await page.evaluate(()=>localStorage.getItem('warPeaceBackgammonMusicEnabledV1')),'off');
});

register('the opponent chooses the quiet first move as well as the later forced capture',async page=>{
  await loadFixture(page,makeSave({white:{0:1},black:{3:1},mode:'PEACE',remainingDice:[1,2]}));
  const initial=await saved(page);
  assert.equal(initial.controller,'Black');
  assert.equal(initial.moveLog.length,0);
  assert.equal(initial.bar.Black,0);
  assert.match(await page.getByTestId('turn').innerText(),/BLACK MAKES ALL MOVES/);
  await point(page,0).click();await point(page,1).click();
  const quiet=await waitSaved(page,s=>s.moveLog.length===1);
  assert.equal(quiet.moveLog[0].move.isHit,false);
  assert.equal(quiet.moveLog[0].controller,'Black');
  await button(page,'Undo move').click();
  await waitSaved(page,s=>s.moveLog.length===0&&s.remainingDice.length===2);
  assert.equal((await saved(page)).controller,'Black');
  await point(page,0).click();await point(page,1).click();
  await page.reload({waitUntil:'networkidle'});await button(page,'Continue saved game').click();
  assert.match(await page.getByTestId('turn').innerText(),/BLACK MAKES ALL MOVES/);
  await point(page,1).click();await point(page,3).click();
  const final=await waitSaved(page,s=>s.remainingDice.length===0);
  assert.equal(final.bar.Black,1);
  assert.ok(final.moveLog.every(m=>m.controller==='Black'));
});

register('a complete quiet PEACE option prevents VENGEANCE and prevents choosing a capture',async page=>{
  await loadFixture(page,makeSave({white:{0:1,18:14},black:{1:1,5:14},mode:'PEACE',remainingDice:[1]}));
  assert.equal((await saved(page)).controller,'White');
  assert.equal(await page.locator('.theme-vengeance').count(),0);
  await point(page,0).click();await point(page,1).click();
  assert.equal((await saved(page)).bar.Black,0);
  await point(page,18).click();await point(page,19).click();
  const final=await waitSaved(page,s=>s.remainingDice.length===0);
  assert.equal(final.bar.Black,0);
  assert.equal(final.controller,'White');
});

register('the opponent computer owns the quiet first move before a forced capture',async page=>{
  await loadFixture(page,makeSave({white:{0:1},black:{3:1},mode:'PEACE',remainingDice:[1,2],playSetupMode:'COMPUTER_BALANCED'}));
  assert.equal((await saved(page)).controller,'Black');
  await point(page,0).click();
  assert.equal(await point(page,0).getAttribute('data-selected'),'false');
  const first=await waitSaved(page,s=>s.moveLog.length>=1);
  assert.equal(first.moveLog[0].controller,'Black');
  assert.equal(first.moveLog[0].move.isHit,false);
  const final=await waitSaved(page,s=>s.moveLog.length>=2);
  assert.equal(final.bar.Black,1);
  assert.ok(final.moveLog.every(m=>m.controller==='Black'));
});

register('the human opponent controls the computer checkers from the first quiet move',async page=>{
  await loadFixture(page,makeSave({white:{20:1},black:{23:1},mode:'PEACE',remainingDice:[1,2],currentPlayer:'Black',controller:'Black',playSetupMode:'COMPUTER_BALANCED'}));
  assert.equal((await saved(page)).controller,'White');
  await page.waitForTimeout(800);
  assert.equal((await saved(page)).moveLog.length,0,'The computer must wait for its opponent.');
  await point(page,23).click();await point(page,22).click();
  const first=await waitSaved(page,s=>s.moveLog.length===1);
  assert.equal(first.moveLog[0].move.isHit,false);
  assert.equal(first.moveLog[0].controller,'White');
  await point(page,22).click();await point(page,20).click();
  const final=await waitSaved(page,s=>s.remainingDice.length===0);
  assert.equal(final.bar.White,1);
  assert.ok(final.moveLog.every(m=>m.controller==='White'));
});

register('the opponent can choose minimum one or all four captures with the same dice',async page=>{
  await page.setViewportSize({width:912,height:590});
  const tap=index=>point(page,index).tap();
  for(const extra of [false,true]){
    await loadFixture(page,makeSave({white:{18:14},black:{0:1,1:1,2:1,3:1},bar:{White:1,Black:0},mode:'PEACE',remainingDice:[1,1,1,1]}));
    assert.equal((await saved(page)).controller,'Black');
    await page.waitForTimeout(180);
    assert.ok(await page.locator('.game-console').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight+1),'Four dice and controls fit the short iPad viewport.');
    await tap(0);
    await waitSaved(page,s=>s.moveLog.length===1);
    for(let n=0;n<3;n++){
      await tap(extra?n:18+n);await tap(extra?n+1:19+n);
      await waitSaved(page,s=>s.moveLog.length===n+2);
    }
    const final=await waitSaved(page,s=>s.remainingDice.length===0);
    assert.equal(final.bar.Black,extra?4:1);
    assert.ok(final.moveLog.every(m=>m.controller==='Black'));
    const bar=page.getByRole('button',{name:/^Black bar:/});
    assert.equal(await bar.locator('.bar-checker').count(),extra?4:1);
    assert.equal((await bar.innerText()).trim(),'');
  }
});

register('captured checkers stack on the bar without numbers and dice use the side panel',async page=>{
  for(const count of [1,6,15]){
    await loadFixture(page,makeSave({white:{18:15},black:count===15?{}:{5:15-count},bar:{White:0,Black:count},mode:'WAR',remainingDice:[1,1,1,1]}));
    const bar=page.getByRole('button',{name:/^Black bar:/});
    assert.equal(await bar.locator('.bar-checker').count(),count);
    assert.equal((await bar.innerText()).trim(),'');
    const geometry=await bar.evaluate(node=>{
      const bar=node.getBoundingClientRect(),pieces=[...node.querySelectorAll('.bar-checker')].map(n=>n.getBoundingClientRect());
      return pieces.every((p,i)=>p.top>=bar.top&&p.bottom<=bar.bottom&&(!i||p.top>=pieces[i-1].bottom+1));
    });
    assert.equal(geometry,true);
    const dice=await page.locator('.game-die').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
    assert.equal(dice.length,4);assert.ok(dice.every(size=>size>=44));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
});

register('opening sound settings pauses the computer until the dialog closes',async page=>{
  await loadFixture(page,makeSave({white:{0:15},black:{23:15},currentPlayer:'Black',controller:'Black',playSetupMode:'COMPUTER_BALANCED'}));
  await button(page,'Sound').click();
  const before=await saved(page);
  await page.waitForTimeout(850);
  assert.deepEqual((await saved(page)).board,before.board);
  assert.deepEqual((await saved(page)).remainingDice,before.remainingDice);
  await button(page,'Close sound settings').click();
  await waitSaved(page,s=>s.moveLog.length>before.moveLog.length);
});


register('free dice choice supports smaller larger left and right first for both colors', async page => {
  for (const player of ['White','Black']) for (const roll of [[6,4],[4,6]]) for (const first of [4,6]) {
    const fixture = player === 'White' ? makeSave({white:{0:1,18:14},black:{23:15},remainingDice:roll}) :
      makeSave({white:{0:15},black:{23:1,5:14},remainingDice:roll,currentPlayer:'Black',controller:'Black'});
    await loadFixture(page,fixture);
    const dice = page.getByTestId('dice').locator('.game-die');
    assert.equal(await dice.count(),2);
    for (const die of await dice.all()) assert.equal(await die.isEnabled(),true);
    const index = roll.indexOf(first), from = player==='White'?0:23, direction=player==='White'?1:-1;
    if (index===1) await dice.nth(index).click(); // A move also works without choosing a die first.
    await point(page,from).click(); await point(page,from+direction*first).click();
    await waitSaved(page,state=>state.turnMoveCount===1);
    assert.equal(await dice.count(),2,'Using a die never removes or reorders it.');
    assert.deepEqual(await dice.evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.dieValue))),roll);
    assert.equal(await dice.nth(index).getAttribute('data-used'),'true');
    assert.equal(await dice.nth(1-index).getAttribute('data-used'),'false');
    const opacity=await dice.nth(index).evaluate(node=>Number(getComputedStyle(node).opacity));
    assert.ok(opacity<.4,'A consumed die is visibly dim.');
    await point(page,from+direction*first).click(); await point(page,from+direction*10).click();
    await waitSaved(page,state=>state.remainingDice.length===0);
    assert.equal(await page.getByTestId('dice').locator('.game-die[data-used="true"]').count(),2);
    await button(page,'Undo move').click();
    await waitSaved(page,state=>state.remainingDice.length===1);
    assert.equal(await page.getByTestId('dice').locator('.game-die[data-used="true"]').count(),1);
  }
});

register('used doubles keep their exact slots through undo and reload', async page => {
  await loadFixture(page,makeSave({white:{0:1,18:14},black:{23:15},remainingDice:[2,2,2,2]}));
  const dice=page.getByTestId('dice').locator('.game-die');
  await dice.nth(3).click(); await point(page,0).click(); await point(page,2).click();
  await waitSaved(page,state=>state.usedDiceIndices?.includes(3));
  assert.equal(await dice.count(),4);
  assert.equal(await dice.nth(3).getAttribute('data-used'),'true');
  assert.equal(await dice.nth(0).getAttribute('data-used'),'false');
  await button(page,'Undo move').click();
  await waitSaved(page,state=>state.usedDiceIndices?.length===0);
  await dice.nth(1).click(); await point(page,0).click(); await point(page,2).click();
  await waitSaved(page,state=>state.usedDiceIndices?.includes(1));
  await page.reload({waitUntil:'networkidle'}); await button(page,'Continue saved game').click();
  assert.equal(await dice.count(),4);
  assert.equal(await dice.nth(1).getAttribute('data-used'),'true');
  assert.equal(await page.getByTestId('dice').locator('.game-die[data-used="false"]').count(),3);
});

register('a selected die controls ambiguous bearing off without a higher die preference', async page => {
  for(const roll of [[1,6],[6,1]]) for(const value of [1,6]) {
    await loadFixture(page,makeSave({white:{23:2},black:{0:15},remainingDice:roll}));
    await page.getByTestId('dice').locator('.game-die').nth(roll.indexOf(value)).click();
    await point(page,23).click(); await page.locator('[data-bear-off-player="White"]').click();
    const state=await waitSaved(page,state=>state.off.White===14);
    assert.equal(state.moveLog.at(-1).move.die,value);
    assert.deepEqual(state.remainingDice,[value===1?6:1]);
    assert.equal(await page.getByTestId('bear-off-choice').count(),0);
  }
});

register('previous five rolls stay small and dim and persist without being changed by undo', async page => {
  const pairs=[[1,2],[3,4],[5,6],[2,2],[4,5],[6,4]];
  const history=pairs.map((dice,index)=>({id:index+1,player:index%2?'White':'Black',dice,opening:index===0}));
  const fixture=makeSave({white:{6:1,18:14},black:{23:15},version:4,remainingDice:[4],rolledDice:[6,4],usedDiceIndices:[0],rollHistory:history,turnMoveCount:1,
    moveLog:[{id:1,player:'White',mode:'WAR',controlState:'NORMAL',controller:'White',move:{from:0,to:6,die:6,isHit:false},remainingDiceAfter:[4]}]});
  await loadFixture(page,fixture);
  const list=page.getByTestId('roll-history');
  assert.equal(await list.locator('li').count(),5);
  assert.match(await list.locator('li').first().getAttribute('aria-label'),/4 and 5/);
  for(const doubles of [false,true]) {
    await loadFixture(page,doubles ? makeSave({white:{1:1,18:14},black:{3:1,5:1,7:1},bar:{White:0,Black:1},version:4,mode:'PEACE',controlState:'ENEMY_CONTROL',controller:'Black',remainingDice:[2,2,2],rolledDice:[2,2,2,2],usedDiceIndices:[0],rollHistory:history.map((roll,index)=>index===5?{...roll,dice:[2,2]}:roll),turnMoveCount:1,moveLog:[{id:1,player:'White',mode:'PEACE',controlState:'ENEMY_CONTROL',controller:'Black',move:{from:-1,to:1,die:2,isHit:true,isBarEntry:true},remainingDiceAfter:[2,2,2]}]}) : fixture);
  for(const viewport of [{width:1366,height:900},{width:1024,height:768},{width:912,height:590},{width:768,height:1024},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(viewport.width>=800) assert.ok(await page.locator('.game-console').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight+1),'Current dice, history and controls fit the landscape screen.');
    const sizes=await page.evaluate(()=>({current:document.querySelector('.game-die').getBoundingClientRect().width,history:document.querySelector('.history-die').getBoundingClientRect().width}));
    assert.ok(sizes.history<sizes.current/2);
    if(process.env.BACKGAMMON_SCREENSHOT_DIRECTORY) await page.screenshot({path:path.join(process.env.BACKGAMMON_SCREENSHOT_DIRECTORY,`dice-history-${doubles?'doubles-':''}${viewport.width}x${viewport.height}.png`),fullPage:true});
  }
  }
  await loadFixture(page,fixture);
  await page.setViewportSize({width:1024,height:768});
  await queueDice(page,[2,5]);
  await point(page,6).click(); await point(page,10).click();
  await button(page,'End turn').click();
  const next=await waitSaved(page,state=>state.currentPlayer==='Black'&&state.remainingDice.length===2);
  assert.deepEqual(next.rolledDice,[2,5]);
  assert.equal(next.rollHistory.length,6);
  assert.deepEqual(next.rollHistory.at(-1).dice,[2,5]);
  assert.match(await list.locator('li').first().getAttribute('aria-label'),/6 and 4/);
  await point(page,23).click(); await point(page,21).click();
  await waitSaved(page,state=>state.usedDiceIndices.length===1);
  await button(page,'Undo move').click();
  const undone=await waitSaved(page,state=>state.usedDiceIndices.length===0);
  assert.deepEqual(undone.rollHistory,next.rollHistory);
  await page.reload({waitUntil:'networkidle'}); await button(page,'Continue saved game').click();
  assert.equal(await list.locator('li').count(),5);
  assert.match(await list.locator('li').first().getAttribute('aria-label'),/6 and 4/);
});

register('normal doubles are not rerolled after a blocked opening turn', async page => {
  await loadFixture(page,makeSave({white:{18:14},black:{0:2,1:2,2:2,3:2,4:2,5:5},bar:{White:1,Black:0},remainingDice:[6,4],
    gamePhase:'OPENING_TURN',openingDice:[6,4],openingWinner:'White'}));
  await queueDice(page,[2,2,3,4]);
  const next=await waitSaved(page,state=>state.currentPlayer==='Black'&&state.gamePhase==='NORMAL_TURN');
  assert.deepEqual(next.rolledDice,[2,2,2,2],'The next pair is accepted, rather than replacing doubles.');
  assert.equal(next.mode,'PEACE');
});

register('iPad messages and VENGEANCE survive captures and Test sound restores audio', async page => {
  await page.setViewportSize({width:1024,height:768});
  await page.addInitScript(()=>{
    const Native=window.AudioContext||window.webkitAudioContext;
    window.__ipadAudio=[];
    if(!Native)return;
    class Observed extends Native { constructor(...args){super(...args);window.__ipadAudio.push(this);} }
    window.AudioContext=Observed;
    if(window.webkitAudioContext)window.webkitAudioContext=Observed;
  });
  await loadFixture(page,makeSave({white:{4:14},black:{0:1,1:2,2:1},bar:{White:1,Black:0},remainingDice:[1,2],mode:'PEACE'}));
  await page.getByTestId('game-narration').waitFor({state:'visible'});
  assert.match(await page.getByTestId('game-narration').innerText(),/VENGEANCE — ALL MOVES/);
  await point(page,0).tap();
  await waitSaved(page,state=>state.bar.Black===1);
  assert.match(await page.getByTestId('game-narration').innerText(),/VENGEANCE — ALL MOVES/,'The first capture does not erase the handoff banner.');
  await button(page,'Messages on').tap();
  assert.equal(await page.getByTestId('game-narration').count(),0);
  await button(page,'Messages off').tap();
  await page.getByTestId('game-narration').waitFor({state:'visible'});
  await button(page,'Sound').tap();
  await button(page,'Test sound').tap();
  await page.waitForFunction(()=>localStorage.getItem('warPeaceBackgammonSoundEnabledV1')==='on'&&window.__ipadAudio.some(context=>context.state==='running'));
  await button(page,'Play music').tap();
  await page.evaluate(async()=>{await Promise.all(window.__ipadAudio.map(context=>context.close()));});
  await button(page,'Close sound settings').tap();
  await page.waitForFunction(()=>window.__ipadAudio.length>=2&&window.__ipadAudio.some(context=>context.state==='running'));
});

(async () => {
  const safari = process.env.BACKGAMMON_BROWSER === 'webkit';
  const browser = await (safari ? webkit : chromium).launch({
    headless: true,
    executablePath: safari ? undefined : process.env.CHROMIUM_EXECUTABLE || undefined,
    args: safari ? [] : ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  let failures = 0;
  let passed = 0;
  try {
    const authContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const authPage = await authContext.newPage();
    await authPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await authPage.getByLabel('Beta password').fill(betaPassword);
    await button(authPage, 'Enter Game').click();
    await authPage.getByRole('button', { name: /Computer 1.*Balanced/ }).waitFor({ state: 'visible' });
    await authPage.evaluate(() => localStorage.setItem('warPeaceBackgammonSoundEnabledV1', 'off'));
    const authenticatedStorage = await authContext.storageState();
    await authContext.close();
    console.log('PASS beta login through the visible UI');
    for (const entry of tests) {
      if (filter && !filter.test(entry.name)) continue;
      const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch:true, storageState: authenticatedStorage });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
      page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
      try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await entry.run(page);
        assert.deepEqual(errors, [], 'No browser runtime or console errors');
        passed += 1;
        console.log(`PASS ${entry.name}`);
      } catch (error) {
        failures += 1;
        fs.mkdirSync(failuresDirectory, { recursive: true });
        const artifact = path.join(failuresDirectory, `${entry.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
        await page.screenshot({ path: artifact, fullPage: true }).catch(() => {});
        console.error(`FAIL ${entry.name}\n${error.stack || error}\n${errors.join('\n')}\nScreenshot: ${artifact}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Browser regressions: ${passed} passed, ${failures} failed.`);
  if (failures) process.exitCode = 1;
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
