/* One deadline timer. Suspending cancels it rather than waking up to do no work. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldRuntime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create({now=()=>performance.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){
    const jobs=new Map();let active=false,timer=null;
    function arm(){
      if(timer!==null){cancel(timer);timer=null;}
      if(!active||!jobs.size)return;
      const due=Math.min(...[...jobs.values()].map(job=>job.due));
      timer=schedule(run,Math.max(0,due-now()));
    }
    function run(){
      timer=null;if(!active)return;
      const time=now();
      for(const [name,job] of [...jobs]){
        if(!active)break;
        if(job.due>time||jobs.get(name)!==job)continue;
        jobs.delete(name);const delay=job.callback();
        if(typeof delay==='number'&&Number.isFinite(delay)&&!jobs.has(name))jobs.set(name,{callback:job.callback,due:now()+Math.max(16,delay)});
      }
      arm();
    }
    return {
      set(name,callback,delay=0){jobs.set(name,{callback,due:now()+Math.max(0,delay)});arm();},
      remove(name){jobs.delete(name);arm();},
      setActive(value){if(active===value)return;active=value;arm();},
      get active(){return active;},
      get pending(){return timer===null?0:1;}
    };
  }
  return {create};
});
