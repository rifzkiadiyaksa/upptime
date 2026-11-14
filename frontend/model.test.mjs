import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyHistory, overall } from './model.mjs';
const now = new Date('2026-11-14T12:00:00Z');
const service = { status: 'up', startTime: '2026-11-12T03:00:00Z', lastUpdated: '2026-11-14T11:55:00Z', dailyMinutesDown: { '2026-11-12':1440, '2026-11-13':20 } };
test('UTC history distinguishes missing data, full and partial outages', () => {
  assert.deepEqual(dailyHistory(service, 4, now).map(d => d.status), ['unknown','down','degraded','up']);
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
