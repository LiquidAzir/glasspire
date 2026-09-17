const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || require('node:path').join(require('node:os').homedir(),'.codex/skills/develop-web-game/node_modules/playwright'));
const base = process.env.REALM_URL || 'http://127.0.0.1:5251';
const out = process.env.REALM_EVIDENCE || path.resolve(__dirname, '../../.visual-review/spire-systems/combat');
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:600,height:600}});
  const checks = [], errors = [];
  // Private function access exists only in this isolated test response.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['localhost','127.0.0.1'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/app.js') {
      const res = await route.fetch();
      const source = (await res.text()).replace('save: saveGame, interact: tickInteraction,', 'attack: autoAttackTick, enemyAttack: enemyHitPlayer, bossTick: tickBoss, projectiles: tickProjectiles, kill: killEnemy, gauntlet: enterGauntlet, daily: enterDaily, throne: enterThrone, pad: pollGamepad, save: saveGame, interact: tickInteraction,');
      return route.fulfill({response:res,body:source});
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/?test');
  await page.waitForFunction(() => window.__hollowlight?.test);
  const run = fn => page.evaluate(fn);
  const check = async (name, fn) => {try {await fn();checks.push({name,pass:true});} catch(e) {checks.push({name,pass:false,error:e.message});}};
  const fixture = async () => run(() => {
    const h = __hollowlight; h.test.start('warrior'); h.test.hold(true);
    const g = h.game; g.world.kind = 'dungeon'; g.world.w = g.world.h = 40;
    g.world.grid = Array.from({length:40},(_,y)=>Array.from({length:40},(_,x)=>x===0||y===0||x===39||y===39||x===5?1:0));
    Object.assign(g.world.player,{x:4.7,y:5.5,skillCd:0,attackCd:0,dashCd:0});
    g.enemies=[];g.items=[];g.projectiles=[];g.world.portals=[];g.world.npcs=[];g.world.shrines=[];
    g.char.autoPlay=false;g.char.autoPotion=false;g.char.selectedSkill='warcry';g.char.potions=5;
    g.activeBiomeId='crypts';g.activeFloor=1;
  });
  await check('rail Skill activation releases arrow movement', async () => {
    await run(()=>{__hollowlight.test.start('warrior');__hollowlight.test.hold(true);});
    await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    const x=await run(()=>__hollowlight.game.world.player.x);
    await page.keyboard.press('ArrowRight');await run(()=>advanceTime(200));
    assert.ok(await page.evaluate(x=>__hollowlight.game.world.player.x-x,x)>.5);
  });
  await check('basic attacks cannot cross a wall but work through an opening', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('skeleton',6.01,5.5);e.hp=e.hpMax=1000;e.frozen=100;g.enemies=[e];h.test.attack(.02);const blocked=e.hp;g.world.grid[5][5]=0;g.world.player.attackCd=0;h.test.attack(2);return{blocked,open:e.hp};});
    assert.equal(r.blocked,1000);assert.ok(r.open<1000);
  });
  await check('enemy melee obeys the same wall and opening', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('skeleton',6.01,5.5),before=g.char.hp;h.test.enemyAttack(e,20);const blocked=g.char.hp;g.world.grid[5][5]=0;h.test.enemyAttack(e,20);return{before,blocked,open:g.char.hp};});
    assert.equal(r.blocked,r.before);assert.ok(r.open<r.before);
  });
  await check('nearby portal across wall cannot skip a floor', async () => {
    await fixture();await run(()=>{const g=__hollowlight.game;g.world.portals=[{kind:'next',x:6.01,y:5.5,label:'Floor2'}];document.querySelector('[data-action="game-interact"]').click();});
    assert.equal(await run(()=>__hollowlight.game.activeFloor),1);
  });
  await check('nearby NPC and loot across wall are not interaction targets', async () => {
    // A target needs a supported role, just like the real Captain in Sanctuary.
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game;g.save.upgrades.pickup=2;g.world.npcs=[{id:'captain',role:'quests',x:5.51,y:5}];g.items=[{x:6.01,y:5.5,item:h.test.item('rusted-sword'),age:0}];h.test.interact();const blocked={npc:!!g.nearbyNpc,ground:g.items.length};g.world.grid[5][5]=0;h.test.interact();return{blocked,open:{npc:!!g.nearbyNpc,ground:g.items.length}};});
    assert.deepEqual(r,{blocked:{npc:false,ground:1},open:{npc:true,ground:0}});
  });
  await check('boss exploration time and hidden nearby time do not trigger enrage', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('lich',30.5,30.5);for(let i=0;i<1600;i++)h.test.bossTick(e,.05,35,g.world.player);e.x=6.01;e.y=5.5;for(let i=0;i<1600;i++)h.test.bossTick(e,.05,1.31,g.world.player);return{time:e.fightTime||0,enraged:!!e.enraged};});assert.deepEqual(r,{time:0,enraged:false});
  });
  await check('loot scattered into masonry settles onto nearby floor and can be collected', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game;g.save.upgrades.pickup=2;const item=h.test.item('rusted-sword'),drop={x:5.3,y:5.8,item,age:0};g.items=[drop];h.test.interact();return{floor:g.world.grid[Math.floor(drop.y)][Math.floor(drop.x)],collected:g.char.inventory.includes(item),remaining:g.items.length};});assert.deepEqual(r,{floor:0,collected:true,remaining:0});
  });
  await check('engaged boss keeps its timer after retreat without targeting through walls', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('lich',4.5,8.5);h.test.bossTick(e,1,3,g.world.player);e.x=6.01;e.y=5.5;e.smashCd=.01;const n=(g.telegraphs||[]).length;h.test.bossTick(e,1,1.31,g.world.player);return{time:e.fightTime,telegraphs:(g.telegraphs||[]).length-n};});assert.equal(r.time,2);assert.equal(r.telegraphs,0);
  });
  await check('fast projectile cannot tunnel through a one-tile wall', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('skeleton',6.7,5.5);e.hp=e.hpMax=1000;g.enemies=[e];g.projectiles=[{x:4.7,y:5.5,dx:1,dy:0,speed:40,dmg:100,color:'#fff',friendly:true,age:0,life:2}];h.test.projectiles(.05);return{hp:e.hp,shots:g.projectiles.length};});assert.equal(r.hp,1000);assert.equal(r.shots,0);
  });
  await check('fast projectile hits a target along its path before reaching a wall', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('skeleton',3.5,5.5);e.hp=e.hpMax=1000;g.enemies=[e];g.projectiles=[{x:1.5,y:5.5,dx:1,dy:0,speed:100,dmg:100,color:'#fff',friendly:true,age:0,life:2}];h.test.projectiles(.05);return{hp:e.hp,shots:g.projectiles.length};});assert.ok(r.hp<1000);assert.equal(r.shots,0);
  });
  await check('explosive projectile cannot damage enemies on the other side of a wall', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,e=h.test.makeEnemy('skeleton',6.1,5.5);e.hp=e.hpMax=1000;g.enemies=[e];g.projectiles=[{x:4.7,y:5.5,dx:1,dy:0,speed:40,dmg:100,color:'#fff',friendly:true,age:0,life:2,explosive:{radius:3}}];h.test.projectiles(.05);return e.hp;});assert.equal(r,1000);
  });
  await check('controller skill fires once per press and rearms on release', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game,buttons=Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={axes:[0,0],buttons};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pad?[window.__pad]:[]});const mp=g.char.mp;buttons[2].pressed=true;h.test.pad();const once=g.char.mp;g.world.player.skillCd=0;h.test.pad();const held=g.char.mp;buttons[2].pressed=false;h.test.pad();buttons[2].pressed=true;h.test.pad();return{mp,once,held,twice:g.char.mp};});assert.ok(r.once<r.mp);assert.equal(r.held,r.once);assert.ok(r.twice<r.held);
  });
  await check('controller Potion and Dash work; disconnect releases held movement', async () => {
    await fixture();const r=await run(()=>{const h=__hollowlight,g=h.game;h.test.pad();window.__pad.buttons.forEach(b=>b.pressed=false);h.test.pad();g.char.hp=30;window.__pad.buttons[3].pressed=true;h.test.pad();const hp=g.char.hp,potions=g.char.potions;g.world.player.lastDir={x:-1,y:0};const x=g.world.player.x;window.__pad.buttons[5].pressed=true;h.test.pad();const dx=x-g.world.player.x;window.__pad.axes=[-1,0];h.test.pad();const held=g.keys.left;window.__pad=null;h.test.pad();return{hp,potions,dx,held,released:!g.keys.left};});assert.ok(r.hp>30);assert.equal(r.potions,4);assert.ok(r.dx>.5);assert.equal(r.held,true);assert.equal(r.released,true);
  });
  await check('every boss hoard includes a legendary or mythic', async () => {
    const r=await run(()=>{const h=__hollowlight;h.test.start('warrior');h.test.hold(true);const g=h.game;let missing=0;for(let i=0;i<32;i++){g.items=[];const e=h.test.makeEnemy('lich',g.world.player.x+1,g.world.player.y);e.xp=0;e._gauntlet=true;g.enemies=[e];h.test.kill(e);if(!g.items.some(d=>['unique','mythic'].includes(d.item.rarity)))missing++;}return missing;});assert.equal(r,0);
  });
  await check('all seven Gauntlet bosses finish without campaign unlocks or false victory', async () => {
    const r=await run(()=>{const h=__hollowlight;h.test.start('warrior');h.test.hold(true);h.test.gauntlet();const g=h.game,ids=[];for(let i=0;i<7;i++){const e=g.enemies.find(e=>e._gauntlet);if(!e)break;ids.push(e.id);e.xp=0;h.test.kill(e);if(g.gauntlet)advanceTime(1450);}return{ids,best:g.save.bestGauntlet,won:!!g.save.gameWon,bosses:g.save.bossesKilled,run:g.gauntlet,dead:g.enemies.some(e=>e._dead)};});assert.equal(r.ids.length,7);assert.ok(r.ids.includes('stormsovereign'));assert.equal(r.best,7);assert.equal(r.won,false);assert.deepEqual(r.bosses,{});assert.equal(r.run,null);assert.equal(r.dead,false);
  });
  await check('Daily completion pays once without awarding campaign boss credit', async () => {
    const r=await run(()=>{const h=__hollowlight;h.test.start('warrior');h.test.hold(true);h.test.daily();const g=h.game,e=g.enemies.find(e=>e._daily);e.xp=0;h.test.kill(e);const gold=g.char.gold;h.test.kill(e);return{bosses:g.save.bossesKilled,once:g.char.gold===gold,done:g.save.dailyDone};});assert.deepEqual(r.bosses,{});assert.equal(r.once,true);assert.ok(r.done);
  });
  await check('campaign finale records King, removes corpse and secures full-bag loot before reload', async () => {
    const r=await run(()=>{const h=__hollowlight;h.test.start('warrior');h.test.hold(true);const g=h.game;h.test.throne();g.char.inventory=Array.from({length:24},()=>h.test.item('rusted-sword'));const e=g.enemies.find(e=>e.id==='hollowking');e.xp=0;h.test.kill(e);const save=JSON.parse(localStorage.hollowlight_save_v2);return{won:g.save.gameWon,king:g.save.bossesKilled.hollowking,corpse:g.enemies.includes(e),ground:g.items.length,stash:save.stash.length,rarities:save.stash.map(i=>i.rarity)};});assert.equal(r.won,true);assert.equal(r.king,1);assert.equal(r.corpse,false);assert.equal(r.ground,0);assert.ok(r.stash>=7);assert.ok(r.rarities.includes('mythic'));await page.reload();await page.waitForFunction(()=>window.__hollowlight?.test);assert.equal(await run(()=>__hollowlight.game.save.bossesKilled.hollowking),1);assert.equal(await run(()=>__hollowlight.game.save.stash.length),r.stash);
  });
  await run(()=>{__hollowlight.test.start('warrior');__hollowlight.test.hold(true);__hollowlight.enterBiome('crypts',1);});
  await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'combat-controls.png')});
  await check('no runtime errors',()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,failures:checks.filter(x=>!x.pass),errors}));
  await browser.close();if(checks.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
