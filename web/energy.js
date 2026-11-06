(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldEnergy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const previews=new Set(['actual','35','15','5','charging']);
  function state(power={},preview='actual',previous=0){
    const demo=previews.has(preview)&&preview!=='actual';
    const level=demo?(preview==='charging'?80:Number(preview)):Number.isFinite(power.level)?Math.round(Math.max(0,Math.min(100,power.level))):null;
    const charging=demo?preview==='charging':!!power.charging,hasBattery=demo||power.hasBattery!==false&&level!==null;
    let stage=0;
    if(hasBattery&&!charging&&level!==null){
      stage=level<=10?3:level<=20?2:level<=35?1:0;
      // A2% recovery margin prevents leaves flickering when battery estimates hover at a boundary.
      if(!demo&&stage<previous&&level<=[35,20,10][previous-1]+2)stage=previous;
    }
    return {level,charging,hasBattery,stage,demo,label:demo?`הדמיה · ${preview==='charging'?'בטעינה':level+'% סוללה'}`:power.available===false?'נתוני הסוללה לא זמינים בדפדפן הזה':hasBattery?`${level}% · ${charging?'מחובר לחשמל':'פועל על סוללה'}`:'מחובר לחשמל · ללא סוללה'};
  }
  function photo(value){return typeof value==='string'&&value.length<=2500000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)?value:'';}
  return {state,photo,previews};
});
