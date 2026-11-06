/* Mac host supplies a hardware-only allowlist. Browsers keep their usual camera behavior. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldLocalCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const normalized=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase();
  const remote=label=>/iphone|continuity|desk\s*view|אייפון/i.test(label);
  function matches(label,name){label=normalized(label);name=normalized(name);return !!name&&!remote(label)&&(label===name||label.includes(name));}
  function choose(devices,names){
    for(const name of names){const found=devices.find(device=>device.kind==='videoinput'&&device.deviceId&&device.deviceId!=='default'&&matches(device.label,name));if(found)return found;}
    return null;
  }
  async function capture(mediaDevices,names,constraints){
    if(!names.length)throw Object.assign(new Error('No local camera'),{name:'LocalCameraNotFoundError'});
    const devices=await mediaDevices.enumerateDevices(),device=choose(devices,names);
    // The host sets its application-scoped camera preference before WebKit is created.
    // On first consent WebKit may hide labels; validate the resulting track before displaying it.
    // A hard 15-fps maximum excludes some Mac camera formats. Keep a low
    // negotiable target, while the hardware device selection remains exact.
    const video={...constraints.video,frameRate:{ideal:12}};delete video.facingMode;
    if(device)video.deviceId={exact:device.deviceId};
    const stream=await mediaDevices.getUserMedia({...constraints,audio:false,video});
    const tracks=stream.getVideoTracks();
    if(!tracks.length||tracks.some(track=>!names.some(name=>matches(track.label,name)))){
      stream.getTracks().forEach(track=>track.stop());
      throw Object.assign(new Error('Camera is not a local Mac camera'),{name:'LocalCameraNotFoundError'});
    }
    return stream;
  }
  return {choose,capture};
});
