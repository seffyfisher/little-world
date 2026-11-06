/* Daily art uses the existing visibility-aware scheduler and a small public catalog. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./energy.js'):root.LittleWorldEnergy,typeof module==='object'&&module.exports?require('./scene-layout.js'):root.LittleWorldLayout);if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(energy,layout){
  'use strict';
  const ratio=layout.wallPhotoFrame.width/layout.wallPhotoFrame.height;
  function fits(width,height){return Number.isFinite(width)&&Number.isFinite(height)&&width>=420&&height>=300&&Math.abs(width/height/ratio-1)<=.05;}
  function record(raw){
    if(!raw||!Number.isSafeInteger(raw.id)||raw.id<=0||raw.isPublicDomain!==true||!/^[A-Za-z0-9._-]{1,60}$/.test(raw.accession||'')||!fits(raw.width,raw.height))return null;
    return {id:raw.id,accession:raw.accession,width:raw.width,height:raw.height,isPublicDomain:true,title:String(raw.title||'יצירה ללא שם').slice(0,200),artist:String(raw.artist||'אמן לא ידוע').slice(0,160),date:String(raw.date||'').slice(0,100)};
  }
  function validate(raw={}){raw=raw||{};const artwork=record(raw.artwork),photo=energy.photo(raw.photo);return {mode:raw.mode==='daily'?'daily':'photo',artwork:artwork&&photo?artwork:null,photo:artwork?photo:'',day:/^\d{4}-\d{2}-\d{2}$/.test(raw.day||'')?raw.day:'',history:Array.isArray(raw.history)?[...new Set(raw.history.filter(id=>Number.isSafeInteger(id)&&id>0))].slice(-30):[]};}
  function morning(date=new Date()){
    const boundary=new Date(date);boundary.setHours(7,0,0,0);
    if(date<boundary)boundary.setDate(boundary.getDate()-1);
    const day=`${boundary.getFullYear()}-${String(boundary.getMonth()+1).padStart(2,'0')}-${String(boundary.getDate()).padStart(2,'0')}`;
    const next=new Date(boundary);next.setDate(next.getDate()+1);
    return {day,delay:Math.max(1,next-date)};
  }
  function imageURL(art){return `assets/art/cma-${art.id}.jpg`;}
  function pageURL(art){return `https://www.clevelandart.org/art/${art.accession}`;}
  function create({runtime,getState,saveState,loadCatalog,loadPhoto,emit=()=>{},now=()=>new Date(),random=Math.random}){
    let active=false,busy=false,generation=0,retryAt=0,status='idle',catalog=null;
    function report(value){status=value;emit({status,busy});}
    function sync(){
      runtime.remove('daily-art');const state=getState();
      if(!active||state.mode!=='daily'||busy)return;
      const clock=morning(now()),current=state.photo&&state.artwork&&state.day===clock.day;
      runtime.set('daily-art',()=>{refresh();},current?clock.delay:Math.max(0,retryAt-now().getTime()));
    }
    async function refresh(force=false){
      if(!active||busy||getState().mode!=='daily')return;
      if(!force&&getState().photo&&getState().day===morning(now()).day){sync();return;}
      busy=true;const token=++generation,initial=getState(),day=morning(now()).day;report('loading');
      const valid=()=>active&&generation===token&&getState().mode==='daily'&&getState().photo===initial.photo;
      try{
        if(!catalog){const data=await loadCatalog();if(!valid())return;catalog=(data.items||[]).map(record).filter(Boolean);}
        let pool=catalog.filter(art=>art.id!==initial.artwork?.id&&!initial.history.includes(art.id));
        if(!pool.length)pool=catalog.filter(art=>art.id!==initial.artwork?.id);
        for(let attempt=0;attempt<3&&pool.length&&valid();attempt++){
          const index=Math.min(pool.length-1,Math.floor(random()*pool.length)),artwork=pool.splice(index,1)[0];
          try{
            const photo=energy.photo(await loadPhoto(artwork));if(!valid())return;if(!photo)throw new Error('Invalid image');
            saveState({...getState(),artwork,photo,day,history:[...initial.history.filter(id=>id!==artwork.id),artwork.id].slice(-30)});
            retryAt=0;report('ready');return;
          }catch(error){if(error.name==='AbortError'||!valid())throw error;}
        }
        throw new Error('No suitable image available');
      }catch(error){if(valid()&&error.name!=='AbortError'){retryAt=now().getTime()+3600000;report('error');}}
      finally{if(generation===token){busy=false;emit({status,busy});sync();}}
    }
    return {sync,refresh,setActive(value){if(active===value){sync();return;}active=value;if(!active){generation++;busy=false;runtime.remove('daily-art');report('idle');}else sync();},get status(){return status;},get busy(){return busy;}};
  }
  return {ratio,fits,record,validate,morning,imageURL,pageURL,create};
});
