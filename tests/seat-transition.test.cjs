const {test}=require('node:test');const assert=require('node:assert/strict');
const layout=require('../web/scene-layout.js');
test('sitting keeps the same physical puppet scale',()=>{
 const base={x:59.5,y:75,phase:'idle',pose:'hold',progress:0};
 const standing=layout.actor(base).size;
 for(const progress of [0,.25,.5,.75,1]){
  const seated=layout.actor({...base,phase:'sit-down',progress}).size;
  assert(Math.abs(seated-standing)<.01,`puppet shrank from ${standing.toFixed(1)} to ${seated.toFixed(1)}`);
 }
});
test('seat position joins the reading and standing endpoints without a jump',()=>{
 const base={x:59.5,y:75,phase:'sit-down',pose:'seat',progress:1};
 const end=layout.actor(base),read=layout.actor({...base,phase:'reading',pose:'read',y:layout.armchair.seatedFeet});
 assert(Math.abs(end.x-read.x)<.01);assert(Math.abs(end.y-read.y)<.01);
 const up=layout.actor({...base,phase:'stand-up',y:layout.armchair.seatedFeet,progress:1});
 const stood=layout.actor({...base,phase:'visit',pose:'carry',progress:0});
 assert(Math.abs(up.y-stood.y)<.01);
});
