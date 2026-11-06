const {test}=require('node:test');const assert=require('node:assert/strict');
const {create}=require('../web/webcam.js');
function media(){
 const track=new EventTarget();track.stops=0;track.stop=()=>{track.stops++;};
 return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};
}
function ready(getMedia){const c=create({getMedia});c.setModes(['webcam','source']);c.setActive(true);return c;}
test('saved webcam modes do not capture before consent; both monitors reuse one video-only stream',async()=>{
 let calls=0,requested;const stream=media();const c=ready(constraints=>{calls++;requested=constraints;return stream;});
 assert.equal(calls,0);assert.equal(c.snapshot().status,'off');
 assert.equal(await c.enable(),stream);c.setModes(['webcam','webcam']);assert.equal(await c.enable(),stream);
 assert.equal(calls,1);assert.equal(requested.audio,false);assert.equal(requested.video.frameRate.max,15);assert.equal(c.snapshot().selected,2);
});
test('switching the last webcam back to a feed releases its tracks',async()=>{
 const stream=media();const c=ready(()=>stream);await c.enable();c.setModes(['webcam','webcam']);c.setModes(['source','webcam']);assert.equal(stream.track.stops,0);
 c.setModes(['source','source']);assert.equal(stream.track.stops,1);assert.equal(c.snapshot().stream,null);assert.equal(c.snapshot().intent,false);
});
test('hidden or paused worlds release capture and resume only a previously enabled session',async()=>{
 const streams=[];const c=ready(()=>{const stream=media();streams.push(stream);return stream;});await c.enable();
 c.setActive(false);assert.equal(streams[0].track.stops,1);assert.equal(c.snapshot().status,'paused');
 c.setActive(true);await c.enable();assert.equal(streams.length,2);assert.equal(c.snapshot().status,'live');
 c.disable();c.setActive(false);c.setActive(true);assert.equal(streams.length,2);
});
test('a permission response arriving after webcam removal cannot leak a camera stream',async()=>{
 let resolve;const c=ready(()=>new Promise(r=>resolve=r));const pending=c.enable();c.setModes(['source','source']);const stream=media();resolve(stream);await pending;
 assert.equal(stream.track.stops,1);assert.equal(c.snapshot().stream,null);assert.equal(c.snapshot().status,'off');
});
test('capture approved while hidden is stopped, and starts fresh after returning',async()=>{
 let resolve,calls=0;const next=media();const c=ready(()=>++calls===1?new Promise(r=>resolve=r):next);
 const pending=c.enable();c.setActive(false);const old=media();resolve(old);await pending;
 assert.equal(old.track.stops,1);assert.equal(c.snapshot().status,'paused');c.setActive(true);await c.enable();assert.equal(c.snapshot().stream,next);assert.equal(calls,2);
});
test('permission denial stays explicit and does not repeatedly prompt on visibility changes',async()=>{
 let calls=0;const c=ready(()=>{calls++;throw Object.assign(new Error('denied'),{name:'NotAllowedError'});});await c.enable();
 assert.match(c.snapshot().label,/permission was not granted/);c.setActive(false);c.setActive(true);assert.equal(calls,1);await c.enable();assert.equal(calls,2);
});
test('disconnects and page disposal stop camera tracks and expose reconnect state',async()=>{
 const stream=media();const c=ready(()=>stream);await c.enable();stream.track.dispatchEvent(new Event('ended'));
 assert.equal(stream.track.stops,1);assert.match(c.snapshot().label,/disconnected/);assert.equal(c.snapshot().intent,false);
 const second=media(),next=ready(()=>second);await next.enable();next.dispose();assert.equal(second.track.stops,1);assert.equal(next.snapshot().status,'off');
});
test('reenabling while an old permission request is pending discards the old stream safely',async()=>{
 let resolve,calls=0;const old=media(),fresh=media();
 const c=ready(()=>++calls===1?new Promise(r=>resolve=r):fresh);
 const first=c.enable();c.disable();c.enable();resolve(old);await first;await c.enable();
 assert.equal(old.track.stops,1);assert.equal(c.snapshot().stream,fresh);assert.equal(calls,2);
});
