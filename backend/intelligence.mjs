import {COUNTRIES} from './countries.mjs';
export const SOURCE='Rifzki Network Intelligence';
export const REGIONS=['ID','SG'];
export const PLANS={
  outages:{path:'/radar/annotations/outages',query:{dateRange:'7d',limit:100}},
  anomalies:{path:'/radar/traffic_anomalies',query:{dateRange:'1d',limit:100,status:'VERIFIED'}},
  speed:{path:'/radar/quality/speed/summary',query:{}},
  quality:{path:'/radar/quality/iqi/summary',query:{dateRange:'1d',metric:'LATENCY'}},
  attacks:{path:'/radar/attacks/layer7/summary/mitigation_product',query:{dateRange:'1d'}},
  bgp:{path:'/radar/bgp/leaks/events',query:{dateRange:'1d',per_page:25}},
  http:{path:'/radar/http/summary/http_version',query:{dateRange:'1d'}},
  tls:{path:'/radar/http/summary/tls_version',query:{dateRange:'1d'}},
  ip:{path:'/radar/http/summary/ip_version',query:{dateRange:'1d'}}
};
const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const text=v=>String(v||'').replace(/Cloudflare|Upptime|Instatus/gi,'the upstream provider').replace(/https?:\/\/\S+/gi,'').slice(0,500);
const summary=r=>r?.summary_0||null;
function datasetValid(key,r){
  if(!r||typeof r!=='object')return false;
  if(key==='outages')return Array.isArray(r.annotations);
  if(key==='anomalies')return Array.isArray(r.trafficAnomalies);
  if(key==='bgp')return Array.isArray(r.events);
  const field={speed:'latencyIdle',quality:'p50',http:'HTTP/3',tls:'TLS 1.3',ip:'IPv6'}[key];
  if(field)return numeric(summary(r)?.[field])!==null;
  return key==='attacks'&&!!summary(r)&&Object.values(summary(r)).some(v=>numeric(v)!==null);
}
export function active(items,now){return(items||[]).filter(i=>Number.isFinite(Date.parse(i.startDate))&&Date.parse(i.startDate)<=+now&&(!i.endDate||Date.parse(i.endDate)>+now)).map(i=>({id:String(i.id||i.uuid||''),kind:i.eventType==='OUTAGE'?'outage':'anomaly',description:text(i.description)||'Regional connectivity event',start:i.startDate,asns:i.asns||i.asnDetails?.asn&&[i.asnDetails.asn]||[],locations:i.locations||i.locationDetails?.code&&[i.locationDetails.code]||[]}));}
export function normalizeIntelligence(results,region,now=new Date()){
  results=Object.fromEntries(Object.keys(PLANS).map(k=>[k,datasetValid(k,results[k])?results[k]:null]));
  const available=Object.values(results).filter(Boolean).length;
  const outages=active(results.outages?.annotations?.map(e=>({...e,eventType:'OUTAGE'})),now),anomalies=active(results.anomalies?.trafficAnomalies,now);
  const complete=results.outages&&results.anomalies&&results.outages.annotations.length<100&&results.anomalies.trafficAnomalies.length<100;
  const events=[...new Map([...outages,...anomalies].map(e=>[e.id,e])).values()];
  const http=summary(results.http),tls=summary(results.tls),ip=summary(results.ip),speed=summary(results.speed),quality=summary(results.quality);
  const leaks=results.bgp?.events?.filter(e=>e.finished===false).map(e=>({id:e.id,asn:e.leak_asn,detectedAt:e.detected_ts,countries:e.countries||[]}))||[];
  return {source:SOURCE,region,status:available===Object.keys(PLANS).length?'ready':available?'partial':'unavailable',checkedAt:now.toISOString(),
    correlation:{status:complete?'checked':results.outages||results.anomalies?'partial':'unavailable',events,interpretation:events.length?'Regional anomaly detected; causation is not established.':results.outages&&results.anomalies?'No active event reported in the queried regional datasets.':'Regional connectivity evidence is unavailable.'},
    latency:{status:speed||quality?'ready':'unavailable',idleMs:numeric(speed?.latencyIdle),jitterMs:numeric(speed?.jitterIdle),window:results.speed?.meta?.dateRange?.[0]||null,loadedMs:numeric(speed?.latencyLoaded),iqiP50Ms:numeric(quality?.p50),updatedAt:results.speed?.meta?.lastUpdated||results.quality?.meta?.lastUpdated||null,scope:'Regional network measurements; not the same as application response time.'},
    threats:{status:results.attacks?'ready':'unavailable',ddosShare:numeric(summary(results.attacks)?.DDOS),wafShare:numeric(summary(results.attacks)?.WAF),scope:'Regional share of observed attack mitigations. Rifzki account protection status is not verified.',updatedAt:results.attacks?.meta?.lastUpdated||null},
    bgp:{status:results.bgp?(results.bgp.complete===false?'partial':'checked'):'unavailable',ongoingLeaks:leaks,scope:'Regional route-leak events; not an audit of Rifzki routes.'},
    adoption:{http3:numeric(http?.['HTTP/3']),tls13:numeric(tls?.['TLS 1.3']),ipv6:numeric(ip?.IPv6),scope:'Regional traffic adoption percentages',updatedAt:results.http?.meta?.lastUpdated||null},
    availability:Object.fromEntries(Object.keys(PLANS).map(k=>[k,!!results[k]]))};
}
async function limitedJson(response){
  if(!response.body)return null;
  const reader=response.body.getReader();let bytes=0,chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2*1024*1024){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
  const out=new Uint8Array(bytes);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder().decode(out));
}
export async function collectIntelligence(region,token,{fetcher=fetch,now=new Date()}={}){
  if(!REGIONS.includes(region))throw Error('Unsupported region');
  if(!token)return {...normalizeIntelligence({},region,now),status:'unconfigured'};
  const results=await Promise.all(Object.entries(PLANS).map(async([key,plan])=>{
    const target=new URL('https://api.cloudflare.com/client/v4'+plan.path);
    target.search=new URLSearchParams({...plan.query,...(key==='bgp'?{involvedCountry:region}:{location:region}),format:'json'}).toString();
    try{const r=await fetcher(target,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});if(!r.ok){await r.body?.cancel();return [key,null];}const data=await limitedJson(r);if(key==='bgp'&&data?.result)data.result.complete=data.result_info?data.result_info.total_count<=(data.result.events?.length||0):(data.result.events?.length||0)<25;return [key,data?.success===true?data.result:null];}catch{return [key,null];}
  }));
  const normalized=normalizeIntelligence(Object.fromEntries(results),region,now);
  const directory=await radar('/radar/entities/asns',{location:region,limit:5,orderBy:'POPULATION'},token,fetcher);
  normalized.networks=await Promise.all((directory?.asns||[]).slice(0,5).map(async entry=>{const metrics=await radar('/radar/quality/speed/summary',{asn:String(entry.asn),location:region},token,fetcher);const evidence=await asnEvents(entry.asn,region,token,fetcher,now);const events=evidence.events;return {asn:entry.asn,name:entry.aka||entry.name,organization:entry.orgName,country:entry.country,city:null,role:'Regional ISP',latencyMs:numeric(metrics?.summary_0?.latencyIdle),jitterMs:numeric(metrics?.summary_0?.jitterIdle),updatedAt:metrics?.meta?.lastUpdated||null,events,status:events.some(e=>e.kind==='outage')?'outage':events.length?'anomaly':evidence.complete?'clear':'unknown'};}));
  return normalized;
}

async function radar(path,query,token,fetcher){try{const u=new URL('https://api.cloudflare.com/client/v4'+path);u.search=new URLSearchParams({...query,format:'json'});const r=await fetcher(u,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});if(!r.ok){await r.body?.cancel();return null;}const d=await limitedJson(r);return d?.success?d.result:null;}catch{return null;}}
export async function collectLocation(region,token,{fetcher=fetch,now=new Date()}={}){
 if(!COUNTRIES.includes(region))throw Error('Unsupported country');
 if(!token)return {source:SOURCE,region,status:'unconfigured'};
 const entries=await Promise.all(['speed','quality','outages','anomalies'].map(async k=>[k,await radar(PLANS[k].path,{...PLANS[k].query,location:region},token,fetcher)]));
 const result=normalizeIntelligence(Object.fromEntries(entries),region,now);return {...result,status:entries.every(([k,v])=>datasetValid(k,v))?'ready':entries.some(([k,v])=>datasetValid(k,v))?'partial':'unavailable'};
}

const INFRA_HOSTS=["rifzki.my.id", "laci.rifzki.my.id", "link.rifzki.my.id", "s.rifzki.my.id", "s3.rifzki.my.id", "ai.rifzki.my.id", "blog.rifzki.my.id", "jejak.rifzki.my.id", "meet.rifzki.my.id", "speed.rifzki.my.id", "webmail.rifzki.my.id", "cpanel.rifzki.my.id", "panel.rifzki.my.id"];
export async function collectInfrastructure(token,{fetcher=fetch,now=new Date()}={}){
 if(!token)return {source:SOURCE,status:'unconfigured',checkedAt:now.toISOString(),networks:[]};
 const observations=[];
 for(let i=0;i<INFRA_HOSTS.length;i+=4)observations.push(...await Promise.all(INFRA_HOSTS.slice(i,i+4).map(async host=>{try{const r=await fetcher('https://dns.google/resolve?name='+host+'&type=A',{signal:AbortSignal.timeout(7000)});const d=await limitedJson(r);return {host,addresses:(d?.Answer||[]).filter(a=>a.type===1).slice(0,1).map(a=>a.data)};}catch{return {host,addresses:[]};}})));
 const networks=new Map();
 for(const address of [...new Set(observations.flatMap(o=>o.addresses))].slice(0,13)){
  const record=(await radar('/radar/entities/ip',{ip:address},token,fetcher))?.ip;if(!record?.asn)continue;
  const asn=Number(record.asn);if(!Number.isInteger(asn))continue;
  if(!networks.has(asn))networks.set(asn,{asn,name:record.asnName,organization:record.asnOrgName,country:record.asnLocation||record.location,city:null,role:'Infrastructure edge',services:[],latencyMs:null,jitterMs:null,status:'unknown',events:[]});
  networks.get(asn).services.push(...observations.filter(o=>o.addresses.includes(address)).map(o=>o.host));
 }
 const list=[...networks.values()].slice(0,4);
 for(const network of list){const evidence=await asnEvents(network.asn,null,token,fetcher,now);const metrics=await radar('/radar/quality/speed/summary',{asn:String(network.asn)},token,fetcher);network.events=evidence.events;network.status=evidence.events.some(e=>e.kind==='outage')?'outage':evidence.events.length?'anomaly':evidence.complete?'clear':'unknown';network.latencyMs=numeric(metrics?.summary_0?.latencyIdle);network.jitterMs=numeric(metrics?.summary_0?.jitterIdle);network.updatedAt=metrics?.meta?.lastUpdated||null;network.scope='Global ASN benchmark';}
 return {source:SOURCE,status:list.length?'ready':'unavailable',truncated:networks.size>4,checkedAt:now.toISOString(),networks:list};
}

async function asnEvents(asn,region,token,fetcher,now){const query={asn:String(asn)};const [outages,anomalies]=await Promise.all([radar(PLANS.outages.path,{...PLANS.outages.query,...query},token,fetcher),radar(PLANS.anomalies.path,{...PLANS.anomalies.query,...query},token,fetcher)]);const complete=Array.isArray(outages?.annotations)&&outages.annotations.length<100&&Array.isArray(anomalies?.trafficAnomalies)&&anomalies.trafficAnomalies.length<100;return {complete,events:[...active(outages?.annotations?.map(e=>({...e,eventType:'OUTAGE'})),now),...active(anomalies?.trafficAnomalies,now)]};}


