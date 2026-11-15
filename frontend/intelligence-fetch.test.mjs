import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchRegionalSnapshot} from './intelligence-fetch.mjs';
const now=new Date('2026-11-15T00:40:00Z');
const previous={source:'Rifzki Network Intelligence',region:'ID',status:'ready',checkedAt:'2026-11-15T00:35:00Z',latency:{idleMs:30}};
test('regional snapshots accept verified fresh data and pass an abort signal',async()=>{
 let signal;const result=await fetchRegionalSnapshot('https://proxy.example/api/network-intelligence','ID',{now,fetcher:async(url,options)=>{assert.equal(url.searchParams.get('region'),'ID');signal=options.signal;return Response.json(previous);}});
 assert.equal(result.checkedAt,previous.checkedAt);assert.equal(result.delivery,undefined);assert.equal(signal.aborted,false);
});
test('a snapshot created during the request is accepted, but excessive clock skew is rejected',async()=>{
 for(const [checkedAt,expected] of [['2026-11-15T00:40:00.100Z','ready'],['2026-11-15T00:42:00Z','unavailable']]){
  const result=await fetchRegionalSnapshot('https://proxy.example','ID',{now,fetcher:async()=>Response.json({...previous,checkedAt})});assert.equal(result.status,expected);
 }
});
test('timeout preserves recent evidence with its real timestamp and explicit fallback label',async()=>{
 const result=await fetchRegionalSnapshot('https://proxy.example','ID',{now,previous,fetcher:async()=>{throw new DOMException('Timed out','TimeoutError');}});
 assert.equal(result.delivery,'previous');assert.equal(result.failureReason,'timeout');assert.equal(result.checkedAt,previous.checkedAt);assert.equal(result.latency.idleMs,30);
});
test('expired, future or wrong-region evidence cannot fill a failed regional request',async()=>{
 for(const old of [{...previous,checkedAt:'2026-11-15T00:24:59Z'},{...previous,checkedAt:'2026-11-15T00:41:00Z'},{...previous,region:'SG'}]){
  const result=await fetchRegionalSnapshot('https://proxy.example','ID',{now,previous:old,fetcher:async()=>Response.json({}, {status:503})});
  assert.equal(result.status,'unavailable');assert.equal(result.checkedAt,undefined);assert.equal(result.latency,undefined);
 }
});
test('authentication and invalid source failures remain explicit without inventing data',async()=>{
 const result=await fetchRegionalSnapshot('https://proxy.example','ID',{now,fetcher:async()=>Response.json({}, {status:403})});assert.equal(result.failureReason,'authentication_failed');
 const bad=await fetchRegionalSnapshot('https://proxy.example','ID',{now,fetcher:async()=>Response.json({...previous,region:'SG'})});assert.equal(bad.status,'unavailable');assert.equal(bad.checkedAt,undefined);
});
