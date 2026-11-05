const {test}=require('node:test');const assert=require('node:assert/strict');
const energy=require('../web/energy.js'),layout=require('../web/scene-layout.js');
const {create}=require('../web/character-routine.js');
const books=Array.from({length:12},(_,i)=>({id:String(i),title:`Book ${i}`,cover:`https://example.com/${i}.jpg`,url:`https://example.com/${i}`}));
test('plants progressively lose foliage on battery and recover on external power',()=>{
 for(const [level,stage] of [[100,0],[36,0],[35,1],[20,2],[10,3],[0,3]])assert.equal(energy.state({level,charging:false,hasBattery:true}).stage,stage);
 assert.equal(energy.state({level:5,charging:true,hasBattery:true},'actual',3).stage,0);
 assert.equal(energy.state({level:null,charging:true,hasBattery:false}).stage,0);
 assert.equal(energy.state({level:21,charging:false},'actual',2).stage,2);
 assert.equal(energy.state({level:23,charging:false},'actual',2).stage,1);
});
test('battery previews are explicit and cannot change the real power sample',()=>{
 const power={level:88,charging:true,hasBattery:true},before={...power};
 assert.equal(energy.state(power,'5').stage,3);assert.equal(energy.state(power,'5').demo,true);
 assert.equal(energy.state(power,'charging').stage,0);assert.equal(energy.state(power,'actual').level,88);
 assert.deepEqual(power,before);
});
test('photo state accepts bounded embedded raster data only',()=>{
 const good='data:image/jpeg;base64,YWJj';assert.equal(energy.photo(good),good);
 for(const value of ['https://example.com/p.jpg','javascript:alert(1)','data:image/svg+xml;base64,YWJj','data:image/jpeg;base64,<x>',good+'A'.repeat(2500000),null])assert.equal(energy.photo(value),'');
});
test('any exact selected shelf book can be read, including high shelves',()=>{
 for(const index of [0,5,11]){
  const r=create();assert(r.selectBook(books,index));let read=false;
  for(let i=0;i<1000;i++){const s=r.tick(.1,{books,wander:false});if(s.phase==='reading'){assert.equal(s.book.id,String(index));assert.equal(s.bookIndex,index);read=true;break;}}
  assert(read,`Book ${index} was not read`);
 }
});
test('choosing another book returns the held book before taking the next one',()=>{
 const r=create();r.read(books);for(let i=0;i<200;i++)r.tick(.1,{books,wander:false});assert.equal(r.snapshot().phase,'reading');
 assert(r.selectBook(books,2));assert.equal(r.snapshot().book.id,'8');let returned=false,selected=false;
 for(let i=0;i<1000;i++){const s=r.tick(.1,{books,wander:false});if(s.phase==='shelf-release')returned=true;if(s.book?.id==='2'){assert(returned);selected=true;break;}}
 assert(selected);
});
test('floor clicks stay on walkable ground and clear of the computer screens',()=>{
 for(const [x,y] of [[0,0],[100,100],[NaN,Infinity],[51,77]]){
  const p=layout.walkPoint(x,y);assert(p.x>=48.5&&p.x<=77&&p.y>=74&&p.y<=79);
  const r=create();r.walkTo(x,y);for(let i=0;i<200;i++)r.tick(.1,{books,wander:false});
  assert(Math.abs(r.snapshot().x-p.x)<.01);assert(Math.abs(r.snapshot().y-p.y)<.01);
 }
});
test('a clicked walking destination is retained while a book is safely returned',()=>{
 const r=create();r.read(books);for(let i=0;i<200;i++)r.tick(.1,{books,wander:false});r.walkTo(75,78);
 for(let i=0;i<600;i++)r.tick(.1,{books,wander:false});
 assert.equal(r.snapshot().held,false);assert.equal(r.snapshot().x,75);assert.equal(r.snapshot().y,78);
});
