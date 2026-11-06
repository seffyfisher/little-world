/* Catalog choices become ordinary saved connections only when assigned to a monitor. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./world-settings.js'):root.LittleWorldSettings);if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldRSSCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(settings){
  'use strict';
  function key(url){const u=new URL(url);return u.host.toLowerCase()+(u.pathname.replace(/\/+$/,'')||'/')+u.search;}
  function normalize(raw){
    if(raw?.schemaVersion!==1||!Array.isArray(raw.sources)||!Array.isArray(raw.categories))throw new Error('מאגר ה־RSS אינו תקין.');
    const categories=raw.categories.filter(c=>typeof c.id==='string'&&typeof c.label==='string');
    const ids=new Set(),sources=raw.sources.filter(s=>s&&/^catalog-rss-[a-f0-9]{12}$/.test(s.id)&&settings.safeURL(s.url)&&Array.isArray(s.categories)).map(s=>{
      if(ids.has(s.id))throw new Error('מקור כפול במאגר.');ids.add(s.id);
      return {id:s.id,name:String(s.name||s.url).slice(0,45),url:settings.safeURL(s.url),kind:'feed',room:'office',categories:s.categories.filter(id=>categories.some(c=>c.id===id))};
    });
    return {sources,categories};
  }
  function groups(catalog,query=''){
    const q=query.trim().toLocaleLowerCase();
    return catalog.categories.map(category=>({...category,sources:catalog.sources.filter(s=>s.categories.includes(category.id)&&(!q||[s.name,s.url,...s.categories,...catalog.categories.filter(c=>s.categories.includes(c.id)).map(c=>c.label)].join(' ').toLocaleLowerCase().includes(q)))})).filter(c=>c.sources.length);
  }
  function prune(config,catalog){
    return {...config,sources:config.sources.filter(s=>{
      const stock=catalog.sources.find(c=>c.id===s.id);
      return !stock||config.officeScreens.includes(s.id)||s.name!==stock.name||s.url!==stock.url||s.kind!=='feed'||s.room!=='office';
    })};
  }
  function assign(config,catalog,index,id){
    if(!Number.isInteger(index)||index<0||index>=settings.MAX_SCREENS)throw new Error('בחרו מסך תקין.');
    const entry=catalog.sources.find(s=>s.id===id);if(!entry)throw new Error('המקור אינו נמצא במאגר.');
    let next={...config,sources:[...config.sources],officeScreens:[...config.officeScreens],screenModes:[...config.screenModes]};
    // Reuse user-created connections too, including the HTTP/HTTPS form of the same feed.
    let source=next.sources.find(s=>s.kind==='feed'&&s.room==='office'&&key(s.url)===key(entry.url));
    next.officeScreens[index]=source?.id||entry.id;next.screenModes[index]='source';
    next=prune(next,catalog);
    if(!source){
      if(next.sources.length>=20)throw new Error('כבר יש 20 חיבורים. הסירו חיבור כדי להוסיף מקור חדש.');
      const {categories,...connection}=entry;next.sources.push(connection);source=connection;
    }
    return {config:next,source};
  }
  return {normalize,groups,prune,assign};
});
