import { open } from 'node:fs/promises';
import { authorized } from './config.mjs';

// One active capture, serial writes and a run-wide quota. Status reads stay public/local.
export function recordingHandler({ dir, token, origin, onStart, onDone, onAbort = () => {}, maxChunk = 8 * 1024 * 1024, maxTotal = 512 * 1024 * 1024 }) {
  let active = null, ready = false, busy = false, total = 0;
  const used = new Set();
  return async function handle(req, res) {
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400); res.end(); return true; }
    if (!url.pathname.startsWith('/recording')) return false;
    const reply = status => { res.writeHead(status); res.end(); return true; };
    if (req.headers.origin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (req.headers.origin !== origin || req.headers.host !== `127.0.0.1:${req.socket.localPort}`) return reply(403);
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return reply(204);
    }
    if (!authorized(req, token, origin)) return reply(403);
    if (req.method !== 'POST') return reply(405);
    const id = url.searchParams.get('id');
    if (!/^[A-Za-z0-9-]{1,64}$/.test(id || '')) return reply(400);
    if (busy) return reply(409);
    busy = true;
    try {
      if (url.pathname === '/recording/start') {
        if (active || used.has(id) || used.size >= 32) return reply(409);
        const file = await open(`${dir}/capture-${id}.webm`, 'wx', 0o600);
        await file.close(); active = id; ready = false; used.add(id); return reply(200);
      }
      if (id !== active) return reply(409);
      if (url.pathname === '/recording/abort') { active = null; ready = false; onAbort(id); return reply(200); }
      if (url.pathname === '/recording/ready') { if(ready)return reply(409); ready = true; onStart(id); return reply(200); }
      if (!ready) return reply(409);
      if (url.pathname === '/recording/done') { active = null; onDone(id); return reply(200); }
      if (url.pathname !== '/recording') return reply(404);
      let bytes = 0; const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > maxChunk || total + bytes > maxTotal) return reply(413);
        chunks.push(chunk);
      }
      const file = await open(`${dir}/capture-${id}.webm`, 'a');
      try { await file.writeFile(Buffer.concat(chunks)); total += bytes; }
      finally { await file.close(); }
      return reply(200);
    } catch { return reply(400); }
    finally { busy = false; }
  };
}
