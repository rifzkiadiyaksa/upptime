const SOURCE='Rifzki Network Intelligence';
export async function fetchRegionalSnapshot(proxyUrl,region,{fetcher=fetch,now=new Date(),previous,timeoutMs=25000}={}){
  if(!['ID','SG'].includes(region))throw Error('Unsupported region');
  let failureReason='source_unavailable';
  try{
    const url=new URL(proxyUrl);
    if(url.protocol!=='https:')throw Error('HTTPS required');
    url.searchParams.set('region',region);
    const response=await fetcher(url,{signal:AbortSignal.timeout(timeoutMs)});
    if(!response.ok){
      failureReason=[401,403].includes(response.status)?'authentication_failed':'source_unavailable';
      await response.body?.cancel();
      throw Error('Regional HTTP error');
    }
    const value=await response.json();
    const age=+now-Date.parse(value.checkedAt);
    if(value.source!==SOURCE||value.region!==region)throw Error('Invalid regional snapshot');
    if(value.status==='unconfigured')return value;
    if(['ready','partial'].includes(value.status)&&age>=-60000&&age<15*60000)return value;
    failureReason='source_unavailable';
  }catch(error){
    if(['TimeoutError','AbortError'].includes(error.name))failureReason='timeout';
  }
  const age=+now-Date.parse(previous?.checkedAt);
  if(previous?.source===SOURCE&&previous.region===region&&['ready','partial'].includes(previous.status)&&age>=0&&age<15*60000){
    // Preserve the original evidence timestamp. Never make old observations look fresh.
    return {...previous,delivery:'previous',failureReason,attemptedAt:now.toISOString()};
  }
  return {source:SOURCE,region,status:'unavailable',failureReason,attemptedAt:now.toISOString()};
}
