/* Short, occasional stories. Durations are visible time, not wall-clock time in the background. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldEmotions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const moods={
    angry:{label:'Angry',activity:'is having a spectacular little tantrum',frames:[[0,1.3],[1,.7],[0,1],[1,.7],[0,1.8]]},
    tired:{label:'Sleepy',activity:'could really use a nap',frames:[[2,1.5],[3,2],[2,1.5],[3,2.5]]},
    floor:{label:'Completely worn out',activity:'has officially run out of energy and is resting on the floor',frames:[[2,1],[3,.8],[4,.8],[5,.8],[6,3],[7,4],[6,2],[5,.8],[4,.8],[3,.8]],recovery:[[6,.4],[5,.7],[4,.7],[3,.7]]},
    hungry:{label:'Hungry / snack time',activity:'is very hungry… snack time!',frames:[[8,1.5],[9,1.2],[8,.8],[9,1.5],[9,1.5]]},
    bellyache:{label:'Bellyache',activity:'has a grumpy tummy and is taking a moment',frames:[[10,1.5],[11,1.3],[10,1.2],[11,1.3],[10,1.8]]},
    crying:{label:'A dramatic cry',activity:'is having a very dramatic cry',frames:[[12,.9],[13,1.2],[12,.9],[13,1.2],[12,.9],[13,1.6]]},
    happy:{label:'Over the moon',activity:'is absolutely over the moon',frames:[[14,.8],[15,.55],[14,.8],[15,.55],[14,1.8]]}
  };
  function duration(frames){return frames.reduce((sum,frame)=>sum+frame[1],0);}
  function at(frames,time){let end=0;for(const [frame,hold] of frames){end+=hold;if(time<end)return {frame,next:Math.max(.016,end-time)};}return {frame:frames.at(-1)[0],next:.016};}
  return {moods,duration,at};
});
