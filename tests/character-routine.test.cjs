const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../web/character-routine.js');
const books=Array.from({length:12},(_,i)=>({id:String(i),title:`Real book ${i}`,cover:`https://images.e-vrit.co.il/Images/Products/${i}.jpg`,url:`https://www.e-vrit.co.il/Product/${i}`}));
function advance(r,seconds,extra={}){for(let i=0;i<seconds*10;i++)r.tick(.1,{books,wander:false,...extra});return r.snapshot();}
test('picks a reachable real book, reads it, returns it, and visits the office',()=>{
  const r=create();assert.equal(r.read(books),true);
  assert.equal(r.snapshot().book.url,books[8].url);
  const phases=new Set();let held=false,read=false,returned=false;
  for(let i=0;i<900;i++){
    const s=r.tick(.1,{books,wander:false});phases.add(s.phase);
    if(s.held)held=true;
    if(s.phase==='reading'){read=true;assert.equal(s.book.title,books[8].title);assert(s.held);}
    if(read&&!s.held)returned=true;
  }
  assert(held&&read&&returned);assert(phases.has('return-book'));
  assert.equal(r.snapshot().room,'office');assert.equal(r.snapshot().book,null);
});
test('pause freezes position, book ownership, and reading time',()=>{
  const r=create();r.read(books);advance(r,20);
  assert.equal(r.snapshot().phase,'reading');const before=r.snapshot();
  advance(r,100,{suspended:true});assert.deepEqual(r.snapshot(),before);
  advance(r,4);assert.equal(r.snapshot().phase,'reading');
});
test('manual navigation returns a held book before walking away',()=>{
  const r=create();r.read(books);advance(r,20);r.visit('home');
  assert.equal(r.snapshot().phase,'stand-up');assert(r.snapshot().held);
  advance(r,30);assert.equal(r.snapshot().room,'home');assert.equal(r.snapshot().held,false);
});
test('reduce motion is static, explicit reading works, empty shelves do not invent books',()=>{
  const r=create();assert.equal(r.read([]),false);advance(r,20,{wander:true,reducedMotion:true});
  assert.equal(r.snapshot().phase,'idle');assert(r.read(books,true));
  const still=r.snapshot();assert.equal(still.pose,'read');
  advance(r,100,{reducedMotion:true});assert.deepEqual(r.snapshot(),still);
  r.visit('office',true);assert.equal(r.snapshot().held,false);
});
test('keeps the selected book stable across daily catalogue replacement',()=>{
  const r=create();r.read(books);advance(r,20,{books:[{...books[8],title:'New daily book'}]});
  assert.equal(r.snapshot().book.title,books[8].title);
});
test('manual and automatic office visits keep the puppet clear of the monitor overlays',()=>{
  const layout=require('../web/scene-layout.js');
  // Right screen ends at42.15% of the plate. The head occupies the central40% of its atlas.
  const screenRight=layout.W*.4215,headLeft=s=>layout.actor(s).x+layout.actor(s).size*.3;
  const manual=create();manual.visit('office');
  for(let i=0;i<150;i++){const s=manual.tick(.1,{books,wander:false});assert(headLeft(s)>screenRight+20);}
  const automatic=create();automatic.read(books);
  for(let i=0;i<1000;i++){const s=automatic.tick(.1,{books,wander:false});assert(headLeft(s)>screenRight+20);}
  const still=create();still.visit('office',true);assert(headLeft(still.snapshot())>screenRight+20);
});
