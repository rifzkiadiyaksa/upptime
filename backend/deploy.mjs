import {readFile} from 'node:fs/promises';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Backend deployment credentials are not configured.');
const metadata=JSON.parse(await readFile('backend/deployment.json','utf8')),name=metadata.name;delete metadata.name;
async function request(path,options={}){
  const response=await fetch('https://api.cloudflare.com/client/v4'+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(60000)});
  const payload=await response.json();if(!response.ok||payload.success!==true)throw Error('Backend API operation failed with HTTP '+response.status);return payload.result;
}
const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
for(const file of ['worker.mjs','intelligence.mjs'])form.append(file,new Blob([await readFile('backend/'+file,'utf8')],{type:'application/javascript+module'}),file);
await request(`/accounts/${account}/workers/scripts/${name}`,{method:'PUT',body:form});
await request(`/accounts/${account}/workers/scripts/${name}/subdomain`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:true})});
console.log('Rifzki Network Intelligence backend deployed. Existing secret bindings were retained.');
