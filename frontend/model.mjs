export function dayKey(date) { return date.toISOString().slice(0, 10); }
export function dailyHistory(service, days, now = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1 + i));
    const key = dayKey(date);
    const start = new Date(service.startTime);
    const last = new Date(service.lastUpdated);
    const known = Number.isFinite(+start) && Number.isFinite(+last) && key >= dayKey(start) && key <= dayKey(last);
    const minutes = Math.max(0, Math.min(1440, Number(service.dailyMinutesDown?.[key] || 0)));
    return { date: key, minutes, status: !known ? 'unknown' : minutes >= 1440 ? 'down' : minutes > 0 ? 'degraded' : 'up' };
  });
}
export function health(service, now = new Date()) {
  if (!Number.isFinite(Date.parse(service.lastUpdated)) || +now - Date.parse(service.lastUpdated) > 30 * 60 * 1000) return 'unknown';
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
