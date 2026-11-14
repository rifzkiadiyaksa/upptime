import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { html:'text/html', css:'text/css', mjs:'text/javascript', json:'application/json', svg:'image/svg+xml' };
createServer(async (req,res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!/^\/[a-z0-9.-]*$/.test(path)) { res.writeHead(404).end(); return; }
  try { const file = path === '/' ? 'index.html' : path.slice(1); res.setHeader('Content-Type', types[file.split('.').pop()] || 'text/plain'); res.end(await readFile(`dist/${file}`)); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
