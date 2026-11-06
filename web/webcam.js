/* One consent-driven, video-only capture shared by both clay monitors. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const constraints={audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:360},frameRate:{ideal:12,max:15}}};
  function create({getMedia,emit=()=>{}}){
    let selected=0,active=false,intent=false,stream=null,pending=null,generation=0;
    let status='off',label='לחצו להפעלת המצלמה';
    const snapshot=()=>({status,label,stream,intent,selected});
    function publish(next,text){status=next;label=text;emit(snapshot());}
    function stopTracks(media){for(const track of media?.getTracks()||[])track.stop();}
    function release(){const old=stream;stream=null;stopTracks(old);}
    function failure(error){
      if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'לא ניתנה הרשאה למצלמה. לחצו כדי לנסות שוב.';
      if(error?.name==='NotFoundError')return 'לא נמצאה מצלמה במכשיר הזה.';
      if(error?.name==='NotReadableError')return 'המצלמה בשימוש. סגרו אפליקציות מצלמה אחרות ונסו שוב.';
      if(error?.name==='NotSupportedError')return 'המצלמה לא זמינה בדפדפן הזה. פתחו את האתר בחיבור HTTPS.';
      return 'לא הצלחנו להפעיל את המצלמה. לחצו כדי לנסות שוב.';
    }
    function enable(){
      intent=true;
      if(!selected){intent=false;return Promise.resolve(null);}
      if(!active){publish('paused','המצלמה מושהית · חזרו לעולם כדי להמשיך');return Promise.resolve(null);}
      if(stream)return Promise.resolve(stream);
      if(pending)return pending;
      const token=++generation;
      publish('requesting','אשרו גישה למצלמה…');
      let capture;
      try{capture=getMedia(constraints);}catch(error){intent=false;publish('error',failure(error));return Promise.resolve(null);}
      const task=Promise.resolve(capture).then(media=>{
        if(token!==generation||!intent||!selected){stopTracks(media);return null;}
        if(!active){stopTracks(media);publish('paused','המצלמה מושהית · חזרו לעולם כדי להמשיך');return null;}
        stream=media;
        for(const track of media.getVideoTracks())track.addEventListener?.('ended',()=>{
          if(stream!==media)return;
          intent=false;release();publish('error','המצלמה התנתקה. לחצו כדי להתחבר שוב.');
        },{once:true});
        publish('live','מצלמה חיה · וידאו בלבד');return media;
      }).catch(error=>{if(token===generation){intent=false;publish('error',failure(error));}return null;}).finally(()=>{
        if(pending===task)pending=null;
        if(active&&intent&&selected&&!stream)enable();
      });
      pending=task;return task;
    }
    function disable(){intent=false;generation++;release();publish('off','לחצו להפעלת המצלמה');}
    function setModes(modes){
      const next=modes.filter(mode=>mode==='webcam').length;
      if(next===selected)return;
      selected=next;if(!selected)disable();
    }
    function setActive(value){
      value=!!value;if(value===active)return;
      active=value;
      if(!active){release();if(intent)publish('paused','המצלמה מושהית · חזרו לעולם כדי להמשיך');}
      else if(intent&&selected)enable();
    }
    return {enable,disable,setModes,setActive,snapshot,dispose:disable};
  }
  return {create,constraints};
});
