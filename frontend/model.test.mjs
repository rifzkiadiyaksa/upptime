import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyHistory, overall, percentile, samplesFor, mergeSamples, activeMaintenance, uptimeFor } from './model.mjs';
const now = new Date('2026-11-14T12:00:00Z');
const service = { status: 'up', startTime: '2026-11-12T03:00:00Z', lastUpdated: '2026-11-14T11:55:00Z', dailyMinutesDown: { '2026-11-12':1440, '2026-11-13':20 } };
test('UTC history distinguishes missing data, full and partial outages', () => {
  assert.deepEqual(dailyHistory(service, 4, now).map(d => d.status), ['unknown','down','degraded','up']);
});
test('percentiles use only valid measured values',()=>{
  assert.equal(percentile([30,10,20,NaN],.5),20);
  assert.equal(percentile([10,20,30],.95),30);
  assert.equal(percentile([],.99),null);
});
test('sample ranges exclude failures, out-of-range and future data',()=>{
  const samples=[{at:'2026-11-14T11:00:00Z',ms:20,status:'up'},{at:'2026-11-14T11:00:00Z',ms:0,status:'down'},{at:'2026-11-15T11:00:00Z',ms:10,status:'up'},{at:'2026-10-14T11:00:00Z',ms:10,status:'up'}];
  assert.equal(samplesFor(samples,24,now).length,1);
});
test('persistent telemetry deduplicates checks and expires old samples',()=>{
  const p={at:'2026-11-14T11:00:00Z',ms:20,status:'up'};
  assert.equal(mergeSamples([p,{...p,at:'2025-01-01T00:00:00Z'}],p,now).length,1);
});
test('maintenance is scoped to components and its actual time window',()=>{
  const items=[{start:'2026-11-14T11:00:00Z',end:'2026-11-14T13:00:00Z',services:['web']}];
  assert.equal(activeMaintenance(items,now,'web').length,1);
  assert.equal(activeMaintenance(items,now,'dns').length,0);
  assert.equal(activeMaintenance(items,new Date('2026-11-14T14:00:00Z'),'web').length,0);
});
test('selected-period uptime excludes unknown days',()=>{
  assert.equal(uptimeFor([{uptime:100},{uptime:50},{uptime:null}]),75);
  assert.equal(uptimeFor([{uptime:null}]),null);
});
test('selected-period uptime weights partial days by actual observed minutes',()=>{
  assert.ok(Math.abs(uptimeFor([{uptime:0,observedMinutes:1},{uptime:100,observedMinutes:1440}])-99.9306)<0.001);
});
test('ongoing incidents cover the observed portion of today and overlap is not double-counted',()=>{
  const s={...service,status:'down',dailyMinutesDown:{},outageIntervals:[{start:'2026-11-13T00:00:00Z',end:service.lastUpdated},{start:'2026-11-14T02:00:00Z',end:service.lastUpdated}]};
  const day=dailyHistory(s,1,now)[0];
  assert.equal(day.uptime,0);
  assert.equal(day.status,'down');
  assert.equal(day.minutes,715);
});
test('missing ongoing outage boundaries never render a green day',()=>{
  assert.equal(dailyHistory({...service,status:'down',dailyMinutesDown:{}},1,now)[0].status,'unknown');
});
test('future history after the final check stays unknown', () => {
  assert.equal(dailyHistory(service, 1, new Date('2026-11-15T12:00:00Z'))[0].status, 'unknown');
});
test('current health distinguishes full, partial, healthy and stale monitoring', () => {
  assert.equal(overall([service], now), 'up');
  assert.equal(overall([service, {...service, status:'down'}], now), 'degraded');
  assert.equal(overall([{...service, status:'down'}], now), 'down');
  assert.equal(overall([service], new Date('2026-11-14T12:30:01Z')), 'unknown');
  assert.equal(overall([], now), 'unknown');
});

test('a check timestamp in the future cannot imply healthy monitoring',()=>{assert.equal(overall([{...service,lastUpdated:'2030-01-01T00:00:00Z'}],now),'unknown');});
