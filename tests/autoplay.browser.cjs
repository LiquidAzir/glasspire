/* Bounded auto-play regressions with explicit local collision/loot fixtures. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || require('node:path').join(require('node:os').homedir(),'.codex/skills/develop-web-game/node_modules/playwright'));
const fs = require('node:fs'), path = require('node:path');
const out = process.env.SPIRE_EVIDENCE || path.resolve(__dirname, '../../.visual-review/spire-systems/experience/autoplay');
fs.mkdirSync(out, { recursive: true });
const report = { checks: [], errors: [], notice: 'Disposable generated-dungeon session, then bounded nine-by-seven floor fixtures. Only geometry, bag capacity and isolated loot are prepared. Auto-Play is enabled through its menu control; movement and pickup use normal simulation.' };
const check = (name, pass, detail) => report.checks.push({ name, pass, detail });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 600, height: 600 }, serviceWorkers: 'block' });
    await context.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto((process.env.REALM_URL || 'http://127.0.0.1:5251').replace(/\/$/, '') + '/?test=1'); await page.waitForFunction(() => window.__hollowlight?.test);
    const prepare = async ({ full = false, filter = 'off', gemmed = false, wall = false, classId = 'warrior' }) => {
      await page.evaluate(({ full, filter, gemmed, wall, classId }) => {
        const h = __hollowlight; h.test.start(classId); h.test.hold(true); h.enterBiome('crypts', 1);
        const g = h.game, grid = Array.from({ length: 7 }, (_, y) => Array.from({ length: 9 }, (_, x) => x === 0 || x === 8 || y === 0 || y === 6 ? 1 : 0));
        if (wall) for (let y = 1; y <= 4; y++) grid[y][4] = 1;
        g.world = { ...g.world, w: 9, h: 7, grid, player: { ...g.world.player, x: 3.5, y: 3.5 }, portals: [{ x: 7.5, y: 5.5, kind: 'next', locked: false }], shrines: [], npcs: [] };
        g.enemies = []; g.minions = []; g.projectiles = []; g.particles = []; g.telegraphs = [];
        g.char.lootFilter = filter;
        if (full) while (g.char.inventory.length < 24) g.char.inventory.push(h.test.item('rusted-sword'));
        const item = h.test.item('rusted-sword');
        if (gemmed) item.gems = ['fixture-socketed-gem'];
        g.items = [{ x: wall ? 5.5 : 3.5, y: 3.5, item, age: 0 }];
      }, { full, filter, gemmed, wall, classId });
      await page.locator('#game [data-action=game-menu]').click();
      await page.locator('[data-action=menu-autoplay-toggle]').click();
      await page.locator('[data-action=menu-resume]').click();
    };
    const snapshot = () => page.evaluate(() => { const g = __hollowlight.game; return { x: g.world.player.x, y: g.world.player.y, bag: g.char.inventory.length, items: g.items.length, floor: g.activeFloor, auto: g.char.autoPlay, legal: __hollowlight.test.canStand(g.world.player.x, g.world.player.y) }; });
    for (const test of [
      { name: 'full bag skips kept loot', options: { full: true } },
      { name: 'full bag still salvages filtered junk', options: { full: true, filter: 'common' } },
      { name: 'socketed gear is kept even with junk filter', options: { full: true, filter: 'common', gemmed: true } },
    ]) {
      await prepare(test.options); await page.evaluate(() => advanceTime(250)); const s = await snapshot();
      check(test.name, test.options.filter === 'common' && !test.options.gemmed ? s.items === 0 : s.items === 1, s);
      check(test.name + ' continues walking', Math.hypot(s.x - 3.5, s.y - 3.5) > .4 && s.legal, s);
      check(test.name + ' preserves bag capacity', s.bag === 24 && s.auto, s);
    }
    await prepare({ wall: true });
    const trace = [];
    for (let n = 0; n < 18; n++) {
      await page.evaluate(() => advanceTime(120)); trace.push(await snapshot());
      if (trace.at(-1).items === 0) break;
    }
    check('nearby loot across wall is reached around corner', trace.at(-1).items === 0, trace);
    check('around-corner route never enters wall', trace.every(s => s.legal), trace);
    check('around-corner pickup gives exactly one item', trace.at(-1).bag === 3, trace);
    await prepare({ wall: true, classId: 'mage' });
    await page.evaluate(() => {
      // Stationary, durable enemy isolates the hero's approach from enemy movement.
      const g = __hollowlight.game, enemy = __hollowlight.test.makeEnemy('skeleton', 5.5, 3.5);
      enemy.speed = 0; enemy.hp = enemy.hpMax = 10000; g.enemies = [enemy]; g.items = [];
    });
    const rangedTrace = [];
    for (let n = 0; n < 16; n++) { await page.evaluate(() => advanceTime(120)); rangedTrace.push(await snapshot()); }
    check('ranged hero approaches around wall instead of idling inside attack range', rangedTrace.some(s => s.y > 4.9 && s.x > 4.1), rangedTrace);
    check('ranged approach respects solid wall', rangedTrace.every(s => s.legal), rangedTrace);
    await context.close();
  } finally {
    await browser.close(); const failed = report.checks.filter(c => !c.pass);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.checks.length - failed.length, total: report.checks.length, failed, errors: report.errors }, null, 2));
    if (failed.length || report.errors.length) process.exitCode = 1;
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
