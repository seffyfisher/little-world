/* Durable visitor settings; keep the existing storage key so upgrades preserve worlds. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./energy.js'):root.LittleWorldEnergy,typeof module==='object'&&module.exports?require('./emotions.js'):root.LittleWorldEmotions);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldSettings=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(energy,emotions){
  'use strict';
  const MAX_SCREENS=8;
  const SCREEN_PLACES=['שמאל על השולחן','ימין על השולחן','קיר שמאל · עליון','קיר שמאל · תחתון','מעל השולחן · שמאל עליון','מעל השולחן · ימין עליון','מעל השולחן · שמאל תחתון','מעל השולחן · ימין תחתון'];
  const KEY = 'little-world-poc-v1';
  const SECOND_SCREEN_SOURCE = {id: 'office-news-2', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', kind: 'feed', room: 'office'};
  const DEFAULT = {schemaVersion: 2, officeScreens: ['news', 'office-news-2',...Array(6).fill(null)], name: 'Seffy', wander: true, ambience: 'auto', location: 'tel-aviv', sources: [
    {id: 'news', name: 'Hacker News', url: 'https://news.ycombinator.com/rss', kind: 'feed', room: 'office'},
    {...SECOND_SCREEN_SOURCE},
    {id: 'books', name: 'עברית · ספרים חדשים', url: 'https://www.e-vrit.co.il/', kind: 'evrit-books', room: 'library'}
  ]};
  function safeURL(raw) {
    try { const u = new URL(raw); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; }
    catch { return null; }
  }
  function validateConfig(raw) {
    if (!raw || !Array.isArray(raw.sources)) raw=DEFAULT;
    const sources = raw.sources.filter(s => s && safeURL(s.url) && ['office','library'].includes(s.room) && ['feed','website','link','evrit-books'].includes(s.kind))
      .slice(0, 20).map((s, index) => {
        const newBooks = s.kind === 'evrit-books' || (raw.schemaVersion !== 2 && s.room === 'library' && ['www.e-vrit.co.il','e-vrit.co.il'].includes(new URL(s.url).hostname) && new URL(s.url).pathname === '/');
        return {id: String(s.id || index).replace(/[^a-z0-9-]/gi,'').slice(0, 60) || String(index),
          name: newBooks && ['e-vrit','e-vrit new books'].includes(s.name) ? 'עברית · ספרים חדשים' : String(s.name || 'Website').slice(0, 45),
          url: newBooks ? 'https://www.e-vrit.co.il/' : safeURL(s.url), kind: newBooks ? 'evrit-books' : s.kind === 'link' ? 'website' : s.kind, room: s.room};
      });
    // Upgrade existing worlds once, keeping their original connections and settings.
    if (raw.schemaVersion !== 2 && sources.filter(s => s.room === 'office').length < 2 && sources.length < 20 && !sources.some(s => s.id === SECOND_SCREEN_SOURCE.id)) sources.push({...SECOND_SCREEN_SOURCE});
    const office = sources.filter(s => s.room === 'office');
    const officeScreens = Array.from({length:MAX_SCREENS},(_,i)=>i).map(i => Array.isArray(raw.officeScreens)
      ? office.some(s => s.id === raw.officeScreens[i]) ? raw.officeScreens[i] : null
      : office[i]?.id || null);
    return {
      schemaVersion: 2, editorScreen:Number.isInteger(raw.editorScreen)?Math.max(0,Math.min(MAX_SCREENS-1,raw.editorScreen)):0,officeScreens,screenModes:Array.from({length:MAX_SCREENS},(_,i)=>i).map(i=>raw.screenModes?.[i]==='webcam'?'webcam':'source'),
      name: String(raw.name || 'אני').slice(0, 30),
      wander: raw.wander !== false, ambience: ['auto','day','dusk','night'].includes(raw.ambience) ? raw.ambience : 'auto',
      location: ['tel-aviv','jerusalem','london','new-york'].includes(raw.location) ? raw.location : 'tel-aviv',
      framePhoto: energy.photo(raw.framePhoto),
      batteryPreview: energy.previews.has(raw.batteryPreview)?raw.batteryPreview:'actual',
      batteryReactions: raw.batteryReactions!==false,
      paused: raw.paused === true,
      room: ['home','office','library'].includes(raw.room) ? raw.room : 'home',
      editorTab: ['connections','character','world'].includes(raw.editorTab) ? raw.editorTab : 'world',
      emotionPreview: raw.emotionPreview === 'next' || Object.hasOwn(emotions.moods, raw.emotionPreview) ? raw.emotionPreview : 'next',
      sources
    };
  }
  function createStore({getStorage=()=>globalThis.localStorage}={}){
    let hasSaved=false;
    function read(){
      try{
        const raw=JSON.parse(getStorage().getItem(KEY));
        hasSaved=!!raw&&Array.isArray(raw.sources);
        return validateConfig(hasSaved?raw:DEFAULT);
      }catch{hasSaved=false;return validateConfig(DEFAULT);}
    }
    function write(config){
      try{getStorage().setItem(KEY,JSON.stringify(validateConfig(config)));hasSaved=true;return true;}
      catch{return false;}
    }
    return {read,write,get hasSaved(){return hasSaved;}};
  }
  return {KEY,MAX_SCREENS,SCREEN_PLACES,DEFAULT,safeURL,validateConfig,createStore};
});
