/* A small portrait-only reading loop. The hidden full world stays suspended. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldPortrait=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const frames=[[3,2200],[4,350],[3,2000],[5,450],[3,1800],[6,450]];
  function create({runtime,emit}){
    let enabled=false,index=0;emit(frames[0][0]);
    function step(){if(!enabled)return;index=(index+1)%frames.length;emit(frames[index][0]);return frames[index][1];}
    return {setActivity({visible,portrait,paused,reducedMotion,lowPower,editing}){
      const next=!!visible&&!!portrait&&!paused&&!reducedMotion&&!lowPower&&!editing;
      if(next===enabled)return;enabled=next;runtime.setActive(next);
      if(next)runtime.set('portrait-reading',step,frames[index][1]);
      else runtime.remove('portrait-reading');
    },get active(){return enabled;},dispose(){enabled=false;runtime.setActive(false);runtime.remove('portrait-reading');}};
  }
  return {create};
});
