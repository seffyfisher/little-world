const {test}=require('node:test');const assert=require('node:assert/strict');
const RSS=require('../web/rss-catalog.js');const {DEFAULT,validateConfig,createStore}=require('../web/world-settings.js');
const raw=require('../web/data/rss-catalog.json'),catalog=RSS.normalize(raw);
test('all imported feed URLs are available, with Hebrew categories and no executable URLs',()=>{
  assert.equal(raw.upstreamEntries,143);assert.equal(catalog.sources.length,141);assert.equal(catalog.categories.length,12);
  assert.equal(new Set(catalog.sources.map(s=>s.id)).size,141);
  for(const source of catalog.sources){assert.match(source.url,/^https?:\/\//);assert(source.categories.length);}
  const bad=RSS.normalize({...raw,sources:[{id:'catalog-rss-000000000000',url:'javascript:alert(1)',categories:['Learning']}]});assert.equal(bad.sources.length,0);
});
test('search matches feed names, URLs and Hebrew or original category labels',()=>{
  const ids=q=>RSS.groups(catalog,q).flatMap(g=>g.sources.map(s=>s.id));
  const cloud=catalog.sources.find(s=>s.name==='The Cloudflare Blog');assert(ids('cloudflare').includes(cloud.id));
  assert(ids('עיצוב').length>5);assert(ids('Engineering').includes(cloud.id));assert.deepEqual(ids('no-feed-matches-908123'),[]);
});
test('each of eight monitors can choose an independent catalog feed and persist across launch',()=>{
  let config=validateConfig(structuredClone(DEFAULT));
  for(let i=0;i<8;i++)config=RSS.assign(config,catalog,i,catalog.sources[i].id).config;
  let saved;const store=createStore({getStorage:()=>({getItem:()=>saved,setItem:(_,v)=>saved=v})});store.write(config);
  assert.deepEqual(store.read().officeScreens,config.officeScreens);assert.equal(new Set(config.officeScreens).size,8);
  assert.equal(store.read().sources.find(s=>s.id==='books').kind,'evrit-books');
});
test('trying every catalog feed on one monitor does not accumulate or fetch all connections',()=>{
  let config=validateConfig(structuredClone(DEFAULT));
  for(const entry of catalog.sources){config=RSS.assign(config,catalog,7,entry.id).config;assert(config.sources.length<=DEFAULT.sources.length+1);}
  assert.equal(config.officeScreens[0],'news');assert.equal(config.officeScreens[1],'office-news-2');
});
test('existing manual feeds are reused and shared catalog selections remain intact',()=>{
  let config=validateConfig(structuredClone(DEFAULT));const hn=catalog.sources.find(s=>s.name==='Hacker News');
  config=RSS.assign(config,catalog,7,hn.id).config;assert.equal(config.officeScreens[7],'news');assert.equal(config.sources.length,3);
  config=RSS.assign(config,catalog,6,catalog.sources[0].id).config;config=RSS.assign(config,catalog,7,catalog.sources[0].id).config;
  config=RSS.assign(config,catalog,7,catalog.sources[1].id).config;assert.equal(config.officeScreens[6],catalog.sources[0].id);assert(config.sources.some(s=>s.id===config.officeScreens[6]));
});
test('customized catalog connections are retained and a full manual catalog is never silently overwritten',()=>{
  let config=RSS.assign(validateConfig(structuredClone(DEFAULT)),catalog,7,catalog.sources[0].id).config;
  config.sources.find(s=>s.id===catalog.sources[0].id).name='My custom feed name';
  config=RSS.assign(config,catalog,7,catalog.sources[1].id).config;assert(config.sources.some(s=>s.name==='My custom feed name'));
  config=validateConfig({...DEFAULT,sources:Array.from({length:20},(_,i)=>({id:`user-${i}`,name:`Custom ${i}`,kind:'feed',room:'office',url:`https://example.com/${i}`}))});
  const before=JSON.stringify(config);assert.throws(()=>RSS.assign(config,catalog,7,catalog.sources[0].id),/20/);assert.equal(JSON.stringify(config),before);
});
