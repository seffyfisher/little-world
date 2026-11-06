/* Little העולם POC. Scene + local configuration; no framework or build step. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const {KEY,MAX_SCREENS,DEFAULT,safeURL,validateConfig,createStore}=window.LittleWorldSettings;
  const settingsStore=createStore();
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let config=settingsStore.read();
  let feeds = {}, weather = null, weatherError = false, selectedRoom = config.room, selectedSource = null, headlineIndex = 0;
  let drawerMode = '', settingsTab = config.editorTab, settingsScreen = config.editorScreen, paused = config.paused, refreshing = false, refreshQueued = false, toastTimer, returnFocus;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const darkAppearance=matchMedia('(prefers-color-scheme: dark)');
  let systemDark=darkAppearance.matches;
  const wallpaperMode = new URLSearchParams(location.search).has('wallpaper');
  const compactEditor = new URLSearchParams(location.search).has('edit');
  document.body.classList.toggle('compact-editor',compactEditor);
  const nativeManaged=!!window.webkit?.messageHandlers?.world;
  const browserApp=!nativeManaged&&!compactEditor;
  const SCREEN_COUNT=nativeManaged?MAX_SCREENS:2,SCREEN_INDICES=Array.from({length:SCREEN_COUNT},(_,i)=>i);
  const screenLabel=index=>`מסך ${index+1}`;
  document.body.classList.toggle('browser-app',browserApp);
  document.body.classList.toggle('world-immersive',browserApp);
  const portraitQuery=matchMedia('(max-width: 767px) and (orientation: portrait)');
  let portraitMobile=browserApp&&portraitQuery.matches;
  document.body.classList.toggle('portrait-mobile',portraitMobile);
  const savedPlace=nativeManaged?'ב־Mac הזה':'בדפדפן הזה';
  let hostActive=!nativeManaged,lowPower=false;
  let interaction=false,power={level:null,charging:true,hasBattery:false,...(!nativeManaged?{available:false}:{})},energy=window.LittleWorldEnergy.state(power,config.batteryPreview),pendingEnergyMood=null,pendingRead=false;
  const runtime=window.LittleWorldRuntime.create();
  const portraitMotion=window.LittleWorldPortrait.create({runtime:window.LittleWorldRuntime.create(),emit:frame=>{const reader=$('#portrait-reader');if(reader)reader.src=`assets/animation/character-seat-${frame}.png`;}});
  const staticData=browserApp?window.LittleWorldStatic.create({load:()=>getJSON('data/world.json')}):null;
  let publishedConfigLoaded=false;
  const needsPublishedDefaults=!settingsStore.hasSaved,initialConnections=JSON.stringify([config.sources,config.officeScreens]);
  const roomProps=window.LittleWorldRoomProps;
  const chairMotion=roomProps.createChair({runtime,emit:frame=>window.dispatchEvent(new CustomEvent('world:chair',{detail:{frame}}))});
  const camera=window.LittleWorldCamera.create({getMedia:constraints=>{if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('Unavailable'),{name:'NotSupportedError'});return nativeManaged&&Array.isArray(window.littleWorldLocalCameras)?window.LittleWorldLocalCamera.capture(navigator.mediaDevices,window.littleWorldLocalCameras,constraints):navigator.mediaDevices.getUserMedia(constraints);},emit:()=>{publishScene();updateCameraControls();}});
  const requests=new Set(),feedChecked=new Map();let weatherChecked=-Infinity,weatherCheckedLocation='';
  function isActive(){return nativeManaged?hostActive:!document.hidden&&(!portraitMobile||!!drawerMode);}

  document.body.classList.toggle('wallpaper-mode', wallpaperMode);
  $$('#world path,#world rect,#world circle,#world ellipse,#world image,#world defs').forEach(element => element.setAttribute('aria-hidden', 'true'));

  function native(action, extra = {}) {
    window.webkit?.messageHandlers?.world?.postMessage({action, ...extra});
  }
  function save() {
    config = validateConfig(config);
    updateEnergy();camera.setModes(config.screenModes.slice(0,SCREEN_COUNT));
    const saved=settingsStore.write(config);
    if(!saved)toast('השינויים פעילים, אבל לא הצלחנו לשמור אותם לפעם הבאה.');
    native('save', {value: JSON.stringify(config)});
    render();return saved;
  }
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000);
  }
  function status(source) {
    const data = feeds[source.id];
    if (!data) return 'מתחברים';
    if (data.stale || (data.error && data.items?.length)) return 'עותק שמור';
    if (data.error) return 'לא זמין';
    if (staticData) return data.adapter==='evrit-books'?'ספרים חדשים מדי יום':'עדכונים מהרשת';
    return data.adapter === 'evrit-books' ? 'ספרים חדשים מדי יום' : data.adapter === 'website' ? 'אתר מתעדכן' : 'עדכונים חיים';
  }
  function screenSource(index) { return config.sources.find(s => s.id === config.officeScreens[index] && s.room === 'office'); }
  function librarySource() { return config.sources.find(s => s.room === 'library' && s.kind === 'evrit-books') || config.sources.find(s => s.room === 'library'); }
  function sourceKind(source) { return source.kind === 'evrit-books' ? 'ספרים חדשים בעברית · עדכון יומי' : source.kind === 'feed' ? 'עדכוני RSS / Atom' : 'אתר חי · זיהוי תוכן אוטומטי'; }
  function sourcePlace(source) {
    if (source.room === 'library') return '▥ הספרייה · מדפי ספרים';
    const screens = config.officeScreens.slice(0,SCREEN_COUNT).flatMap((id, i) => config.screenModes[i]!=='webcam'&&id === source.id ? [String(i + 1)] : []);
    return screens.length ? `▤ המשרד · מסך ${screens.join(' ו־')}` : '▤ המשרד · מקור זמין';
  }
  function sceneState() {
    const library = librarySource();
    return {
      name: config.name, paused, active:isActive(), lowPower, reducedMotion: reducedMotion.matches,interaction,energy,framePhoto:config.framePhoto||'',
      mode: document.body.classList.contains('night') ? 'night' : document.body.classList.contains('dusk') ? 'dusk' : 'day',
      room: selectedRoom, weather: weather?.current || null,camera:camera.snapshot(),
      screens: SCREEN_INDICES.map(index => {
        if(config.screenModes[index]==='webcam')return {mode:'webcam',name:'מצלמה',status:camera.snapshot().status==='live'?'מצלמה חיה':'מצלמה',headline:camera.snapshot().label};
        const source = screenSource(index), data = source && feeds[source.id], items = data?.items || [];
        return {url:safeURL(items[headlineIndex % Math.max(1,items.length)]?.url)||safeURL(source?.url),name: source?.name || `מסך ${index + 1}`, status: source ? status(source) : 'בחירת מקור',
          headline: items[headlineIndex % Math.max(1,items.length)]?.title || (data?.error ? 'המקור לא זמין. לחצו כדי לנסות שוב.' : source ? 'אוספים את העדכונים האחרונים…' : 'בחרו אתר למסך הזה.'), updatedAt: data?.updatedAt || null};
      }),
      books: library?.kind === 'evrit-books' ? (feeds[library.id]?.items || []).filter(book => safeURL(book.cover)).slice(0,12) : []
    };
  }
  function publishScene() { window.dispatchEvent(new CustomEvent('world:change', {detail:sceneState()})); }
  function updateEnergy(){
    const next=window.LittleWorldEnergy.state(power,config.batteryPreview,energy.stage);
    if(config.batteryReactions&&next.stage!==energy.stage){
      if(next.stage>=2)pendingEnergyMood=next.stage===3?'floor':'tired';
      else if(energy.stage>=2&&next.charging)pendingEnergyMood='happy';
    }
    energy=next;
    if($('#energy-label'))$('#energy-label').textContent=energy.label;
  }
  function setPhoto(value){
    const photo=window.LittleWorldEnergy.photo(value);if(!photo)return;
    config.framePhoto=photo;const saved=save();if(drawerMode==='settings'&&settingsTab==='world')renderSettings();if(saved)toast(`התמונה במסגרת שעל הקיר. נשמרה ${savedPlace}.`);
  }
  async function importPhoto(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000){toast('בחרו תמונת JPG, PNG או WebP בגודל של עד 20MB.');return;}
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();
      const scale=Math.min(1,960/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);setPhoto(canvas.toDataURL('image/jpeg',.82));
    }catch{toast('לא הצלחנו לפתוח את התמונה. נסו קובץ JPG או PNG.');}finally{URL.revokeObjectURL(url);}
  }
  function render() {
    $('#scene-name').textContent = `העולם של ${config.name}`;
    $('#character-name').textContent = config.name;
    for (const room of ['office', 'library']) {
      const sources = config.sources.filter(s => s.room === room);
      const first = room === 'library' ? librarySource() : screenSource(0) || screenSource(1) || sources[0];
      const data = first && feeds[first.id];
      $(`#${room}-count`).textContent = `${sources.length} חיבורים`;
      $(`#${room}-title`).textContent = first ? (data?.items?.[0]?.title || first.name) : 'מקום קטן למשהו חדש';
      $(`#${room}-description`).textContent = !first ? 'הוסיפו אתר כדי להפוך את החדר לשלכם.'
        : `${first.name} · ${data?.error || data?.stale ? (data.items ? 'מציגים עותק שמור · מנסים שוב' : 'המקור לא זמין · לחצו לפרטים') : data?.items ? `${data.adapter === 'evrit-books' ? `${data.items.length} ספרים חדשים · עדכון יומי` : data.adapter === 'website' ? 'אתר מתעדכן' : 'עדכונים חיים'} · עודכן ב־${timeLabel(data.updatedAt)}` : 'מתחברים לתוכן מתעדכן…'}`;
    }
    for (const index of [0,1]) {
      const office = screenSource(index), suffix = index ? '-2' : '';
      const items = (office && feeds[office.id]?.items) || [];
      const headline = items[headlineIndex % Math.max(1, items.length)]?.title;
      $(`#monitor-source${suffix}`).textContent = office ? office.name.toUpperCase().slice(0, 19) : `מסך ${index + 1} · הוספת מקור`;
      const lines = wrap(headline || (office ? feeds[office.id]?.error ? 'המקור לא זמין. לחצו כדי לנסות שוב.' : 'מתחברים לתוכן מתעדכן…' : 'בחרו אתר למסך הזה.'), 24);
      $(`#monitor-line1${suffix}`).textContent = lines[0] || '';
      $(`#monitor-line2${suffix}`).textContent = lines[1] || '';
      $(`#office-object${suffix}`).setAttribute('aria-label', `מסך במשרד ${index + 1}: ${office?.name || 'בחירת מקור'}`);
    }
    const library = librarySource();
    const libraryItems = (library && feeds[library.id]?.items) || [];
    $('#book-label').textContent = library?.kind === 'evrit-books' ? 'ספרים חדשים · עברית' : library?.name.slice(0, 24) || 'הספרים שלך';
    $('#library-live-line').textContent = library?.kind === 'evrit-books' ? libraryItems.length ? `${libraryItems.length} ספרים חדשים · מתעדכנים מדי יום` : 'טוענים את עטיפות הספרים…' : (libraryItems[headlineIndex % Math.max(1, libraryItems.length)]?.title || 'הוספת מקור מתעדכן').slice(0, 30);
    renderBooks(library, libraryItems);
    const live = config.sources.filter(s => feeds[s.id]?.items && !feeds[s.id]?.error && !feeds[s.id]?.stale).length;
    const feedCount = config.sources.length;
    $('#connection-summary').textContent = `${config.sources.length} חיבורים · ${live}/${feedCount} מקורות ${staticData?'מפורסמים':'פעילים'} · נשמר ${savedPlace}`;
    renderAmbience();
  }
  let shelfSignature = '';
  function renderBooks(source, items) {
    const books = source?.kind === 'evrit-books' ? items.filter(item => safeURL(item.cover)).slice(0,12) : [];
    const signature = JSON.stringify([source?.id, books]);
    if (signature === shelfSignature) return;
    shelfSignature = signature;
    $('#books').innerHTML = books.map((book, index) => {
      const x = 1026 + (index % 4) * 56, y = 280 + Math.floor(index / 4) * 76;
      return `<g class="scene-book" tabindex="0" role="button" aria-label="${escape(book.title)}" data-book="${escape(book.id)}"><title>${escape(book.title)}${book.author ? ` · ${escape(book.author)}` : ''}</title><rect x="${x-1}" y="${y+1}" width="47" height="66" rx="1" fill="#283b31" opacity=".4"/><image href="${escape(safeURL(book.cover))}" x="${x}" y="${y}" width="45" height="65" preserveAspectRatio="xMidYMid meet"/><rect x="${x}" y="${y}" width="45" height="65" rx="1" fill="none" stroke="#e8dcc0" stroke-opacity=".18"/></g>`;
    }).join('') || `<text x="1131" y="372" text-anchor="middle" font-size="10" fill="#c7cbb0">${source ? 'ממתינים לעטיפות הספרים…' : 'הוספת מקור לספרים חדשים'}</text>`;
    $$('#books [data-book]').forEach(element => {
      element.onclick = event => { event.stopPropagation(); openBook(source, books.find(book => book.id === element.dataset.book)); };
      element.onkeydown = event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); element.dispatchEvent(new MouseEvent('click')); } };
    });
  }
  function timeLabel(iso) { return iso ? new Date(iso).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'}) : 'הרגע'; }
  function wrap(value, length) {
    const words = value.split(/\s+/), lines = [''];
    for (const word of words) {
      if ((lines[lines.length - 1] + ' ' + word).trim().length > length && lines[lines.length - 1]) lines.push('');
      lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + word;
    }
    if (lines.length > 2) lines[1] = lines[1].slice(0, length - 1) + '…';
    return lines.slice(0, 2);
  }
  function renderAmbience() {
    const mode = roomProps.lightMode(config.ambience,systemDark);
    document.body.classList.remove('day', 'dusk', 'night');
    document.body.classList.add(mode);
    $('#ambience-label').textContent = config.ambience === 'auto' ? 'לפי מראה המערכת' : {day:'אור יום',dusk:'דמדומים',night:'לילה'}[mode];
    publishScene();
  }
  async function getJSON(url) {
    if(!isActive())throw new DOMException('Scene is not visible','AbortError');
    const controller=new AbortController();requests.add(controller);
    try {
      const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'לא הצלחנו להתחבר.');
      return data;
    } finally {requests.delete(controller);}
  }
  async function refreshFeed(source,force=false) {
    if(!isActive())return;
    if(!force&&performance.now()-(feedChecked.get(source.id)||-Infinity)<300000)return;
    const existing = feeds[source.id];
    if (source.kind === 'evrit-books' && existing?.items && !existing.stale && Date.parse(existing.nextRefreshAt) > Date.now()) return;
    try {
      const endpoint = source.kind === 'evrit-books' ? '/api/evrit-books' : `/api/${source.kind === 'website' ? 'site' : 'feed'}?url=${encodeURIComponent(source.url)}`;
      const data = staticData?staticData.feed(source):await getJSON(endpoint);
      if (config.sources.some(s => s.id === source.id && s.url === source.url)) {
        feeds[source.id] = data;feedChecked.set(source.id,performance.now());
        if(pendingRead&&source.kind==='evrit-books'){pendingRead=false;readBook();}
        if (source.kind === 'evrit-books' && !data.stale && data.nextRefreshAt) {
          runtime.set('books-midnight',()=>{refreshAll();},Math.max(1000,Date.parse(data.nextRefreshAt)-Date.now()+500));
        }
      }
    } catch (error) {
      if(!isActive()||error.name==='AbortError')return;
      feedChecked.set(source.id,performance.now());
      if (config.sources.some(s => s.id === source.id && s.url === source.url)) feeds[source.id] = {...feeds[source.id], error: error.message};
    }
    render();
    if (drawerMode === 'room' && selectedSource === source.id) renderRoomContent();
    if (drawerMode === 'settings' && settingsTab === 'connections') renderSettings();
  }
  async function refreshWeather(force=false) {
    if(!isActive()||(!force&&weatherCheckedLocation===config.location&&performance.now()-weatherChecked<300000))return;
    const requestedLocation = config.location;
    try {
      const result = staticData?staticData.weather(config.location):await getJSON(`/api/weather?location=${config.location}`);
      if (requestedLocation !== config.location) return;
      weather = result; weatherError = false;weatherChecked=performance.now();weatherCheckedLocation=requestedLocation;
      const current = weather.current;
      const code = current.weather_code;
      const condition = code === 0 ? 'שמיים בהירים' : code <= 3 ? 'מעט עננים' : code < 50 ? 'ערפילי בחוץ' : code < 70 ? 'גשם בחלון' : code < 80 ? 'מעט שלג' : 'ממטרים בחוץ';
      $('#weather-location').textContent = {'tel-aviv':'תל אביב',jerusalem:'ירושלים',london:'לונדון','new-york':'ניו יורק'}[config.location];
      $('#weather-temperature').textContent = `${Math.round(current.temperature_2m)}° ${current.is_day ? '☀' : '☾'}`;
      $('#weather-description').textContent = `${condition}${weather.stale ? ' · עותק שמור' : ''}`;
      $('#weather-symbol').textContent = code >= 50 ? '☂' : current.is_day ? '☀' : '☾';
      $('#rain').setAttribute('opacity', code >= 50 ? '.7' : '0');
      renderAmbience();
    } catch(error) {
      if(!isActive()||error.name==='AbortError')return;
      weatherChecked=performance.now();weatherCheckedLocation=requestedLocation;
      if (requestedLocation !== config.location) return;
      weatherError = true;
      $('#weather-temperature').textContent = 'אין חיבור';
      $('#weather-description').textContent = 'מזג האוויר לא זמין · נסו לרענן';
      $('#weather-symbol').textContent = '◌';
    }
  }
  async function refreshAll(force=false) {
    if(!isActive())return;
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    $('#refresh').textContent = '↻ מתחברים…';
    if(staticData){
      try{
        await staticData.refresh(force);
        if(!publishedConfigLoaded){
          publishedConfigLoaded=true;
          if(needsPublishedDefaults&&JSON.stringify([config.sources,config.officeScreens])===initialConnections){config=validateConfig({...config,sources:staticData.sources,officeScreens:staticData.sources.filter(source=>source.room==='office').slice(0,2).map(source=>source.id)});if(settingsStore.hasSaved)settingsStore.write(config);render();}
        }
      }catch(error){
        refreshing=false;$('#refresh').textContent='↻ ניסיון נוסף לטעינת הנתונים';
        if(error.name!=='AbortError'){toast('הנתונים לא זמינים כרגע. נסו לרענן בעוד רגע.');}
        return;
      }
    }
    await Promise.allSettled([refreshWeather(force), ...config.sources.map(source=>refreshFeed(source,force))]);
    refreshing = false;
    $('#refresh').textContent = staticData?'↻ בדיקת עדכונים':'↻ רענון המקורות';
    if(refreshQueued){refreshQueued=false;refreshAll();}
  }

  // One clock owns movement, taking a real shelf book, reading, and returning it.
  const routine = window.LittleWorldRoutine.create();
  let lastMotion = 0;
  function shelfBooks() { const source=librarySource(); return source?.kind==='evrit-books' ? (feeds[source.id]?.items||[]).filter(book=>safeURL(book.cover)).slice(0,12) : []; }
  function selectRoom(room) {
    selectedRoom = room;
    $$('.room-nav button').forEach(b => { b.classList.toggle('active', b.dataset.room === room); b.setAttribute('aria-pressed', b.dataset.room === room); });
    $$('.room-marker').forEach(g => g.classList.toggle('selected', g.dataset.room === room));
  }
  function goTo(room) {
    config.room=['home','office','library'].includes(room)?room:'home';save();selectRoom(config.room);
    routine.visit(room,reducedMotion.matches);
    renderCharacter();wakeMotion();
  }
  function readBook() {
    if(!shelfBooks().length){pendingRead=true;refreshAll();return;}
    if (!routine.read(shelfBooks(),reducedMotion.matches)) {
      toast(routine.snapshot().emotion ? 'נסיים את הרגע הזה ואז נמשיך.' : shelfBooks().length ? 'כבר בוחרים ספר. נסיים את הפרק ונמשיך.' : 'המדפים עוד נטענים. אפשר לנסות שוב כשהספרים יגיעו.');
      return;
    }
    selectRoom('library');renderCharacter();wakeMotion();
  }
  function selectBook(index){
    if(!routine.selectBook(shelfBooks(),index,reducedMotion.matches))return;
    selectRoom('library');renderCharacter();wakeMotion();
  }
  function walkTo(x,y){routine.walkTo(x,y,reducedMotion.matches);selectRoom('home');renderCharacter();wakeMotion();}
  function expressMood(name='next'){
    if(!routine.express(name,reducedMotion.matches))return;
    renderCharacter();wakeMotion();
  }
  let activitySignature='';
  function renderCharacter() {
    const s=routine.snapshot();
    const title=s.book?.title||'ספר';
    const text=s.emotion?(s.phase==='emotion-recover'?'אוסף כוחות כדי לקום':window.LittleWorldEmotions.moods[s.emotion].activity):{
      'walk-to-emotion':'לוקח רגע לעצמו',
      'walk-to-ladder':'ניגש לסולם הספרייה','climb-up':'מטפס בזהירות אל המדף','climb-down':'יורד מהמדף',
      'walk-to-shelf':'הולך לבחור ספר', 'take-book':`מרים את ״${title}״ מהמדף`, 'shelf-release':'מניח את הספר על המדף', 'choose-book':`לוקח את ״${title}״ מהמדף`,
      'walk-to-chair':`לוקח את ״${title}״ לכורסה`, 'sit-down':'מתיישב בנחת בכורסה',
      reading:`קורא את ״${title}״`, 'stand-up':'מסיים פרק',
      'walk-to-return':`מחזיר את ״${title}״`, 'return-book':'מחזיר את הספר למדף',
      visit:`בדרך ל${s.room==='office'?'משרד':s.room==='library'?'ספרייה':'מרכז החדר'}`, idle:s.room==='office'?'מתעדכן במה שקורה בעולם':'נהנה מרגע שקט'
    }[s.phase];
    if(text!==activitySignature){$('#character-activity').textContent=text;activitySignature=text;}
    // Retain the lightweight SVG fallback if the photographic plate cannot load.
    if(!document.body.classList.contains('photo-clay'))$('#avatar').setAttribute('transform',`translate(${755+(s.x-51)*14} ${573+(s.y-75)*5})`);
    window.dispatchEvent(new CustomEvent('world:character',{detail:{...s,paused,reducedMotion:reducedMotion.matches,active:isActive(),lowPower}}));
  }
  function motionStep(){
    if(!isActive()||paused||reducedMotion.matches||compactEditor||portraitMobile)return;
    const now=performance.now(),dt=lastMotion?(now-lastMotion)/1000:0;lastMotion=now;
    routine.tick(dt,{books:shelfBooks(),wander:config.wander&&!drawerMode&&!interaction});renderCharacter();
    if(routine.snapshot().phase==='idle'&&(!config.wander||drawerMode||interaction))return;
    return routine.nextDelay(lowPower);
  }
  function wakeMotion(){
    lastMotion=performance.now();runtime.remove('motion');
    if(isActive()&&!paused&&!reducedMotion.matches&&!compactEditor&&!portraitMobile)runtime.set('motion',motionStep,0);
  }
  function activityChanged(){
    const active=isActive();
    portraitMotion.setActivity({visible:!document.hidden,portrait:portraitMobile,paused,reducedMotion:reducedMotion.matches,lowPower,editing:!!drawerMode});
    const guide=$('.portrait-guide');if(guide)guide.dataset.moving=String(portraitMotion.active);
    document.body.dataset.runtimeActive=String(active);document.body.dataset.lowPower=String(lowPower);
    document.body.classList.toggle('runtime-suspended',!active);
    runtime.setActive(active);camera.setActive(active&&!paused&&!portraitMobile);
    if(active&&!paused&&!compactEditor&&!portraitMobile&&pendingEnergyMood){const mood=pendingEnergyMood;pendingEnergyMood=null;routine.express(mood,reducedMotion.matches);}
    chairMotion.setActivity({active:active&&!portraitMobile,paused,lowPower,reducedMotion:reducedMotion.matches});
    if(active){tickClock();runtime.set('clock',tickClock,roomProps.clock().delay);}
    if(!active){
      for(const request of requests)request.abort();
      runtime.set('sources',()=>{refreshAll();return 300000;},0);
    }
    wakeMotion();publishScene();renderCharacter();
    window.dispatchEvent(new CustomEvent('world:activity',{detail:{active,paused,lowPower,reducedMotion:reducedMotion.matches}}));
  }
  function setHostState(value){hostActive=!!value.active;lowPower=!!value.lowPower;interaction=!!value.interaction;if(typeof value.systemDark==='boolean')systemDark=value.systemDark;if(value.battery){power=value.battery;updateEnergy();}activityChanged();}
  function setInteraction(value){
    if(nativeManaged){native(value?'enter':'exit');return;}
    interaction=!!value;
    for(const button of [$('#enter-world'),$('#web-enter-focused')]){button.textContent=interaction?'יציאה מהעולם':'כניסה לעולם';button.setAttribute('aria-pressed',String(interaction));}
    activityChanged();
  }
  function setFocusView(value){
    document.body.classList.toggle('world-focus',value);
    $('#wallpaper').textContent=value?'→ חזרה לעמוד':'↗ תצוגת העולם';
    $('#wallpaper').setAttribute('aria-pressed',String(value));
  }
  function setPaused(value,persist=true) {
    paused = !!value;config.paused=paused;
    if(persist)save();
    document.body.classList.toggle('paused', value);
    $('#pause').textContent = value ? '▷' : 'Ⅱ';
    $('#pause').setAttribute('aria-label', value ? 'המשך התנועה' : 'השהיית התנועה');
    $('#pause').title = value ? 'המשך התנועה' : 'השהיית התנועה';
    activityChanged();
  }

  // Panels are an editor for sources and the character, plus a reader for live feeds.
  function openDrawer(mode, title, kicker) {
    if (!drawerMode) returnFocus = document.activeElement;
    drawerMode = mode;
    $('#drawer-title').textContent = title;
    $('#drawer-title').dir = 'auto';
    $('#drawer-kicker').textContent = kicker;
    $('#drawer').hidden = false; $('#backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#close-drawer').focus();
    activityChanged();
  }
  function closeDrawer() {
    $('#drawer').hidden = true; $('#backdrop').hidden = true;
    document.body.style.overflow = '';
    drawerMode = '';
    returnFocus?.focus();activityChanged();
  }
  function openSettings(tab = config.editorTab) {
    settingsTab = tab;if(config.editorTab!==tab){config.editorTab=tab;save();}
    openDrawer('settings', 'העולם שלך', 'עולם שמרגיש כמוך');
    renderSettings();
  }
  function enableCamera(){native('camera',{enabled:true});return camera.enable();}
  function disableCamera(){native('camera',{enabled:false});camera.disable();}
  function updateCameraControls(){
    const state=camera.snapshot();
    if($('#camera-status'))$('#camera-status').textContent=state.label;
    if($('#camera-start'))$('#camera-start').disabled=state.status==='live'||state.status==='requesting';
    if($('#camera-stop'))$('#camera-stop').disabled=!state.intent;
  }
  function screenMap(){
    const layout=window.LittleWorldLayout,{W,H}=layout,view={x:0,y:135,width:850,height:430};
    const wall=layout.wallMonitors.slice(0,SCREEN_COUNT-2),base='<image href="assets/photographic-clay-room-v3.png" width="1672" height="941"/>';
    const outlines=layout.deskForegroundOutlines.map(outline=>`<polygon points="${outline.map(p=>p.join(',')).join(' ')}"/>`).join('');
    const p=layout.windowPatch,patch=wall.length?`<defs><filter id="settings-window-feather"><feGaussianBlur stdDeviation="8"/></filter><mask id="settings-window-patch" maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="941"><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="white" filter="url(#settings-window-feather)"/></mask></defs><image href="assets/office-no-window-v1.png" width="1672" height="941" mask="url(#settings-window-patch)"/>`:'';
    const a=layout.officePicturePatch,artPatch=`<defs><filter id="settings-picture-feather"><feGaussianBlur stdDeviation="6"/></filter><mask id="settings-picture-patch" maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="941"><rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="white" filter="url(#settings-picture-feather)"/></mask></defs><image href="assets/office-no-picture-v1.png" width="1672" height="941" mask="url(#settings-picture-patch)"/>`;
    const rear=wall.map(b=>`<image href="assets/office-wall-monitor-v1.png" x="${b.left/100*W}" y="${b.top/100*H}" width="${b.width/100*W}" height="${b.height/100*H}"/>`).join('');
    const boxes=[...layout.deskMonitors.map(m=>m.bounds),...wall.map(b=>({x:b.left/100*W,y:b.top/100*H,width:b.width/100*W,height:b.height/100*H}))];
    const buttons=boxes.map((b,index)=>`<button class="office-map-screen ${index<2?'desk-screen':''}" data-map-screen="${index}" aria-label="הגדרות ${screenLabel(index)}" aria-pressed="${settingsScreen===index}" title="${screenLabel(index)} · ${escape(config.screenModes[index]==='webcam'?'מצלמה':screenSource(index)?.name||'ללא מקור')}" style="left:${(b.x-view.x)/view.width*100}%;top:${(b.y-view.y)/view.height*100}%;width:${b.width/view.width*100}%;height:${b.height/view.height*100}%"><span>${index+1}</span></button>`).join('');
    return `<div class="office-screen-map" role="group" aria-label="בחירת מסך בתמונת המשרד"><svg class="office-map-background" viewBox="0 135 850 430" aria-hidden="true">${base}${patch}${artPatch}${rear}</svg>${buttons}<svg class="office-map-foreground" viewBox="0 135 850 430" aria-hidden="true"><defs><clipPath id="settings-desk-cases">${outlines}</clipPath></defs><g clip-path="url(#settings-desk-cases)">${base}</g></svg></div>`;
  }
  function screenControls() {
    const sources=config.sources.filter(source=>source.room==='office');
    const index=settingsScreen=Math.max(0,Math.min(SCREEN_COUNT-1,settingsScreen||0)),selected=config.screenModes[index]==='webcam',source=screenSource(index);
    return `<div class="office-screen-settings"><h3>המסכים במשרד</h3><p class="note">לחצו על מסך בתמונה כדי לבחור את התוכן שלו.</p>${screenMap()}<section class="screen-config" aria-label="${screenLabel(index)}"><h4>${screenLabel(index)}</h4><label class="field">מקור התוכן למסך ${index+1}<select data-screen-index="${index}"><option value="">ללא מקור תוכן</option><option value="__webcam__" ${selected?'selected':''}>${nativeManaged?'מצלמת ה־Mac':'מצלמת המכשיר'}</option>${sources.map(item=>`<option value="${escape(item.id)}" ${!selected&&config.officeScreens[index]===item.id?'selected':''}>${escape(item.name)}</option>`).join('')}</select></label><div class="screen-config-actions"><button class="secondary" id="screen-add-feed">הוספת RSS למסך ${index+1}</button>${source&&!selected?'<button class="secondary" id="screen-edit-feed">עריכת המקור</button>':''}</div>${selected?`<div class="camera-settings"><p id="camera-status" role="status">${escape(camera.snapshot().label)}</p><div class="form-row"><button class="secondary" id="camera-start">הפעלת המצלמה</button><button class="secondary" id="camera-stop">כיבוי המצלמה</button></div><p class="note">הווידאו נשאר במכשיר. ללא מיקרופון, הקלטה או העלאה לרשת. המסכים יכולים לשתף מצלמה אחת. אחרי רענון צריך להפעיל אותה שוב.</p></div>`:''}</section></div>`;
  }
  function renderSettings() {
    const controls=browserApp?`<div class="editor-world-controls" role="group" aria-label="פעולות בעולם"><button class="secondary" id="editor-pause">${paused?'המשך':'השהיה'}</button><button class="secondary" id="editor-interaction">${interaction?'יציאה מהעולם':'כניסה לעולם'}</button><button class="secondary" id="editor-read">קריאת ספר</button><button class="secondary" id="editor-office">המשרד</button><button class="secondary" id="editor-library">הספרייה</button><button class="secondary" id="editor-refresh">בדיקת עדכונים</button><button class="secondary" id="editor-fullscreen">מסך מלא</button></div>`:'';
    const tabs = controls+`<div class="drawer-tabs"><button data-tab="connections" class="${settingsTab === 'connections' ? 'active' : ''}">חיבורים</button><button data-tab="character" class="${settingsTab === 'character' ? 'active' : ''}">הדמות</button><button data-tab="world" class="${settingsTab === 'world' ? 'active' : ''}">העולם</button></div>`;
    if (settingsTab === 'connections') {
      $('#drawer-content').innerHTML = tabs + `<p>הכניסו תוכן מתעדכן לחדרים: עדכוני RSS, תוכן מאתרים או מצלמה חיה במסכי המשרד.</p>${screenControls()}<div id="source-list">${config.sources.map(s => `<article class="source-item"><div class="source-item-head"><h3 dir="auto">${escape(s.name)}</h3><span class="status">${status(s)}</span></div><div class="source-url">${escape(s.url)}</div><div class="source-meta">${escape(sourcePlace(s))} · ${sourceKind(s)}</div><div class="source-actions"><button data-edit="${escape(s.id)}">עריכת החיבור</button><button data-view="${escape(s.id)}">פתיחת התוכן ↗</button><button class="danger" data-remove="${escape(s.id)}" aria-label="הסרה ${escape(s.name)}">הסרה</button></div></article>`).join('') || '<div class="empty">החדרים מחכים.<br>אפשר להוסיף כאן את האתר הראשון.</div>'}</div><button class="primary full" id="add-source">＋ הוספת אתר</button><p class="note">עד 20 חיבורים. השינויים נשמרים אוטומטית ${savedPlace}. ${staticData?'האתר בודק נתונים חדשים כל 5 דקות. המקורות מתעדכנים כשמתפרסמת גרסה חדשה של הנתונים.':'העדכונים והאתרים במשרד מתרעננים כל 5 דקות.'} מדפי הספרים החדשים בעברית מתעדכנים מדי יום בחצות, שעון ישראל. אתרים הדורשים התחברות או JavaScript זקוקים לחיבור ייעודי.</p><div class="divider"></div><label class="field">מזג האוויר<select id="location"><option value="tel-aviv">תל אביב</option><option value="jerusalem">ירושלים</option><option value="london">לונדון</option><option value="new-york">ניו יורק</option></select><small>נתוני מזג האוויר מגיעים מ־Open-Meteo לפי העיר שבחרתם. המיקום שלכם לא נאסף.</small></label><p class="note"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">נתוני מזג אוויר: Open-Meteo ↗</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>`;
      $$('[data-map-screen]').forEach(button=>button.onclick=()=>{settingsScreen=Number(button.dataset.mapScreen);config.editorScreen=settingsScreen;save();renderSettings();});
      $('#screen-add-feed').onclick=()=>editSource(null,settingsScreen);
      if($('#screen-edit-feed'))$('#screen-edit-feed').onclick=()=>editSource(screenSource(settingsScreen).id,settingsScreen);
      $$('[data-screen-index]').forEach(select => select.onchange = () => {
        const index=Number(select.dataset.screenIndex),webcam=select.value==='__webcam__';
        config.screenModes[index]=webcam?'webcam':'source';
        if(!webcam)config.officeScreens[index]=select.value||null;
        save();renderSettings();if(webcam)enableCamera();
      });
      if($('#camera-start'))$('#camera-start').onclick=()=>enableCamera();
      if($('#camera-stop'))$('#camera-stop').onclick=()=>disableCamera();
      updateCameraControls();
      $('#location').value = config.location;
      $('#location').onchange = event => {
        config.location = event.target.value; weather = null; save();
        $('#weather-location').textContent = $('#location').selectedOptions[0].textContent.toUpperCase();
        $('#weather-temperature').textContent = 'מתחברים…';
        $('#weather-description').textContent = 'מעדכנים את הנוף בחלון';
        refreshWeather();
      };
      $('#add-source').disabled = config.sources.length >= 20;
      $('#add-source').onclick = () => editSource();
      $$('[data-edit]').forEach(b => b.onclick = () => editSource(b.dataset.edit));
      $$('[data-view]').forEach(b => b.onclick = () => openRoom(config.sources.find(s => s.id === b.dataset.view).room, b.dataset.view));
      $$('[data-remove]').forEach(b => b.onclick = () => {
        config.sources = config.sources.filter(s => s.id !== b.dataset.remove);
        delete feeds[b.dataset.remove]; save(); renderSettings(); toast('החיבור הוסר.');
      });
    } else if(settingsTab==='character') {
      $('#drawer-content').innerHTML = tabs + `<p>הדמות הקטנה שלך. תנו לה שם ואפשרו לה להרגיש בבית.</p><label class="field">שם הדמות<input id="name" maxlength="30" value="${escape(config.name)}" autocomplete="off" dir="auto"></label><label class="toggle-row"><input id="wander" type="checkbox" ${config.wander ? 'checked' : ''}> לשוטט, לקרוא וליהנות מרגעים קטנים</label><p class="note">אפשר תמיד לבחור לאן ללכת. התנועה מותאמת גם להגדרת הפחתת התנועה במכשיר.</p><div class="divider"></div><h3>קצת זמן לעצמך</h3><button class="primary full" id="read-a-book">בחירת ספר וקריאה</button><div class="form-row"><button class="secondary" id="visit-office">ביקור במשרד</button><button class="secondary" id="visit-library">ביקור בספרייה</button></div><div class="divider"></div><h3>עולם של רגשות</h3><label class="field">בחירת מצב רוח<select id="emotion-preview"><option value="next">תפתיעו אותי</option>${Object.entries(window.LittleWorldEmotions.moods).map(([id,mood])=>`<option value="${id}">${mood.label}</option>`).join('')}</select></label><button class="secondary full" id="try-emotion">הצגת מצב הרוח</button><p class="note">מדי פעם הדמות מביעה רגשות בין הפעילויות, אחרי החזרת הספר למדף. התנועה נעצרת בהשהיה או כשהעולם מוסתר.</p><div class="divider"></div><p class="note">מהדורת פלסטלינה · הדמות שלך, בעבודת יד.</p>`;
      $('#name').oninput = event => { config.name = event.target.value.trim() || 'אני'; save(); };
      $('#wander').onchange = event => { config.wander = event.target.checked; save();wakeMotion(); };
      $('#emotion-preview').value=config.emotionPreview;
      $('#emotion-preview').onchange=event=>{config.emotionPreview=event.target.value;save();};
      $('#try-emotion').onclick = () => { const mood=$('#emotion-preview').value;config.emotionPreview=mood;save();closeDrawer();expressMood(mood); };
      $('#read-a-book').onclick = () => { closeDrawer(); readBook(); };
      $('#visit-office').onclick = () => { closeDrawer(); goTo('office'); };
      $('#visit-library').onclick = () => { closeDrawer(); goTo('library'); };
    } else {
      $('#drawer-content').innerHTML=tabs+`<label class="field">תאורה<select id="world-light"><option value="auto">לפי מראה המערכת</option><option value="day">יום</option><option value="dusk">דמדומים</option><option value="night">לילה חשוך · מנורה ואור ירח</option></select></label><div class="divider"></div><h3>תמונה על הקיר בספרייה</h3><button class="photo-drop-zone" id="edit-wall-photo">${config.framePhoto?`<img src="${config.framePhoto}" alt="התמונה ששמרת במסגרת">`:''}<span>גררו לכאן תמונה או לחצו לבחירה</span><small>JPG, PNG או WebP · נשמרת ${savedPlace}</small></button>${config.framePhoto?'<button class="secondary" id="clear-wall-photo">הסרת התמונה מהמסגרת</button>':''}<div class="divider"></div><h3>עולם שמרגיש את הסוללה שלך</h3><p id="energy-label">${escape(energy.label)}</p><label class="toggle-row"><input type="checkbox" id="battery-reactions" ${config.batteryReactions?'checked':''}> הדמות מגיבה לסוללה חלשה ולטעינה</label><p class="note">הצמחים מתחילים להתכופף ב־35%, נובלים ב־20% וכמעט מאבדים את כל העלים ב־10%. חיבור לחשמל מחזיר אותם לחיים.</p><label class="field">הדמיית מצב סוללה<select id="battery-preview"><option value="actual">סוללת ${nativeManaged?'ה־Mac':'המכשיר'}</option><option value="35">35% · צמחים כפופים</option><option value="15">15% · צמחים נבולים</option><option value="5">5% · כמעט בלי עלים</option><option value="charging">מחובר לחשמל · מתאוששים</option></select></label><p class="note">ההדמיה משפיעה רק על העולם הזה. בחרו בסוללת המכשיר כדי לחזור למצב האמיתי.</p>`;
      $('#world-light').value=config.ambience;
      $('#world-light').onchange=event=>{config.ambience=event.target.value;save();};
      $('#battery-preview').value=config.batteryPreview||'actual';
      $('#battery-preview').onchange=event=>{config.batteryPreview=event.target.value;save();activityChanged();renderSettings();};
      $('#battery-reactions').onchange=event=>{config.batteryReactions=event.target.checked;if(!config.batteryReactions)pendingEnergyMood=null;save();};
      $('#edit-wall-photo').onclick=()=>choosePhoto();
      for(const type of ['dragenter','dragover'])$('#edit-wall-photo').addEventListener(type,event=>{event.preventDefault();event.currentTarget.classList.add('dragging');});
      $('#edit-wall-photo').addEventListener('dragleave',event=>event.currentTarget.classList.remove('dragging'));
      $('#edit-wall-photo').addEventListener('drop',event=>{event.preventDefault();event.currentTarget.classList.remove('dragging');importPhoto(event.dataTransfer.files[0]);});
      if($('#clear-wall-photo'))$('#clear-wall-photo').onclick=()=>{config.framePhoto='';save();renderSettings();};
    }
    if(staticData&&settingsTab==='connections'){const note=document.createElement('p');note.className='note';note.textContent='האתר מציג נתונים שפורסמו מראש. מקור חדש צריך להתווסף לקטלוג המקורות באתר. רענון בודק אם פורסמו נתונים חדשים.';$('#drawer-content').prepend(note);}
    if(browserApp){
      $('#editor-pause').onclick=()=>{setPaused(!paused);renderSettings();};
      $('#editor-interaction').onclick=()=>{setInteraction(!interaction);closeDrawer();};
      $('#editor-read').onclick=()=>{closeDrawer();readBook();};
      $('#editor-office').onclick=()=>{closeDrawer();goTo('office');};
      $('#editor-library').onclick=()=>{closeDrawer();goTo('library');};
      $('#editor-refresh').onclick=()=>refreshAll(true);
      if($('#editor-fullscreen'))$('#editor-fullscreen').onclick=()=>{closeDrawer();$('#web-fullscreen').click();};
    }
    $$('[data-tab]').forEach(b => b.onclick = () => { settingsTab = b.dataset.tab;config.editorTab=settingsTab;save(); renderSettings(); });
  }
  function choosePhoto(){
    if(nativeManaged){native('choosePhoto');return;}
    const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.onchange=()=>importPhoto(input.files[0]);input.click();
  }
  function editSource(id, targetScreen = null) {
    const existing = config.sources.find(s => s.id === id);
    drawerMode = 'form';
    $('#drawer-title').textContent = existing ? 'עריכת החיבור' : 'משהו חדש בעולם';
    $('#drawer-content').innerHTML = `<button class="secondary" id="back-settings">→ חזרה לחיבורים</button><p>${existing ? 'אפשר לשנות את החיבור או להעביר אותו לחדר אחר.' : 'בחרו אתר שאוהבים ותנו לו מקום בעולם.'}</p><form id="source-form"><label class="field">שם<input name="name" maxlength="45" required placeholder="הפינה האהובה עליי ברשת" value="${escape(existing?.name || '')}" dir="auto"></label><label class="field">סוג החיבור<select name="kind"><option value="feed">כותרות מתעדכנות · RSS או Atom</option><option value="website">אתר חי · זיהוי תוכן</option><option value="evrit-books">עברית · ספרים חדשים מדי יום</option></select></label><label class="field"><span id="url-label">כתובת עדכוני RSS או Atom</span><input name="url" type="url" required placeholder="https://example.com/feed.xml" value="${escape(existing?.url || '')}"><small id="url-help">הזינו כתובת ישירה של ערוץ העדכונים. הכותרות החדשות יופיעו בחדר.</small></label><label class="field">חדר<select name="room"><option value="office">המשרד · ${SCREEN_COUNT} מסכים</option><option value="library">הספרייה · מדפי ספרים</option></select><small>בחרו מסך במשרד או מקמו את החיבור בספרייה.</small></label><label class="field" id="screen-field">מסך במשרד<select name="screen"><option value="">חיבור לחדר בלבד</option>${SCREEN_INDICES.map(index=>`<option value="${index}">${screenLabel(index)}</option>`).join('')}</select></label><p class="form-error" id="form-error" role="alert" hidden></p><button class="primary full" type="submit">${existing ? 'שמירת החיבור' : 'הוספה לעולם שלי'} ↗</button></form>`;
    $('#back-settings').onclick = () => openSettings('connections');
    if(staticData){const label=document.createElement('label');label.className='field';label.textContent='מקור מהקטלוג';const select=document.createElement('select');select.id='published-connection';select.innerHTML='<option value="">בחירת מקור מהקטלוג</option>'+staticData.sources.map(source=>`<option value="${escape(source.id)}">${escape(source.name)}</option>`).join('');label.append(select);$('#source-form').prepend(label);select.onchange=()=>{const source=staticData.sources.find(source=>source.id===select.value);if(!source)return;form.elements.name.value=source.name;form.elements.kind.value=source.kind;form.elements.url.value=source.url;form.elements.room.value=source.room;updatePlacement();updateKind();};}
    const form = $('#source-form');
    form.elements.kind.value = existing?.kind || 'feed';
    form.elements.room.value = targetScreen!==null?'office':existing?.room || (selectedRoom === 'library' ? 'library' : 'office');
    const currentScreen = targetScreen!==null?targetScreen:existing ? config.officeScreens.findIndex((id,i)=>id===existing.id&&config.screenModes[i]!=='webcam') : config.officeScreens.findIndex((id,i)=>!id&&config.screenModes[i]!=='webcam');
    form.elements.screen.value = currentScreen >= 0 ? String(currentScreen) : '';
    function updatePlacement() { $('#screen-field').hidden = form.elements.room.value !== 'office'; }
    form.elements.room.onchange = updatePlacement;
    updatePlacement();
    function updateKind() {
      const dailyBooks = form.elements.kind.value === 'evrit-books';
      form.elements.url.readOnly = dailyBooks;
      if (dailyBooks) form.elements.url.value = 'https://www.e-vrit.co.il/';
      const link = form.elements.kind.value === 'website' || dailyBooks;
      $('#url-label').textContent = link ? 'כתובת האתר' : 'כתובת עדכוני RSS או Atom';
      $('#url-help').textContent = link ? 'נזהה ערוץ RSS או נציג כותרות ציבוריות מהאתר. התוכן מתעדכן כל 5 דקות. אתרים הדורשים התחברות עדיין לא נתמכים.' : 'הזינו כתובת ישירה של ערוץ העדכונים. הכותרות החדשות יופיעו בחדר.';
      form.elements.url.placeholder = link ? 'https://example.com' : 'https://example.com/feed.xml';
      if (dailyBooks) {
        $('#url-label').textContent = 'עמוד הבית של עברית · ספרים חדשים';
        $('#url-help').textContent = 'מציג את 12 הספרים הראשונים באוסף הספרים החדשים בעמוד הבית של עברית, עם העטיפות המקוריות. מתעדכן פעם ביום.';
      }
      if(staticData)$('#url-help').textContent='בחרו מקור מהקטלוג. כדי להוסיף כתובת חדשה, צריך קודם לפרסם אותה בקטלוג המקורות.';
    }
    form.elements.kind.onchange = () => {
      if (form.elements.kind.value === 'evrit-books') { form.elements.room.value = 'library'; updatePlacement(); }
      updateKind();
    }; updateKind();
    form.onsubmit = event => {
      event.preventDefault();
      const name = form.elements.name.value.trim(), url = safeURL(form.elements.url.value.trim());
      if (!name || !url) { $('#form-error').hidden = false; $('#form-error').textContent = 'הזינו שם וכתובת ציבורית תקינה שמתחילה ב־http או https.'; return; }
      const source = {id: existing?.id || crypto.randomUUID(), name, url, room: form.elements.room.value, kind: form.elements.kind.value};
      if(staticData&&!staticData.published(source)){$('#form-error').hidden=false;$('#form-error').textContent='בחרו מקור קיים, או הוסיפו את הכתובת לקטלוג המקורות ופרסמו נתונים מעודכנים.';return;}
      if (existing) config.sources = config.sources.map(s => s.id === existing.id ? source : s);
      else config.sources.push(source);
      config.officeScreens = config.officeScreens.map(id => id === source.id ? null : id);
      if (source.room === 'office' && form.elements.screen.value !== '') {const index=Number(form.elements.screen.value);config.officeScreens[index]=source.id;config.screenModes[index]='source';}
      delete feeds[source.id];feedChecked.delete(source.id); save(); openSettings();
      refreshFeed(source);
      toast(existing ? 'החיבור עודכן.' : 'חיבור חדש. עוד משהו משלך.');
    };
    form.elements.name.focus();
  }
  function openRoom(room, sourceId) {
    goTo(room);
    selectedSource = sourceId || (room === 'library' ? librarySource() : screenSource(0) || screenSource(1))?.id || config.sources.find(s => s.room === room)?.id;
    openDrawer('room', room === 'office' ? 'המשרד' : 'הספרייה', room === 'office' ? 'החלון שלך לעולם' : 'מקום קטן לסקרנות');
    renderRoomContent();
  }
  function renderRoomContent() {
    const roomSources = config.sources.filter(s => s.room === selectedRoom);
    let source = roomSources.find(s => s.id === selectedSource) || roomSources[0];
    selectedSource = source?.id;
    const tabs = roomSources.length > 1 ? `<div class="source-picker">${roomSources.map(s => `<button data-pick="${escape(s.id)}" class="${s.id === source.id ? 'active' : ''}">${escape(s.name)}</button>`).join('')}</div>` : '';
    const data = source && feeds[source.id];
    $('#drawer-content').innerHTML = !source ? `<div class="empty">עדיין אין כאן חיבורים.<br>אפשר לפנות מקום לאתר האהוב עליך.</div><button class="primary full" id="room-add">＋ הוספת אתר</button>`
      : tabs + `<article class="source-item"><div class="source-item-head"><h3 dir="auto">${escape(source.name)}</h3><span class="status">${status(source)}</span></div><div class="source-url">${escape(source.url)}</div></article>` + `<p class="note">${data?.items ? `עודכן ב־${escape(timeLabel(data.updatedAt))} · ${data.stale || data.error ? 'מציגים תוכן שמור. המקור לא זמין כרגע.' : 'בדיקת עדכונים כל 5 דקות.'}` : 'טוענים תוכן מתעדכן מהמקור…'}</p>${data?.discoveredFeed ? `<p class="note">ערוץ RSS שזוהה: ${escape(data.discoveredFeed)}</p>` : data?.adapter === 'website' ? `<p class="note">כותרות ציבוריות מתוך ${escape(data.pageTitle || source.name)}. התוכן מוצג כפי שנאסף מהעמוד, ולא בהכרח כולל תאריך פרסום.</p>` : ''}${data?.error && !data.items ? `<p class="form-error">לא הצלחנו לטעון את המקור. נסו שוב בעוד רגע.</p><button class="secondary" id="retry-feed">↻ ניסיון נוסף</button>` : ''}<ul class="feed-list">${(data?.items || []).map(item => `<li>${safeURL(item.url) ? `<a href="${escape(safeURL(item.url))}" target="_blank" rel="noopener noreferrer" dir="auto">${escape(item.title)} ↗</a>` : `<span dir="auto">${escape(item.title)}</span>`}${item.date && !isNaN(Date.parse(item.date)) ? `<small>${escape(new Date(item.date).toLocaleDateString('he-IL', {month:'short',day:'numeric'}))}</small>` : ''}</li>`).join('')}</ul><div class="divider"></div><button class="secondary" id="room-edit">ניהול החיבור</button>`;
    if (source?.kind === 'evrit-books') {
      $('#drawer-content').innerHTML = tabs + `<article class="source-item"><div class="source-item-head"><h3 dir="auto">${escape(source.name)}</h3><span class="status">${status(source)}</span></div><p class="note">${data?.items ? `נטען ב־${escape(new Date(data.updatedAt).toLocaleString('he-IL'))} · ${data.stale || data.error ? 'מציגים את המדף השמור. ננסה לעדכן כשהחיבור יחזור.' : 'מתעדכן מדי יום בחצות, שעון ישראל.'}` : 'טוענים את אוסף הספרים החדשים מעמוד הבית…'}</p></article><p>העטיפות המקוריות מאוסף הספרים החדשים באתר עברית, לפי הסדר באתר.</p>${data?.error && !data.items ? `<p class="form-error">לא הצלחנו לטעון את המקור. נסו שוב בעוד רגע.</p><button class="secondary" id="retry-feed">↻ ניסיון נוסף</button>` : ''}<div class="book-grid">${(data?.items || []).map(book => `<button class="book-card" data-read-book="${escape(book.id)}"><img src="${escape(safeURL(book.cover) || '')}" alt="${escape(book.title)}" loading="lazy" referrerpolicy="no-referrer"><strong dir="auto">${escape(book.title)}</strong><span dir="auto">${escape(book.author || '')}</span></button>`).join('')}</div>${data?.sourceURL ? `<a class="secondary collection-link" href="${escape(safeURL(data.sourceURL))}" target="_blank" rel="noopener noreferrer">ספרים חדשים בעברית ↗</a>` : ''}<div class="divider"></div><button class="secondary" id="room-edit">ניהול החיבור</button>`;
      $$('[data-read-book]').forEach(button => button.onclick = () => openBook(source, data.items.find(book => book.id === button.dataset.readBook)));
    }
    $$('[data-pick]').forEach(b => b.onclick = () => { selectedSource = b.dataset.pick; renderRoomContent(); });
    if ($('#room-edit')) $('#room-edit').onclick = () => editSource(source.id);
    if ($('#room-add')) $('#room-add').onclick = () => editSource();
    if ($('#retry-feed')) $('#retry-feed').onclick = () => { $('#retry-feed').disabled = true; refreshFeed(source); };
  }

  function openBook(source, book, move = true) {
    if (!book) return;
    if (move) goTo(source.room);
    selectedSource = source.id;
    openDrawer('book', book.title, 'חדש על המדף · עברית');
    $('#drawer-content').innerHTML = `<button class="secondary" id="back-to-books">→ לכל הספרים החדשים</button><div class="book-detail"><img src="${escape(safeURL(book.cover) || '')}" alt="${escape(book.title)}" referrerpolicy="no-referrer"><p dir="auto">${escape(book.author || '')}</p></div><a class="primary full" style="text-decoration:none" href="${escape(safeURL(book.url))}" target="_blank" rel="noopener noreferrer">לעמוד הספר באתר עברית ↗</a><p class="note">מתוך אוסף הספרים החדשים באתר עברית. המדפים מתעדכנים מדי יום. הקישור פותח את עמוד הספר המקורי.</p>`;
    $('#back-to-books').onclick = () => openRoom(source.room, source.id);
  }

  $('#manage').onclick = () => openSettings();
  $('#world-editor-launcher').onclick=()=>nativeManaged?native('edit'):openSettings();
  $('#close-drawer').onclick = () => compactEditor?native('closeEditor'):closeDrawer();
  $('#backdrop').onclick = closeDrawer;
  $('#office-card').onclick = () => openRoom('office');
  $('#library-card').onclick = () => openRoom('library');
  for (const index of [0,1]) $(`#office-object${index ? '-2' : ''}`).onclick = () => {
    const source = screenSource(index);
    if (source) openRoom('office', source.id); else { openSettings(); toast(`בחרו מקור למסך ${index + 1} במשרד.`); }
  };
  $('#library-shelf-control').onclick = () => openRoom('library');
  $$('[data-room]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.room)));
  $$('.scene-object,.room-marker').forEach(g => g.addEventListener('keydown', event => {
    if (['Enter',' '].includes(event.key)) { event.preventDefault(); g.dispatchEvent(new MouseEvent('click')); }
  }));
  $('#pause').onclick = () => setPaused(!paused);
  $('#refresh').onclick = () => refreshAll(true);
  $('#ambience').onclick = () => {
    const choices = ['auto','day','dusk','night'];
    config.ambience = choices[(choices.indexOf(config.ambience) + 1) % choices.length]; save();
  };
  $('#wallpaper').onclick = () => {
    if (window.webkit?.messageHandlers?.world) native('wallpaper');
    else setFocusView(!document.body.classList.contains('world-focus'));
  };
  document.addEventListener('keydown', event => {
    if(event.key==='Escape'&&!drawerMode){if(interaction)setInteraction(false);return;}
    if (!drawerMode) return;
    if (event.key === 'Escape') { if(compactEditor){native('closeEditor');return;}closeDrawer(); }
    if (event.key === 'Tab') {
      const items = $$('#drawer button,#drawer input,#drawer select,#drawer a').filter(el => !el.disabled && el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  addEventListener('storage', event => {
    if (event.key === KEY && event.newValue) {
      try { config = validateConfig(JSON.parse(event.newValue));camera.setModes(config.screenModes.slice(0,SCREEN_COUNT));updateEnergy();setPaused(config.paused,false);selectRoom(config.room);render();if(drawerMode==='settings')renderSettings();refreshAll(); }
      catch { /* Ignore incomplete external edits. */ }
    }
  });
  function tickClock() {
    const date = new Date();
    const wall=roomProps.clock(date);
    $('#clock').textContent = date.toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'});
    $('#wall-clock-digital').textContent=wall.text;
    window.dispatchEvent(new CustomEvent('world:clock',{detail:wall}));
    renderAmbience();
    return wall.delay;
  }
  // The native app persists this separately because its local server port changes on launch.
  window.worldApp = {
    setPaused,setHostState,isActive,getSceneState:sceneState,getClockState:()=>roomProps.clock(),
    getCharacterState:() => ({...routine.snapshot(),paused,reducedMotion:reducedMotion.matches,active:isActive(),lowPower}),
    setScreenHotspots:(screens,viewport)=>native('screenTargets',{screens,viewport}),
    openDesktopScreen:index=>native('openScreenTarget',{index}),
    editScreen:index=>{settingsScreen=index;config.editorScreen=index;save();openSettings('connections');},
    readBook,expressMood,setCameraEnabled:value=>value?camera.enable():camera.disable(),
    selectBook,walkTo,importPhoto,setPhoto,choosePhoto,
    enterWorld:()=>setInteraction(true),leaveWorld:()=>setInteraction(false),
    editWorld:()=>nativeManaged?native('edit'):openSettings('world'),
    command(name){
      if(name==='read')readBook();
      if(name==='office'||name==='library')goTo(name);
      if(name==='light'){const choices=['auto','day','dusk','night'];config.ambience=choices[(choices.indexOf(config.ambience)+1)%choices.length];save();}
    },
    coverURL:url=>nativeManaged?`/api/cover?url=${encodeURIComponent(url)}`:safeURL(url)||'',
    openReadingBook() { const source=librarySource(), book=routine.snapshot().book; if(source&&book)openBook(source,book,false); },
    openScreen(index) { if(config.screenModes[index]==='webcam'){if(camera.snapshot().status==='live')openSettings('connections');else enableCamera();return;} const source = screenSource(index); if (source) openRoom('office',source.id); else editSource(null,index); },
    openLibrary:() => openRoom('library'),
    openBookAt(index) { const source=librarySource(), book=shelfBooks()[index]; if (book) openBook(source,book); },
    visitRoom:goTo,
    restoreNative(value) {
    try { const previousRoom=selectedRoom;config = validateConfig(JSON.parse(value));settingsScreen=config.editorScreen;settingsTab=config.editorTab;camera.setModes(config.screenModes.slice(0,SCREEN_COUNT));updateEnergy();settingsStore.write(config);selectRoom(config.room);if(previousRoom!==config.room)routine.visit(config.room,true);render();setPaused(config.paused,false);if(compactEditor)openSettings(settingsTab||'world');refreshAll(); }
    catch { /* Keep the current usable setup. */ }
  }};
  camera.setModes(config.screenModes.slice(0,SCREEN_COUNT));selectRoom(config.room);
  if(config.room!=='home')routine.visit(config.room,true);
  render();tickClock();setPaused(config.paused,false);
  if(browserApp){
    $('#enter-world').hidden=false;$('#enter-world').onclick=()=>setInteraction(!interaction);
    $('#web-enter-focused').hidden=false;$('#web-enter-focused').onclick=()=>setInteraction(!interaction);
    $('#web-read').hidden=false;$('#web-read').onclick=()=>readBook();
    setFocusView(true);setInteraction(true);
    const full=$('#web-fullscreen'),expand=$('#world-expand-launcher');
    const standalone=matchMedia('(display-mode: standalone)'),fullDisplay=matchMedia('(display-mode: fullscreen)');
    const installed=()=>standalone.matches||fullDisplay.matches||navigator.standalone===true;
    const canExpand=!!document.fullscreenEnabled&&!!document.documentElement.requestFullscreen;
    const updateFullscreen=()=>{
      const active=!!document.fullscreenElement;
      full.hidden=false;full.textContent=active?'יציאה ממסך מלא':'מסך מלא';
      expand.hidden=installed()&&!active;
      expand.setAttribute('aria-label',active?'יציאה ממסך מלא':'כניסה למסך מלא');
      expand.title=active?'יציאה ממסך מלא':'כניסה למסך מלא';
    };
    const toggleFullscreen=async()=>{
      if(!document.fullscreenElement&&!canExpand){toast('לתצוגה בלי סרגלי הדפדפן: שיתוף ← הוספה למסך הבית, ואז פתחו את עולם קטן מהסמל שלו.');return;}
      try{if(document.fullscreenElement)await document.exitFullscreen();else{setFocusView(true);await document.documentElement.requestFullscreen({navigationUI:'hide'});}}
      catch{toast('מסך מלא לא זמין כאן. הוסיפו את עולם קטן למסך הבית ופתחו אותו משם כדי להסתיר את סרגלי הדפדפן.');}
    };
    full.onclick=toggleFullscreen;expand.onclick=toggleFullscreen;
    document.addEventListener('fullscreenchange',updateFullscreen);
    standalone.addEventListener('change',updateFullscreen);fullDisplay.addEventListener('change',updateFullscreen);updateFullscreen();
    window.LittleWorldBrowser.observeBattery(navigator,value=>{power=value;updateEnergy();activityChanged();});
  }
  if(compactEditor)openSettings('world');
  runtime.set('sources',()=>{refreshAll();return 300000;});
  runtime.set('clock',tickClock,roomProps.clock().delay);
  runtime.set('headlines',()=>{if(!paused){headlineIndex++;render();}return 12000;},12000);
  let ambientFrame=0;
  runtime.set('ambient',()=>{
    if(!paused&&!reducedMotion.matches&&!lowPower&&!portraitMobile)window.dispatchEvent(new CustomEvent('world:ambient',{detail:++ambientFrame}));
    return lowPower?30000:3000;
  },3000);
  reducedMotion.addEventListener('change',activityChanged);
  portraitQuery.addEventListener('change',()=>{portraitMobile=browserApp&&portraitQuery.matches;document.body.classList.toggle('portrait-mobile',portraitMobile);activityChanged();});
  darkAppearance.addEventListener('change',event=>{if(!nativeManaged){systemDark=event.matches;activityChanged();}});
  document.addEventListener('visibilitychange',activityChanged);
  addEventListener('pagehide',()=>{camera.dispose();portraitMotion.dispose();});
  activityChanged();
})();
