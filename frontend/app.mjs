import { dailyHistory, health, overall } from './model.mjs';
const $ = id => document.getElementById(id);
const labels = { up: 'Operational', down: 'Outage', degraded: 'Partial outage', unknown: 'Awaiting fresh data' };
const titles = { up: 'All systems operational', down: 'Major service outage', degraded: 'Some services are disrupted', unknown: 'Status updates delayed' };
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const date = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
let data, visible = 5;
function render() {
  const state = overall(data.services);
  const overview = document.querySelector('.overview');
  overview.className = `overview ${state}`;
  $('overall-title').textContent = titles[state];
  $('overall-icon').textContent = state === 'up' ? '✓' : state === 'unknown' ? '◷' : '!';
  const operational = data.services.filter(s => health(s) === 'up').length;
  $('overall-description').textContent = state === 'up' ? 'Everything is running smoothly across our services.' : state === 'unknown' ? 'Some checks are older than 30 minutes. Status is unconfirmed.' : `${operational} of ${data.services.length} services are operational. We're keeping watch.`;
  $('live').textContent = state === 'unknown' ? '◷ Delayed' : '● Monitoring';
  const checked = data.services.map(s => Date.parse(s.lastUpdated)).filter(Number.isFinite);
  $('last-updated').textContent = checked.length ? `Latest check ${new Date(Math.max(...checked)).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' })}` : 'Check time unavailable';
  const days = Number($('period').value);
  $('service-list').innerHTML = [...new Set(data.services.map(s => s.group))].map(group => {
    const services = data.services.filter(s => s.group === group);
    return `<div class="group"><div class="group-title">${escape(group)}<span>${services.length} services</span></div>${services.map(s => {
      const state = health(s), history = dailyHistory(s, days);
      return `<article class="service ${state}"><div class="service-top"><span class="service-name">${escape(s.name)}</span><span class="state">${labels[state]}</span></div><div class="bars" role="img" aria-label="${days}-day UTC availability for ${escape(s.name)}">${history.map(d => {
        const detail = `${d.date} UTC\n${d.status === 'unknown' ? 'No monitoring data' : d.minutes ? `${d.minutes} minutes of downtime` : 'No downtime recorded'}`;
        return `<span class="bar ${d.status}" tabindex="0" aria-label="${escape(detail)}" data-tip="${escape(detail)}"></span>`;
      }).join('')}</div><div class="service-meta"><span>${date(history[0].date)}</span><strong>${escape(s.uptimeMonth || '—')} uptime · last 30 days</strong><span>Today</span></div></article>`;
    }).join('')}</div>`;
  }).join('');
  renderIncidents();
}
function renderIncidents() {
  const incidents = data.incidents;
  $('incident-count').textContent = data.incidentsAvailable ? `(${incidents.length})` : '';
  $('all-incidents').href = `${data.repository}/issues?q=label%3Astatus`;
  $('more').hidden = visible >= incidents.length;
  if (!data.incidentsAvailable) {
    $('incident-list').innerHTML = '<div class="empty"><strong>Incident history is unavailable</strong>Visit the incident archive for the latest updates.</div>';
    return;
  }
  if (!incidents.length) {
    $('incident-list').innerHTML = '<div class="empty"><strong>No incidents reported</strong>Any service disruptions will appear here.</div>';
    return;
  }
  $('incident-list').innerHTML = incidents.slice(0, visible).map(i => `<article class="incident"><time datetime="${escape(i.created)}">${date(i.created)}</time><div><span class="badge ${i.state === 'open' ? 'open' : ''}">${i.state === 'open' ? 'Investigating' : 'Resolved'}</span><h3><a href="${escape(i.url)}">${escape(i.title.replace(/^[🛑✅]\s*/, ''))} ↗</a></h3><p>${i.closed ? 'Resolved' : 'Updated'} ${date(i.closed || i.updated)}</p></div></article>`).join('');
}
async function load() {
  $('refresh').disabled = true;
  try {
    const response = await fetch(`./status.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load status');
    const next = await response.json();
    if (!Array.isArray(next.services)) throw new Error('Invalid status data');
    data = next;
    render();
  } catch {
    $('overall-title').textContent = 'Status temporarily unavailable';
    $('overall-description').textContent = 'Please try refreshing in a moment.';
    document.querySelector('.overview').className = 'overview unknown';
    $('overall-icon').textContent = '◷';
    $('live').textContent = '◷ Unavailable';
    if (!data) { $('service-list').innerHTML = '<div class="empty">Service data could not be loaded.</div>'; $('incident-list').innerHTML = '<div class="empty">Incident data could not be loaded.</div>'; }
  } finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', load);
$('period').addEventListener('change', () => data && render());
$('more').addEventListener('click', () => { visible += 10; renderIncidents(); });
document.querySelectorAll('.tabs a').forEach(a => a.addEventListener('click', () => { document.querySelector('.tabs .active')?.classList.remove('active'); a.classList.add('active'); }));
load();
setInterval(load, 60_000);
