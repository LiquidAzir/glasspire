const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.codex/skills/develop-web-game/node_modules/playwright'));
async function openHarness(name) {
  const out=process.env.REALM_EVIDENCE||path.resolve(__dirname,'../../.visual-review/spire-systems/progression');fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader']});
  const context=await browser.newContext({viewport:{width:600,height:600}}),errors=[],external=[];
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)){external.push(u.origin);return route.abort();}
    if(u.pathname==='/app.js') {
      const response=await route.fetch(),body=await response.text(),marker='window.__GL_DATA =';
      if(!body.includes(marker))throw new Error('Missing local test insertion anchor');
      const methods='derived, applyDerivedToChar, computeSetBonuses, rollItem, rollAffix, withSeededRandom, gainXp, xpForLevel, xpForParagon, equipItemAt, unequipSlot, craftSalvage, craftUpgrade, craftAddSocket, socketGem, imprintApply, rerollItem, reforgeKeepBest, claimChapter, showItemDetail, renderCharacter, renderSkills, renderCraft, openVendor, getActiveSkillId, getAvailableSkills, stashDeposit, stashWithdraw, vendorSell, vendorBuy, spendParagon, spendParagonNode, spendStat, killEnemy, saveGame, navigateTo, getAvailableSkills, CLASSES, AFFIXES, ITEM_BASES, GEMS, POWERS, JOURNEY, SETS, BIOMES, ENEMIES, SKILLS, RUNES';
      return route.fulfill({response,body:body.replace(marker,`window.__gearTest={${methods}}; ${marker}`)});
    }
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.REALM_URL||'http://127.0.0.1:5251')+'/?test');await page.waitForFunction(()=>window.__gearTest&&window.__hollowlight?.test);
  const report={name,checks:[],errors,external};
  return {browser,page,out,report,check(name,actual,expected=true){require('node:assert/strict').deepEqual(actual,expected,name);report.checks.push({name,pass:true});},finish:async()=>{fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(report,null,2));await browser.close();console.log(`${name}: ${report.checks.length} checks passed; ${errors.length} errors.`);}};
}
module.exports={openHarness};
