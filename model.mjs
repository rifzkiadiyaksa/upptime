export function dayKey(date) { return date.toISOString().slice(0, 10); }
export function dailyHistory(service, days, now = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1 + i));
    const key = dayKey(date);
    const start = new Date(service.startTime||NaN);
    const last = new Date(service.lastUpdated);
    const known = Number.isFinite(+start) && Number.isFinite(+last) && key >= dayKey(start) && key <= dayKey(last);
    const from=Math.max(+date,+start),to=Math.min(+date+86400000,+last,+now);
    const coverage=known?Math.max(0,(to-from)/60000):0;
    const intervals=(service.outageIntervals||[]).map(i=>[Math.max(from,Date.parse(i.start)),Math.min(to,Date.parse(i.end))]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
    let union=0,end=0;
    for(const [a,b] of intervals){union+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
    const minutes=Math.round(Math.max(0,Math.min(coverage,Math.max(Number(service.dailyMinutesDown?.[key]||0),union/60000)))*100)/100;
    const unconfirmedOpenDay=service.status==='down'&&key===dayKey(last)&&!intervals.length&&!Object.hasOwn(service.dailyMinutesDown||{},key);
    const available=known&&coverage>0&&!unconfirmedOpenDay;
    return { date:key,minutes,observedMinutes:coverage,uptime:available?Math.max(0,100-minutes/coverage*100):null,status:!available?'unknown':minutes>=coverage-.01?'down':minutes>0?'degraded':'up' };
  });
}
export function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function samplesFor(samples, hours, now = new Date()) {
  return (samples || []).filter(s => Number.isFinite(s.ms) && s.ms >= 0 && s.status === 'up' && Date.parse(s.at) >= +now - hours * 3600000 && Date.parse(s.at) <= +now).sort((a,b) => Date.parse(a.at)-Date.parse(b.at));
}
export function mergeSamples(previous, current, now = new Date()) {
  const valid = [...(previous || []), current].filter(s => s && Number.isFinite(s.ms) && s.ms >= 0 && Number.isFinite(Date.parse(s.at)) && Date.parse(s.at) >= +now-90*86400000 && Date.parse(s.at) <= +now);
  return [...new Map(valid.map(s => [s.at,s])).values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-27000);
}
export function activeMaintenance(items, now = new Date(), slug) {
  return (items || []).filter(m => (!slug || m.services.includes(slug)) && Date.parse(m.start) <= +now && Date.parse(m.end) > +now);
}
export function uptimeFor(history) {
  const known = history.filter(d => d.uptime !== null);
  const weight=d=>Number.isFinite(d.observedMinutes)&&d.observedMinutes>0?d.observedMinutes:1440;
  return known.length ? known.reduce((n,d)=>n+d.uptime*weight(d),0)/known.reduce((n,d)=>n+weight(d),0) : null;
}
export function health(service, now = new Date()) {
  if (!Number.isFinite(Date.parse(service.lastUpdated)) || Date.parse(service.lastUpdated) > +now + 60000 || +now - Date.parse(service.lastUpdated) > 30 * 60 * 1000) return 'unknown';
  return ['up', 'down', 'degraded'].includes(service.status) ? service.status : 'unknown';
}
export function overall(services, now = new Date()) {
  const states = services.map(s => health(s, now));
  if (!states.length) return 'unknown';
  if (states.every(s => s === 'down')) return 'down';
  if (states.some(s => s === 'down' || s === 'degraded')) return 'degraded';
  if (states.includes('unknown')) return 'unknown';
  return 'up';
}
