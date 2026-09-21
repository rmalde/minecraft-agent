import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { authorized, localToken, positiveInt } from './lib/config.mjs';
import { createModelClient, validateRequest } from './lib/model-client.mjs';

export function createRelay({ token, request, env = process.env } = {}) {
  let active = 0;
  const concurrency = positiveInt(env.MC_RELAY_CONCURRENCY, 2, 8);
  return http.createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    const fail = status => { res.writeHead(status, { 'Connection': 'close' }); res.end(); };
    if (!authorized(req, token)) return fail(403);
    if (req.method !== 'POST' || req.url !== '/') return fail(405);
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return fail(415);
    if (active >= concurrency) return fail(429);
    active++;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2_000_000) { fail(413); return; }
        chunks.push(chunk);
      }
      const { path, body } = JSON.parse(Buffer.concat(chunks));
      validateRequest(path, body, env);
      const result = await request(path, body);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
    } catch { if (!res.headersSent) fail(502); }
    finally { active--; }
  });
}
export function startRelay() {
  const env = { ...process.env }; delete env.MODEL_RELAY;
  const request = createModelClient({ env });
  const server = createRelay({ token: localToken(env), request, env });
  server.listen(positiveInt(env.MODEL_RELAY_PORT, 3099, 65535), '127.0.0.1', () => console.log('Authenticated local model relay ready.'));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startRelay();
