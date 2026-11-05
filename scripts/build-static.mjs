// Copy only runtime files. No framework, package install or app server is needed.
import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const web=join(root,'web'),out=join(root,'dist');
const snapshot=JSON.parse(readFileSync(join(web,'data/world.json'),'utf8'));
if(snapshot.schemaVersion!==1||!snapshot.sources?.length)throw new Error('Run python3 scripts/refresh-static-data.py first.');
// dist is generated output belonging only to this script.
if(existsSync(out))rmSync(out,{recursive:true});
mkdirSync(join(out,'assets/animation'),{recursive:true});
for(const name of readdirSync(web))if(/\.(html|css|js)$/.test(name)&&name!=='clay-scene.js')cpSync(join(web,name),join(out,name));
cpSync(join(web,'data'),join(out,'data'),{recursive:true});
for(const name of ['photographic-clay-room-v3.png','photographic-clay-room-night-v1.png'])cpSync(join(web,'assets',name),join(out,'assets',name));
for(const name of readdirSync(join(web,'assets/animation')))if(name.endsWith('.png'))cpSync(join(web,'assets/animation',name),join(out,'assets/animation',name));
if(existsSync(join(web,'CNAME')))cpSync(join(web,'CNAME'),join(out,'CNAME'));
writeFileSync(join(out,'.nojekyll'),'');
writeFileSync(join(out,'_headers'),'/data/*\n  Cache-Control: public, max-age=60, must-revalidate\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n');
console.log('Static site ready: '+out);
