import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createIntelligenceClient} from './intelligence-client.mjs';
test('no regional requests without an active visible panel; only the selected country is collected',async()=>{
 let active=false,calls=[];const client=createIntelligenceClient({active:()=>active,onChange(){},fetchSnapshot:async(url,region)=>{calls.push(region);return {region,status:'ready',checkedAt:new Date().toISOString()};}});
 await client.refresh('https://proxy.example','ID');assert.deepEqual(calls,[]);active=true;await client.refresh('https://proxy.example','ID');assert.deepEqual(calls,['ID']);await client.refresh('https://proxy.example','SG');assert.deepEqual(calls,['ID','SG']);
});
test('concurrent refreshes share one request and verified data suppresses requests for five minutes',async()=>{
 let now=1000000000,calls=0,release;const client=createIntelligenceClient({active:()=>true,onChange(){},clock:()=>now,fetchSnapshot:async(url,region)=>{calls++;if(calls===1)await new Promise(r=>release=r);return {region,status:'ready',checkedAt:new Date(now).toISOString()};}});
 const first=client.refresh('https://proxy.example','ID'),second=client.refresh('https://proxy.example','ID');assert.equal(calls,1);release();await Promise.all([first,second]);now+=299999;await client.refresh('https://proxy.example','ID');assert.equal(calls,1);now+=1;await client.refresh('https://proxy.example','ID');assert.equal(calls,2);
});
test('failed collections have a two-minute retry delay',async()=>{
 let now=1000000000,calls=0;const client=createIntelligenceClient({active:()=>true,onChange(){},clock:()=>now,fetchSnapshot:async(url,region,{previous})=>{calls++;return previous?{...previous,delivery:'previous'}:{region,status:'unavailable'};}});
 await client.refresh('https://proxy.example','ID');await client.refresh('https://proxy.example','ID');assert.equal(calls,1);now+=120000;await client.refresh('https://proxy.example','ID');assert.equal(calls,2);
});
test('static builds publish proxy configuration without fetching Radar or the proxy',async()=>{
 const build=await readFile('frontend/build.mjs','utf8');assert.doesNotMatch(build,/fetchRegionalSnapshot|collectIntelligence|RADAR_API_TOKEN/);assert.match(build,/services,intelligence,intelligenceProxyUrl/);assert.match(build,/'intelligence-client.mjs','intelligence-fetch.mjs'/);
});

test('browser modules and their imports share a deployment revision to prevent cached mixed versions',async()=>{const build=await readFile('frontend/build.mjs','utf8');assert.match(build,/JSON.stringify\(moduleContents\)/);assert.match(build,/app\.mjs\?v=/);assert.match(build,/path\+'\?v='\+scriptRevision/);});
