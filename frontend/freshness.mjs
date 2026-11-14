import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Check actual service timestamps, not the build timestamp. Never hide stale checks.
export function needsRefresh(snapshot,endpoints,now=Date.now()) {
  return snapshot?.services?.length!==endpoints.length || endpoints.some(endpoint=>{
    const service=snapshot.services.find(s=>s.host===endpoint.host);
    const at=Date.parse(service?.lastUpdated);
    return !Number.isFinite(at)||at>now+60000||now-at>=180000;
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let refresh=true;
  if(['schedule','workflow_run'].includes(process.env.GITHUB_EVENT_NAME)){
    try{
      const endpoints=JSON.parse(await readFile('frontend/endpoints.json','utf8'));
      const response=await fetch('https://status.rifzki.my.id/status.json',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
      if(response.ok)refresh=needsRefresh(await response.json(),endpoints);
    }catch{/* Missing or unreachable data always warrants a new check. */}
  }
  console.log(refresh?'Collecting a new monitoring snapshot':'Recent checks already published; skipping duplicate build');
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`refresh=${refresh}\n`);
}
