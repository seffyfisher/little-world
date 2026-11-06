/* The public site reads one published JSON document; it never needs /api routes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldStatic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create({load,now=Date.now}){
    let snapshot=null,loadedAt=-Infinity,pending=null;
    async function refresh(force=false){
      if(pending)return pending;
      if(!force&&snapshot&&now()-loadedAt<300000)return snapshot;
      pending=(async()=>{
        const value=await load();
        if(value?.schemaVersion!==1||!Array.isArray(value.sources)||!value.feeds||!value.weather)throw new Error('קובץ נתוני העולם אינו תקין.');
        snapshot=value;loadedAt=now();return snapshot;
      })();
      try{return await pending;}finally{pending=null;}
    }
    function published(source){return snapshot?.sources.find(item=>item.url===source.url&&item.kind===source.kind);}
    function feed(source){
      const match=published(source),value=match&&snapshot.feeds[match.id];
      if(!value)throw new Error('החיבור הזה עדיין לא זמין בנתונים שפורסמו.');
      return {...value,stale:!!value.stale||!!value.updatedAt&&now()-Date.parse(value.updatedAt)>86400000};
    }
    function weather(location){const value=snapshot?.weather[location];if(!value)throw new Error('עדיין אין נתוני מזג אוויר לעיר הזו.');return {...value,stale:!!value.stale||!!value.updatedAt&&now()-Date.parse(value.updatedAt)>86400000};}
    return {refresh,feed,weather,published,get sources(){return snapshot?.sources||[];},get generatedAt(){return snapshot?.generatedAt;}};
  }
  return {create};
});
