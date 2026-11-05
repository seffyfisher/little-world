const {test}=require('node:test');const assert=require('node:assert/strict');
const layout=require('../web/scene-layout.js');
const {create}=require('../web/character-routine.js');
const books=Array.from({length:12},(_,i)=>({url:`https://www.e-vrit.co.il/product/${i}`,cover:`https://images.e-vrit.co.il/${i}.jpg`,title:`Book ${i}`}));
test('book has a transfer stage after shelf contact instead of teleporting to walking hands',()=>{
 const r=create();r.read(books);let previous=r.snapshot();
 for(let i=0;i<300;i++){const s=r.tick(.05,{books,wander:false});if(!previous.held&&s.held){assert.equal(s.phase,'take-book');return;}previous=s;}
 assert.fail('never picked up a book');
});
test('carried cover keeps the shelf book physical height',()=>{
 const r=create();r.read(books);let held=0;
 for(let i=0;i<1600;i++){
  const s=r.tick(.05,{books,wander:false});if(!s.held)continue;held++;
  const b=layout.book(s),shelf=layout.shelf(s.bookIndex);
  assert.equal(b.height,shelf.height);assert.equal(b.width,shelf.width);
 }
 assert(held>100);
});
test('contact frame exactly matches the selected shelf slot at pickup and return',()=>{
 for(let col=0;col<4;col++){
  const index=8+col,s={...layout.shelfStand(index),direction:1,phase:'take-book',pose:'transfer',transferFrame:0,bookIndex:index,book:books[index]};
  const b=layout.book(s),slot=layout.shelf(index);assert(Math.abs(b.x-slot.x)<.01);assert(Math.abs(b.y-slot.y)<.01);
 }
});
test('return plays the transfer frames backwards before restoring the shelf book',()=>{
 const r=create();r.read(books);const frames=[];let lastHeld;
 for(let i=0;i<1800;i++){
  const s=r.tick(.05,{books,wander:false});
  if(s.phase==='return-book'){assert(s.held);if(frames.at(-1)!==s.transferFrame)frames.push(s.transferFrame);lastHeld=s;}
  if(s.phase==='shelf-release'){assert.equal(s.held,false);assert.equal(lastHeld.transferFrame,0);break;}
 }
 assert.deepEqual(frames,[3,2,1,0]);
});
