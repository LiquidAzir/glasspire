const {openHarness}=require('./gear-progression.helpers.cjs');
(async()=>{const h=await openHarness('gear-generation');try{
 const rows=await h.page.evaluate(()=>{const t=__gearTest,g=__hollowlight.game;__hollowlight.test.start('mage');__hollowlight.test.hold(true);const rows=[];
 for(const rarity of ['magic','rare','unique','mythic'])for(const ilvl of [1,6,12,25,50]) {
  const keys=new Set();let good=true;
  for(let seed=1;seed<=100;seed++){const it=t.withSeededRandom(seed,()=>t.rollItem(ilvl,rarity,{primal:true,noLegendary:true}));const expected=it.rarity==='magic'?1:it.rarity==='rare'?[2,3]:it.rarity==='unique'?4:5;
   good=good&&(Array.isArray(expected)?expected.includes(it.affixes.length):it.affixes.length===expected)&&new Set(it.affixes.map(a=>a.key)).size===it.affixes.length&&t.ITEM_BASES[it.baseId].ilvl<=ilvl+1;
   for(const a of it.affixes){keys.add(a.key);const def=t.AFFIXES.find(x=>x.key===a.key),cap=Math.min(def.max,ilvl+1);good=good&&def.rarities.includes(rarity==='mythic'?'unique':rarity)&&a.val===(rarity==='mythic'?Math.ceil(cap*1.4):cap);}}
  rows.push({name:`${rarity} ilvl${ilvl}:100 seeded rolls keep complete unique bounded affixes`,pass:good});rows.push({name:`${rarity} ilvl${ilvl}: eligible affix variety remains`,pass:keys.size===t.AFFIXES.filter(a=>a.rarities.includes(rarity==='mythic'?'unique':rarity)).length});
 }
 const it=__hollowlight.test.item('copper-ring');it.ilvl=25;it.rarity='mythic';g.char.inventory.push(it);
 for(const mode of ['reroll','keep']) {let good=true;for(let seed=1;seed<=200;seed++){it.affixes=t.AFFIXES.slice(0,5).map((a,i)=>({key:a.key,label:a.label,val:i+1}));const protectedAffix=JSON.stringify(it.affixes[4]);g.char.gold=1000000;g.char.glassTears=100;
  t.withSeededRandom(seed,()=>mode==='reroll'?t.rerollItem(2):t.reforgeKeepBest(2));good=good&&it.affixes.length===5&&new Set(it.affixes.map(a=>a.key)).size===5&&(mode==='reroll'||JSON.stringify(it.affixes[0])===protectedAffix)&&g.char.glassTears===(mode==='reroll'?99:98)&&g.char.gold===(1000000-(260+25*8)*(mode==='reroll'?1:2));}
  rows.push({name:`200 paid ${mode} seeds including49 retain affix count/identity/cost`,pass:good});}
 for(const mode of ['reroll','keep']){let good=true;it.primal=true;for(let seed=1;seed<=100;seed++){it.affixes=t.AFFIXES.slice(0,5).map(a=>({key:a.key,label:a.label,val:Math.ceil(Math.min(a.max,26)*1.4)}));g.char.gold=1000000;g.char.glassTears=100;t.withSeededRandom(seed,()=>mode==='reroll'?t.rerollItem(2):t.reforgeKeepBest(2));good=good&&it.primal&&it.affixes.length===5&&it.affixes.every(a=>a.val===Math.ceil(Math.min(t.AFFIXES.find(x=>x.key===a.key).max,26)*1.4));}rows.push({name:`100 Primal ${mode} seeds preserve perfected values`,pass:!!good});}
 return rows;});for(const r of rows)h.check(r.name,r.pass);h.report.samples={generated:2000,paidRerolls:200,paidKeepBest:200,primalRerolls:100,primalKeepBest:100};h.check('no runtime errors',h.report.errors,[]);h.check('no external/cloud calls',h.report.external,[]);
}catch(e){h.report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await h.finish();}})().catch(e=>{console.error(e);process.exit(1)});
