import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
test('configuration setup cannot regenerate workflows or publish the legacy UI',async()=>{
  const setup=parse(await readFile('.github/workflows/setup.yml','utf8'));
  const steps=Object.values(setup.jobs).flatMap(j=>j.steps||[]);
  assert.ok(steps.every(s=>!['site','update-template'].includes(s.with?.command)));
  assert.ok(steps.every(s=>!s.uses?.includes('actions-gh-pages')));
  assert.deepEqual(setup.on.push.branches,['master']);
});
test('frontend validates PRs and publishes only the custom build on master',async()=>{
  const site=parse(await readFile('.github/workflows/site.yml','utf8'));
  const steps=Object.values(site.jobs).flatMap(j=>j.steps||[]);
  assert.deepEqual(site.on.push.branches,['master']);
  assert.ok(site.on.pull_request);
  assert.ok(steps.some(s=>s.run==='npm test'));
  assert.ok(steps.some(s=>s.run==='npm run build'));
  const publish=steps.find(s=>s.uses?.includes('actions-gh-pages'));
  assert.equal(publish.with.publish_dir,'dist');
  assert.match(publish.if,/github\.ref == 'refs\/heads\/master'/);
  assert.match(publish.if,/github\.event_name != 'pull_request'/);
});
