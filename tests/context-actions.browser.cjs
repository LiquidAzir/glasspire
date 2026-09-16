/* Context-action fixtures are isolated, held game states. Inputs are real Enter,
   coordinate-free focused clicks and native mobile taps; no personal saves/cloud. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kgood/.codex/skills/develop-web-game/node_modules/playwright');
const base = process.env.REALM_URL || 'http://127.0.0.1:5265';
const out = process.env.REALM_EVIDENCE || path.resolve(__dirname, '../../.visual-review/spire-feel/actions/tests');
fs.mkdirSync(out, { recursive: true });
const checks = [], errors = [], external = [];
function check(name, ok, detail) { checks.push({ name, pass: !!ok, detail }); assert.ok(ok, name + ' ' + JSON.stringify(detail || '')); }
const view = p => p.evaluate(() => {
  const g = __hollowlight.game, a = JSON.parse(render_game_to_text()).interaction;
  return { screen: g.screen, action: a, mp: g.char.mp, cd: g.world.player.skillCd, cast: g._castUid || 0, label: document.getElementById('game-interact-label').textContent, touch: document.getElementById('touch-action-label').textContent, hud: document.getElementById('hud-skill-name').textContent, status: document.getElementById('hud-skill-cd').textContent, toast: document.getElementById('hud-toast').textContent };
});
async function input(p, method) {
  if (method === 'touch') await p.locator('#touch-action').tap();
  else if (method === 'click') await p.evaluate(() => document.activeElement.click());
  else await p.keyboard.press('Enter');
}
async function freshState(p, classId = 'warrior') {
  await p.evaluate(id => {
    const h = __hollowlight; h.test.start(id); h.test.hold(true);
    const g = h.game; g.enemies = []; g.items = []; g.world.npcs = []; g.world.portals = []; g.world.shrines = [];
    g.world.player.x = 8.5; g.world.player.y = 9.5;
    g.char.autoPlay = false; g.char.autoPotion = false;
    h.test.interact(); h.test.hud();
  }, classId);
}
async function hud(p) { await p.evaluate(() => { __hollowlight.test.interact(); __hollowlight.test.hud(); }); }
function parity(name, x, type, label) {
  check(name + ' label/HUD/text-state agree', x.action.type === type && x.action.label === label && x.label === label && x.touch === label && x.hud === x.action.displayName && x.status === x.action.status, x);
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const method of ['Enter', 'click', 'touch']) {
      const phone = method === 'touch';
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 600, height: 600 }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block' });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) { external.push(url.href); return route.abort(); }
        if (url.pathname === '/app.js') {
          const response = await route.fetch();
          const body = (await response.text()).replace('save: saveGame, interact: tickInteraction,', 'hud: updateHud, context: resolveContextAction, skillState: skillCastState, save: saveGame, interact: tickInteraction,');
          return route.fulfill({ response, body });
        }
        return route.continue();
      });
      const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.goto(base + '/?test'); await p.waitForFunction(() => window.__hollowlight?.test);

      for (const classId of ['warrior', 'mage', 'ranger', 'summoner', 'paladin']) {
        const name = method + ' ' + classId;
        await freshState(p, classId);
        let before = await view(p); parity(name + ' ready', before, 'skill', 'Cast');
        check(name + ' correct default skill ready', before.action.available && before.status === 'READY');
        await input(p, method); let after = await view(p);
        check(name + ' tap casts shown skill and spends shown cost', after.cast > before.cast && after.cd > 0 && after.mp === before.mp - before.action.manaCost, { before, after });
        parity(name + ' cooldown immediately after tap', after, 'skill', 'Cast');
        check(name + ' cooldown is unavailable immediately', !after.action.available && after.action.reason === 'cooldown');
        before = after; await input(p, method); after = await view(p);
        check(name + ' repeat during cooldown does not spend mana', after.mp === before.mp && after.cast === before.cast && /cooling/.test(after.toast));

        await p.evaluate(() => { const g = __hollowlight.game; g.world.player.skillCd = 0; g.char.mp = 0; __hollowlight.test.hud(); });
        before = await view(p); parity(name + ' empty mana', before, 'skill', 'Cast');
        check(name + ' no mana is honestly shown', !before.action.available && before.status === 'NO MANA');
        await input(p, method); after = await view(p);
        check(name + ' empty mana does not cast', after.cast === before.cast && after.mp === 0 && /Not enough mana/.test(after.toast));

        await p.evaluate(() => { const g = __hollowlight.game; g.world.player.silenced = 1; g.activeBuffs = { channeling: 5 }; __hollowlight.test.hud(); });
        before = await view(p); await input(p, method); after = await view(p);
        check(name + ' silence overrides even free channeling', before.status === 'SILENCED' && !before.action.available && before.cast === after.cast && after.toast === 'SILENCED!');
        await p.evaluate(() => { const g = __hollowlight.game; g.world.player.silenced = 0; g.world.player.skillCd = 9; __hollowlight.test.hud(); });
        before = await view(p); await input(p, method); after = await view(p);
        check(name + ' channeling bypasses cost and existing cooldown', before.status === 'FREE' && before.action.available && before.action.manaCost === 0 && after.cast > before.cast && after.mp === 0 && after.cd === 9, { before, after });

        await p.evaluate(() => { const h = __hollowlight, g = h.game; g.activeBuffs = {}; g.world.player.skillCd = 0; g.char.skillRunes[g.char.selectedSkill] = 'efficient'; const cost = h.test.skillState().cost; g.char.mp = cost; h.test.hud(); });
        before = await view(p); await input(p, method); after = await view(p);
        check(name + ' efficient rune availability matches actual mana spent', before.action.available && after.cast > before.cast && after.mp === 0 && before.mp === before.action.manaCost, { before, after });
      }

      for (const [role, screen] of [['vendor', 'vendor'], ['stash', 'stash'], ['quests', 'dialog'], ['waypoint', 'waypoint'], ['mystery', 'mystery-vendor'], ['mercenary', 'mercenary'], ['gambler', 'gambler']]) {
        await freshState(p);
        await p.evaluate(role => { const g = __hollowlight.game; g.world.npcs = [{ id: role, role, name: 'Test ' + role, x: 8, y: 8 }]; }, role); await hud(p);
        const before = await view(p); parity(method + ' ' + role, before, 'npc', 'Talk');
        await input(p, method); const after = await view(p);
        check(method + ' ' + role + ' opens correct screen without skill cost', after.screen === screen && after.mp === before.mp && after.cast === before.cast, after);
      }

      await freshState(p); await p.evaluate(() => { const g = __hollowlight.game; g.world.shrines = [{ x: 8.9, y: 9.5, type: 'fury', used: false }]; }); await hud(p);
      let before = await view(p); parity(method + ' shrine', before, 'shrine', 'Use'); await input(p, method);
      let after = await view(p); check(method + ' uses shrine without casting and immediately returns to Cast', after.action.type === 'skill' && after.label === 'Cast' && after.cast === before.cast && after.mp === before.mp && await p.evaluate(() => __hollowlight.game.world.shrines[0].used));

      await freshState(p); await p.evaluate(() => { const g = __hollowlight.game; g.world.portals = [{ x: 8.9, y: 9.5, kind: 'town', label: 'Sanctuary' }]; }); await hud(p);
      before = await view(p); parity(method + ' portal', before, 'portal', 'Enter'); await input(p, method); after = await view(p);
      check(method + ' portal actually travels without skill cost', after.action.type === 'skill' && after.mp === before.mp && after.cast === before.cast && await p.evaluate(() => __hollowlight.game.world.player.x === 10.5));

      await freshState(p); await p.evaluate(() => { const g = __hollowlight.game; g.world.portals = [{ x: 8.9, y: 9.5, kind: 'rift-next', label: 'Sealed gate', locked: true }]; }); await hud(p);
      before = await view(p); parity(method + ' locked portal', before, 'skill', 'Cast'); await input(p, method); after = await view(p);
      check(method + ' locked portal stays locked and cannot swallow cast', after.cast > before.cast && await p.evaluate(() => __hollowlight.game.world.portals[0].locked));

      await freshState(p); await p.evaluate(() => { const g = __hollowlight.game; g.world.npcs = [{ role: 'quests', name: 'Captain', x: 8, y: 8 }]; }); await hud(p);
      // Change the world state between HUD refresh and pinch, retaining old caches.
      await p.evaluate(() => { __hollowlight.game.world.npcs = []; });
      before = await view(p); await input(p, method); after = await view(p);
      check(method + ' removed/stale NPC cache cannot open old menu', after.screen === 'game' && after.cast > before.cast && after.action.type === 'skill');

      await freshState(p); await p.evaluate(() => {
        const g = __hollowlight.game;
        g.world.npcs = [{ role: 'quests', name: 'Behind wall', x: 8, y: 8 }];
        g.world.portals = [{ kind: 'town', label: 'Behind wall', x: 8.5, y: 8.5 }];
        g.world.shrines = [{ type: 'fury', x: 8.5, y: 8.5 }];
        g.world.grid[8][8] = 1;
      }); await hud(p); before = await view(p); parity(method + ' obstructed interactions', before, 'skill', 'Cast'); await input(p, method); after = await view(p);
      check(method + ' walls block all interaction types, skill still casts', after.cast > before.cast && after.screen === 'game');

      await freshState(p); await p.evaluate(() => {
        const g = __hollowlight.game;
        g.world.npcs = [{ role: 'unknown', name: 'Decoration', x: 8, y: 8 }];
        g.world.portals = [{ kind: 'unknown', x: 8.8, y: 9.5 }];
        g.world.shrines = [{ type: 'fury', used: true, x: 8.9, y: 9.5 }, { type: 'unknown', x: 8.9, y: 9.5 }];
      }); await hud(p); before = await view(p); await input(p, method); after = await view(p);
      check(method + ' decorations and spent shrines never consume action', before.action.type === 'skill' && after.cast > before.cast);

      // Priority and nearest-in-category are intentional and shared by prompt/dispatch.
      await freshState(p); await p.evaluate(() => {
        const g = __hollowlight.game;
        g.world.npcs = [{ role: 'quests', name: 'Far Captain', x: 8, y: 8.2 }, { role: 'stash', name: 'Near Keeper', x: 8, y: 8.7 }];
        g.world.portals = [{ kind: 'town', label: 'Sanctuary', x: 8.6, y: 9.5 }];
        g.world.shrines = [{ type: 'fury', used: false, x: 8.6, y: 9.5 }];
      }); await hud(p); before = await view(p); await input(p, method); after = await view(p);
      check(method + ' nearest NPC takes priority over portal and shrine', before.hud === 'Near Keeper' && before.action.type === 'npc' && after.screen === 'stash');

      // Existing auto-loot semantics remain independent of what the pinch does.
      await freshState(p); await p.evaluate(() => { const h = __hollowlight, g = h.game; g.items = [{ x: 8.5, y: 9.5, item: h.test.item('rusted-sword'), age: 0 }]; });
      before = await view(p); await input(p, method); after = await view(p);
      check(method + ' nearby loot auto-collects and does not suppress skill', after.cast > before.cast && await p.evaluate(() => __hollowlight.game.items.length === 0));
      await freshState(p); await p.evaluate(() => { const h = __hollowlight, g = h.game; g.char.inventory = Array.from({ length: 24 }, () => h.test.item('rusted-sword')); g.items = [{ x: 8.5, y: 9.5, item: h.test.item('rusted-sword'), age: 0 }]; });
      before = await view(p); await input(p, method); after = await view(p);
      check(method + ' full bag still casts while retaining uncollected loot', after.cast > before.cast && await p.evaluate(() => __hollowlight.game.items.length === 1));
      await context.close();
    }
    check('No runtime errors', errors.length === 0, errors);
    check('No external/cloud requests', external.length === 0, external);
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks, errors, external, passed: checks.filter(c => c.pass).length }, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ passed: checks.length, out }));
})().catch(e => { console.error(e); process.exitCode = 1; });
