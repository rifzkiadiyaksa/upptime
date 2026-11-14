import {collectIntelligence,REGIONS,PLANS} from './intelligence.mjs';
const ORIGINS=['https://status.rifzki.my.id','http://127.0.0.1:4173','http://localhost:4173'];
export async function handleRequest(request,env,ctx,{fetcher=fetch,cache=globalThis.caches?.default}={}){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Vary':'Origin','Cache-Control':'public, max-age=60'};
  if(origin&&ORIGINS.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!ORIGINS.includes(origin))return reply({source:'Rifzki Network Intelligence',status:'origin-not-allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
  if(request.method!=='GET')return reply({source:'Rifzki Network Intelligence',status:'method-not-allowed'},405);
  const knownPaths=['/api/network-intelligence','/radar/quality/iqi','/radar/attacks/layer7/summary','/radar/http/summary','/radar/http/summary/',...Object.values(PLANS).map(p=>p.path)];
  if(!knownPaths.includes(url.pathname))return reply({source:'Rifzki Network Intelligence',status:'not-found'},404);
  if([...url.searchParams.keys()].some(k=>k!=='region'))return reply({source:'Rifzki Network Intelligence',status:'invalid-query'},400);
  const region=url.searchParams.get('region')||'ID';
  if(!REGIONS.includes(region))return reply({source:'Rifzki Network Intelligence',status:'invalid-region'},400);
  const key=new Request(`https://rifzki-intelligence.internal/v1/${region}`);
  let data;
  try{const hit=cache?await cache.match(key):null;if(hit)data=await hit.json();}catch{}
  if(!data){
    data=await collectIntelligence(region,env.RADAR_API_TOKEN,{fetcher});
    if(cache&&['ready','partial'].includes(data.status))ctx.waitUntil(cache.put(key,new Response(JSON.stringify(data),{headers:{'Cache-Control':'public, max-age=300'}})).catch(()=>{}));
    console.log(JSON.stringify({event:'intelligence_snapshot',region,status:data.status}));
  }
  // Compatibility aliases return only normalized, branded fields, never an arbitrary upstream proxy.
  return reply(data,data.status==='unconfigured'?503:200);
}
export default {async fetch(request,env,ctx){try{return await handleRequest(request,env,ctx);}catch{console.error(JSON.stringify({event:'intelligence_error'}));return Response.json({source:'Rifzki Network Intelligence',status:'unavailable'},{status:503});}}};
