import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rows} from './catalog.mjs';
import {LANGUAGES,translate} from './i18n.mjs';
import {normalizeIntelligence} from '../backend/intelligence.mjs';
const now=Date.parse('2026-11-14T12:00:00Z');
const location={code:'CGK',countryCode:'ID',name:'Jakarta',country:'Indonesia'};
const snapshot={region:'ID',checkedAt:new Date(now-60000).toISOString(),latency:{idleMs:30,jitterMs:4},correlation:{status:'checked',events:[]}};
test('all UI catalogue entries have six complete translations and stable placeholders',()=>{assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);for(const row of rows){assert.equal(row.length,6,row[0]);for(const entry of row){assert.ok(entry.trim(),row[0]);assert.deepEqual([...entry.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...row[0].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),row[0]);}}assert.equal(LANGUAGES[0],'en-US');});
test('mixed dynamic badges translate without swallowing technical identifiers',()=>{for(const lang of LANGUAGES.slice(1)){for(const phrase of ['9/10 Partial · 1 unknown','SSL Valid · 59d left','P50 · median','12 of 13 services operational. We\'re keeping watch.']){const result=translate(phrase,lang);if(!(lang==='id-ID'&&phrase==='P50 · median'))assert.notEqual(result,phrase);assert.doesNotMatch(result,/Partial|unknown|d left|operational/);if(lang!=='id-ID')assert.doesNotMatch(result,/median/);}}});
test('an event at the result cap cannot imply complete clean coverage',()=>{const r=normalizeIntelligence({outages:{annotations:Array.from({length:100},()=>({startDate:'2020-01-01',endDate:'2020-01-02'}))},anomalies:{trafficAnomalies:[]}},'ID',new Date(now));assert.equal(r.correlation.status,'partial');});
test('subscription is absent and clients poll static snapshots without visitor-driven Worker calls',async()=>{const html=await readFile('frontend/index.html','utf8'),app=await readFile('frontend/app.mjs','utf8'),ui=await readFile('frontend/network-ui.mjs','utf8');assert.doesNotMatch(html+app,/subscribe|subscription/i);assert.doesNotMatch(app+ui,/intelligenceProxyUrl|refreshNetworkIntelligence|workers\.dev/);assert.match(app,/document.visibilityState==='visible'/);assert.match(app,/if\(loading\)return/);assert.equal((html.match(/<option value="/g)||[]).length,6);assert.doesNotMatch(app,/rifzki-language/);});


test('Locations navigation and data collection are removed',async()=>{const html=await readFile('frontend/index.html','utf8'),app=await readFile('frontend/app.mjs','utf8'),build=await readFile('frontend/build.mjs','utf8');assert.doesNotMatch(html,/view-locations|leaflet/);assert.doesNotMatch(app,/locations:\[/);assert.doesNotMatch(build,/api\/location-intelligence|api\/infrastructure/);});
