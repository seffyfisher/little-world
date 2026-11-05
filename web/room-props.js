/* Live room props share the visibility-aware deadline scheduler. No render loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldRoomProps=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function clock(date=new Date()){
    return {text:`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`,
      datetime:date.toISOString(),delay:60000-(date.getSeconds()*1000+date.getMilliseconds())};
  }
  function createChair({runtime,emit,now=()=>performance.now(),random=Math.random}){
    // Stop-motion acceleration, one revolution, then settle into the original orientation.
    const frames=[0,1,2,3,4,5,6,7,0],holds=[350,240,180,180,180,180,240,350];
    let enabled=false,index=0,remaining=15000,due=0;
    function arm(){due=now()+remaining;runtime.set('chair-turn',step,remaining);}
    function step(){
      if(!enabled)return;
      if(index===frames.length-1){index=0;remaining=75000+random()*45000;}
      else {index++;emit(frames[index]);remaining=holds[index-1];}
      arm();
    }
    return {setActivity({active,paused,lowPower,reducedMotion}){
      const next=active&&!paused&&!lowPower&&!reducedMotion;
      if(next===enabled)return;
      if(enabled){remaining=Math.max(0,due-now());runtime.remove('chair-turn');}
      enabled=next;if(enabled)arm();
    }};
  }
  function lightMode(selection,systemDark){return ['day','dusk','night'].includes(selection)?selection:systemDark?'night':'day';}
  return {clock,createChair,lightMode};
});
