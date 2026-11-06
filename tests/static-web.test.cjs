const {test}=require('node:test');const assert=require('node:assert/strict');
const {create}=require('../web/static-data.js');
const {observeBattery}=require('../web/browser-platform.js');
const energy=require('../web/energy.js');
const source={id:'news',url:'https://example.com/rss',kind:'feed',room:'office'};
const snapshot={schemaVersion:1,generatedAt:'2026-11-05T00:00:00Z',sources:[source],feeds:{news:{items:[{title:'A real published item'}],updatedAt:'2026-11-05T00:00:00Z'}},weather:{'tel-aviv':{current:{temperature_2m:20}}}};
test('static data shares one JSON fetch, caches it, and force refresh reads new publication',async()=>{
 let calls=0,now=Date.parse(snapshot.generatedAt);const c=create({load:async()=>{calls++;return structuredClone(snapshot);},now:()=>now});
 await Promise.all([c.refresh(),c.refresh(),c.refresh()]);assert.equal(calls,1);
 await c.refresh();assert.equal(calls,1);
 assert.equal(c.feed({...source,id:'a-local-id'}).items[0].title,'A real published item');
 assert.equal(c.weather('tel-aviv').current.temperature_2m,20);
 await c.refresh(true);assert.equal(calls,2);now+=300001;await c.refresh();assert.equal(calls,3);
});
test('unpublished connections cannot borrow a different URL snapshot; old content is labeled stale',async()=>{
 const c=create({load:async()=>snapshot,now:()=>Date.parse(snapshot.generatedAt)+86400001});await c.refresh();
 assert.throws(()=>c.feed({...source,url:'https://other.example/rss'}),/בנתונים שפורסמו/);
 assert.equal(c.feed(source).stale,true);assert.throws(()=>c.weather('missing'),/נתוני מזג אוויר/);
});
test('a failed JSON refresh preserves the last usable publication and can retry',async()=>{
 let fail=false;const c=create({load:async()=>{if(fail)throw new Error('offline');return snapshot;}});
 await c.refresh();fail=true;await assert.rejects(c.refresh(true));assert.equal(c.feed(source).items.length,1);
 fail=false;await c.refresh(true);assert.equal(c.sources.length,1);
});
test('browser battery follows change events and disposes listeners without polling',async()=>{
 const battery=new EventTarget();battery.level=.15;battery.charging=false;const samples=[];
 const dispose=await observeBattery({getBattery:async()=>battery},value=>samples.push(value));
 assert.equal(energy.state(samples.at(-1)).stage,2);
 battery.charging=true;battery.dispatchEvent(new Event('chargingchange'));assert.equal(energy.state(samples.at(-1)).stage,0);
 dispose();battery.dispatchEvent(new Event('levelchange'));assert.equal(samples.length,2);
});
test('unsupported or denied browser battery never pretends to measure a desktop battery',async()=>{
 for(const navigator of [{},{getBattery:async()=>{throw new Error('denied');}}]){
  let sample;await observeBattery(navigator,value=>sample=value);
  assert.match(energy.state(sample).label,/לא זמינים/);assert.equal(energy.state(sample).stage,0);
  assert.equal(energy.state(sample,'5').stage,3);assert.equal(energy.state(sample,'5').demo,true);
 }
});
