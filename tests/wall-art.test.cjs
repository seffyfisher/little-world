const {test}=require('node:test');const assert=require('node:assert/strict');
const Art=require('../web/wall-art.js'),{createStore,DEFAULT}=require('../web/world-settings.js');
const {create:runtimeFactory}=require('../web/world-runtime.js');
const photo='data:image/jpeg;base64,YWJj';
const item=id=>({id,accession:'1900.123',isPublicDomain:true,width:1364,height:1000,title:`Work ${id}`,artist:'Artist',date:'1900'});
function fixture({state={},loadPhoto=async()=>photo,loadCatalog=async()=>({items:[item(1),item(2),item(3)]})}={}){
 let time=new Date(2026,10,6,8).getTime(),id=0,saved=Art.validate({mode:'daily',...state}),calls=0;const timers=new Map();
 const runtime=runtimeFactory({now:()=>time,schedule:(fn,ms)=>{timers.set(++id,{fn,due:time+ms});return id;},cancel:id=>timers.delete(id)});
 const art=Art.create({runtime,getState:()=>saved,saveState:value=>saved=value,loadCatalog,loadPhoto:async x=>{calls++;return loadPhoto(x);},now:()=>new Date(time),random:()=>0});
 return {art,runtime,timers,get state(){return saved;},get calls(){return calls;},setState:value=>{saved=Art.validate(value);art.sync();},activity:value=>{runtime.setActive(value);art.setActive(value);},advance(ms){time+=ms;for(const [id,job]of [...timers])if(job.due<=time){timers.delete(id);job.fn();}}};
}
test('morning changes at 07:00 local time, including the year boundary',()=>{
 assert.equal(Art.morning(new Date(2026,0,1,6,59)).day,'2025-12-31');
 assert.equal(Art.morning(new Date(2026,0,1,7)).day,'2026-01-01');
 assert.equal(Art.morning(new Date(2026,0,1,6,59)).delay,60000);
 assert.equal(Art.morning(new Date(2026,0,1,7)).delay,86400000);
});
test('only public-domain raster records near the actual frame ratio are accepted',()=>{
 assert(Art.record(item(1)));assert(Art.fits(1333,1000));
 for(const invalid of [{isPublicDomain:false},{width:1000,height:1500},{width:1600,height:900},{width:136,height:100},{accession:'https://untrusted.example/image'},{id:-1}])assert.equal(Art.record({...item(1),...invalid}),null);
 assert.equal(Art.validate({artwork:item(1),photo:'https://example.com/image.jpg'}).photo,'');
});
test('daily art persists independently from the original personal photo',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(k,v)=>map.set(k,v)};
 const config={...DEFAULT,framePhoto:photo,wallArt:{mode:'daily',artwork:item(1),photo,day:'2026-11-06',history:[1]}};
 assert(createStore({getStorage:()=>storage}).write(config));const saved=createStore({getStorage:()=>storage}).read();
 assert.equal(saved.framePhoto,photo);assert.equal(saved.wallArt.photo,photo);assert.equal(saved.wallArt.artwork.id,1);
});
test('visible daily art selects a new real record and rests until the next morning',async()=>{
 const f=fixture();f.activity(true);await f.art.refresh();assert.equal(f.calls,1);assert.equal(f.state.artwork.id,1);assert.equal(f.state.day,'2026-11-06');
 await f.art.refresh();assert.equal(f.calls,1);assert.equal(f.timers.size,1);
 await f.art.refresh(true);assert.equal(f.state.artwork.id,2);assert.equal(f.calls,2);
});
test('recent works are avoided; an exhausted history still excludes the current artwork',async()=>{
 const f=fixture({state:{photo,artwork:item(1),day:'2026-11-05',history:[1,2]}});f.activity(true);await f.art.refresh();assert.equal(f.state.artwork.id,3);
 const g=fixture({state:{photo,artwork:item(1),day:'2026-11-05',history:[1,2,3]}});g.activity(true);await g.art.refresh();assert.equal(g.state.artwork.id,2);
});
test('an unavailable image tries another candidate; failure keeps the last art and retries hourly',async()=>{
 const f=fixture({loadPhoto:async art=>{if(art.id===1)throw new Error('offline');return photo;}});f.activity(true);await f.art.refresh();assert.equal(f.state.artwork.id,2);
 const g=fixture({state:{photo,artwork:item(1),day:'2026-11-05'},loadPhoto:async()=>{throw new Error('offline');}});g.activity(true);await g.art.refresh();assert.equal(g.state.artwork.id,1);assert.equal(g.state.day,'2026-11-05');assert.equal(g.art.status,'error');const calls=g.calls;g.advance(3599999);assert.equal(g.calls,calls);
});
test('hidden desktop has no timer or fetch; overdue art refreshes on return',async()=>{
 const f=fixture();f.activity(false);f.advance(86400000);assert.equal(f.calls,0);assert.equal(f.timers.size,0);
 f.activity(true);await f.art.refresh();assert.equal(f.calls,1);assert.equal(f.state.day,'2026-11-07');f.activity(false);assert.equal(f.timers.size,0);
});
test('a late image cannot overwrite a personal photo or art received from another window',async()=>{
 for(const next of [{mode:'photo'},{mode:'daily',photo:'data:image/jpeg;base64,ZGVm',artwork:item(2)}]){
  let resolve;const pending=new Promise(r=>resolve=r);const f=fixture({loadPhoto:()=>pending});f.activity(true);const work=f.art.refresh();await Promise.resolve();f.setState(next);resolve(photo);await work;assert.equal(f.state.mode,next.mode);assert.equal(f.state.photo,next.photo||'');
 }
});
test('occlusion discards an in-flight selection and duplicate requests share the busy guard',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const f=fixture({loadPhoto:()=>pending});f.activity(true);const work=f.art.refresh();await Promise.resolve();await f.art.refresh(true);assert.equal(f.calls,1);f.activity(false);resolve(photo);await work;assert.equal(f.state.photo,'');assert.equal(f.timers.size,0);
});
test('bundled catalog contains only eligible public-domain images and unique IDs',()=>{
 const catalog=require('../web/data/art-catalog.json');assert(catalog.items.length>=10);assert.equal(new Set(catalog.items.map(x=>x.id)).size,catalog.items.length);for(const x of catalog.items)assert(Art.record(x));
});
