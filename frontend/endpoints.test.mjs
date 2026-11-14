import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
const expected=[['Dashboard & Core App',['rifzki.my.id','laci.rifzki.my.id','link.rifzki.my.id','s.rifzki.my.id','s3.rifzki.my.id']],['Public Service & App',['ai.rifzki.my.id','blog.rifzki.my.id','jejak.rifzki.my.id','meet.rifzki.my.id','speed.rifzki.my.id','webmail.rifzki.my.id']],['Hosting App',['cpanel.rifzki.my.id','panel.rifzki.my.id']]];
test('the engine and public UI share exactly the requested 13 endpoints and three groups',async()=>{
  const endpoints=JSON.parse(await readFile('frontend/endpoints.json','utf8')),config=parse(await readFile('.upptimerc.yml','utf8'));
  assert.equal(endpoints.length,13);assert.equal(config.sites.length,13);
  assert.deepEqual([...new Set(endpoints.map(e=>e.group))],expected.map(([g])=>g));
  for(const [group,hosts]of expected)assert.deepEqual(endpoints.filter(e=>e.group===group).map(e=>e.host),hosts);
  assert.deepEqual(config.sites.map(s=>s.url),expected.flatMap(([,hosts])=>hosts.map(h=>'https://'+h)));
  assert.deepEqual(config.sites.map(s=>s.slug),endpoints.map(e=>e.slug));
});
