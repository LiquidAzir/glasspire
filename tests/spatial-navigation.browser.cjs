// Spatial menu regression suite. Disposable local saves; no cloud or owner data.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(require('node:os').homedir(), '.codex/skills/develop-web-game/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
const out = process.env.REALM_EVIDENCE || path.resolve(root, '../.visual-review/spire-spatial-nav-2026-09-22');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end('window.HOLLOWLIGHT_CONFIG={cloudUrl:""};'); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !mime[path.extname(file)] || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', mime[path.extname(file)]); res.end(fs.readFileSync(file));
});
const checks = [], errors = [], outbound = [];
const check = async (name, fn) => { try { await fn(); checks.push({ name, pass: true }); } catch (error) { checks.push({ name, pass: false, error: error.message }); } };
(async () => {
  await new Promise(r => server.listen(process.env.NAV_PORT || 0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  if (process.argv.includes('--serve')) { console.log(base + ' (cloud disabled)'); return; }
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
  try {
    for (const viewport of [{ width: 600, height: 600 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600, isMobile: viewport.width < 600, serviceWorkers: 'block' });
      await ctx.routeWebSocket('**/*', ws => { outbound.push('websocket'); ws.close(); });
      await ctx.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) { outbound.push(url.origin); return route.abort(); }
        if (url.pathname === '/app.js') {
          const response = await route.fetch();
          const text = await response.text();
          return route.fulfill({ response, body: text.replace('save: saveGame, interact: tickInteraction,', 'navigate: navigateTo, dialog: showDialog, save: saveGame, interact: tickInteraction,') });
        }
        return route.continue();
      });
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/?test'); await page.waitForFunction(() => window.__hollowlight?.test);
      const prefix = viewport.width + 'px: ';
      const run = fn => page.evaluate(fn);
      const action = () => run(() => document.activeElement?.dataset.action);
      const press = key => page.keyboard.press(key);
      const focus = selector => page.locator(selector).focus();
      const click = a => page.locator(`[data-action="${a}"]`).filter({ visible: true }).click();
      const start = () => run(() => { __hollowlight.test.start('warrior'); __hollowlight.test.hold(true); });
      await check(prefix + 'title vertical movement stays at edges; sideways does not change row', async () => {
        await focus('[data-action="title-new"]');
        await press('ArrowRight'); assert.equal(await action(), 'title-new');
        await press('ArrowLeft'); assert.equal(await action(), 'title-new');
        await press('ArrowUp'); assert.equal(await action(), 'title-new');
      });
      await click('title-new');
      await check(prefix + 'class grid follows displayed columns and keeps horizontal edges', async () => {
        assert.equal(await run(() => document.activeElement.dataset.class), 'warrior');
        await press('ArrowRight'); assert.equal(await run(() => document.activeElement.dataset.class), viewport.width === 600 ? 'mage' : 'warrior');
        await press('ArrowDown'); assert.equal(await run(() => document.activeElement.dataset.class), viewport.width === 600 ? 'summoner' : 'mage');
        if (viewport.width === 600) {
          await press('ArrowDown'); assert.equal(await run(() => document.activeElement.dataset.class), 'paladin');
          await press('ArrowUp'); assert.equal(await run(() => document.activeElement.dataset.class), 'summoner');
          await press('ArrowRight'); assert.equal(await run(() => document.activeElement.dataset.class), 'summoner');
        }
      });
      await page.screenshot({ path: path.join(out, `classes-${viewport.width}.png`) });
      await start(); await press('Escape');
      await check(prefix + 'journal Down follows column and Right follows row without wrapping', async () => {
        assert.equal(await action(), 'menu-resume'); await press('ArrowDown'); assert.equal(await action(), 'menu-inventory');
        await press('ArrowRight'); assert.equal(await action(), 'menu-character');
        await press('ArrowRight'); assert.equal(await action(), 'menu-character');
        await press('ArrowDown'); assert.equal(await action(), 'menu-talents');
        await press('ArrowLeft'); assert.equal(await action(), 'menu-skills');
        await press('ArrowLeft'); assert.equal(await action(), 'menu-skills');
        await press('ArrowUp'); assert.equal(await action(), 'menu-inventory');
      });
      await check(prefix + 'incomplete rows choose nearest next row and preserve the previous column', async () => {
        await focus('[data-action="menu-bestiary"]'); await press('ArrowDown'); assert.equal(await action(), 'menu-factions');
        await press('ArrowUp'); assert.equal(await action(), 'menu-bestiary');
      });
      await check(prefix + 'long menu traversal scrolls focus into view and stops at bottom', async () => {
        await focus('[data-action="menu-inventory"]');
        for (let i = 0; i < 40; i++) await press('ArrowDown');
        assert.equal(await action(), 'menu-sync');
        const visible = await run(() => { const r = document.activeElement.getBoundingClientRect(), s = document.activeElement.closest('.content').getBoundingClientRect(); return r.top >= s.top && r.bottom <= s.bottom; });
        assert.equal(visible, true); await press('ArrowRight'); assert.equal(await action(), 'menu-title');
        await press('ArrowDown'); assert.equal(await action(), 'menu-title');
        await press('ArrowRight'); assert.equal(await action(), 'menu-title');
      });
      await page.screenshot({ path: path.join(out, `journal-bottom-${viewport.width}.png`) });
      await check(prefix + 'disabled, hidden, locked, inert and aria-hidden entries cannot receive navigation or pinch', async () => {
        await run(() => {
          const content = document.querySelector('#menu .content');
          content.insertAdjacentHTML('afterbegin', '<div id="nav-fixture" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><button id="nav-a" class="focusable">A</button><button id="nav-disabled" class="focusable" disabled>disabled</button><button id="nav-b" class="focusable">B</button><button id="nav-invisible" class="focusable" style="visibility:hidden">invisible</button><button class="focusable locked">locked</button><button class="focusable" aria-hidden="true">aria hidden</button><div inert><button class="focusable">inert</button></div><button class="focusable hidden">hidden</button><button id="nav-c" class="focusable">C</button></div>');
          window.navClicked = 0; document.getElementById('nav-b').onclick = () => window.navClicked++;
        });
        await focus('#nav-a'); await press('ArrowRight'); assert.equal(await run(() => document.activeElement.id), 'nav-b');
        await press('Enter'); assert.equal(await run(() => window.navClicked), 1);
        await run(() => document.getElementById('nav-b').classList.add('disabled'));
        await press('Enter'); assert.equal(await run(() => window.navClicked), 1);
        await focus('#nav-a'); await press('ArrowDown'); assert.equal(await run(() => document.activeElement.id), 'nav-c');
        await run(() => document.getElementById('nav-fixture').remove());
      });
      await check(prefix + 'fixed footer is reached only after scroll content, then returns to last row', async () => {
        await run(() => {
          const screen = document.getElementById('menu');
          screen.insertAdjacentHTML('beforeend', '<nav id="nav-footer" class="nav-bar" style="display:flex;flex-shrink:0;height:60px"><button id="nav-footer-a" class="focusable" style="flex:1">Footer A</button><button id="nav-footer-b" class="focusable" style="flex:1">Footer B</button></nav>');
        });
        await focus('[data-action="menu-inventory"]'); await press('ArrowDown'); assert.equal(await action(), 'menu-skills');
        await focus('[data-action="menu-title"]'); await press('ArrowDown'); assert.equal(await run(() => document.activeElement.id), 'nav-footer-b');
        await press('ArrowDown'); assert.equal(await run(() => document.activeElement.id), 'nav-footer-b');
        await press('ArrowUp'); assert.equal(await action(), 'menu-title');
        await run(() => document.getElementById('nav-footer').remove());
      });
      await check(prefix + 'pinch selects one menu action and Back returns one level without moving hero', async () => {
        const before = await run(() => ({ x: __hollowlight.game.world.player.x, y: __hollowlight.game.world.player.y }));
        await focus('[data-action="menu-inventory"]'); await press('Enter'); assert.equal(await run(() => __hollowlight.game.screen), 'inventory');
        await press('ArrowRight'); assert.equal(await action(), 'inv-open');
        await press('Escape'); assert.equal(await run(() => __hollowlight.game.screen), 'menu');
        assert.deepEqual(await run(() => ({ x: __hollowlight.game.world.player.x, y: __hollowlight.game.world.player.y })), before);
        await press('Enter'); assert.equal(await run(() => __hollowlight.game.screen), 'game');
        await press('Escape'); assert.equal(await run(() => __hollowlight.game.screen), 'menu');
      });
      await check(prefix + 'skills move vertically, never sideways to another row', async () => {
        await run(() => { __hollowlight.game.char.level = 30; });
        await click('menu-skills'); const before = await run(() => document.activeElement.dataset.skill);
        await press('ArrowRight'); assert.equal(await run(() => document.activeElement.dataset.skill), before);
        await press('ArrowDown'); assert.notEqual(await run(() => document.activeElement.dataset.skill), before);
        await press('ArrowUp'); assert.equal(await run(() => document.activeElement.dataset.skill), before);
        await press('Escape'); assert.equal(await run(() => __hollowlight.game.screen), 'menu');
      });
      await check(prefix + 'dialogue options move vertically, preserve edges and activate exactly once per pinch', async () => {
        await run(() => { window.dialogClicks = []; __hollowlight.test.dialog({ title: 'Fictional dialogue', portrait: '◇', portraitColor: '#fff', line: 'Isolated menu verification.', options: ['First', 'Second', 'Third'].map(label => ({ label, cb: () => window.dialogClicks.push(label) })) }); });
        await press('ArrowRight'); assert.equal(await run(() => document.activeElement.textContent), 'First');
        await press('ArrowDown'); assert.equal(await run(() => document.activeElement.textContent), 'Second');
        await press('Enter');
        await run(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true })));
        assert.deepEqual(await run(() => window.dialogClicks), ['Second']);
        await press('ArrowDown'); await press('ArrowDown'); assert.equal(await run(() => document.activeElement.textContent), 'Third');
        await press('Escape'); assert.equal(await run(() => __hollowlight.game.screen), 'menu');
      });
      await check(prefix + 'code entry retains character editing, Submit, Cancel and Back', async () => {
        await click('menu-sync'); await click('open-code-picker');
        const before = await run(() => __hollowlight.game.codePicker.code[0]); await press('ArrowUp'); assert.notEqual(await run(() => __hollowlight.game.codePicker.code[0]), before);
        for (let i = 0; i < 7; i++) await press('ArrowRight'); assert.equal(await action(), 'picker-submit');
        await press('ArrowRight'); assert.equal(await action(), 'picker-submit');
        await press('ArrowDown'); assert.equal(await action(), 'back');
        await press('Enter'); assert.equal(await run(() => __hollowlight.game.screen), 'sync');
      });
      await ctx.close();
    }
    await check('No runtime errors or external/cloud requests', async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks, errors, outbound }, null, 2));
    console.log(JSON.stringify({ passed: checks.filter(c => c.pass).length, total: checks.length, failures: checks.filter(c => !c.pass), errors }));
    if (checks.some(c => !c.pass)) process.exitCode = 1;
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
