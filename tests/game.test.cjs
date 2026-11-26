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
]);
let server, browser, url;

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
];

async function complete(page, index) {
  const [source, steps] = solutions[index];
  await page.locator('#code').fill(source);
  for (let i = 0; i < steps; i += 1) await page.locator('#step').click();
  assert.equal(await page.locator('#win-card').isVisible(), true);
}

test('three missions unlock, survive reload, and return focus on replay', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await page.goto(url);
    await complete(page, 0);
    assert.equal(await page.locator('#world').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-mission');
    await page.locator('#next-mission').click();
    await page.reload();
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 03/);
    await complete(page, 1);
    await page.locator('#next-mission').click();
    await complete(page, 2);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'replay-win');
    await page.locator('#replay-win').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'code');
    assert.equal(await page.locator('#world').isVisible(), true);
  } finally { await context.close(); }
});

test('keyboard exploration and edited programs have consistent state', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('.rover-tile').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'code');
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
    await page.goto(url);
    assert.match(await page.locator('#progress-note').textContent(), /無法保存/);
    await page.locator('#code').fill('moveForward();\nunknown();');
    await page.locator('#run').click();
    assert.match(await page.locator('#status').textContent(), /第 2 行.*unknown/);
    assert.match(await page.locator('#coordinates').textContent(), /X 01.*Y 05/);
    await complete(page, 0);
    await page.locator('#next-mission').click();
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 03/);
  } finally { await context.close(); }
});

test('other tabs cannot overwrite newer unlocked progress', async () => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto(url);
    await second.goto(url);
    await second.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await first.waitForFunction(() => !document.querySelector('#next-unlocked').disabled);
    await complete(first, 0);
    assert.equal(await first.evaluate(() => localStorage.getItem('light-seed-game-unlocked-mission')), '2');
  } finally { await context.close(); }
});

test('narrow map fits and reset cancels a running program', async () => {
  const context = await browser.newContext({ viewport: { width: 721, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(url);
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

test('map exposes its rows and cells and distinguishes a wall from the map edge', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url);
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
    await page.goto(url);
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

test('JavaScript line comments can follow an instruction without changing its result', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#code').fill('moveForward(); // 第一步\nmoveForward(); // 到光種\ncollectLight(); // 拾取');
    for (let i = 0; i < 3; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
    assert.match(await page.locator('#status').textContent(), /第 3 行/);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await page.reload();
    await page.locator('#code').fill('if (lightIsPresent()) collectLight(); // 起點沒有\nrepeat(2, moveForward); // 前進兩步\nif (lightIsPresent()) collectLight(); // 到達光種');
    for (let i = 0; i < 4; i += 1) await page.locator('#step').click();
    assert.match(await page.locator('#goal-count').textContent(), /1 \/ 2/);
  } finally { await context.close(); }
});

test('mission switching preserves each in-page draft, including empty and inserted text', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await page.reload();
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
    await page.reload();
    await page.locator('#previous-mission').click();
    assert.match(await page.locator('#code').inputValue(), /repeat\(2, moveForward\)/);
  } finally { await context.close(); }
});

test('switching missions interrupts execution without losing the edited program', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '1'));
    await page.reload();
    await page.locator('#previous-mission').click();
    const source = 'moveForward();\nmoveForward();\ncollectLight();';
    await page.locator('#code').fill(source);
    await page.locator('#run').click();
    await page.locator('#next-unlocked').click();
    await page.waitForTimeout(600);
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 03/);
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
    await page.goto(url);
    await complete(page, 0);
    assert.match(await page.locator('#progress-note').textContent(), /無法保存/);
    await page.locator('#next-mission').click();
    assert.match(await page.locator('#mission-position').textContent(), /02 \/ 03/);
  } finally { await context.close(); }
});

test('execution highlights and reveals the current source line, then clears on reset or edit', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await page.goto(url);
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
    await page.goto(url);
    await page.evaluate(() => localStorage.setItem('light-seed-game-unlocked-mission', '2'));
    await page.reload();
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
