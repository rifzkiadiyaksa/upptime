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

test('uptime completion refreshes the public snapshot and duplicate triggers are bounded',async()=>{
 const site=parse(await readFile('.github/workflows/site.yml','utf8'));
 assert.deepEqual(site.on.workflow_run.workflows,['Uptime CI']);
 assert.deepEqual(site.on.workflow_run.branches,['master']);
 assert.match(site.jobs.release.if,/conclusion == 'success'/);
 const steps=site.jobs.release.steps;
 assert.equal(steps.find(s=>s.id==='freshness').run,'node frontend/freshness.mjs');
 for(const step of steps.filter(s=>['npm ci','npm test','npm run build'].includes(s.run)||s.uses?.includes('actions-gh-pages')))assert.match(step.if,/freshness.outputs.refresh == 'true'/);
 const config=parse(await readFile('.upptimerc.yml','utf8'));
 const uptime=parse(await readFile('.github/workflows/monitor.yml','utf8'));
 assert.equal(config.workflowSchedule.uptime,uptime.on.schedule[0].cron);
 assert.equal(config.workflowSchedule.staticSite,site.on.schedule[0].cron);
});

test('fresh monitor workflow registers the native five-minute schedule and reports its trigger',async()=>{
 const monitor=parse(await readFile('.github/workflows/monitor.yml','utf8'));
 assert.equal(monitor.name,'Uptime CI');
 assert.equal(monitor.on.schedule[0].cron,'2-59/5 * * * *');
 assert.ok(Object.hasOwn(monitor.on,'workflow_dispatch'));
 assert.equal(monitor.jobs.release['timeout-minutes'],8);
 assert.ok(monitor.jobs.release.steps.some(s=>s.name==='Record trigger diagnostics'));
 const {readdir}=await import('node:fs/promises');
 assert.ok(!(await readdir('.github/workflows')).includes('uptime.yml'));
});

test('monitor API errors retry at most three times and independent snapshots still refresh on failure',async()=>{
 const monitor=parse(await readFile('.github/workflows/monitor.yml','utf8'));
 const attempts=monitor.jobs.release.steps.filter(s=>s.uses==='upptime/uptime-monitor@v1.46.5');
 assert.equal(attempts.length,3);
 assert.equal(attempts[0]['continue-on-error'],true);
 assert.equal(attempts[1]['continue-on-error'],true);
 assert.equal(attempts[2]['continue-on-error'],undefined);
 assert.match(attempts[1].if,/monitor_1.outcome == 'failure'/);
 assert.match(attempts[2].if,/monitor_2.outcome == 'failure'/);
 assert.deepEqual(attempts[0].env,attempts[1].env);
 assert.deepEqual(attempts[0].env,attempts[2].env);
 const site=parse(await readFile('.github/workflows/site.yml','utf8'));
 assert.match(site.jobs.release.if,/conclusion == 'failure'/);
 assert.deepEqual(site.on.workflow_run.branches,['master']);
});
