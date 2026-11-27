const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, firefox, webkit } = require('playwright');
const engines = { chromium, firefox, webkit };
const engineName = process.env.TEST_BROWSER || 'chromium';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/game.js', ['game.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/assets/landing.svg', ['assets/landing.svg', 'image/svg+xml']],
  ['/assets/valley.svg', ['assets/valley.svg', 'image/svg+xml']],
  ['/assets/signal.svg', ['assets/signal.svg', 'image/svg+xml']],
  ['/assets/ruins.svg', ['assets/ruins.svg', 'image/svg+xml']],
  ['/assets/core.svg', ['assets/core.svg', 'image/svg+xml']],
  ['/assets/crystal.svg', ['assets/crystal.svg', 'image/svg+xml']],
]);
let server, browser, url;

async function dismissIntro(page) {
  if (await page.locator('#intro-dialog').isVisible()) await page.locator('#intro-start').click();
}
async function openGame(page) {
  await page.goto(url);
  await dismissIntro(page);
}
async function reloadGame(page) {
  await page.reload();
  await dismissIntro(page);
}

before(async () => {
  server = http.createServer((request, response) => {
    const asset = assets.get(new URL(request.url, 'http://localhost').pathname);
    if (!asset) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': asset[1] });
    fs.createReadStream(path.join(__dirname, '..', asset[0])).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/`;
  if (!engines[engineName]) throw new Error(`Unsupported browser: ${engineName}`);
  browser = await engines[engineName].launch({ headless: true, ...(engineName === 'chromium' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

const solutions = [
  ['moveForward();\nmoveForward();\ncollectLight();\nturnLeft();\nmoveForward();\nmoveForward();\ncollectLight();\nturnRight();\nmoveForward();\nmoveForward();\nmoveForward();\nmoveForward();\nopenGate();', 13],
  ['repeat(2, moveForward);\ncollectLight();\nrepeat(2, moveForward);\ncollectLight();\nrepeat(2, moveForward);\nopenGate();', 9],
  ['if (lightIsPresent()) collectLight();\nrepeat(2, moveForward);\nif (lightIsPresent()) collectLight();\nif (pathAheadIsBlocked()) turnLeft();\nrepeat(2, moveForward);\nif (lightIsPresent()) collectLight();\nturnRight();\nrepeat(4, moveForward);\nopenGate();', 14],
  ['repeat(2, moveForward);\ncollectLight();\nturnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\ncollectLight();\nrepeat(2, moveForward);\nopenGate();', 13],
  ['repeat(2, moveForward);\ncollectLight();\nturnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\nturnLeft();\nmoveForward();\nturnRight();\nturnRight();\nmoveForward();\nturnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\ncollectLight();\nturnRight();\nturnRight();\nrepeat(2, moveForward);\nopenGate();', 26],
  ['turnLeft();\nmoveForward();\ncollectLight();\nturnRight();\nturnRight();\nrepeat(2, moveForward);\nturnLeft();\nrepeat(2, moveForward);\nturnLeft();\nmoveForward();\nturnLeft();\nmoveForward();\nturnRight();\nrepeat(2, moveForward);\nturnRight();\nrepeat(4, moveForward);\ncollectLight();\nmoveForward();\nopenGate();', 25],
];

async function complete(page, index) {
  const [source, steps] = solutions[index];
  await page.locator('#code').fill(source);
  for (let i = 0; i < steps; i += 1) await page.locator('#step').click();
  assert.equal(await page.locator('#win-card').isVisible(), true);
}

test('first visit starts with the story and does not repeat it after starting', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await page.goto(url);
    assert.equal(await page.locator('#intro-dialog').evaluate((dialog) => dialog.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'intro-start');
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('#intro-start').click();
    assert.equal(await page.locator('#intro-dialog').evaluate((dialog) => dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('rover-tile')), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('light-seed-game-intro-seen')), '1');
    await page.reload();
    assert.equal(await page.locator('#intro-dialog').evaluate((dialog) => dialog.open), false);
  } finally { await context.close(); }
});

test('returning progress skips the introduction and unavailable storage remains playable', async () => {
  const returning = await browser.newContext();
  try {
    await returning.addInitScript(() => {
      if (location.protocol === 'http:') localStorage.setItem('light-seed-game-unlocked-mission', '2');
    });
    const page = await returning.newPage();
    await page.goto(url);
    assert.equal(await page.locator('#intro-dialog').evaluate((dialog) => dialog.open), false);
    assert.match(await page.locator('#mission-position').textContent(), /03 \/ 06/);
  } finally { await returning.close(); }
  const unavailable = await browser.newContext();
  try {
    await unavailable.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
    const page = await unavailable.newPage();
    await page.goto(url);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#intro-dialog').evaluate((dialog) => dialog.open), false);
    await page.locator('#code').fill('moveForward();');
    await page.locator('#step').click();
    assert.match(await page.locator('#coordinates').textContent(), /X 02.*Y 05/);
    await page.reload();
    assert.equal(await page.locator('#intro-dialog').evaluate((dialog) => dialog.open), true);
  } finally { await unavailable.close(); }
});

test('six missions unlock, survive reload, and return focus on replay', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    await complete(page, 0);
    assert.equal(await page.locator('#world').isHidden(), true);
    assert.match(await page.locator('#win-story').textContent(), /還藏著星球回聲/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-mission');
    await page.locator('#next-mission').click();
    await reloadGame(page);
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 06/);
    await complete(page, 1);
    await page.locator('#next-mission').click();
    await complete(page, 2);
    await page.locator('#next-mission').click();
    await complete(page, 3);
    await page.locator('#next-mission').click();
    await complete(page, 4);
    await page.locator('#next-mission').click();
    await complete(page, 5);
    assert.equal(await page.evaluate(() => localStorage.getItem('light-seed-game-completed-mission')), '5');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'replay-win');
    await page.locator('#replay-win').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'code');
    assert.equal(await page.locator('#world').isVisible(), true);
  } finally { await context.close(); }
});

test('winning ends the attempt even when instructions follow the gate', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill(`${solutions[0][0]}\nturnRight();`);
    for (let i = 0; i < solutions[0][1]; i += 1) await page.locator('#step').click();
    assert.equal(await page.locator('#win-card').isVisible(), true);
    await page.locator('#step').click();
    assert.equal(await page.locator('#win-card').isHidden(), true);
    assert.match(await page.locator('#coordinates').textContent(), /X 02.*Y 05/);
    assert.match(await page.locator('.rover-tile').getAttribute('aria-label'), /面向東方/);
    assert.match(await page.locator('#goal-count').textContent(), /0 \/ 2/);
  } finally { await context.close(); }
});

test('both win actions fit in the scene on a small screen', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    await complete(page, 0);
    const fits = await page.evaluate(() => {
      const frame = document.querySelector('.world-frame').getBoundingClientRect();
      return ['#next-mission', '#replay-win'].every((selector) => {
        const button = document.querySelector(selector).getBoundingClientRect();
        return button.top >= frame.top - 1 && button.bottom <= frame.bottom + 1;
      });
    });
    assert.equal(fits, true);
  } finally { await context.close(); }
});

test('keyboard exploration and edited programs have consistent state', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('.rover-tile').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => ({ id: document.activeElement.id, tag: document.activeElement.tagName, className: document.activeElement.className }));
    assert.equal(active.id, 'code', `Unexpected focus after leaving the map: ${JSON.stringify(active)}`);
    await page.keyboard.press('Shift+Tab');
    assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /X 1，Y 4/);
    await page.locator('#code').fill('moveForward();\nmoveForward();\ncollectLight();');
    await page.locator('#step').click();
    assert.match(await page.locator('[data-x="0"][data-y="4"]').getAttribute('aria-label'), /可通行/);
    await page.locator('#code').fill('turnRight();\nmoveForward();');
    await page.locator('#step').click();
    assert.match(await page.locator('#coordinates').textContent(), /X 01.*Y 05/);
    assert.match(await page.locator('.rover-tile').getAttribute('aria-label'), /面向南方/);
  } finally { await context.close(); }
});

test('invalid input and unavailable storage keep the game usable', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
    const page = await context.newPage();
    await openGame(page);
    assert.match(await page.locator('#progress-note').textContent(), /無法保存/);
    await page.locator('#code').fill('moveForward();\nunknown();');
    await page.locator('#run').click();
    assert.match(await page.locator('#status').textContent(), /第 2 行.*unknown/);
    assert.match(await page.locator('#coordinates').textContent(), /X 01.*Y 05/);
    await complete(page, 0);
    await page.locator('#next-mission').click();
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 06/);
  } finally { await context.close(); }
});

test('other tabs cannot overwrite newer unlocked progress', async () => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await openGame(first);
    await openGame(second);
    await second.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await first.waitForFunction(() => !document.querySelector('#next-unlocked').disabled);
    await complete(first, 0);
    assert.equal(await first.evaluate(() => localStorage.getItem('light-seed-game-unlocked-mission')), '2');
  } finally { await context.close(); }
});

test('a completed last mission unlocks newly added content without replay', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => {
      localStorage.setItem('light-seed-game-unlocked-mission', '3');
      localStorage.setItem('light-seed-game-completed-mission', '3');
    });
    await reloadGame(page);
    assert.match(await page.locator('#mission-position').textContent(), /05 \/ 06/);
    await page.evaluate(() => localStorage.removeItem('light-seed-game-completed-mission'));
    await reloadGame(page);
    assert.match(await page.locator('#mission-position').textContent(), /04 \/ 06/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-completed-mission', 'not-a-number'));
    await reloadGame(page);
    assert.match(await page.locator('#mission-position').textContent(), /04 \/ 06/);
  } finally { await context.close(); }
});

test('completed progress from another tab is preserved by an older attempt', async () => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await openGame(first);
    await openGame(second);
    await second.evaluate(() => localStorage.setItem('light-seed-game-completed-mission', '3'));
    await first.waitForFunction(() => !document.querySelector('#next-unlocked').disabled);
    await complete(first, 0);
    assert.equal(await first.evaluate(() => localStorage.getItem('light-seed-game-completed-mission')), '3');
    assert.equal(await first.evaluate(() => localStorage.getItem('light-seed-game-unlocked-mission')), '4');
  } finally { await context.close(); }
});

test('narrow map fits and reset cancels a running program', async () => {
  const context = await browser.newContext({ viewport: { width: 721, height: 900 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    assert.equal(await page.evaluate(() => {
      const frame = document.querySelector('.world-frame').getBoundingClientRect();
      const map = document.querySelector('.world').getBoundingClientRect();
      return map.left >= frame.left && map.right <= frame.right && document.documentElement.scrollWidth <= innerWidth;
    }), true);
    await page.locator('#code').fill('moveForward();\nmoveForward();\ncollectLight();');
    await page.locator('#run').click();
    await page.locator('#reset').click();
    await page.waitForTimeout(600);
    assert.match(await page.locator('#coordinates').textContent(), /X 01.*Y 05/);
    assert.equal(await page.locator('#run').isEnabled(), true);
  } finally { await context.close(); }
});

test('players can pause, step, and resume a running program', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill(Array(6).fill('turnRight();').join('\n'));
    await page.locator('#run').click();
    assert.match(await page.locator('#run').textContent(), /暫停行動/);
    await page.locator('#run').click();
    assert.match(await page.locator('#status').textContent(), /已暫停/);
    assert.match(await page.locator('#run').textContent(), /繼續執行/);
    assert.equal(await page.locator('#step').isEnabled(), true);
    const before = await page.locator('.rover-tile').getAttribute('aria-label');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.rover-tile').getAttribute('aria-label'), before);
    await page.locator('#step').click();
    assert.notEqual(await page.locator('.rover-tile').getAttribute('aria-label'), before);
    await page.locator('#run').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('程式跑完了'));
    assert.match(await page.locator('.rover-tile').getAttribute('aria-label'), /面向西方/);
    assert.match(await page.locator('#run').textContent(), /執行程式/);
  } finally { await context.close(); }
});

test('sound is opt-in, can be turned off, and leaves action feedback intact', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      window.soundStarts = 0;
      window.soundStops = 0;
      class FakeAudioContext {
        constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
        async resume() { this.state = 'running'; }
        createOscillator() {
          return {
            frequency: { setValueAtTime() {} }, connect() {},
            start() { window.soundStarts += 1; }, stop() { window.soundStops += 1; },
          };
        }
        createGain() {
          return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext });
    });
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill('turnRight();\nturnRight();\nturnRight();');
    await page.locator('#step').click();
    assert.equal(await page.evaluate(() => window.soundStarts), 0);
    const actionStatus = await page.locator('#status').textContent();
    await page.locator('#sound-toggle').click();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#status').textContent(), actionStatus);
    const enabledCount = await page.evaluate(() => window.soundStarts);
    assert.ok(enabledCount > 0);
    await page.locator('#step').click();
    assert.ok(await page.evaluate(() => window.soundStarts) > enabledCount);
    const stopsBefore = await page.evaluate(() => window.soundStops);
    await page.locator('#sound-toggle').click();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
    const disabledCount = await page.evaluate(() => window.soundStarts);
    await page.locator('#step').click();
    assert.equal(await page.evaluate(() => window.soundStarts), disabledCount);
    assert.ok(await page.evaluate(() => window.soundStops) > stopsBefore);
    await reloadGame(page);
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
  } finally { await context.close(); }
});

test('an unavailable audio engine does not prevent play', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'AudioContext', { value: undefined });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
    });
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#sound-toggle').click();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
    assert.match(await page.locator('#sound-feedback').textContent(), /無法使用音效/);
    await page.locator('#code').fill('moveForward();');
    await page.locator('#step').click();
    assert.match(await page.locator('#coordinates').textContent(), /X 02.*Y 05/);
  } finally { await context.close(); }
});

test('undo restores movement and collection, and editing clears history', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    assert.equal(await page.locator('#undo').isDisabled(), true);
    await page.locator('#code').fill('moveForward();\nmoveForward();\ncollectLight();');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
    await page.locator('#undo').click();
    assert.match(await page.locator('#goal-count').textContent(), /0 \/ 2/);
    assert.match(await page.locator('.rover-tile').getAttribute('aria-label'), /光種/);
    await page.locator('#step').click();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
    await page.locator('#undo').click();
    await page.locator('#undo').click();
    assert.match(await page.locator('#coordinates').textContent(), /X 02.*Y 05/);
    assert.equal(await page.locator('.tile.visited').count(), 2);
    await page.locator('#code').fill('turnLeft();');
    assert.equal(await page.locator('#undo').isDisabled(), true);
    await page.locator('#code').fill('moveForward();\nmoveForward();\nmoveForward();');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /岩壁/);
    await page.locator('#undo').click();
    assert.match(await page.locator('#editor-help').textContent(), /第 3 行/);
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /岩壁/);
  } finally { await context.close(); }
});

test('undo after pausing is not affected by an old playback timer', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill(Array(6).fill('turnRight();').join('\n'));
    await page.locator('#run').click();
    assert.equal(await page.locator('#undo').isDisabled(), true);
    await page.locator('#run').click();
    const paused = await page.locator('.rover-tile').getAttribute('aria-label');
    await page.locator('#undo').click();
    const restored = await page.locator('.rover-tile').getAttribute('aria-label');
    assert.notEqual(restored, paused);
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.rover-tile').getAttribute('aria-label'), restored);
  } finally { await context.close(); }
});

test('undo restores repeated actions and keeps discovered stories', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill('turnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    await page.locator('#undo').click();
    assert.match(await page.locator('.echo').getAttribute('aria-label'), /走過可發現/);
    assert.match(await page.locator('#journal-count').textContent(), /1 \/ 6/);
    await page.locator('#step').click();
    assert.match(await page.locator('.echo').getAttribute('aria-label'), /已發現/);
    assert.match(await page.locator('#journal-count').textContent(), /1 \/ 6/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '1'));
    await reloadGame(page);
    await page.locator('#code').fill('repeat(2, moveForward);');
    await page.locator('#step').click();
    await page.locator('#step').click();
    await page.locator('#undo').click();
    assert.match(await page.locator('#coordinates').textContent(), /X 02.*Y 05/);
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /第 2 \/ 2 次/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await reloadGame(page);
    await page.locator('#code').fill('if (lightIsPresent()) collectLight();\nmoveForward();');
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件不成立/);
    await page.locator('#undo').click();
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件不成立/);
  } finally { await context.close(); }
});

test('undo reverses a crystal push and a win without relocking progress', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '5'));
    await reloadGame(page);
    await page.locator('#code').fill('turnRight();\nmoveForward();\nturnLeft();\nrepeat(2, moveForward);\nturnLeft();\nmoveForward();\nmoveForward();');
    for (let i = 0; i < 7; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /已打開/);
    await page.locator('#step').click();
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /關閉/);
    await page.locator('#undo').click();
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /已打開/);
    assert.match(await page.locator('.pressure-plate').getAttribute('aria-label'), /光晶已放上/);
    await page.locator('#undo').click();
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /關閉/);
    assert.match(await page.locator('[data-x="2"][data-y="4"]').getAttribute('aria-label'), /光晶/);
    await page.locator('#previous-mission').click();
    for (let i = 0; i < 4; i += 1) await page.locator('#previous-mission').click();
    await complete(page, 0);
    await page.locator('#undo').click();
    assert.equal(await page.locator('#win-card').isHidden(), true);
    assert.equal(await page.locator('#world').isVisible(), true);
    assert.equal(await page.locator('#next-unlocked').isEnabled(), true);
    await page.locator('#step').click();
    assert.equal(await page.locator('#win-card').isVisible(), true);
  } finally { await context.close(); }
});

test('the journey map shows progress, navigates, and pauses playback', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#open-journey').click();
    assert.equal(await page.locator('#journey-dialog').evaluate((dialog) => dialog.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'close-journey');
    assert.equal(await page.locator('.journey-step').count(), 6);
    assert.equal(await page.locator('.journey-step:disabled').count(), 5);
    assert.equal(await page.evaluate(() => document.querySelector('#journey-dialog').getBoundingClientRect().width <= innerWidth), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-journey');

    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '3'));
    await reloadGame(page);
    await page.locator('#open-journey').click();
    assert.equal(await page.locator('.journey-step:disabled').count(), 2);
    await page.locator('.journey-step[data-mission="1"]').click();
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 06/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mission-title');
    await page.locator('#code').fill(Array(6).fill('turnRight();').join('\n'));
    await page.locator('#run').click();
    await page.locator('#open-journey').click();
    assert.match(await page.locator('#status').textContent(), /已暫停/);
    const before = await page.locator('.rover-tile').getAttribute('aria-label');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.rover-tile').getAttribute('aria-label'), before);
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#run').textContent(), /繼續執行/);
    await page.locator('#open-journey').click();
    await page.locator('.journey-step[data-mission="1"]').click();
    assert.equal(await page.locator('.rover-tile').getAttribute('aria-label'), before);
    assert.match(await page.locator('#run').textContent(), /繼續執行/);
    await page.locator('#open-journey').click();
    await page.locator('#journey-dialog').evaluate((dialog) => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    assert.equal(await page.locator('#journey-dialog').evaluate((dialog) => dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-journey');
  } finally { await context.close(); }
});

test('journey focus survives progress updates from another tab', async () => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await openGame(first);
    await openGame(second);
    await first.locator('#open-journey').click();
    await first.locator('.journey-step[data-mission="0"]').focus();
    await second.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await first.waitForFunction(() => !document.querySelector('[data-mission="2"]').disabled);
    assert.equal(await first.evaluate(() => document.activeElement.dataset.mission), '0');
  } finally { await context.close(); }
});

test('the whole map fits its scene at desktop and phone sizes', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    for (const [width, height] of [[320, 700], [375, 812], [721, 900], [761, 600], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await openGame(page);
      const fits = await page.evaluate(() => {
        const frame = document.querySelector('.world-frame').getBoundingClientRect();
        const map = document.querySelector('.world').getBoundingClientRect();
        const controls = ['.brand', '#sound-toggle', '#open-journey', '.mission-nav']
          .map((selector) => document.querySelector(selector).getBoundingClientRect());
        return map.left >= frame.left - 1 && map.right <= frame.right + 1 &&
          map.top >= frame.top - 1 && map.bottom <= frame.bottom + 1 &&
          controls.every((rect, index) => index === 0 || controls[index - 1].right <= rect.left + 1) &&
          controls.at(-1).right <= innerWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth;
      });
      assert.equal(fits, true, `map should fit at ${width}×${height}`);
    }
  } finally { await context.close(); }
});

test('each unlocked area shows its own available scene art', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '5'));
    await reloadGame(page);
    for (const [index, scene] of ['crystal', 'core', 'ruins', 'signal', 'valley', 'landing'].entries()) {
      assert.equal(await page.locator('.world-panel').getAttribute('data-scene'), scene);
      assert.equal(await page.locator('#sector-label').textContent(), `SECTOR 0${6 - index}-A`);
      const artUrl = await page.locator('.scene-art').evaluate((element) => {
        return getComputedStyle(element).backgroundImage.slice(5, -2);
      });
      assert.equal((await page.request.get(artUrl)).status(), 200);
      if (scene !== 'landing') await page.locator('#previous-mission').click();
    }
  } finally { await context.close(); }
});

test('map exposes its rows and cells and distinguishes a wall from the map edge', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    if (engineName === 'chromium') {
      const client = await context.newCDPSession(page);
      const { nodes } = await client.send('Accessibility.getFullAXTree');
      const count = (role) => nodes.filter((node) => node.role?.value === role).length;
      assert.equal(count('grid'), 1);
      assert.equal(count('row'), 6);
      assert.equal(count('gridcell'), 42);
    }
    await page.locator('#code').fill('turnRight();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /地圖邊界/);
    await page.locator('#code').fill('moveForward();\nmoveForward();\nmoveForward();');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /岩壁/);
  } finally { await context.close(); }
});

test('touch players can insert and step through commands on a narrow screen', { skip: engineName === 'firefox' && 'Firefox does not support Playwright mobile emulation' }, async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill('');
    for (const name of ['moveForward', 'moveForward', 'collectLight']) {
      const button = page.locator(`[data-command="${name}"]`);
      assert.ok((await button.boundingBox()).height >= 44);
      await button.tap();
    }
    for (let i = 0; i < 3; i += 1) await page.locator('#step').tap();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
    assert.match(await page.locator('.rover-tile').getAttribute('aria-label'), /光種，已收集/);
  } finally { await context.close(); }
});

test('the scene reflects movement and collected gate energy, then resets', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    assert.equal(await page.locator('.seed-orb').count(), 2);
    assert.equal(await page.locator('.seed-orb.filled').count(), 0);
    await page.locator('#code').fill('moveForward();\nmoveForward();\ncollectLight();\nturnLeft();\nmoveForward();\nmoveForward();\ncollectLight();');
    await page.locator('#step').click();
    assert.equal(await page.locator('.rover.travelling').count(), 1);
    await page.locator('#step').click();
    await page.locator('#step').click();
    assert.equal(await page.locator('.seed-orb.filled').count(), 1);
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.equal(await page.locator('.seed-orb.filled').count(), 2);
    assert.equal(await page.locator('.world-frame.energized').count(), 1);
    await page.locator('#reset').click();
    assert.equal(await page.locator('.seed-orb.filled').count(), 0);
    assert.equal(await page.locator('.world-frame.energized').count(), 0);
    assert.equal(await page.locator('.rover.travelling').count(), 0);
    assert.match(await page.locator('#goal-count').textContent(), /0 \/ 2/);
  } finally { await context.close(); }
});

test('the map shows the path taken in this attempt and clears it on reset', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    assert.equal(await page.locator('.tile.visited').count(), 1);
    await page.locator('#code').fill('moveForward();\nmoveForward();\nturnLeft();');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.equal(await page.locator('.tile.visited').count(), 3);
    assert.match(await page.locator('[data-x="1"][data-y="4"]').getAttribute('aria-label'), /可通行.*這次走過/);
    await page.locator('#reset').click();
    assert.equal(await page.locator('.tile.visited').count(), 1);
    assert.doesNotMatch(await page.locator('[data-x="1"][data-y="4"]').getAttribute('aria-label'), /這次走過/);
  } finally { await context.close(); }
});

test('optional echoes reward exploration and reset with each attempt', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    assert.match(await page.locator('.echo').getAttribute('aria-label'), /星球回聲.*走過可發現/);
    const detour = 'turnLeft();\nmoveForward();\nturnRight();\nmoveForward();\nturnRight();\nmoveForward();\nturnLeft();\nmoveForward();\ncollectLight();\nturnLeft();\nmoveForward();\nmoveForward();\ncollectLight();\nturnRight();\nmoveForward();\nmoveForward();\nmoveForward();\nmoveForward();\nopenGate();';
    await page.locator('#code').fill(detour);
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /發現星球回聲/);
    assert.match(await page.locator('.echo').getAttribute('aria-label'), /已發現/);
    assert.match(await page.locator('#echo-log').textContent(), /小花園/);
    for (let i = 4; i < 19; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#win-story').textContent(), /小花園/);
    await page.locator('#replay-win').click();
    assert.equal(await page.locator('#echo-log').isHidden(), true);
    assert.match(await page.locator('.echo').getAttribute('aria-label'), /走過可發現/);

    await page.locator('#next-unlocked').click();
    await page.locator('#code').fill('repeat(3, moveForward);\nturnLeft();\nmoveForward();');
    for (let i = 0; i < 5; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#echo-log').textContent(), /山谷/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await reloadGame(page);
    await page.locator('#code').fill('turnLeft();\nrepeat(2, moveForward);');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#echo-log').textContent(), /回家的路/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '3'));
    await reloadGame(page);
    await page.locator('#code').fill('turnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#echo-log').textContent(), /光閘曾守護/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '4'));
    await reloadGame(page);
    await page.locator('#code').fill('turnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#echo-log').textContent(), /星核曾將光/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '5'));
    await reloadGame(page);
    await page.locator('#code').fill('turnLeft();\nrepeat(2, moveForward);');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#echo-log').textContent(), /光晶曾替花園/);
  } finally { await context.close(); }
});

test('a switch opens the barrier and the sensor observes both states', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '3'));
    await reloadGame(page);
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /光閘.*關閉/);
    assert.match(await page.locator('.switch-tile').getAttribute('aria-label'), /能量開關.*走上可啟動/);
    await page.locator('#code').fill('turnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\nmoveForward();');
    for (let i = 0; i < 7; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /光閘擋住了去路/);
    assert.match(await page.locator('#coordinates').textContent(), /X 03.*Y 03/);

    await page.locator('#code').fill('turnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\nif (pathAheadIsBlocked()) turnRight();\nmoveForward();\nturnLeft();\nturnLeft();\nmoveForward();\nturnRight();\nif (pathAheadIsBlocked()) turnRight();\nmoveForward();');
    for (let i = 0; i < 7; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件成立.*pathAheadIsBlocked/);
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /能量開關.*光閘打開/);
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /已打開/);
    assert.match(await page.locator('.switch-tile').getAttribute('aria-label'), /已啟動/);
    for (let i = 0; i < 5; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件不成立.*pathAheadIsBlocked/);
    await page.locator('#step').click();
    assert.match(await page.locator('#coordinates').textContent(), /X 04.*Y 03/);
    await page.locator('#reset').click();
    assert.match(await page.locator('.barrier').getAttribute('aria-label'), /關閉/);
  } finally { await context.close(); }
});

test('the two switches independently open their matching barriers', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '4'));
    await reloadGame(page);
    const gateA = page.locator('.barrier[data-mechanism="A"]');
    const gateB = page.locator('.barrier[data-mechanism="B"]');
    await page.locator('#code').fill('repeat(2, moveForward);\nturnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\nmoveForward();');
    for (let i = 0; i < 9; i += 1) await page.locator('#step').click();
    assert.match(await gateA.getAttribute('aria-label'), /已打開/);
    assert.match(await gateB.getAttribute('aria-label'), /關閉/);
    assert.match(await page.locator('#status').textContent(), /光閘擋住.*開關 B/);
    await page.locator('#code').fill('repeat(2, moveForward);\nturnLeft();\nrepeat(2, moveForward);\nturnRight();\nrepeat(2, moveForward);\nturnLeft();\nmoveForward();');
    for (let i = 0; i < 10; i += 1) await page.locator('#step').click();
    assert.match(await gateA.getAttribute('aria-label'), /已打開/);
    assert.match(await gateB.getAttribute('aria-label'), /已打開/);
    assert.match(await page.locator('#status').textContent(), /開關 B.*光閘打開/);
    await page.locator('#reset').click();
    assert.match(await gateA.getAttribute('aria-label'), /關閉/);
    assert.match(await gateB.getAttribute('aria-label'), /關閉/);
  } finally { await context.close(); }
});

test('a pushable crystal controls the pressure plate and blocked-path sensor', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '5'));
    await reloadGame(page);
    const gate = page.locator('.barrier');
    const plate = page.locator('.pressure-plate');
    assert.match(await page.locator('[data-x="2"][data-y="4"]').getAttribute('aria-label'), /光晶，可推動/);
    await page.locator('#code').fill('moveForward();\nturnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 5; i += 1) await page.locator('#step').click();
    assert.match(await plate.getAttribute('aria-label'), /需要光晶/);
    assert.match(await gate.getAttribute('aria-label'), /關閉/);

    const approach = 'turnRight();\nmoveForward();\nturnLeft();\nrepeat(2, moveForward);\nturnLeft();';
    await page.locator('#code').fill(`${approach}\nif (pathAheadIsBlocked()) turnRight();\nmoveForward();\nmoveForward();\nif (pathAheadIsBlocked()) turnRight();`);
    for (let i = 0; i < 7; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件不成立.*pathAheadIsBlocked/);
    await page.locator('#step').click();
    assert.match(await plate.getAttribute('aria-label'), /光晶已放上/);
    assert.match(await gate.getAttribute('aria-label'), /已打開/);
    assert.match(await page.locator('#status').textContent(), /光晶壓住底座.*打開/);
    await page.locator('#step').click();
    assert.match(await gate.getAttribute('aria-label'), /關閉/);
    assert.match(await page.locator('#status').textContent(), /光晶離開底座.*關閉/);
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件成立.*pathAheadIsBlocked/);

    await page.locator('#code').fill(`${approach}\nmoveForward();\nmoveForward();\nmoveForward();`);
    for (let i = 0; i < 9; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /光晶推不動/);
    assert.match(await page.locator('[data-x="2"][data-y="2"]').getAttribute('aria-label'), /光晶/);
    await page.locator('#reset').click();
    assert.match(await page.locator('[data-x="2"][data-y="4"]').getAttribute('aria-label'), /光晶/);
    assert.match(await gate.getAttribute('aria-label'), /關閉/);
  } finally { await context.close(); }
});

test('long crystal feedback leaves the map and legend visible on a small screen', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '5'));
    await reloadGame(page);
    await page.locator('#code').fill('turnRight();\nmoveForward();\nturnLeft();\nrepeat(2, moveForward);\nturnLeft();\nmoveForward();');
    for (let i = 0; i < 7; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /光晶壓住底座/);
    const clear = await page.evaluate(() => {
      const map = document.querySelector('.world').getBoundingClientRect();
      const frame = document.querySelector('.world-frame').getBoundingClientRect();
      const legend = document.querySelector('.world-legend').getBoundingClientRect();
      const status = document.querySelector('.status-strip').getBoundingClientRect();
      return map.top >= frame.top - 1 && map.bottom <= frame.bottom + 1 &&
        frame.bottom <= legend.top + 1 && legend.bottom <= status.top + 1;
    });
    assert.equal(clear, true);
  } finally { await context.close(); }
});

test('a very long unknown command does not overwhelm the game scene', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill(`${'a'.repeat(1000)}();`);
    await page.locator('#run').click();
    const message = await page.locator('#status').textContent();
    assert.match(message, /aaaa.*….*還沒學過/);
    assert.ok(message.length < 100);
    assert.equal(await page.evaluate(() => {
      const frame = document.querySelector('.world-frame').getBoundingClientRect();
      const map = document.querySelector('.world').getBoundingClientRect();
      const legend = document.querySelector('.world-legend').getBoundingClientRect();
      const status = document.querySelector('.status-strip').getBoundingClientRect();
      return map.top >= frame.top - 1 && map.bottom <= frame.bottom + 1 && legend.bottom <= status.top + 1;
    }), true);
  } finally { await context.close(); }
});

test('a discovered story and replay action fit after the final mission on a small screen', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '5'));
    await reloadGame(page);
    const source = 'turnLeft();\nmoveForward();\nmoveForward();\nturnRight();\nturnRight();\nmoveForward();\ncollectLight();\nrepeat(2, moveForward);\nturnLeft();\nrepeat(2, moveForward);\nturnLeft();\nmoveForward();\nturnLeft();\nmoveForward();\nturnRight();\nrepeat(2, moveForward);\nturnRight();\nrepeat(4, moveForward);\ncollectLight();\nmoveForward();\nopenGate();';
    await page.locator('#code').fill(source);
    for (let i = 0; i < 27; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#win-story').textContent(), /光晶曾替花園/);
    const fits = await page.evaluate(() => {
      const frame = document.querySelector('.world-frame').getBoundingClientRect();
      const story = document.querySelector('#win-story').getBoundingClientRect();
      const replay = document.querySelector('#replay-win').getBoundingClientRect();
      return story.top >= frame.top - 1 && replay.bottom <= frame.bottom + 1;
    });
    assert.equal(fits, true);
  } finally { await context.close(); }
});

test('discovered stories remain in the journal after reset and reload', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill('turnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#journal-count').textContent(), /1 \/ 6/);
    await page.locator('.journal summary').click();
    assert.match(await page.locator('#journal-entries').textContent(), /小花園/);
    await page.locator('#reset').click();
    assert.match(await page.locator('#journal-count').textContent(), /1 \/ 6/);
    await reloadGame(page);
    await page.locator('.journal summary').click();
    assert.match(await page.locator('#journal-count').textContent(), /1 \/ 6/);
    assert.match(await page.locator('#journal-entries').textContent(), /小花園/);
    assert.equal(await page.locator('#echo-log').isHidden(), true);
  } finally { await context.close(); }
});

test('echo discoveries merge across tabs without losing either story', async () => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await openGame(first);
    await openGame(second);
    await second.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '1'));
    await reloadGame(second);
    await first.locator('#code').fill('turnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    await second.locator('#code').fill('repeat(3, moveForward);\nturnLeft();\nmoveForward();');
    for (let i = 0; i < 3; i += 1) await Promise.all([first.locator('#step').click(), second.locator('#step').click()]);
    await second.locator('#step').click();
    await Promise.all([first.locator('#step').click(), second.locator('#step').click()]);
    await first.waitForFunction(() => document.querySelector('#journal-count').textContent === '2 / 6');
    await second.waitForFunction(() => document.querySelector('#journal-count').textContent === '2 / 6');
    assert.deepEqual(await first.evaluate(() => JSON.parse(localStorage.getItem('light-seed-game-discovered-echoes'))), [0, 1]);
  } finally { await context.close(); }
});

test('unavailable echo storage keeps the discovery in the current page', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'light-seed-game-discovered-echoes') throw new DOMException('Full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill('turnLeft();\nmoveForward();\nturnRight();\nmoveForward();');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#journal-count').textContent(), /1 \/ 6/);
    await page.locator('.journal summary').click();
    assert.match(await page.locator('#journal-note').textContent(), /無法保存回聲/);
    assert.match(await page.locator('#journal-entries').textContent(), /小花園/);
    await reloadGame(page);
    assert.match(await page.locator('#journal-count').textContent(), /0 \/ 6/);
  } finally { await context.close(); }
});

test('JavaScript line comments can follow an instruction without changing its result', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.locator('#code').fill('moveForward(); // 第一步\nmoveForward(); // 到光種\ncollectLight(); // 拾取');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
    assert.match(await page.locator('#status').textContent(), /第 3 行/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await reloadGame(page);
    await page.locator('#code').fill('if (lightIsPresent()) collectLight(); // 起點沒有\nrepeat(2, moveForward); // 前進兩步\nif (lightIsPresent()) collectLight(); // 到達光種');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
  } finally { await context.close(); }
});

test('mission switching preserves each in-page draft, including empty and inserted text', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await reloadGame(page);
    await page.locator('#previous-mission').click();
    await page.locator('#code').fill('');
    await page.locator('#previous-mission').click();
    await page.locator('#code').fill('// 我的第一關\nturnLeft();');
    await page.locator('#next-unlocked').click();
    assert.equal(await page.locator('#code').inputValue(), '');
    await page.locator('[data-command="moveForward"]').click();
    await page.locator('#reset').click();
    await page.locator('#previous-mission').click();
    assert.equal(await page.locator('#code').inputValue(), '// 我的第一關\nturnLeft();');
    await page.locator('#next-unlocked').click();
    assert.equal(await page.locator('#code').inputValue(), 'moveForward();');
    await reloadGame(page);
    await page.locator('#previous-mission').click();
    assert.match(await page.locator('#code').inputValue(), /repeat\(2, moveForward\)/);
  } finally { await context.close(); }
});

test('command insertion preserves a line at the cursor and respects the editor limit', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    const editor = page.locator('#code');
    await editor.fill('moveForward();\ncollectLight();');
    await editor.evaluate((element) => { element.focus(); element.setSelectionRange(4, 4); });
    await page.locator('[data-command="turnLeft"]').click();
    assert.equal(await editor.inputValue(), 'moveForward();\nturnLeft();\ncollectLight();');
    await editor.evaluate((element) => {
      const start = element.value.indexOf('turnLeft();');
      element.setSelectionRange(start, start + 'turnLeft();'.length);
    });
    await page.locator('[data-command="turnRight"]').click();
    assert.equal(await editor.inputValue(), 'moveForward();\nturnRight();\ncollectLight();');
    const full = 'x'.repeat(1199);
    await editor.fill(full);
    await page.locator('[data-command="moveForward"]').click();
    assert.equal(await editor.inputValue(), full);
    assert.match(await page.locator('#status').textContent(), /最多 1200 個字/);
  } finally { await context.close(); }
});

test('switching missions interrupts execution without losing the edited program', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '1'));
    await reloadGame(page);
    await page.locator('#previous-mission').click();
    const source = 'moveForward();\nmoveForward();\ncollectLight();';
    await page.locator('#code').fill(source);
    await page.locator('#run').click();
    await page.locator('#next-unlocked').click();
    await page.waitForTimeout(600);
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 06/);
    assert.match(await page.locator('#coordinates').textContent(), /X 01.*Y 05/);
    assert.equal(await page.locator('#run').isEnabled(), true);
    await page.locator('#previous-mission').click();
    assert.equal(await page.locator('#code').inputValue(), source);
  } finally { await context.close(); }
});

test('a storage write failure still permits in-session progression', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException('Full', 'QuotaExceededError'); };
    });
    const page = await context.newPage();
    await openGame(page);
    await complete(page, 0);
    assert.match(await page.locator('#progress-note').textContent(), /無法保存/);
    await page.locator('#next-mission').click();
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 06/);
  } finally { await context.close(); }
});

test('a completion-record write failure warns even if unlocked progress was saved', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'light-seed-game-completed-mission') throw new DOMException('Full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    const page = await context.newPage();
    await openGame(page);
    await complete(page, 0);
    assert.match(await page.locator('#progress-note').textContent(), /無法保存進度/);
    await reloadGame(page);
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 06/);
  } finally { await context.close(); }
});

test('execution highlights and reveals the current source line, then clears on reset or edit', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await openGame(page);
    const source = `${Array(29).fill('// 探索筆記').join('\n')}\nturnLeft();\nmoveForward();`;
    await page.locator('#code').fill(source);
    await page.locator('#step').click();
    assert.equal(await page.locator('#line-gutter .active-line').textContent(), '30');
    assert.ok(await page.locator('#code').evaluate((editor) => editor.scrollTop > 0));
    assert.match(await page.locator('#status').textContent(), /第 30 行/);
    await page.locator('#step').click();
    assert.equal(await page.locator('#line-gutter .active-line').textContent(), '31');
    await page.locator('#reset').click();
    assert.equal(await page.locator('#line-gutter .active-line').count(), 0);
    await page.locator('#step').click();
    await page.locator('#code').fill('turnRight();');
    assert.equal(await page.locator('#line-gutter .active-line').count(), 0);
  } finally { await context.close(); }
});

test('condition feedback identifies true and false sensors, including failed actions', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await reloadGame(page);
    await page.locator('#code').fill('if (lightIsPresent()) collectLight();\nmoveForward();\nmoveForward();\nif (lightIsPresent()) collectLight();\nif (pathAheadIsBlocked()) turnLeft();\nif (pathAheadIsBlocked()) turnRight();');
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件不成立（lightIsPresent\(\)）.*略過/);
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件成立（lightIsPresent\(\)）.*光種/);
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件成立（pathAheadIsBlocked\(\)）.*左轉/);
    await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件不成立（pathAheadIsBlocked\(\)）.*略過/);
    await page.locator('#code').fill('moveForward();\nmoveForward();\nif (pathAheadIsBlocked()) openGate();');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /條件成立（pathAheadIsBlocked\(\)）.*還沒抵達導航門/);
    assert.equal(await page.locator('#win-card').isHidden(), true);
  } finally { await context.close(); }
});

test('repeat feedback shows each iteration and identifies where an action fails', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGame(page);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '1'));
    await reloadGame(page);
    await page.locator('#code').fill('repeat(3, moveForward);');
    for (let i = 1; i <= 3; i += 1) {
      await page.locator('#step').click();
      const expected = new RegExp(`第 1 行（第 ${i} / 3 次）`);
      assert.match(await page.locator('#status').textContent(), expected);
      assert.match(await page.locator('#editor-help').textContent(), expected);
      assert.equal(await page.locator('#line-gutter .active-line').textContent(), '1');
    }
    await page.locator('#code').fill('repeat(10, moveForward);');
    for (let i = 0; i < 7; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#status').textContent(), /第 1 行（第 7 \/ 10 次）.*地圖邊界/);
  } finally { await context.close(); }
});
