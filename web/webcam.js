/* One consent-driven, video-only capture shared by both clay monitors. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const constraints={audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:360},frameRate:{ideal:12,max:15}}};
  function create({getMedia,emit=()=>{}}){
    let selected=0,active=false,intent=false,stream=null,pending=null,generation=0;
    let status='off',label='Tap to enable camera';
    const snapshot=()=>({status,label,stream,intent,selected});
    function publish(next,text){status=next;label=text;emit(snapshot());}
    function stopTracks(media){for(const track of media?.getTracks()||[])track.stop();}
    function release(){const old=stream;stream=null;stopTracks(old);}
    function failure(error){
      if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'Camera permission was not granted. Tap to retry.';
      if(error?.name==='NotFoundError')return 'No webcam found on this device.';
      if(error?.name==='NotReadableError')return 'Camera is busy. Close other camera apps and retry.';
      if(error?.name==='NotSupportedError')return 'Camera access is unavailable in this browser. Use HTTPS.';
      return 'Camera could not start. Tap to retry.';
    }
    function enable(){
      intent=true;
      if(!selected){intent=false;return Promise.resolve(null);}
      if(!active){publish('paused','Camera paused · return to the world to resume');return Promise.resolve(null);}
      if(stream)return Promise.resolve(stream);
      if(pending)return pending;
      const token=++generation;
      publish('requesting','Allow camera access in your browser…');
      let capture;
      try{capture=getMedia(constraints);}catch(error){intent=false;publish('error',failure(error));return Promise.resolve(null);}
      const task=Promise.resolve(capture).then(media=>{
        if(token!==generation||!intent||!selected){stopTracks(media);return null;}
        if(!active){stopTracks(media);publish('paused','Camera paused · return to the world to resume');return null;}
        stream=media;
        for(const track of media.getVideoTracks())track.addEventListener?.('ended',()=>{
          if(stream!==media)return;
          intent=false;release();publish('error','Camera disconnected. Tap to reconnect.');
        },{once:true});
        publish('live','Live webcam · video only');return media;
      }).catch(error=>{if(token===generation){intent=false;publish('error',failure(error));}return null;}).finally(()=>{
        if(pending===task)pending=null;
        if(active&&intent&&selected&&!stream)enable();
      });
      pending=task;return task;
    }
    function disable(){intent=false;generation++;release();publish('off','Tap to enable camera');}
    function setModes(modes){
      const next=modes.filter(mode=>mode==='webcam').length;
      if(next===selected)return;
      selected=next;if(!selected)disable();
    }
    function setActive(value){
      value=!!value;if(value===active)return;
      active=value;
      if(!active){release();if(intent)publish('paused','Camera paused · return to the world to resume');}
      else if(intent&&selected)enable();
    }
    return {enable,disable,setModes,setActive,snapshot,dispose:disable};
  }
  return {create,constraints};
});
