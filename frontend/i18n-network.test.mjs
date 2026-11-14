import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rows} from './catalog.mjs';
import {LANGUAGES,translate} from './i18n.mjs';
import {locationEvidence,renderLocationCards} from './locations-ui.mjs';
import {normalizeIntelligence} from '../backend/intelligence.mjs';
const now=Date.parse('2026-11-14T12:00:00Z');
const location={code:'CGK',countryCode:'ID',name:'Jakarta',country:'Indonesia'};
const snapshot={region:'ID',checkedAt:new Date(now-60000).toISOString(),latency:{idleMs:30,jitterMs:4},correlation:{status:'checked',events:[]}};
test('all UI catalogue entries have six complete translations and stable placeholders',()=>{assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);for(const row of rows){assert.equal(row.length,6,row[0]);for(const entry of row){assert.ok(entry.trim(),row[0]);assert.deepEqual([...entry.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...row[0].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),row[0]);}}assert.equal(LANGUAGES[0],'en-US');});
test('mixed dynamic badges translate without swallowing technical identifiers',()=>{for(const lang of LANGUAGES.slice(1)){for(const phrase of ['9/10 Partial · 1 unknown','SSL Valid · 59d left','P50 · median','12 of 13 services operational. We\'re keeping watch.']){const result=translate(phrase,lang);if(!(lang==='id-ID'&&phrase==='P50 · median'))assert.notEqual(result,phrase);assert.doesNotMatch(result,/Partial|unknown|d left|operational/);if(lang!=='id-ID')assert.doesNotMatch(result,/median/);}}});
test('location cards share actual country evidence, never invent PoP ping or jitter',()=>{const data={regionalTelemetry:[snapshot],probes:[]};const evidence=locationEvidence(location,data,now);assert.equal(evidence.latency,30);assert.equal(evidence.jitter,4);assert.equal(evidence.probe,null);const html=renderLocationCards([location],{regionalTelemetry:[{...snapshot,checkedAt:new Date().toISOString()}],probes:[]});assert.match(html,/Direct PoP ping: — ms/);assert.match(html,/Direct PoP jitter: — ms/);});
test('stale, future and partial evidence cannot imply a healthy location',()=>{for(const checkedAt of [new Date(now-3600000).toISOString(),new Date(now+60000).toISOString()])assert.equal(locationEvidence(location,{regionalTelemetry:[{...snapshot,checkedAt}],probes:[]},now).state,'unknown');assert.equal(locationEvidence(location,{regionalTelemetry:[{...snapshot,correlation:{status:'partial',events:[]}}]},now).state,'unknown');});
test('country events synchronize card and marker state while preserving outage severity',()=>{for(const [kind,state]of [['anomaly','anomaly'],['outage','outage']])assert.equal(locationEvidence(location,{regionalTelemetry:[{...snapshot,correlation:{status:'checked',events:[{kind}]}}]},now).state,state);});
test('an event at the result cap cannot imply complete clean coverage',()=>{const r=normalizeIntelligence({outages:{annotations:Array.from({length:100},()=>({startDate:'2020-01-01',endDate:'2020-01-02'}))},anomalies:{trafficAnomalies:[]}},'ID',new Date(now));assert.equal(r.correlation.status,'partial');});
test('subscription is absent and clients poll static snapshots without visitor-driven Worker calls',async()=>{const html=await readFile('frontend/index.html','utf8'),app=await readFile('frontend/app.mjs','utf8'),ui=await readFile('frontend/network-ui.mjs','utf8');assert.doesNotMatch(html+app,/subscribe|subscription/i);assert.doesNotMatch(app+ui,/intelligenceProxyUrl|refreshNetworkIntelligence|workers\.dev/);assert.match(app,/document.visibilityState==='visible'/);assert.match(app,/if\(loading\)return/);assert.equal((html.match(/<option value="/g)||[]).length,6);assert.doesNotMatch(app,/rifzki-language/);});


test('ASN map context never geolocates an infrastructure network from its registry country',async()=>{
 const {networkEvidenceForLocation}=await import('./locations-ui.mjs');
 const country={countryCode:'US'};
 const data={intelligence:[],infrastructure:{checkedAt:new Date(now).toISOString(),networks:[{asn:13335,country:'US',status:'outage',events:[{kind:'outage',locations:[]}]}]}};
 assert.equal(networkEvidenceForLocation(country,data,now).state,'unknown');
 data.infrastructure.networks[0].events[0].locations=['US'];assert.equal(networkEvidenceForLocation(country,data,now).state,'outage');
});

