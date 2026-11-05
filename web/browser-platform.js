/* Optional browser capabilities. No polling and no native bridge emulation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldBrowser=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  async function observeBattery(navigator,emit){
    const unavailable=()=>emit({available:false,level:null,hasBattery:false,charging:false});
    if(typeof navigator.getBattery!=='function'){unavailable();return ()=>{};}
    try{
      const battery=await navigator.getBattery();
      const sample=()=>{
        if(!Number.isFinite(battery.level)){unavailable();return;}
        emit({available:true,level:Math.round(Math.max(0,Math.min(1,battery.level))*100),charging:!!battery.charging,hasBattery:true});
      };
      sample();
      for(const type of ['levelchange','chargingchange'])battery.addEventListener(type,sample);
      return ()=>{for(const type of ['levelchange','chargingchange'])battery.removeEventListener(type,sample);};
    }catch{unavailable();return ()=>{};}
  }
  return {observeBattery};
});
