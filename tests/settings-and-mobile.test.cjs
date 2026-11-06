const {test}=require('node:test');const assert=require('node:assert/strict');
const {createStore,validateConfig,DEFAULT,KEY}=require('../web/world-settings.js');
const {fit,fitRoom,roomBounds,W,H}=require('../web/scene-layout.js');
function memory(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
test('visitor settings, source assignments and embedded picture survive a new store instance',()=>{
 const storage=memory(),store=createStore({getStorage:()=>storage});
 const config={...structuredClone(DEFAULT),name:'My world',shirt:'#88ab94',wander:false,ambience:'night',location:'london',officeScreens:['office-news-2','news'],framePhoto:'data:image/png;base64,AAAA',batteryPreview:'15',batteryReactions:false,paused:true,room:'office',editorTab:'character',emotionPreview:'happy'};
 store.read();assert.equal(store.hasSaved,false);assert.equal(store.write(config),true);
 const restored=createStore({getStorage:()=>storage});assert.deepEqual(restored.read(),validateConfig(config));assert.equal(restored.hasSaved,true);
 assert.equal(restored.read().framePhoto,config.framePhoto);assert.equal(restored.read().paused,true);
});
test('existing saved worlds upgrade without losing their name, sources, photo or appearance',()=>{
 const storage=memory(),old={...structuredClone(DEFAULT),name:'Existing visitor',ambience:'dusk',framePhoto:'data:image/jpeg;base64,AAAA'};
 storage.setItem(KEY,JSON.stringify(old));const config=createStore({getStorage:()=>storage}).read();
 assert.equal(config.name,old.name);assert.deepEqual(config.sources,old.sources);assert.equal(config.framePhoto,old.framePhoto);assert.equal(config.ambience,'dusk');
 assert.equal(config.paused,false);assert.equal(config.editorTab,'world');assert.equal(config.room,'home');
});
test('webcam monitor choices persist, while live media and capture intent do not',()=>{
 const storage=memory(),store=createStore({getStorage:()=>storage});
 store.write({...DEFAULT,screenModes:['webcam','source'],camera:{stream:'private live media',intent:true}});
 assert.deepEqual(store.read().screenModes,['webcam','source']);assert.equal(store.read().camera,undefined);
 assert(!storage.getItem(KEY).includes('private live media'));
});
test('malformed storage and blocked browser storage recover without claiming a successful save',()=>{
 const storage=memory();storage.setItem(KEY,'{broken');const store=createStore({getStorage:()=>storage});
 assert.deepEqual(store.read(),validateConfig(DEFAULT));assert.equal(store.hasSaved,false);
 const blocked=createStore({getStorage:()=>{throw new Error('Storage blocked');}});
 assert.deepEqual(blocked.read(),validateConfig(DEFAULT));assert.equal(blocked.write(DEFAULT),false);
 storage.setItem(KEY,JSON.stringify(DEFAULT));const previous=storage.getItem(KEY);storage.setItem=()=>{throw new Error('Quota exceeded');};
 assert.equal(store.write({...DEFAULT,name:'Cannot persist'}),false);assert.equal(storage.getItem(KEY),previous);
});
test('the entire world stays inside phone landscape, portrait and desktop viewports',()=>{
 for(const [width,height] of [[844,390],[667,375],[932,430],[740,320],[390,844],[320,568],[1920,1080],[2560,1080]]){
  const box=fit(width,height);
  assert(box.width<=width+.001,`${width}×${height}: no horizontal crop`);
  assert(box.height<=height+.001,`${width}×${height}: no vertical crop`);
  assert(box.left>=0&&box.top>=0);assert(Math.abs(box.width/box.height-W/H)<.0001);
  assert(Math.abs(box.left*2+box.width-width)<.001);assert(Math.abs(box.top*2+box.height-height)<.001);
 }
});
test('immersive framing maximizes the miniature inside notch-safe bounds without cropping it',()=>{
 for(const [width,height] of [[844,390],[667,375],[750,369],[1440,900],[2560,1080]]){
  const box=fitRoom(width,height),scale=box.width/W;
  const left=box.left+roomBounds.left*scale,top=box.top+roomBounds.top*scale;
  const right=left+roomBounds.width*scale,bottom=top+roomBounds.height*scale;
  assert(left>=-.001&&top>=-.001);assert(right<=width+.001&&bottom<=height+.001);
  assert(Math.abs(right-left-width)<.001||Math.abs(bottom-top-height)<.001,'one safe viewport dimension must be filled');
 }
 assert(fitRoom(844,390).width>fit(844,390).width*1.2,'wide phones should show a meaningfully larger miniature');
});
