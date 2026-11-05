const {test}=require('node:test');const assert=require('node:assert/strict');
const {clock,createChair}=require('../web/room-props.js');
const {create}=require('../web/world-runtime.js');
test('automatic room lighting follows macOS dark appearance; manual lighting stays explicit',()=>{
 const {lightMode}=require('../web/room-props.js');
 assert.equal(lightMode('auto',true),'night');assert.equal(lightMode('auto',false),'day');
 for(const selected of ['day','dusk','night']){assert.equal(lightMode(selected,true),selected);assert.equal(lightMode(selected,false),selected);}
});
function fixture(){
 let time=0,id=0;const timers=new Map(),frames=[];
 const runtime=create({now:()=>time,schedule:(fn,ms)=>{timers.set(++id,{fn,due:time+ms});return id;},cancel:id=>timers.delete(id)});
 const chair=createChair({runtime,emit:frame=>frames.push(frame),now:()=>time,random:()=>0});
 function advance(ms){const end=time+ms;for(let i=0;i<10000;i++){const next=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];if(!next||next[1].due>end)break;time=next[1].due;timers.delete(next[0]);next[1].fn();}time=end;}
 function activity(values={}){const state={active:true,paused:false,lowPower:false,reducedMotion:false,...values};runtime.setActive(state.active);chair.setActivity(state);}
 return {frames,timers,advance,activity};
}
test('wall clock uses local 24-hour time and targets the next minute boundary',()=>{
 const date=new Date(2026,10,5,23,59,58,725),before=clock(date);assert.equal(before.text,'23:59');assert.equal(before.delay,1275);
 const after=clock(new Date(date.getTime()+before.delay));assert.equal(after.text,'00:00');assert.equal(after.delay,60000);
 assert.equal(after.datetime,new Date(date.getTime()+before.delay).toISOString());
});
test('chair makes one complete turn and rests instead of continuously playing',()=>{
 const f=fixture();f.activity();f.advance(14999);assert.equal(f.frames.length,0);f.advance(5000);
 assert.deepEqual(f.frames,[1,2,3,4,5,6,7,0]);assert.equal(f.timers.size,1);
 f.advance(60000);assert.equal(f.frames.length,8);
});
test('occlusion, pause, reduced motion and low power freeze the chair and its visible-time countdown',()=>{
 for(const stop of [{active:false},{paused:true},{reducedMotion:true},{lowPower:true}]){
  const f=fixture();f.activity();f.advance(10000);f.activity(stop);f.advance(3600000);
  assert.equal(f.frames.length,0);assert.equal(f.timers.size,0);f.activity();f.advance(4999);assert.equal(f.frames.length,0);f.advance(1);assert.deepEqual(f.frames,[1]);
  f.activity(stop);const frame=f.frames.at(-1);f.advance(60000);assert.equal(f.frames.at(-1),frame);
 }
});
