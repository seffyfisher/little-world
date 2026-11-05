const {test}=require('node:test');const assert=require('node:assert/strict');
const {create}=require('../web/character-routine.js');const {moods}=require('../web/emotions.js');
const books=Array.from({length:12},(_,i)=>({id:String(i),title:`Book ${i}`,cover:`https://images.e-vrit.co.il/${i}.jpg`,url:`https://www.e-vrit.co.il/product/${i}`}));
const step=(r,n,options={})=>{for(let i=0;i<n*10;i++)r.tick(.1,{books,wander:false,...options});return r.snapshot();};
test('every requested mood has a real sequence, completes, and keeps book ownership valid',()=>{
 for(const mood of Object.keys(moods)){
  const r=create({random:()=>.5});assert(r.express(mood));const seen=new Set();
  for(let i=0;i<400;i++){const s=r.tick(.1,{books,wander:false});if(s.emotion)seen.add(s.emotionFrame);assert.equal(s.held,false);}
  assert(seen.size>=2,mood);assert.equal(r.snapshot().emotion,null,mood);
 }
});
test('an emotion waits for the held book to be returned, including a smooth stand-up',()=>{
 const r=create();r.read(books);step(r,20);assert.equal(r.snapshot().phase,'reading');
 r.express('happy');assert.equal(r.snapshot().phase,'stand-up');let returned=false,happy=false;
 for(let i=0;i<300;i++){const s=r.tick(.1,{books,wander:false});if(s.phase==='shelf-release')returned=true;if(s.emotion==='happy'){happy=true;assert(returned);assert.equal(s.book,null);}}
 assert(happy);
});
test('floor exhaustion recovers through getting-up frames before a manual room visit',()=>{
 const r=create();r.express('floor');step(r,7);assert.equal(r.snapshot().emotion,'floor');r.visit('office');
 assert.equal(r.snapshot().phase,'emotion-recover');step(r,15);assert.equal(r.snapshot().room,'office');assert.equal(r.snapshot().emotion,null);
});
test('pause/occlusion freeze mood time and reduced motion allows static explicit poses',()=>{
 const r=create();r.express('crying');step(r,2);const before=r.snapshot();step(r,100,{suspended:true});assert.deepEqual(r.snapshot(),before);
 const still=create();still.express('floor',true);const a=still.snapshot();assert.equal(a.emotionFrame,6);step(still,100,{reducedMotion:true});assert.deepEqual(still.snapshot(),a);
});
test('automatic moments vary, do not repeat immediately, and coexist with real reading',()=>{
 const r=create({random:()=>.25}),seen=[],phases=new Set();let prior=null;
 for(let i=0;i<20000;i++){const s=r.tick(.1,{books,wander:true});phases.add(s.phase);if(s.emotion&&s.emotion!==prior){seen.push(s.emotion);prior=s.emotion;}if(!s.emotion)prior=null;}
 assert(seen.length>=7);assert.equal(new Set(seen).size,7);assert(phases.has('reading'));
 for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);
});
test('disabling wandering prevents unsolicited emotions',()=>{
 const r=create();step(r,1000);assert.equal(r.snapshot().phase,'idle');assert.equal(r.snapshot().emotion,null);
});
