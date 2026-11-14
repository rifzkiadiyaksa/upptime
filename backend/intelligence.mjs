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
function active(items,now){return(items||[]).filter(i=>Number.isFinite(Date.parse(i.startDate))&&Date.parse(i.startDate)<=+now&&(!i.endDate||Date.parse(i.endDate)>+now)).map(i=>({id:String(i.id||i.uuid||''),description:text(i.description)||'Regional connectivity event',start:i.startDate,asns:i.asns||i.asnDetails?.asn&&[i.asnDetails.asn]||[],locations:i.locations||i.locationDetails?.code&&[i.locationDetails.code]||[]}));}
export function normalizeIntelligence(results,region,now=new Date()){
  results=Object.fromEntries(Object.keys(PLANS).map(k=>[k,datasetValid(k,results[k])?results[k]:null]));
  const available=Object.values(results).filter(Boolean).length;
  const outages=active(results.outages?.annotations,now),anomalies=active(results.anomalies?.trafficAnomalies,now);
  const events=[...new Map([...outages,...anomalies].map(e=>[e.id,e])).values()];
  const http=summary(results.http),tls=summary(results.tls),ip=summary(results.ip),speed=summary(results.speed),quality=summary(results.quality);
  const leaks=results.bgp?.events?.filter(e=>e.finished===false).map(e=>({id:e.id,asn:e.leak_asn,detectedAt:e.detected_ts,countries:e.countries||[]}))||[];
  return {source:SOURCE,region,status:available===Object.keys(PLANS).length?'ready':available?'partial':'unavailable',checkedAt:now.toISOString(),
    correlation:{status:results.outages&&results.anomalies?'checked':results.outages||results.anomalies?'partial':'unavailable',events,interpretation:events.length?'Regional anomaly detected; causation is not established.':results.outages&&results.anomalies?'No active event reported in the queried regional datasets.':'Regional connectivity evidence is unavailable.'},
    latency:{status:speed||quality?'ready':'unavailable',idleMs:numeric(speed?.latencyIdle),loadedMs:numeric(speed?.latencyLoaded),iqiP50Ms:numeric(quality?.p50),updatedAt:results.speed?.meta?.lastUpdated||results.quality?.meta?.lastUpdated||null,scope:'Regional network measurements; not the same as application response time.'},
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
  return normalizeIntelligence(Object.fromEntries(results),region,now);
}
