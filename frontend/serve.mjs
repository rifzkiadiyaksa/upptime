import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { html:'text/html', css:'text/css', js:'text/javascript', mjs:'text/javascript', json:'application/json', geojson:'application/geo+json', svg:'image/svg+xml', webmanifest:'application/manifest+json', png:'image/png' };
createServer(async (req,res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!/^\/[a-zA-Z0-9_./-]*$/.test(path) || path.split('/').some(p=>p==='..')) { res.writeHead(404).end(); return; }
  try { const file = path === '/' ? 'index.html' : path.slice(1); res.setHeader('Content-Type', types[file.split('.').pop()] || 'text/plain'); res.end(await readFile(`dist/${file}`)); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
