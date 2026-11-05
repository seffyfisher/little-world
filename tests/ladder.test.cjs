const {test}=require('node:test');const assert=require('node:assert/strict');
const layout=require('../web/scene-layout.js'),{create}=require('../web/character-routine.js');
const books=Array.from({length:12},(_,i)=>({id:String(i),cover:`https://example.com/${i}.jpg`,url:`https://example.com/${i}`}));
test('ladder floor and landing align with the physical soles and book contact position',()=>{
 for(const index of [0,3,4,7]){
  const l=layout.ladder(index),landing=layout.shelfStand(index),footOffset=(.975-.945)*layout.actor({x:0,y:75}).size;
  assert(Math.abs(l.top+l.height-(layout.H*.75+footOffset))<.001);
  assert(Math.abs(l.landing.x-landing.x)<.001);assert(Math.abs(l.landing.y-landing.y)<.001);
  const start=layout.climbMotion(index,0),end=layout.climbMotion(index,1),reverse=layout.climbMotion(index,1,true);
  assert.equal(start.y,l.base.y);assert.equal(end.y,l.landing.y);assert.equal(reverse.y,l.base.y);
 }
});
test('high books are reached from ground using dedicated climbs in both directions',()=>{
 const r=create();r.selectBook(books,0);const phases=[];let previous='',up=0,down=0;
 for(let i=0;i<1500;i++){
  const s=r.tick(.05,{books,wander:false});
  if(s.phase!==previous){phases.push(s.phase);previous=s.phase;}
  if(s.phase==='climb-up')up++;if(s.phase==='climb-down')down++;
  if(['walk-to-ladder','walk-to-chair','visit'].includes(s.phase))assert.equal(s.y,75);
  if(s.pose==='climb'){assert(s.climbFrame>=0&&s.climbFrame<=7);assert.equal(s.direction,1);}
 }
 assert(up&&down);assert.equal(phases.filter(p=>p==='climb-up').length,2);assert.equal(phases.filter(p=>p==='climb-down').length,2);
 assert.equal(r.snapshot().held,false);assert.equal(r.snapshot().room,'office');
});
test('pausing mid-climb freezes the pose and position; navigation descends safely first',()=>{
 const r=create();r.selectBook(books,0);let s;
 for(let i=0;i<200;i++){s=r.tick(.05,{books,wander:false});if(s.phase==='climb-up')break;}
 const before=r.snapshot();r.tick(600,{books,suspended:true});assert.deepEqual(r.snapshot(),before);
 r.walkTo(75,78);let descended=false;
 for(let i=0;i<1000;i++){s=r.tick(.05,{books,wander:false});if(s.phase==='climb-down')descended=true;}
 assert(descended);assert.equal(s.x,75);assert.equal(s.y,78);assert.equal(s.held,false);
});
test('ladder disappears after descent, stays away during reading, and returns for the book return',()=>{
 const r=create();r.selectBook(books,0);let descents=0,wasDescending=false,reading=false,returnApproach=false;
 for(let i=0;i<1600;i++){
  const s=r.tick(.05,{books,wander:false});
  if(s.phase==='climb-down'){assert(s.ladderVisible);wasDescending=true;}
  else if(wasDescending){descents++;wasDescending=false;assert.equal(s.ladderVisible,false);}
  if(['walk-to-chair','sit-down','reading','stand-up','visit','idle'].includes(s.phase))assert.equal(s.ladderVisible,false);
  if(s.phase==='reading')reading=true;
  if(reading&&s.phase==='walk-to-ladder'){returnApproach=true;assert(s.ladderVisible);}
 }
 assert(reading&&returnApproach);assert.equal(descents,2);
 const reduced=create();reduced.selectBook(books,0,true);assert.equal(reduced.snapshot().ladderVisible,false);
});
