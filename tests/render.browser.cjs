// Regression guards for the camera/fog overhaul and both lightweight fallbacks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.codex/skills/develop-web-game/node_modules/playwright'));
const url=process.env.REALM_URL||'http://127.0.0.1:5251';
let browser;
(async()=>{browser=await chromium.launch({headless:true});const checks=[],errors=[];
for(const mode of ['3d','missing-art','2d']){
 const context=await browser.newContext({viewport:{width:600,height:600},deviceScaleFactor:3});let artRequests=0;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')return r.abort();if(u.pathname.endsWith('spire-kit.json')){artRequests++;if(mode==='missing-art')return r.fulfill({status:503,body:'Test unavailable'});}return r.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/?test'+(mode==='2d'?'&gl=0':''));await page.waitForFunction(()=>window.__hollowlight?.test);await page.evaluate(async()=>{if(__GL.ready)await __GL.ready;__hollowlight.test.start('warrior');__hollowlight.test.hold(true);advanceTime(0);});
 if(mode==='3d'){
  const state=await page.evaluate(()=>{const g=__hollowlight.game,p=g.world.player,a=__GL.project(p.x,p.y,0),b=__GL.project(p.x+1,p.y,0),c=__GL.project(p.x,p.y+1,0),h=__GL.project(p.x,p.y,1),canvas=document.querySelector('#game-canvas-gl');return{enabled:__GL.enabled,stats:__GL._dbg(),dx:b.x-a.x,dy:c.y-a.y,height:a.y-h.y,width:canvas.width,heightPx:canvas.height};});
  assert.equal(state.enabled,true);assert.equal(state.stats.art.models,27);checks.push('Blender kit loaded with27 original meshes');
  for(const key of ['dx','dy','height'])assert.ok(Math.abs(state[key]-28)<.001,key+' must project to28px');checks.push('Camera preserves28px tiles on both axes and correct model height');
  assert.equal(state.width,600);assert.equal(state.heightPx,600);checks.push('600px framebuffer remains capped on a3x-density display');
  for(const biome of ['crypts','overgrowth','frostpeak','infernal','tempest','voidspire']){
   await page.evaluate(id=>{__hollowlight.enterBiome(id,1);advanceTime(0);},biome);
   await page.waitForFunction(()=>__GL._dbg().rendererInfo.calls>0);
   const stats=await page.evaluate(()=>__GL._dbg());assert.ok(stats.playerVisible,biome+' '+JSON.stringify(stats));checks.push(biome+' draws world and hero');
  }
 }else if(mode==='missing-art'){
  const result=await page.evaluate(()=>({enabled:__GL.enabled,art:__GL._dbg().art,gear:__GL._gear(),state:JSON.parse(render_game_to_text())}));assert.equal(result.enabled,true);assert.equal(result.art.ready,false);assert.equal(result.state.screen,'game');assert.ok(result.gear.weapon>0);checks.push('Unavailable Blender kit retains a playable legacy3D hero and gear');
 }else{
  assert.equal(await page.evaluate(()=>__GL.enabled),false);assert.equal(artRequests,0);assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).screen),'game');checks.push('Canvas2D fallback remains playable and does not fetch Blender art');
 }
 await context.close();
}
assert.deepEqual(errors,[]);checks.push('No JavaScript runtime errors');const report={passed:checks.length,checks,errors};const out=process.env.REALM_EVIDENCE||path.resolve(__dirname,'../../.visual-review/spire/render-regressions');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
