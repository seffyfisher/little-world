const {test}=require('node:test');const assert=require('node:assert/strict');
const {create}=require('../web/world-runtime.js');
function fixture(){let time=0,id=0;const timers=new Map();const runtime=create({now:()=>time,schedule:(fn,ms)=>{timers.set(++id,{fn,due:time+ms});return id;},cancel:id=>timers.delete(id)});function advance(ms){const target=time+ms;for(let i=0;i<10000;i++){const next=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];if(!next||next[1].due>target)break;time=next[1].due;timers.delete(next[0]);next[1].fn();}time=target;}return {runtime,advance,timers};}
test('covered desktop has zero animation callbacks, fetch callbacks, and pending timers',()=>{
 const {runtime:r,advance,timers}=fixture();let motion=0,fetches=0;
 r.set('motion',()=>{motion++;return 83;});r.set('fetch',()=>{fetches++;return 300000;});r.setActive(true);advance(200);
 const before={motion,fetches};r.setActive(false);advance(3600000);
 assert.deepEqual({motion,fetches},before);assert.equal(timers.size,0);
 r.setActive(true);advance(0);assert.equal(fetches,before.fetches+1);
});
test('briefly covering the desktop does not trigger another fetch on resume',()=>{
 const {runtime:r,advance}=fixture();let fetched=0;r.set('feed',()=>{fetched++;return 300000;});r.setActive(true);advance(0);
 r.setActive(false);advance(5000);r.setActive(true);advance(0);assert.equal(fetched,1);advance(295000);assert.equal(fetched,2);
});
test('static reading wakes at its frame deadline rather than display refresh rate',()=>{
 const {runtime:r,advance}=fixture();let frames=0;r.set('read',()=>{frames++;return 1500;});r.setActive(true);advance(10000);assert.equal(frames,7);
});
