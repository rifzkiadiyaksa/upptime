import { readFile, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { parse } from 'yaml';
const config = parse(await readFile('.upptimerc.yml', 'utf8'));
const summary = JSON.parse(await readFile('history/summary.json', 'utf8'));
const services = await Promise.all(summary.map(async s => {
  if (!/^[a-z0-9-]+$/.test(s.slug)) throw new Error('Invalid service slug');
  const current = parse(await readFile(`history/${s.slug}.yml`, 'utf8'));
  return { ...s, ...current, name: s.name.replace(/^🔵\s*/, ''), group: s.url.startsWith('https://') ? 'Websites & apps' : 'Infrastructure' };
}));
let incidents = [], incidentsAvailable = false;
if (process.env.GITHUB_TOKEN) {
  // Fetch at build time: visitors never need a GitHub token or API quota.
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues?state=all&labels=status&sort=updated&direction=desc&per_page=100`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!response.ok) throw new Error(`Incident request failed (${response.status})`);
  incidents = (await response.json()).filter(i => !i.pull_request).map(i => ({ title: i.title, url: i.html_url, state: i.state, created: i.created_at, updated: i.updated_at, closed: i.closed_at }));
  incidentsAvailable = true;
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'favicon.svg']) await cp(`frontend/${file}`, `dist/${file}`);
await writeFile('dist/status.json', JSON.stringify({ generatedAt: new Date().toISOString(), repository: `https://github.com/${config.owner}/${config.repo}`, services, incidents, incidentsAvailable }));
await writeFile('dist/.nojekyll', '');
if (config['status-website']?.cname) await writeFile('dist/CNAME', config['status-website'].cname + '\n');
console.log(`Built Rifzki status: ${services.length} services, ${incidents.length} incidents.`);
