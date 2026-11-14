import {test} from 'node:test';
import assert from 'node:assert/strict';
import {needsRefresh} from './freshness.mjs';
const now=Date.parse('2026-11-14T12:00:00Z'),endpoints=[{host:'a'},{host:'b'}];
const services=endpoints.map(e=>({...e,lastUpdated:new Date(now-60000).toISOString()}));
test('duplicate triggers skip only when every configured service was checked recently',()=>{
 assert.equal(needsRefresh({services},endpoints,now),false);
 for(const snapshot of [null,{services:services.slice(1)},{services:[services[0],{host:'b',lastUpdated:'invalid'}]},{services:[services[0],{host:'b',lastUpdated:new Date(now-180000).toISOString()}]},{services:[services[0],{host:'b',lastUpdated:new Date(now+120000).toISOString()}]}])assert.equal(needsRefresh(snapshot,endpoints,now),true);
});
