(() => {
'use strict';
if(document.body.classList.contains('compact-editor'))return;
/* Photographic clay plates + local transparent stop-motion GIFs; live objects stay real DOM. */
const host=document.querySelector('#clay-world');
const api=window.worldApp;
const layout=window.LittleWorldLayout;
const {W,H}=layout,A='assets/animation/';
const surface=document.createElement('div');surface.className='photo-surface';
surface.innerHTML=`
  <img class="photo-room" src="assets/photographic-clay-room-v3.png" alt="Hand-sculpted clay office and library, photographed miniature style" draggable="false">
  <img class="photo-room-night" alt="" aria-hidden="true" draggable="false">
  <time class="photo-digital-clock" aria-label="Local time">--:--</time>
  <div class="photo-chair-shadow" aria-hidden="true"></div>
  <img class="photo-office-chair" src="assets/animation/office-chair-0.png" alt="Turquoise clay swivel chair" draggable="false">
  <button class="photo-wall-frame" aria-label="Choose a picture for the wall frame"><img alt="Your wall picture" hidden></button>
  <div class="photo-lamp-glow" aria-hidden="true"></div>
  <div class="photo-window-weather" aria-hidden="true"></div>
  <div class="photo-steam" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="photo-books" role="group" aria-label="New books from e-vrit, refreshed daily"></div>
  <div class="photo-plant-ground" aria-hidden="true"></div>
  <img class="photo-plant photo-plant-left" alt="" draggable="false">
  <img class="photo-plant photo-plant-right" alt="" draggable="false">
  <img class="photo-library-steps" alt="Library steps for a high shelf" draggable="false" hidden>
  <button class="photo-avatar" aria-label="Your character"><span class="photo-avatar-flip"><img class="photo-person" alt="" draggable="false"><img class="photo-seat-blend" alt="" draggable="false" hidden><img class="photo-shirt-tint" alt="" draggable="false"><img class="photo-carried-cover" alt="" draggable="false"><img class="photo-hand photo-hand-left" alt="" draggable="false"><img class="photo-hand photo-hand-right" alt="" draggable="false"></span></button>
  <button class="photo-monitor photo-monitor-one"><span class="photo-monitor-status"></span><strong dir="auto"></strong><span class="photo-headline" dir="auto"></span></button>
  <button class="photo-monitor photo-monitor-two"><span class="photo-monitor-status"></span><strong dir="auto"></strong><span class="photo-headline" dir="auto"></span></button>
  <button class="photo-library-label" aria-label="Open the library">ספרים חדשים · עברית <span>DAILY</span></button>
`;
host.replaceChildren(surface);
const worldBar=document.createElement('nav');worldBar.className='world-interaction-bar';worldBar.setAttribute('aria-label','World controls');
worldBar.innerHTML='<strong>You are in your world</strong><span>Click a book to read · click the floor to walk · drop a picture in the wall frame</span><button data-world-action="office">Office</button><button data-world-action="library">Library</button><button data-world-action="edit">Edit</button><button data-world-action="exit">Leave world · Esc</button>';
(document.body.classList.contains('browser-app')?host.closest('.world-stage'):document.body).append(worldBar);
worldBar.onclick=event=>{const action=event.target.dataset.worldAction;if(action==='exit')api.leaveWorld();else if(action==='edit')api.editWorld();else if(action)api.visitRoom(action);};
const wallFrame=surface.querySelector('.photo-wall-frame'),wallPicture=wallFrame.querySelector('img'),steps=surface.querySelector('.photo-library-steps');
wallFrame.onclick=()=>api.choosePhoto();
for(const type of ['dragenter','dragover'])wallFrame.addEventListener(type,event=>{event.preventDefault();wallFrame.classList.add('dragging');});
wallFrame.addEventListener('dragleave',()=>wallFrame.classList.remove('dragging'));
wallFrame.addEventListener('drop',event=>{event.preventDefault();wallFrame.classList.remove('dragging');api.importPhoto(event.dataTransfer.files[0]);});
surface.addEventListener('click',event=>{
 if(!state.interaction||event.target.closest('button'))return;
 const bounds=surface.getBoundingClientRect(),x=(event.clientX-bounds.left)/bounds.width*100,y=(event.clientY-bounds.top)/bounds.height*100;
 if(y>=69)api.walkTo(x,y);
});
const plate=surface.querySelector('.photo-room'),actor=surface.querySelector('.photo-avatar');
const nightPlate=surface.querySelector('.photo-room-night');nightPlate.onload=()=>surface.classList.add('night-ready');
const person=surface.querySelector('.photo-person'),shirt=surface.querySelector('.photo-shirt-tint');
const seatBlend=surface.querySelector('.photo-seat-blend');let seatFade=null,seatToken=0;
const flip=surface.querySelector('.photo-avatar-flip'),heldCover=surface.querySelector('.photo-carried-cover');
const hands=[...surface.querySelectorAll('.photo-hand')];
const shelves=surface.querySelector('.photo-books'),monitors=[...surface.querySelectorAll('.photo-monitor')];
const plants=[...surface.querySelectorAll('.photo-plant')];
const officeChair=surface.querySelector('.photo-office-chair'),digitalClock=surface.querySelector('.photo-digital-clock');
function drawClock(clock){digitalClock.textContent=clock.text;digitalClock.dateTime=clock.datetime;digitalClock.setAttribute('aria-label',`Local time ${clock.text}`);}
drawClock(api.getClockState());
let state=api.getSceneState(),booksSignature='',width=0,height=0,coverURL='',heldSignature='',ambientFrame=0;
const bookButtons=[];
function showPhoto(){
  document.body.classList.add('photo-clay');
  document.querySelector('#world').setAttribute('aria-hidden','true');
  document.querySelectorAll('#world [tabindex]').forEach(el=>el.setAttribute('tabindex','-1'));
  resize();drawCharacter(api.getCharacterState());
}
plate.addEventListener('load',showPhoto);
plate.addEventListener('error',()=>{host.hidden=true;document.body.classList.remove('photo-clay');});
function resize(){
  const bounds=host.getBoundingClientRect();
  // The editor's wide stage crops only the empty studio backdrop above/below the model.
  // Keep the entire miniature visible in wallpaper mode and narrow layouts.
  const fillEditor=!document.body.classList.contains('browser-app')&&!document.body.classList.contains('wallpaper-mode')&&bounds.width/bounds.height>1.7;
  const fit=layout.fit(bounds.width,bounds.height);
  width=fillEditor?bounds.width:fit.width;height=width*H/W;
  surface.style.width=`${width}px`;surface.style.height=`${height}px`;
  surface.style.left=`${(bounds.width-width)/2}px`;surface.style.top=`${(bounds.height-height)/2}px`;
  drawCharacter(api.getCharacterState());
}
new ResizeObserver(resize).observe(host);
const srcFor=book=>api.coverURL(book.cover);
function update(next){
  state=next;
  document.body.classList.toggle('in-world',!!state.interaction);
  worldBar.hidden=!state.interaction;
  wallPicture.hidden=!state.framePhoto;if(state.framePhoto&&wallPicture.src!==state.framePhoto)wallPicture.src=state.framePhoto;
  surface.dataset.light=state.mode;
  if(state.mode==='night'&&!nightPlate.getAttribute('src'))nightPlate.src='assets/photographic-clay-room-night-v1.png';
  surface.querySelector('.photo-window-weather').dataset.rain=String((state.weather?.weather_code||0)>=50);
  monitors.forEach((button,index)=>{
    const screen=state.screens[index];
    button.setAttribute('aria-label',`Office screen ${index+1}: ${screen.name}. ${screen.headline}`);
    button.querySelector('strong').textContent=screen.name;
    button.querySelector('.photo-headline').textContent=screen.headline;
    button.querySelector('.photo-monitor-status').textContent=screen.status;
  });
  const signature=JSON.stringify(state.books);
  if(signature!==booksSignature){
    booksSignature=signature;heldSignature='';shelves.replaceChildren();bookButtons.length=0;
    state.books.forEach((book,index)=>{
      const button=document.createElement('button');button.className='photo-book';
      button.style.left=`${(1154+index%4*76)/W*100}%`;
      button.style.top=`${(287+Math.floor(index/4)*111)/H*100}%`;
      button.style.setProperty('--book-tilt',`${[-1.1,.8,-.5,1.2][index%4]}deg`);
      button.title=`${book.title}${book.author?' · '+book.author:''}`;button.setAttribute('aria-label',button.title);
      const image=document.createElement('img');image.src=srcFor(book);image.alt=book.title;image.draggable=false;
      // Transient upstream failures may succeed on the server's next attempt. One retry only.
      image.onerror=()=>{if(api.isActive()&&!document.body.classList.contains('browser-app')&&!image.dataset.retried){image.dataset.retried='1';setTimeout(()=>{if(api.isActive())image.src=srcFor(book)+'&retry=1';},2000);}};
      button.append(image);button.onclick=()=>state.interaction?api.selectBook(index):api.openBookAt(index);
      button.dataset.bookUrl=book.url;shelves.append(button);bookButtons.push(button);
    });
  }
  actor.setAttribute('aria-label',`${state.name}: choose a book, or open the book being read`);
  drawCharacter(api.getCharacterState());drawPlants();
}
monitors.forEach((button,index)=>button.onclick=()=>api.openScreen(index));
surface.querySelector('.photo-library-label').onclick=()=>api.openLibrary();
actor.onclick=()=>{if(api.getCharacterState().book)api.openReadingBook();else api.readBook();};
const assetURL=path=>path+'?v=ladder-pinning-11';
// Pose-specific fabric regions keep the recolour away from faces, bare arms and book pages.
const fabric=[
  '40,61 60,61 60,67 40,67','40,45 58,45 60,57 40,57',
  '42,46 58,46 59,61 40,61','40,47 55,47 58,62 40,62',
  '42,70 57,70 62,78 39,78','42,59 57,60 62,73 42,73',
  '42,59 57,60 68,64 67,70 48,69','32,72 50,74 62,78 60,85 33,82',
  '42,49 58,49 59,60 41,60','40,68 59,68 59,73 40,73',
  '42,54 58,54 59,60 41,60','45,58 58,58 59,64 44,64',
  '42,69 58,69 59,73 41,73','42,58 55,58 56,62 41,62',
  '42,57 57,57 59,72 40,72','42,55 57,55 59,65 40,65'
];
const polygon=points=>'polygon('+points.split(' ').map(point=>point.split(',').join('% ')+'%').join(',')+')';
function source(image,path){const url=assetURL(path);if(image.getAttribute('src')!==url)image.setAttribute('src',url);}
function personFrame(path,c){
  const url=assetURL(path),old=person.getAttribute('src');
  const blend=(['sit-down','stand-up'].includes(c.phase)||c.pose==='climb')&&c.active&&!c.paused&&!c.reducedMotion&&!c.lowPower;
  if(!blend){seatFade?.cancel();seatBlend.hidden=true;}
  if(old===url)return;
  const token=++seatToken;
  if(blend&&old){seatFade?.cancel();seatBlend.src=old;seatBlend.hidden=false;seatBlend.style.opacity='1';}
  person.src=url;
  if(blend&&old)person.decode().then(()=>{
    if(token!==seatToken)return;
    if(!api.isActive()||api.getCharacterState().paused){seatBlend.hidden=true;return;}
    seatFade=seatBlend.animate([{opacity:1},{opacity:0}],{duration:c.pose==='climb'?100:150,easing:'cubic-bezier(.23,1,.32,1)'});
    seatFade.finished.then(()=>{if(token===seatToken)seatBlend.hidden=true;}).catch(()=>{});
  }).catch(()=>{seatBlend.hidden=true;});
}
function style(element,key,value){if(element.style[key]!==value)element.style[key]=value;}
function drawPlants(){
  const stopped=!state.active||state.paused||state.reducedMotion||state.lowPower;
  const stage=state.energy?.stage||0;
  plants.forEach((plant,index)=>{
    source(plant,A+(stage?`plant-energy-${index*3+stage-1}.png`:`plant-frame-${index*6+(stopped?0:ambientFrame%6)}.png`));
    plant.style.transform=stage?`translateY(${index?9.1:4.1}%)`:'';
  });
}
function drawCharacter(c){
  if(!width)return;
  const stopped=!c.active||c.paused||c.reducedMotion;
  surface.classList.toggle('photo-still',stopped);
  let frame=1,path;
  if(c.pose==='walk')frame=[0,1,2,3][c.stride%4];
  if(c.pose==='carry')frame=[6,7][c.stride%2];
  if(c.pose==='read')frame=8+(c.lowPower?0:c.readFrame);
  if(c.pose==='reach')frame=4;
  if(c.pose==='hold')frame=5;
  path=c.pose==='transfer'?`character-transfer-${c.transferFrame}.png`:`character-frame-${frame}.png`;
  if(c.pose==='read')path=`character-seat-${3+(c.lowPower?0:c.readFrame)}.png`;
  if(c.pose==='seat')path=`character-seat-${c.seatFrame}.png`;
  if(c.pose==='emotion')path=`character-emotion-${c.emotionFrame}.png`;
  if(c.pose==='climb')path=`character-climb-${c.climbFrame}.png`;
  personFrame(A+path,c);
  const rose=state.shirt==='#c58d8c';shirt.hidden=rose;
  if(!rose){
    source(shirt,A+path);style(shirt,'filter',`hue-rotate(${{'#d8ab7d':35,'#88ab94':135,'#879eb5':195}[state.shirt]||0}deg)`);
    const mask=c.pose==='emotion'?fabric[c.emotionFrame]:c.pose==='read'?'40,50 56,50 62,54 60,57 40,57':c.pose==='seat'
      ?c.seatFrame===2?'40,48 58,48 60,53 40,53':'40,44 57,44 60,49 40,49':null;
    style(shirt,'clipPath',mask?polygon(mask):'');
  }
  const a=layout.actor(c),scale=width/W;
  const lampReach=Math.max(0,1-Math.hypot((c.x-58.5)/11,(c.y-73)/10));
  style(actor,'filter',state.mode==='night'?`brightness(${.10+lampReach*.40}) sepia(.24) saturate(.7)`:'');
  steps.hidden=!c.ladderVisible;
  if(!steps.hidden){
    const l=layout.ladder(c.bookIndex);
    source(steps,A+`library-steps-${l.tall?'tall':'short'}.png`);
    steps.style.width=`${l.width*scale}px`;steps.style.height=`${l.height*scale}px`;
    steps.style.left=`${l.left*scale}px`;steps.style.top=`${l.top*scale}px`;
  }
  style(actor,'width',`${a.size*scale}px`);
  style(actor,'transform',`translate3d(${a.x*scale}px,${a.y*scale}px,0)`);
  actor.dataset.pose=c.pose;actor.dataset.phase=c.phase;actor.dataset.transferFrame=c.transferFrame;actor.dataset.emotion=c.emotion||'';actor.dataset.emotionFrame=c.emotionFrame;actor.dataset.seatFrame=c.seatFrame;
  style(flip,'transform',`scaleX(${c.direction})`);
  const show=c.held&&c.pose!=='read'&&!(c.pose==='seat'&&c.seatFrame>=3&&c.seatFrame!==7);heldCover.hidden=!show;hands.forEach(hand=>hand.hidden=!show);
  if(show){
    const b=layout.book({...c,direction:1});
    style(heldCover,'left',`${(b.x-a.x)*scale}px`);style(heldCover,'top',`${(b.y-a.y)*scale}px`);
    style(heldCover,'width',`${b.width*scale}px`);style(heldCover,'height',`${b.height*scale}px`);
    style(heldCover,'transform',`scaleX(${c.direction})`);
    if(coverURL!==c.book.cover){coverURL=c.book.cover;heldCover.src=srcFor(c.book);}
    const transferHands=[[[68.5,40.9,7.5,6],[91.5,39.9,3,6]],[[64.1,48.8,8,6],[86.4,47.1,3,6]],[[53.4,57.5,7,6],[74,55.2,4,6]],[[41.9,62.2,8,6],[69,59.7,5,6]]];
    const seatGrip=layout.seatGrips[c.seatFrame===7?1:Math.min(2,c.seatFrame||0)];
    const clips=c.pose==='transfer'?transferHands[c.transferFrame]:c.pose==='climb'?[[44,57,9,7],[73,36,6,6]]:c.pose==='seat'?[[seatGrip[0]*100-12,seatGrip[1]*100+7,9,6.5],[seatGrip[0]*100+8,seatGrip[1]*100+6,6,7]]:[[43,56,9,6.5],[63,55.5,6,7]];
    hands.forEach((hand,i)=>{source(hand,A+path);const [x,y,rx,ry]=clips[i];style(hand,'clipPath',`ellipse(${rx}% ${ry}% at ${x}% ${y}%)`);});
  }
  const signature=c.held?c.book?.url||'':'';
  if(signature!==heldSignature){for(const button of bookButtons)button.hidden=!!signature&&button.dataset.bookUrl===signature;heldSignature=signature;}
}
window.addEventListener('world:change',event=>update(event.detail));
window.addEventListener('world:character',event=>drawCharacter(event.detail));
window.addEventListener('world:activity',event=>{Object.assign(state,event.detail);drawCharacter(api.getCharacterState());drawPlants();});
window.addEventListener('world:ambient',event=>{ambientFrame=event.detail;drawPlants();});
window.addEventListener('world:chair',event=>source(officeChair,A+`office-chair-${event.detail.frame}.png`));
window.addEventListener('world:clock',event=>drawClock(event.detail));
update(state);
// A cached image can already be complete: initialize it only after sprite helpers exist.
if(plate.complete&&plate.naturalWidth)showPhoto();

})();
