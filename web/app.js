/* Little World POC. Scene + local configuration; no framework or build step. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const {KEY,SHIRTS,DEFAULT,safeURL,validateConfig,createStore}=window.LittleWorldSettings;
  const settingsStore=createStore();
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let config=settingsStore.read();
  let feeds = {}, weather = null, weatherError = false, selectedRoom = config.room, selectedSource = null, headlineIndex = 0;
  let drawerMode = '', settingsTab = config.editorTab, paused = config.paused, refreshing = false, refreshQueued = false, toastTimer, returnFocus;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const darkAppearance=matchMedia('(prefers-color-scheme: dark)');
  let systemDark=darkAppearance.matches;
  const wallpaperMode = new URLSearchParams(location.search).has('wallpaper');
  const compactEditor = new URLSearchParams(location.search).has('edit');
  document.body.classList.toggle('compact-editor',compactEditor);
  const nativeManaged=!!window.webkit?.messageHandlers?.world;
  const browserApp=!nativeManaged&&!compactEditor;
  document.body.classList.toggle('browser-app',browserApp);
  const portraitQuery=matchMedia('(max-width: 767px) and (orientation: portrait)');
  let portraitMobile=browserApp&&portraitQuery.matches;
  document.body.classList.toggle('portrait-mobile',portraitMobile);
  const savedPlace=nativeManaged?'on this Mac':'in this browser';
  let hostActive=!nativeManaged,lowPower=false;
  let interaction=false,power={level:null,charging:true,hasBattery:false,...(!nativeManaged?{available:false}:{})},energy=window.LittleWorldEnergy.state(power,config.batteryPreview),pendingEnergyMood=null,pendingRead=false;
  const runtime=window.LittleWorldRuntime.create();
  const staticData=browserApp?window.LittleWorldStatic.create({load:()=>getJSON('data/world.json')}):null;
  let publishedConfigLoaded=false;
  const needsPublishedDefaults=!settingsStore.hasSaved,initialConnections=JSON.stringify([config.sources,config.officeScreens]);
  const roomProps=window.LittleWorldRoomProps;
  const chairMotion=roomProps.createChair({runtime,emit:frame=>window.dispatchEvent(new CustomEvent('world:chair',{detail:{frame}}))});
  const requests=new Set(),feedChecked=new Map();let weatherChecked=-Infinity,weatherCheckedLocation='';
  function isActive(){return nativeManaged?hostActive:!document.hidden&&(!portraitMobile||!!drawerMode);}

  document.body.classList.toggle('wallpaper-mode', wallpaperMode);
  $$('#world path,#world rect,#world circle,#world ellipse,#world image,#world defs').forEach(element => element.setAttribute('aria-hidden', 'true'));

  function native(action, extra = {}) {
    window.webkit?.messageHandlers?.world?.postMessage({action, ...extra});
  }
  function save() {
    config = validateConfig(config);
    updateEnergy();
    const saved=settingsStore.write(config);
    if(!saved)toast('Your changes are active, but this browser could not save them for next time.');
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
    if (!data) return 'CONNECTING';
    if (data.stale || (data.error && data.items?.length)) return 'CACHED';
    if (data.error) return 'UNAVAILABLE';
    if (staticData) return data.adapter==='evrit-books'?'DAILY BOOKS':'FEED SNAPSHOT';
    return data.adapter === 'evrit-books' ? 'DAILY BOOKS' : data.adapter === 'website' ? 'LIVE PAGE' : 'LIVE FEED';
  }
  function screenSource(index) { return config.sources.find(s => s.id === config.officeScreens[index] && s.room === 'office'); }
  function librarySource() { return config.sources.find(s => s.room === 'library' && s.kind === 'evrit-books') || config.sources.find(s => s.room === 'library'); }
  function sourceKind(source) { return source.kind === 'evrit-books' ? 'e-vrit new books · daily' : source.kind === 'feed' ? 'RSS / Atom feed' : 'Live website · auto discovery'; }
  function sourcePlace(source) {
    if (source.room === 'library') return '▥ Library · bookshelf';
    const screens = config.officeScreens.flatMap((id, i) => id === source.id ? [String(i + 1)] : []);
    return screens.length ? `▤ Office · screen ${screens.join(' & ')}` : '▤ Office · available source';
  }
  function sceneState() {
    const library = librarySource();
    return {
      name: config.name, shirt: config.shirt, paused, active:isActive(), lowPower, reducedMotion: reducedMotion.matches,interaction,energy,framePhoto:config.framePhoto||'',
      mode: document.body.classList.contains('night') ? 'night' : document.body.classList.contains('dusk') ? 'dusk' : 'day',
      room: selectedRoom, weather: weather?.current || null,
      screens: [0,1].map(index => {
        const source = screenSource(index), data = source && feeds[source.id], items = data?.items || [];
        return {name: source?.name || `Screen ${index + 1}`, status: source ? status(source) : 'CHOOSE A SOURCE',
          headline: items[headlineIndex % Math.max(1,items.length)]?.title || (data?.error ? 'Source unavailable. Open to retry.' : source ? 'Gathering the latest stories…' : 'Choose a website for this screen.'), updatedAt: data?.updatedAt || null};
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
    config.framePhoto=photo;const saved=save();if(drawerMode==='settings'&&settingsTab==='world')renderSettings();if(saved)toast(`Your picture is in the wall frame. Saved ${savedPlace}.`);
  }
  async function importPhoto(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000){toast('Choose a JPG, PNG or WebP image up to20MB.');return;}
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();
      const scale=Math.min(1,960/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);setPhoto(canvas.toDataURL('image/jpeg',.82));
    }catch{toast('This image could not be opened. Try JPG or PNG.');}finally{URL.revokeObjectURL(url);}
  }
  function render() {
    const guideShirt=$('#portrait-shirt');
    guideShirt.hidden=config.shirt==='#c58d8c';
    guideShirt.style.filter=`hue-rotate(${{'#d8ab7d':35,'#88ab94':135,'#879eb5':195}[config.shirt]||0}deg)`;
    $('#scene-name').textContent = `${config.name.toUpperCase()}’S PLACE`;
    $('#character-name').textContent = config.name;
    document.documentElement.style.setProperty('--shirt', config.shirt);
    for (const room of ['office', 'library']) {
      const sources = config.sources.filter(s => s.room === room);
      const first = room === 'library' ? librarySource() : screenSource(0) || screenSource(1) || sources[0];
      const data = first && feeds[first.id];
      $(`#${room}-count`).textContent = `${String(sources.length).padStart(2, '0')} CONNECTION${sources.length === 1 ? '' : 'S'}`;
      $(`#${room}-title`).textContent = first ? (data?.items?.[0]?.title || first.name) : 'A little room for something new';
      $(`#${room}-description`).textContent = !first ? 'Add a website to make this room yours.'
        : `${first.name} · ${data?.error || data?.stale ? (data.items ? 'Cached content · retrying' : 'Source unavailable · open for details') : data?.items ? `${data.adapter === 'evrit-books' ? `${data.items.length} new books · daily` : data.adapter === 'website' ? 'Live page' : 'Live feed'} · updated ${timeLabel(data.updatedAt)}` : 'Connecting to live content…'}`;
    }
    for (const index of [0,1]) {
      const office = screenSource(index), suffix = index ? '-2' : '';
      const items = (office && feeds[office.id]?.items) || [];
      const headline = items[headlineIndex % Math.max(1, items.length)]?.title;
      $(`#monitor-source${suffix}`).textContent = office ? office.name.toUpperCase().slice(0, 19) : `SCREEN ${index + 1} · ADD A SOURCE`;
      const lines = wrap(headline || (office ? feeds[office.id]?.error ? 'Source unavailable. Click to retry.' : 'Connecting to live content…' : 'Choose a website for this screen.'), 24);
      $(`#monitor-line1${suffix}`).textContent = lines[0] || '';
      $(`#monitor-line2${suffix}`).textContent = lines[1] || '';
      $(`#office-object${suffix}`).setAttribute('aria-label', `Office screen ${index + 1}: ${office?.name || 'choose a source'}`);
    }
    const library = librarySource();
    const libraryItems = (library && feeds[library.id]?.items) || [];
    $('#book-label').textContent = library?.kind === 'evrit-books' ? 'ספרים חדשים · עברית' : library?.name.slice(0, 24) || 'Your books';
    $('#library-live-line').textContent = library?.kind === 'evrit-books' ? libraryItems.length ? `${libraryItems.length} new books · refreshed daily` : 'Fetching real book covers…' : (libraryItems[headlineIndex % Math.max(1, libraryItems.length)]?.title || 'Add a live source').slice(0, 30);
    renderBooks(library, libraryItems);
    const live = config.sources.filter(s => feeds[s.id]?.items && !feeds[s.id]?.error && !feeds[s.id]?.stale).length;
    const feedCount = config.sources.length;
    $('#connection-summary').textContent = `${config.sources.length} CONNECTIONS · ${live}/${feedCount} SOURCES ${staticData?'PUBLISHED':'LIVE'} · SAVED ${savedPlace.toUpperCase()}`;
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
    }).join('') || `<text x="1131" y="372" text-anchor="middle" font-size="10" fill="#c7cbb0">${source ? 'Waiting for book covers…' : 'Add a new-books source'}</text>`;
    $$('#books [data-book]').forEach(element => {
      element.onclick = event => { event.stopPropagation(); openBook(source, books.find(book => book.id === element.dataset.book)); };
      element.onkeydown = event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); element.dispatchEvent(new MouseEvent('click')); } };
    });
  }
  function timeLabel(iso) { return iso ? new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'just now'; }
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
    $('#ambience-label').textContent = config.ambience === 'auto' ? nativeManaged?'macOS light':'System light' : `${mode[0].toUpperCase()}${mode.slice(1)} light`;
    publishScene();
  }
  async function getJSON(url) {
    if(!isActive())throw new DOMException('Scene is not visible','AbortError');
    const controller=new AbortController();requests.add(controller);
    try {
      const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not connect.');
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
      const condition = code === 0 ? 'Clear skies' : code <= 3 ? 'A few clouds' : code < 50 ? 'Misty outside' : code < 70 ? 'Rain at the window' : code < 80 ? 'A little snow' : 'Showers outside';
      $('#weather-location').textContent = weather.location.toUpperCase();
      $('#weather-temperature').textContent = `${Math.round(current.temperature_2m)}° ${current.is_day ? '☀' : '☾'}`;
      $('#weather-description').textContent = `${condition}${weather.stale ? ' · cached' : ''}`;
      $('#weather-symbol').textContent = code >= 50 ? '☂' : current.is_day ? '☀' : '☾';
      $('#rain').setAttribute('opacity', code >= 50 ? '.7' : '0');
      renderAmbience();
    } catch(error) {
      if(!isActive()||error.name==='AbortError')return;
      weatherChecked=performance.now();weatherCheckedLocation=requestedLocation;
      if (requestedLocation !== config.location) return;
      weatherError = true;
      $('#weather-temperature').textContent = 'Offline';
      $('#weather-description').textContent = 'Weather unavailable · try refresh';
      $('#weather-symbol').textContent = '◌';
    }
  }
  async function refreshAll(force=false) {
    if(!isActive())return;
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    $('#refresh').textContent = '↻ Connecting…';
    if(staticData){
      try{
        await staticData.refresh(force);
        if(!publishedConfigLoaded){
          publishedConfigLoaded=true;
          if(needsPublishedDefaults&&JSON.stringify([config.sources,config.officeScreens])===initialConnections){config=validateConfig({...config,sources:staticData.sources,officeScreens:staticData.sources.filter(source=>source.room==='office').slice(0,2).map(source=>source.id)});if(settingsStore.hasSaved)settingsStore.write(config);render();}
        }
      }catch(error){
        refreshing=false;$('#refresh').textContent='↻ Retry published data';
        if(error.name!=='AbortError'){toast('Published data is unavailable. Try refreshing in a moment.');}
        return;
      }
    }
    await Promise.allSettled([refreshWeather(force), ...config.sources.map(source=>refreshFeed(source,force))]);
    refreshing = false;
    $('#refresh').textContent = staticData?'↻ Check updates':'↻ Refresh sources';
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
      toast(routine.snapshot().emotion ? 'Let’s finish this little moment first.' : shelfBooks().length ? 'Already choosing a book. Let’s finish this chapter.' : 'The shelves are still connecting. Try again when books arrive.');
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
    const title=s.book?.title||'a book';
    const text=s.emotion?(s.phase==='emotion-recover'?'is gathering enough energy to get back up':window.LittleWorldEmotions.moods[s.emotion].activity):{
      'walk-to-emotion':'is taking a little moment',
      'walk-to-ladder':'is walking to the library steps','climb-up':'is climbing carefully to the shelf','climb-down':'is stepping down from the shelf',
      'walk-to-shelf':'is going to choose a book', 'take-book':`is lifting “${title}” from the shelf`, 'shelf-release':'is leaving the book safely on the shelf', 'choose-book':`is taking “${title}” from the shelf`,
      'walk-to-chair':`is carrying “${title}” to the armchair`, 'sit-down':'is settling into the armchair',
      reading:`is reading “${title}”`, 'stand-up':'is finishing a chapter',
      'walk-to-return':`is bringing “${title}” back`, 'return-book':'is putting the book back on the shelf',
      visit:`is heading to the ${s.room}`, idle:s.room==='office'?'is catching up on the world':'is enjoying a quiet moment'
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
    document.body.dataset.runtimeActive=String(active);document.body.dataset.lowPower=String(lowPower);
    document.body.classList.toggle('runtime-suspended',!active);
    runtime.setActive(active);
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
    for(const button of [$('#enter-world'),$('#web-enter-focused')]){button.textContent=interaction?'Leave world':'Enter world';button.setAttribute('aria-pressed',String(interaction));}
    activityChanged();
  }
  function setFocusView(value){
    document.body.classList.toggle('world-focus',value);
    $('#wallpaper').textContent=value?'← Back to page':'↗ Focus view';
    $('#wallpaper').setAttribute('aria-pressed',String(value));
  }
  function setPaused(value,persist=true) {
    paused = !!value;config.paused=paused;
    if(persist)save();
    document.body.classList.toggle('paused', value);
    $('#pause').textContent = value ? '▷' : 'Ⅱ';
    $('#pause').setAttribute('aria-label', value ? 'Resume animation' : 'Pause animation');
    $('#pause').title = value ? 'Resume animation' : 'Pause animation';
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
    openDrawer('settings', 'Make it yours.', 'A WORLD THAT FEELS LIKE YOU');
    renderSettings();
  }
  function screenControls() {
    const sources = config.sources.filter(source => source.room === 'office');
    return `<div class="office-screen-settings"><h3>Office screens</h3><p class="note">Give each monitor its own live website or feed. Click a monitor in the room to read that source.</p>${[0,1].map(index => `<label class="field">Screen ${index + 1} · ${index ? 'right' : 'left'} monitor<select data-screen-index="${index}"><option value="">No source assigned</option>${sources.map(source => `<option value="${escape(source.id)}" ${config.officeScreens[index] === source.id ? 'selected' : ''}>${escape(source.name)}</option>`).join('')}</select></label>`).join('')}</div>`;
  }
  function renderSettings() {
    const controls=browserApp?`<div class="editor-world-controls" role="group" aria-label="World actions"><button class="secondary" id="editor-pause">${paused?'Resume':'Pause'}</button><button class="secondary" id="editor-interaction">${interaction?'Leave world':'Enter world'}</button><button class="secondary" id="editor-read">Read a book</button><button class="secondary" id="editor-office">Office</button><button class="secondary" id="editor-library">Library</button><button class="secondary" id="editor-refresh">Check updates</button>${document.fullscreenEnabled?'<button class="secondary" id="editor-fullscreen">Full screen</button>':''}</div>`:'';
    const tabs = controls+`<div class="drawer-tabs"><button data-tab="connections" class="${settingsTab === 'connections' ? 'active' : ''}">Connections</button><button data-tab="character" class="${settingsTab === 'character' ? 'active' : ''}">Character</button><button data-tab="world" class="${settingsTab === 'world' ? 'active' : ''}">World</button></div>`;
    if (settingsTab === 'connections') {
      $('#drawer-content').innerHTML = tabs + `<p>Bring live content into your rooms. Connect an RSS feed or paste a website: we discover its feed or read its current page content.</p>${screenControls()}<div id="source-list">${config.sources.map(s => `<article class="source-item"><div class="source-item-head"><h3 dir="auto">${escape(s.name)}</h3><span class="status">${status(s)}</span></div><div class="source-url">${escape(s.url)}</div><div class="source-meta">${escape(sourcePlace(s))} · ${sourceKind(s)}</div><div class="source-actions"><button data-edit="${escape(s.id)}">Edit connection</button><button data-view="${escape(s.id)}">Open object ↗</button><button class="danger" data-remove="${escape(s.id)}" aria-label="Remove ${escape(s.name)}">Remove</button></div></article>`).join('') || '<div class="empty">Your rooms are waiting.<br>Add your first website below.</div>'}</div><button class="primary full" id="add-source">＋ Add a website</button><p class="note">Up to 20 connections. Changes save automatically ${savedPlace}. ${staticData?'Published JSON is checked every5 minutes; upstream data refreshes when the site is republished.':'Office feeds and websites refresh every5 minutes.'} The e-vrit new-books shelves refresh daily at midnight in Israel. Websites expose public page headings or discovered feeds. Sign-in and JavaScript-only sites need a dedicated adapter.</p><div class="divider"></div><label class="field">Weather outside your window<select id="location"><option value="tel-aviv">Tel Aviv</option><option value="jerusalem">Jerusalem</option><option value="london">London</option><option value="new-york">New York</option></select><small>Illustrated weather comes from Open-Meteo. This is a chosen city; your location is not detected.</small></label><p class="note"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo ↗</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>`;
      $$('[data-screen-index]').forEach(select => select.onchange = () => {
        config.officeScreens[Number(select.dataset.screenIndex)] = select.value || null;
        save(); renderSettings();
      });
      $('#location').value = config.location;
      $('#location').onchange = event => {
        config.location = event.target.value; weather = null; save();
        $('#weather-location').textContent = $('#location').selectedOptions[0].textContent.toUpperCase();
        $('#weather-temperature').textContent = 'Connecting…';
        $('#weather-description').textContent = 'Updating your window';
        refreshWeather();
      };
      $('#add-source').disabled = config.sources.length >= 20;
      $('#add-source').onclick = () => editSource();
      $$('[data-edit]').forEach(b => b.onclick = () => editSource(b.dataset.edit));
      $$('[data-view]').forEach(b => b.onclick = () => openRoom(config.sources.find(s => s.id === b.dataset.view).room, b.dataset.view));
      $$('[data-remove]').forEach(b => b.onclick = () => {
        config.sources = config.sources.filter(s => s.id !== b.dataset.remove);
        delete feeds[b.dataset.remove]; save(); renderSettings(); toast('Connection removed.');
      });
    } else if(settingsTab==='character') {
      $('#drawer-content').innerHTML = tabs + `<p>A small stand-in for you. Give your character a name, pick a favorite color, and let them settle in.</p><label class="field">Your character’s name<input id="name" maxlength="30" value="${escape(config.name)}" autocomplete="off" dir="auto"></label><label class="field">T-shirt color</label><div class="swatches">${SHIRTS.map((color, i) => `<button class="swatch ${config.shirt === color ? 'active' : ''}" style="--swatch:${color}" data-color="${color}" aria-label="${['Ochre','Sage','Blue','Rose'][i]} T-shirt" aria-pressed="${config.shirt === color}"></button>`).join('')}</div><label class="toggle-row"><input id="wander" type="checkbox" ${config.wander ? 'checked' : ''}> Wander, read, and have little moments</label><p class="note">You can always choose a room yourself. Animation also respects your device’s Reduce Motion preference.</p><div class="divider"></div><h3>A little time for yourself</h3><button class="primary full" id="read-a-book">Pick a book and read</button><div class="form-row"><button class="secondary" id="visit-office">Visit the office</button><button class="secondary" id="visit-library">Visit the library</button></div><div class="divider"></div><h3>A whole range of feelings</h3><label class="field">Try a little moment<select id="emotion-preview"><option value="next">Surprise me</option>${Object.entries(window.LittleWorldEmotions.moods).map(([id,mood])=>`<option value="${id}">${mood.label}</option>`).join('')}</select></label><button class="secondary full" id="try-emotion">Show this mood</button><p class="note">Occasional moments happen naturally between activities. Books are returned first. Pause, Reduce Motion, and desktop visibility still apply.</p><div class="divider"></div><p class="note">Clay edition · Your handmade character. More ways to make this little world yours can come next.</p>`;
      $('#name').oninput = event => { config.name = event.target.value.trim() || 'You'; save(); };
      $('#wander').onchange = event => { config.wander = event.target.checked; save();wakeMotion(); };
      $$('[data-color]').forEach(b => b.onclick = () => { config.shirt = b.dataset.color; save(); renderSettings(); });
      $('#emotion-preview').value=config.emotionPreview;
      $('#emotion-preview').onchange=event=>{config.emotionPreview=event.target.value;save();};
      $('#try-emotion').onclick = () => { const mood=$('#emotion-preview').value;config.emotionPreview=mood;save();closeDrawer();expressMood(mood); };
      $('#read-a-book').onclick = () => { closeDrawer(); readBook(); };
      $('#visit-office').onclick = () => { closeDrawer(); goTo('office'); };
      $('#visit-library').onclick = () => { closeDrawer(); goTo('library'); };
    } else {
      $('#drawer-content').innerHTML=tabs+`<label class="field">Lighting<select id="world-light"><option value="auto">Follow ${nativeManaged?'macOS':'system'} appearance</option><option value="day">Day</option><option value="dusk">Dusk</option><option value="night">Deep night · lamp and moonlight</option></select></label><div class="divider"></div><h3>A picture on your wall</h3><button class="photo-drop-zone" id="edit-wall-photo">${config.framePhoto?`<img src="${config.framePhoto}" alt="Your saved wall photo">`:''}<span>Drop a picture here, or click to choose</span><small>JPG, PNG or WebP · stays ${savedPlace}</small></button>${config.framePhoto?'<button class="secondary" id="clear-wall-photo">Remove picture from frame</button>':''}<div class="divider"></div><h3>A world that shares your energy</h3><p id="energy-label">${escape(energy.label)}</p><label class="toggle-row"><input type="checkbox" id="battery-reactions" ${config.batteryReactions?'checked':''}> Character reacts to low battery and charging</label><p class="note">Plants droop at35%, wilt at20%, and lose almost all attached leaves at10%. Connecting power brings them back.</p><label class="field">Battery preview<select id="battery-preview"><option value="actual">Actual ${nativeManaged?'Mac':'device'} battery</option><option value="35">35% · drooping</option><option value="15">15% · wilted</option><option value="5">5% · almost bare</option><option value="charging">Power connected · recovering</option></select></label><p class="note">Preview affects this world only. Choose Actual device battery to follow your device again.</p>`;
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
    if(staticData&&settingsTab==='connections'){const note=document.createElement('p');note.className='note';note.textContent='This site reads published JSON snapshots. Publish a new connection in data/sources.json to make its content available here. Refresh checks for a newer snapshot.';$('#drawer-content').prepend(note);}
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
  function editSource(id) {
    const existing = config.sources.find(s => s.id === id);
    drawerMode = 'form';
    $('#drawer-title').textContent = existing ? 'A place for this.' : 'Bring something in.';
    $('#drawer-content').innerHTML = `<button class="secondary" id="back-settings">← Connections</button><p>${existing ? 'Change the connection or move it to another room.' : 'Choose a website you care about, then give it a home.'}</p><form id="source-form"><label class="field">Name<input name="name" maxlength="45" required placeholder="My favorite corner of the web" value="${escape(existing?.name || '')}" dir="auto"></label><label class="field">Connection type<select name="kind"><option value="feed">Live headlines · RSS or Atom</option><option value="website">Live website · discover content</option><option value="evrit-books">e-vrit · new books, daily</option></select></label><label class="field"><span id="url-label">RSS or Atom feed URL</span><input name="url" type="url" required placeholder="https://example.com/feed.xml" value="${escape(existing?.url || '')}"><small id="url-help">Use the direct feed address. We’ll show its latest headlines on your room’s object.</small></label><label class="field">Room<select name="room"><option value="office">The office · two screens</option><option value="library">The library · bookshelf</option></select><small>Choose the office screen below, or place this connection in the library.</small></label><label class="field" id="screen-field">Office screen<select name="screen"><option value="">Room connection only</option><option value="0">Screen 1 · left monitor</option><option value="1">Screen 2 · right monitor</option></select></label><p class="form-error" id="form-error" role="alert" hidden></p><button class="primary full" type="submit">${existing ? 'Save connection' : 'Add to my world'} ↗</button></form>`;
    $('#back-settings').onclick = () => openSettings();
    if(staticData){const label=document.createElement('label');label.className='field';label.textContent='Published connection';const select=document.createElement('select');select.id='published-connection';select.innerHTML='<option value="">Choose a published source</option>'+staticData.sources.map(source=>`<option value="${escape(source.id)}">${escape(source.name)}</option>`).join('');label.append(select);$('#source-form').prepend(label);select.onchange=()=>{const source=staticData.sources.find(source=>source.id===select.value);if(!source)return;form.elements.name.value=source.name;form.elements.kind.value=source.kind;form.elements.url.value=source.url;form.elements.room.value=source.room;updatePlacement();updateKind();};}
    const form = $('#source-form');
    form.elements.kind.value = existing?.kind || 'feed';
    form.elements.room.value = existing?.room || (selectedRoom === 'library' ? 'library' : 'office');
    const currentScreen = existing ? config.officeScreens.indexOf(existing.id) : config.officeScreens.findIndex(id => !id);
    form.elements.screen.value = currentScreen >= 0 ? String(currentScreen) : '';
    function updatePlacement() { $('#screen-field').hidden = form.elements.room.value !== 'office'; }
    form.elements.room.onchange = updatePlacement;
    updatePlacement();
    function updateKind() {
      const dailyBooks = form.elements.kind.value === 'evrit-books';
      form.elements.url.readOnly = dailyBooks;
      if (dailyBooks) form.elements.url.value = 'https://www.e-vrit.co.il/';
      const link = form.elements.kind.value === 'website' || dailyBooks;
      $('#url-label').textContent = link ? 'Live website URL' : 'RSS or Atom feed URL';
      $('#url-help').textContent = link ? 'We discover its RSS feed, or extract current public page headings. Content refreshes every 5 minutes; sign-in pages are not supported yet.' : 'Use the direct feed address. We’ll show its latest headlines on your room’s object.';
      form.elements.url.placeholder = link ? 'https://example.com' : 'https://example.com/feed.xml';
      if (dailyBooks) {
        $('#url-label').textContent = 'e-vrit homepage · ספרים חדשים';
        $('#url-help').textContent = 'Follows the homepage’s ספרים חדשים collection and places its first 12 listed books, with real covers, on your shelves. Refreshes once each day, even across app restarts.';
      }
      if(staticData)$('#url-help').textContent='Choose a published connection. Add a new URL to the public JSON source catalog before its snapshot is available.';
    }
    form.elements.kind.onchange = () => {
      if (form.elements.kind.value === 'evrit-books') { form.elements.room.value = 'library'; updatePlacement(); }
      updateKind();
    }; updateKind();
    form.onsubmit = event => {
      event.preventDefault();
      const name = form.elements.name.value.trim(), url = safeURL(form.elements.url.value.trim());
      if (!name || !url) { $('#form-error').hidden = false; $('#form-error').textContent = 'Add a name and a valid public http or https URL.'; return; }
      const source = {id: existing?.id || crypto.randomUUID(), name, url, room: form.elements.room.value, kind: form.elements.kind.value};
      if(staticData&&!staticData.published(source)){$('#form-error').hidden=false;$('#form-error').textContent='Choose a published connection, or add this URL to data/sources.json and refresh the published snapshot first.';return;}
      if (existing) config.sources = config.sources.map(s => s.id === existing.id ? source : s);
      else config.sources.push(source);
      config.officeScreens = config.officeScreens.map(id => id === source.id ? null : id);
      if (source.room === 'office' && form.elements.screen.value !== '') config.officeScreens[Number(form.elements.screen.value)] = source.id;
      delete feeds[source.id];feedChecked.delete(source.id); save(); openSettings();
      refreshFeed(source);
      toast(existing ? 'Connection updated.' : 'A new connection. A little more you.');
    };
    form.elements.name.focus();
  }
  function openRoom(room, sourceId) {
    goTo(room);
    selectedSource = sourceId || (room === 'library' ? librarySource() : screenSource(0) || screenSource(1))?.id || config.sources.find(s => s.room === room)?.id;
    openDrawer('room', room === 'office' ? 'The office.' : 'The library.', room === 'office' ? 'YOUR WINDOW TO THE WORLD' : 'A LITTLE ROOM FOR CURIOSITY');
    renderRoomContent();
  }
  function renderRoomContent() {
    const roomSources = config.sources.filter(s => s.room === selectedRoom);
    let source = roomSources.find(s => s.id === selectedSource) || roomSources[0];
    selectedSource = source?.id;
    const tabs = roomSources.length > 1 ? `<div class="source-picker">${roomSources.map(s => `<button data-pick="${escape(s.id)}" class="${s.id === source.id ? 'active' : ''}">${escape(s.name)}</button>`).join('')}</div>` : '';
    const data = source && feeds[source.id];
    $('#drawer-content').innerHTML = !source ? `<div class="empty">Nothing connected here yet.<br>Make a little room for your favorite website.</div><button class="primary full" id="room-add">＋ Add a website</button>`
      : tabs + `<article class="source-item"><div class="source-item-head"><h3 dir="auto">${escape(source.name)}</h3><span class="status">${status(source)}</span></div><div class="source-url">${escape(source.url)}</div></article>` + `<p class="note">${data?.items ? `Updated ${escape(timeLabel(data.updatedAt))} · ${data.stale || data.error ? 'Showing cached content; source is currently unavailable.' : 'Checks every 5 minutes.'}` : 'Fetching live content from this source…'}</p>${data?.discoveredFeed ? `<p class="note">Discovered RSS feed: ${escape(data.discoveredFeed)}</p>` : data?.adapter === 'website' ? `<p class="note">Current public page headings from ${escape(data.pageTitle || source.name)}. JavaScript is not executed. These are page contents, not necessarily dated articles.</p>` : ''}${data?.error && !data.items ? `<p class="form-error">${escape(data.error)}</p><button class="secondary" id="retry-feed">↻ Try again</button>` : ''}<ul class="feed-list">${(data?.items || []).map(item => `<li>${safeURL(item.url) ? `<a href="${escape(safeURL(item.url))}" target="_blank" rel="noopener noreferrer" dir="auto">${escape(item.title)} ↗</a>` : `<span dir="auto">${escape(item.title)}</span>`}${item.date && !isNaN(Date.parse(item.date)) ? `<small>${escape(new Date(item.date).toLocaleDateString([], {month:'short',day:'numeric'}))}</small>` : ''}</li>`).join('')}</ul><div class="divider"></div><button class="secondary" id="room-edit">Manage this connection</button>`;
    if (source?.kind === 'evrit-books') {
      $('#drawer-content').innerHTML = tabs + `<article class="source-item"><div class="source-item-head"><h3 dir="auto">${escape(source.name)}</h3><span class="status">${status(source)}</span></div><p class="note">${data?.items ? `Fetched ${escape(new Date(data.updatedAt).toLocaleString())} · ${data.stale || data.error ? 'Showing the saved shelf; retrying when connected.' : 'Refreshes daily at midnight, Israel time.'}` : 'Fetching the homepage’s ספרים חדשים collection…'}</p></article><p>Real covers from the new-books list linked on the e-vrit homepage, in the website’s displayed order.</p>${data?.error && !data.items ? `<p class="form-error">${escape(data.error)}</p><button class="secondary" id="retry-feed">↻ Try again</button>` : ''}<div class="book-grid">${(data?.items || []).map(book => `<button class="book-card" data-read-book="${escape(book.id)}"><img src="${escape(safeURL(book.cover) || '')}" alt="${escape(book.title)}" loading="lazy" referrerpolicy="no-referrer"><strong dir="auto">${escape(book.title)}</strong><span dir="auto">${escape(book.author || '')}</span></button>`).join('')}</div>${data?.sourceURL ? `<a class="secondary collection-link" href="${escape(safeURL(data.sourceURL))}" target="_blank" rel="noopener noreferrer">ספרים חדשים בעברית ↗</a>` : ''}<div class="divider"></div><button class="secondary" id="room-edit">Manage this connection</button>`;
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
    openDrawer('book', book.title, 'NEW ON THE SHELF · E-VRIT');
    $('#drawer-content').innerHTML = `<button class="secondary" id="back-to-books">← All new books</button><div class="book-detail"><img src="${escape(safeURL(book.cover) || '')}" alt="${escape(book.title)}" referrerpolicy="no-referrer"><p dir="auto">${escape(book.author || '')}</p></div><a class="primary full" style="text-decoration:none" href="${escape(safeURL(book.url))}" target="_blank" rel="noopener noreferrer">View book on e-vrit ↗</a><p class="note">From the homepage’s ספרים חדשים collection. Your shelves refresh daily; this opens the original book page.</p>`;
    $('#back-to-books').onclick = () => openRoom(source.room, source.id);
  }

  $('#manage').onclick = () => openSettings();
  $('#world-editor-launcher').onclick=()=>openSettings();
  $('#close-drawer').onclick = () => compactEditor?native('closeEditor'):closeDrawer();
  $('#backdrop').onclick = closeDrawer;
  $('#office-card').onclick = () => openRoom('office');
  $('#library-card').onclick = () => openRoom('library');
  for (const index of [0,1]) $(`#office-object${index ? '-2' : ''}`).onclick = () => {
    const source = screenSource(index);
    if (source) openRoom('office', source.id); else { openSettings(); toast(`Choose a source for office screen ${index + 1}.`); }
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
      try { config = validateConfig(JSON.parse(event.newValue));updateEnergy();setPaused(config.paused,false);selectRoom(config.room);render();if(drawerMode==='settings')renderSettings();refreshAll(); }
      catch { /* Ignore incomplete external edits. */ }
    }
  });
  function tickClock() {
    const date = new Date();
    const wall=roomProps.clock(date);
    $('#clock').textContent = date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    $('#wall-clock-digital').textContent=wall.text;
    window.dispatchEvent(new CustomEvent('world:clock',{detail:wall}));
    renderAmbience();
    return wall.delay;
  }
  // The native app persists this separately because its local server port changes on launch.
  window.worldApp = {
    setPaused,setHostState,isActive,getSceneState:sceneState,getClockState:()=>roomProps.clock(),
    getCharacterState:() => ({...routine.snapshot(),paused,reducedMotion:reducedMotion.matches,active:isActive(),lowPower}),
    readBook,expressMood,
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
    openScreen(index) { const source = screenSource(index); if (source) openRoom('office',source.id); else openSettings(); },
    openLibrary:() => openRoom('library'),
    openBookAt(index) { const source=librarySource(), book=shelfBooks()[index]; if (book) openBook(source,book); },
    visitRoom:goTo,
    restoreNative(value) {
    try { config = validateConfig(JSON.parse(value));updateEnergy();settingsStore.write(config);render();activityChanged();if(compactEditor)openSettings(settingsTab||'world');refreshAll(); }
    catch { /* Keep the current usable setup. */ }
  }};
  selectRoom(config.room);
  if(config.room!=='home')routine.visit(config.room,true);
  render();tickClock();setPaused(config.paused,false);
  if(browserApp){
    $('#enter-world').hidden=false;$('#enter-world').onclick=()=>setInteraction(!interaction);
    $('#web-enter-focused').hidden=false;$('#web-enter-focused').onclick=()=>setInteraction(!interaction);
    $('#web-read').hidden=false;$('#web-read').onclick=()=>readBook();
    setFocusView(true);setInteraction(true);
    const full=$('#web-fullscreen');full.hidden=!document.fullscreenEnabled;
    full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{setFocusView(true);await document.documentElement.requestFullscreen();}}catch{toast('Full screen is unavailable here. Focus view is still available.');}};
    document.addEventListener('fullscreenchange',()=>{full.textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
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
  activityChanged();
})();
