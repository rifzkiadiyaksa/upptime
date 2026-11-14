import {createHash} from 'node:crypto';
import {buildArchive} from './archive-build.mjs';
import { readFile, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { parse } from 'yaml';
import { mergeSamples } from './model.mjs';
import { inspectEndpoint } from './inspect.mjs';
import { collectIntelligence } from '../backend/intelligence.mjs';
const config = parse(await readFile('.upptimerc.yml', 'utf8'));
const operations = JSON.parse(await readFile('frontend/operations.json', 'utf8'));
for (const m of operations.maintenance) {
  if (!m.id || !m.title || !Array.isArray(m.services) || !(Date.parse(m.end)>Date.parse(m.start))) throw new Error('Invalid maintenance entry');
}
const now = new Date();
const repo = `${config.owner}/${config.repo}`;
const headers = { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
  return response.json();
}
// Explicitly fall back only on the first deployment (404), never silently erase stored telemetry.
let previous = {};
if (process.env.CI) {
  const response = await fetch(`https://raw.githubusercontent.com/${repo}/gh-pages/telemetry.json`, { signal: AbortSignal.timeout(20000) });
  if (response.ok) previous = await response.json();
  else if (response.status !== 404) throw new Error(`Previous telemetry unavailable (${response.status})`);
}
const summary = JSON.parse(await readFile('history/summary.json','utf8'));
const endpoints=JSON.parse(await readFile('frontend/endpoints.json','utf8'));
if(config.sites.length!==endpoints.length||endpoints.some(e=>!config.sites.some(s=>s.slug===e.slug&&s.url==='https://'+e.host)))throw Error('Monitoring configuration and endpoint manifest differ');
for(const window of operations.maintenance)if(!window.services.length||window.services.some(slug=>!endpoints.some(e=>e.slug===slug)))throw Error('Maintenance must reference configured endpoints');
const telemetry={};
async function readCurrent(slug){try{return parse(await readFile('history/'+slug+'.yml','utf8'));}catch{return null;}}
const inspections=[];
for(let i=0;i<endpoints.length;i+=4)inspections.push(...await Promise.all(endpoints.slice(i,i+4).map(inspectEndpoint)));
const services=await Promise.all(endpoints.map(async(e,i)=>{
  const old=summary.find(s=>s.slug===e.slug),history=await readCurrent(e.slug),current=inspections[i];
  telemetry[e.slug]=mergeSamples(previous[e.slug],{at:current.lastUpdated,ms:current.responseTime,status:current.status},new Date());
  return {name:e.host,host:e.host,slug:e.slug,group:e.group,...current,startTime:history?.startTime||previous[e.slug]?.[0]?.at||null,dailyMinutesDown:old?.dailyMinutesDown||{},uptimeMonth:old?.uptimeMonth||null,domainExpiry:operations.domainExpiry[e.host]||null};
}));
let intelligence=[];
const proxyUrl=process.env.INTELLIGENCE_PROXY_URL||operations.intelligence?.proxyUrl||'';
if(proxyUrl){
  intelligence=await Promise.all(['ID','SG'].map(async region=>{try{const u=new URL(proxyUrl);if(u.protocol!=='https:')throw Error('HTTPS required');u.searchParams.set('region',region);const r=await fetch(u,{signal:AbortSignal.timeout(15000)});const value=await r.json();if(value.source!=='Rifzki Network Intelligence'||value.region!==region)throw Error('Invalid proxy snapshot');return value;}catch{return {source:'Rifzki Network Intelligence',region,status:'unavailable'};}}));
}else intelligence=await Promise.all(['ID','SG'].map(region=>collectIntelligence(region,process.env.RADAR_API_TOKEN)));
let incidents=[],incidentsAvailable=false,incidentsUpdatedAt=null;
try {
  // Keep recent and active incidents, with pagination, independent of visitors' API quotas.
  for (let page=1;page<=5;page++) {
    const batch=await github(`issues?state=all&labels=status&sort=updated&direction=desc&per_page=100&page=${page}`);
    incidents.push(...batch.filter(i=>!i.pull_request));
    if (batch.length<100) break;
  }
  const active=await github('issues?state=open&labels=status&per_page=100');
  incidents=[...new Map([...incidents,...active].filter(i=>!i.pull_request).map(i=>[i.number,i])).values()];
  incidents=await Promise.all(incidents.map(async i=>{
    const stages = ['investigating','identified','monitoring','resolved'];
    const stage=i.state==='closed'?'resolved':stages.find(s=>i.labels.some(l=>l.name.toLowerCase()===s))||'investigating';
    let updates=[];
    // Fetch timelines lazily at build time for active incidents and the most recent resolved reports.
    if (i.comments && (i.state==='open' || incidents.indexOf(i)<20)) {
      const comments=await github(`issues/${i.number}/comments?per_page=100`);
      updates=comments.map(c=>({at:c.created_at,stage:stages.find(s=>new RegExp(`\\b${s}\\b`,'i').test(c.body))||'update',text:c.body,url:c.html_url}));
    }
    return {number:i.number,title:i.title.replace(/^[🛑✅🔵\s]+/u,''),url:i.html_url,state:i.state,stage,created:i.created_at,updated:i.updated_at,closed:i.closed_at,services:i.labels.map(l=>l.name).filter(l=>services.some(s=>s.slug===l)),timeline:[{at:i.created_at,stage:'investigating',text:i.body||'Incident reported.'},...updates,...(i.closed_at?[{at:i.closed_at,stage:'resolved',text:'Service restored. Incident closed.'}]:[])]};
  }));
  incidents.sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated));
  incidentsAvailable=true;
  incidentsUpdatedAt=now.toISOString();
} catch(error) {
  if (process.env.CI) throw error;
  incidents=[];
  try{
    const cached=JSON.parse(await readFile('dist/status.json','utf8'));
    if(cached.incidentsAvailable){incidents=cached.incidents;if(cached.archiveVersion){const idx=JSON.parse(await readFile('dist/archive/index.json','utf8')),stored=[];for(const [month,meta]of Object.entries(idx.months))for(let page=1;page<=meta.pages;page++){const payload=JSON.parse(await readFile(`dist/archive/${idx.version}/${month}/${page}.json`,'utf8'));stored.push(...payload.entries.filter(i=>i.kind==='incident'));}incidents=[...new Map(stored.map(i=>[i.number,i])).values()];}incidentsAvailable=true;incidentsUpdatedAt=cached.incidentsUpdatedAt||cached.generatedAt;}
  }catch{}
  console.warn(`Incident API unavailable (${error.message}); ${incidentsAvailable?'using the previous verified local snapshot':'showing unavailable state'}.`);
}
incidents=incidents.filter(i=>i.services?.some(slug=>services.some(s=>s.slug===slug)));
for(const service of services){service.outageIntervals=incidents.filter(i=>i.services.includes(service.slug)&&(i.closed||service.status==='down')).map(i=>({start:i.created,end:i.closed||service.lastUpdated}));}
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for (const file of ['index.html','styles.css','security-styles.css','app.mjs','model.mjs','security-ui.mjs','network-ui.mjs','i18n.mjs','catalog.mjs']) await cp(`frontend/${file}`,`dist/${file}`);
const cssRevision=createHash('sha256').update(await readFile('dist/styles.css')).digest('hex').slice(0,12);
await writeFile('dist/index.html',(await readFile('dist/index.html','utf8')).replace('./styles.css','./styles.css?v='+cssRevision));
await mkdir('dist/public',{recursive:true});for(const asset of ['logo.svg','favicon.svg'])await cp('frontend/public/'+asset,'dist/public/'+asset);
const archive=buildArchive(incidents,operations.maintenance,now);
for(const [path,value]of Object.entries(archive.files)){await mkdir(path.slice(0,path.lastIndexOf('/')).replace(/^archive/,'dist/archive'),{recursive:true});await writeFile('dist/'+path,JSON.stringify(value));}
await mkdir('dist/archive',{recursive:true});await writeFile('dist/archive/index.json',JSON.stringify(archive.index));
const publicIncidents=incidents.filter((i,index)=>i.state==='open'||index<3).map(i=>i.state==='open'?i:{...i,timeline:[]});
await writeFile('dist/status.json',JSON.stringify({measurementOrigin:process.env.GITHUB_ACTIONS?'GitHub Actions runner':'Local preview runner',generatedAt:now.toISOString(),repository:`https://github.com/${repo}`,services,intelligence,archiveVersion:archive.index.version,incidents:publicIncidents,incidentsAvailable,incidentsUpdatedAt,maintenance:operations.maintenance}));
await writeFile('dist/telemetry.json',JSON.stringify(telemetry));
await writeFile('dist/manifest.webmanifest',JSON.stringify({name:'Rifzki System Status',short_name:'Rifzki Status',start_url:'./',display:'standalone',background_color:'#09090b',theme_color:'#f97316',icons:[{src:'./public/logo.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}));
await writeFile('dist/.nojekyll','');
if (config['status-website']?.cname) await writeFile('dist/CNAME',config['status-website'].cname+'\n');
console.log(`Built Rifzki System Status: ${services.length} services, ${incidents.length} incidents, paginated archive.`);

