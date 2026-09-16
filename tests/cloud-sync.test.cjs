const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../cloud.js'),'utf8');
function harness(){
  let now=1_000_000,seq=0;const timers=new Map(),requests=[];
  const context={window:{HOLLOWLIGHT_CONFIG:{cloudUrl:'https://invalid.example'}},location:{search:'',origin:'http://localhost',pathname:'/'},localStorage:{getItem:()=> 'fixture-only',setItem:()=>{}},URLSearchParams,TextEncoder,AbortController,Promise,Date:{now:()=>now},Math,JSON,
    setTimeout:(fn,ms)=>{timers.set(++seq,{fn,at:now+ms});return seq;},clearTimeout:id=>timers.delete(id),fetch:(url,opts)=>new Promise((resolve,reject)=>requests.push({url,opts,resolve,reject}))};
  vm.runInNewContext(source,context);
  const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
  return{api:context.window.__CLOUD,requests,settle,async tick(ms){const end=now+ms;for(;;){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}now=end;await settle();},async resolve(i,ok=true,json){requests[i].resolve({ok,json:()=>json?json():Promise.resolve({data:{v:2}})});await settle();}};
}
const passed=[];async function test(name,fn){await fn();passed.push(name);}
(async()=>{
  await test('Serializes flushes and coalesces the latest snapshot',async()=>{const h=harness();h.api.push({t:1,gold:1},true);h.api.push({t:2,gold:2},true);h.api.push({t:3,gold:3},true);assert.equal(h.requests.length,1);await h.resolve(0);assert.equal(h.requests.length,2);assert.equal(JSON.parse(h.requests[1].opts.body).gold,3);await h.resolve(1);h.api.push({t:4,gold:3},true);assert.equal(h.requests.length,2);});
  await test('Snapshots are immutable after submission',async()=>{const h=harness(),save={t:1,char:{gold:10}};h.api.push(save);save.char.gold=99;await h.tick(2500);assert.equal(JSON.parse(h.requests[0].opts.body).char.gold,10);});
  await test('Failed writes retry after backoff without another player action',async()=>{const h=harness();h.api.push({t:1,gold:1},true);await h.resolve(0,false);await h.tick(59999);assert.equal(h.requests.length,1);await h.tick(1);assert.equal(h.requests.length,2);});
  await test('A newer pending save replaces failed state',async()=>{const h=harness();h.api.push({t:1,gold:1},true);h.api.push({t:2,gold:2},true);await h.resolve(0,false);await h.tick(60000);assert.equal(JSON.parse(h.requests[1].opts.body).gold,2);});
  await test('Five-minute throttle remains active for ordinary saves',async()=>{const h=harness();h.api.push({t:1,gold:1},true);await h.resolve(0);h.api.push({t:2,gold:2});await h.tick(299999);assert.equal(h.requests.length,1);await h.tick(1);assert.equal(h.requests.length,2);});
  await test('Only the root timestamp is ignored for deduplication',async()=>{const h=harness();h.api.markSynced({t:1,event:{t:10}});h.api.push({t:2,event:{t:11}},true);assert.equal(h.requests.length,1);});
  await test('Returning to synced state cancels an older queued change',async()=>{const h=harness();h.api.markSynced({t:1,gold:1});h.api.push({t:2,gold:2});h.api.push({t:3,gold:1},true);await h.tick(300000);assert.equal(h.requests.length,0);});
  await test('Returning to prior state while a write is running is preserved',async()=>{const h=harness();h.api.markSynced({t:1,gold:1});h.api.push({t:2,gold:2},true);h.api.push({t:3,gold:1},true);await h.resolve(0);assert.equal(h.requests.length,2);assert.equal(JSON.parse(h.requests[1].opts.body).gold,1);});
  await test('Keepalive uses UTF-8 bytes, including non-ASCII save text',async()=>{const h=harness();h.api.push({t:1,name:'界'.repeat(21000)},true);assert.equal(h.requests[0].opts.keepalive,undefined);});
  await test('Pull timeout includes a stalled response body',async()=>{const h=harness();const result=h.api.pull();await h.resolve(0,true,()=>new Promise(()=>{}));await h.tick(4500);assert.equal(await result,null);});
  await test('Intentional save replacement cancels queued writes and failed retries',async()=>{const h=harness();h.api.push({t:1,gold:1},true);h.api.push({t:2,gold:2});h.api.cancelPending();await h.resolve(0,false);await h.tick(300000);assert.equal(h.requests.length,1);});
  console.log(JSON.stringify({passed:passed.length,tests:passed,externalRequests:0},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
