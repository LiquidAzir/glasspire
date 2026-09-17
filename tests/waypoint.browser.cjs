/* Local presentation fixtures only; cloud and user profiles are never contacted. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || require('node:path').join(require('node:os').homedir(),'.codex/skills/develop-web-game/node_modules/playwright'));
const fs = require('node:fs'), path = require('node:path');
const out = process.env.SPIRE_EVIDENCE || path.resolve(__dirname, '../../.visual-review/spire-systems/experience/waypoint');
fs.mkdirSync(out, { recursive: true });
const report = { checks: [], errors: [], notice: 'Unlock states are isolated UI fixtures. Navigation and selection use actual arrows, focused click and phone tap. No cloud requests or personal saves.' };
const check = (name, pass, detail) => report.checks.push({ name, pass, detail });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [600, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 600 ? 600 : 844 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block' });
      await context.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
      const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
      await page.goto('http://127.0.0.1:5251/?test=1'); await page.waitForFunction(() => window.__hollowlight?.test);
      const open = async defeated => {
        await page.evaluate(n => {
          const h = __hollowlight, g = h.game;
          h.test.start('warrior'); h.test.hold(true);
          h.BIOMES.forEach((b, i) => { g.save.bossesKilled[b.id] = i < n ? 1 : 0; g.save.unlockedBiomes[b.id] = i <= n; });
          const npc = g.world.npcs.find(n => n.id === 'waypoint');
          g.world.player.x = npc.x + .5; g.world.player.y = npc.y + 1;
          h.test.interact();
        }, defeated);
        if (width < 600) await page.locator('#touch-controls .touch-pinch').tap();
        else await page.evaluate(() => document.activeElement.click());
        await page.waitForTimeout(120);
      };
      const count = await page.evaluate(() => __hollowlight.BIOMES.length);
      for (const defeated of [0, 1, count - 1, count]) {
        await open(defeated);
        const data = await page.evaluate(() => {
          const content = document.querySelector('#waypoint-content'), cards = [...content.querySelectorAll('.waypoint-card')];
          const firstSpecial = cards.findIndex(c => !c.dataset.biome && !c.classList.contains('locked'));
          return { screen: __hollowlight.game.screen, focus: document.activeElement.dataset.action, firstBiome: cards[0]?.dataset.biome, text: content.innerText, cardTexts: cards.map(c => c.innerText), firstSpecial, campaignCount: __hollowlight.BIOMES.length };
        });
        check(`${width} campaign first after ${defeated} bosses`, data.firstBiome === 'crypts' && data.firstSpecial >= data.campaignCount, data);
        check(`${width} default focus is campaign`, data.focus === 'travel', data.focus);
        if (defeated === 0) check(`${width} first goal names boss floor and unlock`, /Lich Lord.*Floor 4.*Overgrown Ruins/.test(data.text), data.text);
        if (defeated === 1) check(`${width} next goal follows actual progress`, /Old Druid.*Floor 4.*Frozen Peaks/.test(data.text), data.text);
        if (defeated === count) check(`${width} finale goal uses dynamic biome count`, data.text.includes(`All ${count} biome bosses defeated`) && data.text.includes('The Hollow Throne'), data.text);
        if (defeated > 0) check(`${width} gauntlet uses actual boss count`, data.text.includes(`${count + 1} bosses, no rest`) && data.text.includes(`/${count + 1}`), data.text);
        const reachable = new Set();
        const available = await page.evaluate(() => [...document.querySelectorAll('#waypoint .focusable')].filter(e => !e.classList.contains('locked') && e.tabIndex !== -1 && !e.disabled && e.checkVisibility()).length);
        for (let n = 0; n < available + 1; n++) {
          const f = await page.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(), c = e.closest('.content')?.getBoundingClientRect(); return { action: e.dataset.action, biome: e.dataset.biome, label: e.innerText, locked: e.classList.contains('locked'), fits: r.left >= 0 && r.right <= innerWidth && r.top >= (c?.top || 0) - 1 && r.bottom <= (c?.bottom || innerHeight) + 1 }; });
          reachable.add(f.action + ':' + f.biome + ':' + f.label);
          check(`${width} ${defeated} directional focus ${n} fits`, !f.locked && f.fits, f);
          await page.keyboard.press('ArrowDown'); await page.waitForTimeout(30);
        }
        check(`${width} ${defeated} all available actions reached`, reachable.size === available, { reachable: reachable.size, available });
        await page.locator('[data-action=travel][data-biome=crypts]').focus();
        await page.locator('#waypoint-content').evaluate(e => { e.scrollTop = 0; });
        await page.screenshot({ path: path.join(out, `${width}-bosses-${defeated}.png`) });
      }
      await open(0);
      if (width < 600) await page.locator('[data-action=travel][data-biome=crypts]').tap();
      else await page.evaluate(() => document.activeElement.click());
      check(`${width} primary campaign action starts first floor`, await page.evaluate(() => __hollowlight.game.screen === 'game' && __hollowlight.game.activeBiomeId === 'crypts' && __hollowlight.game.activeFloor === 1));
      await context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    const failed = report.checks.filter(c => !c.pass);
    console.log(JSON.stringify({ passed: report.checks.length - failed.length, total: report.checks.length, failures: failed, errors: report.errors }, null, 2));
    if (failed.length || report.errors.length) process.exitCode = 1;
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
