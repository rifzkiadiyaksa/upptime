import { readFile, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import tls from 'node:tls';
import { parse } from 'yaml';
import { mergeSamples } from './model.mjs';
const config = parse(await readFile('.upptimerc.yml', 'utf8'));
const operations = JSON.parse(await readFile('frontend/operations.json', 'utf8'));
const locations = JSON.parse(await readFile('frontend/locations.json', 'utf8'));
for (const m of operations.maintenance) {
  if (!m.id || !m.title || !Array.isArray(m.services) || !(Date.parse(m.end)>Date.parse(m.start))) throw new Error('Invalid maintenance entry');
}
for (const p of operations.probes) {
  if (!locations.some(l=>l.code===p.code) || !Number.isFinite(p.ping) || p.ping<0 || !Number.isFinite(Date.parse(p.checkedAt)) || !['Operational','Re-routed','Down'].includes(p.routing)) throw new Error('Invalid regional probe');
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
const summary = JSON.parse(await readFile('history/summary.json', 'utf8'));
const certs = new Map();
function certificate(host) {
  if (!certs.has(host)) certs.set(host, new Promise(resolve => {
    let finished = false;
    const done = value => { if (!finished) { finished=true; socket.destroy(); resolve(value); } };
    const socket = tls.connect({host,port:443,servername:host,rejectUnauthorized:true},()=>{
      const cert=socket.getPeerCertificate();
      done({valid:true,expires:cert.valid_to ? new Date(cert.valid_to).toISOString():null,checkedAt:now.toISOString()});
    });
    socket.setTimeout(8000,()=>done({valid:null,checkedAt:now.toISOString()}));
    socket.on('error', error => done({valid:['CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(error.code)?false:null,checkedAt:now.toISOString()}));
  }));
  return certs.get(host);
}
const telemetry = {};
const services = await Promise.all(summary.map(async s => {
  if (!/^[a-z0-9-]+$/.test(s.slug)) throw new Error('Invalid service slug');
  const current = parse(await readFile(`history/${s.slug}.yml`, 'utf8'));
  telemetry[s.slug]=mergeSamples(previous[s.slug],{at:current.lastUpdated,ms:current.responseTime,status:current.status},now);
  const url = /^https:\/\//.test(s.url) ? new URL(s.url) : null;
  const ssl = url ? await certificate(url.hostname) : null;
  const group = url ? 'Core Web & App' : /cdn|sg-server|kl-server|krw-server/.test(s.slug) ? 'Rifzki Edge & DNS Network' : 'Internal Infrastructure';
  // Expose only public UI fields, never the backend generator or upstream branding.
  return {name:s.name.replace(/^🔵\s*/,''),slug:s.slug,group,status:current.status,lastUpdated:current.lastUpdated,startTime:current.startTime,
    responseTime:current.responseTime,dailyMinutesDown:s.dailyMinutesDown||{},uptimeMonth:s.uptimeMonth,ssl,domainExpiry:url ? operations.domainExpiry[url.hostname]||null : null};
}));
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
    if(cached.incidentsAvailable){incidents=cached.incidents;incidentsAvailable=true;incidentsUpdatedAt=cached.incidentsUpdatedAt||cached.generatedAt;}
  }catch{}
  console.warn(`Incident API unavailable (${error.message}); ${incidentsAvailable?'using the previous verified local snapshot':'showing unavailable state'}.`);
}
for(const service of services){service.outageIntervals=incidents.filter(i=>i.services.includes(service.slug)&&(i.closed||service.status==='down')).map(i=>({start:i.created,end:i.closed||service.lastUpdated}));}
await rm('dist',{recursive:true,force:true});
await mkdir('dist/vendor',{recursive:true});
for (const file of ['index.html','styles.css','app.mjs','model.mjs']) await cp(`frontend/${file}`,`dist/${file}`);
await cp('frontend/public','dist/public',{recursive:true});
for (const file of ['leaflet.css','leaflet.js']) await cp(`node_modules/leaflet/dist/${file}`,`dist/vendor/${file}`);
await cp('node_modules/leaflet/LICENSE','dist/vendor/leaflet-LICENSE.txt');
await writeFile('dist/status.json',JSON.stringify({generatedAt:now.toISOString(),repository:`https://github.com/${repo}`,services,incidents,incidentsAvailable,incidentsUpdatedAt,locations,maintenance:operations.maintenance,probes:operations.probes,map:{cartoApiKey:process.env.CARTO_API_KEY||operations.map.cartoApiKey||''}}));
await writeFile('dist/telemetry.json',JSON.stringify(telemetry));
await writeFile('dist/manifest.webmanifest',JSON.stringify({name:'Rifzki System Status',short_name:'Rifzki Status',start_url:'./',display:'standalone',background_color:'#09090b',theme_color:'#f97316',icons:[{src:'./public/logo.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}));
await writeFile('dist/.nojekyll','');
if (config['status-website']?.cname) await writeFile('dist/CNAME',config['status-website'].cname+'\n');
console.log(`Built Rifzki System Status: ${services.length} services, ${incidents.length} incidents, ${locations.length} locations.`);
