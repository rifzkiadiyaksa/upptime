import {fetchRegionalSnapshot} from './intelligence-fetch.mjs?v=f79b19b052d5';

// The page owns this cache: static uptime refreshes never erase live regional evidence.
export function createIntelligenceClient({active,onChange,fetchSnapshot=fetchRegionalSnapshot,clock=Date.now}){
  const snapshots=new Map(),attempts=new Map(),pending=new Map();
  return {
    values:()=>[...snapshots.values()],
    async refresh(proxyUrl,region){
      if(!proxyUrl||!active()||!['ID','SG'].includes(region))return;
      if(pending.has(region))return pending.get(region);
      const now=clock(),previous=snapshots.get(region),age=now-Date.parse(previous?.checkedAt);
      if(age>=0&&age<300000||now-(attempts.get(region)??-Infinity)<120000)return;
      attempts.set(region,now);
      const request=(async()=>{
        const value=await fetchSnapshot(proxyUrl,region,{previous,now:new Date(now)});
        snapshots.set(region,value);onChange();
      })().finally(()=>pending.delete(region));
      pending.set(region,request);return request;
    }
  };
}
