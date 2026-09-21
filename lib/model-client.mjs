import { loadApiKey, localToken, positiveInt } from './config.mjs';

export function validateRequest(path, body, env = process.env) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Invalid model request');
  if (path === '/api/alpha/decisions') {
    if (body.model !== 'typesafe/jev-1.13') throw Error('Controller model is not allowed');
    if (typeof body.state !== 'string' || !body.questions) throw Error('Invalid decision request');
  } else if (path === '/api/v1/chat/completions') {
    if (body.model !== (env.PLANNER_MODEL || 'openai/gpt-6-astra')) throw Error('Planner model is not allowed');
    const cap = positiveInt(env.MC_MAX_OUTPUT_TOKENS, 2500, 16384);
    if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > cap || body.n && body.n !== 1 || body.stream) throw Error('Invalid model output limit');
    if (!Array.isArray(body.messages)) throw Error('Invalid planner messages');
  } else throw Error('Unsupported model endpoint');
  if (Buffer.byteLength(JSON.stringify(body)) > 2_000_000) throw Error('Model request too large');
}
export function createModelClient({ env = process.env, fetchImpl = fetch, getKey = () => loadApiKey(env) } = {}) {
  let key, calls = 0;
  const maxCalls = positiveInt(env.MC_MAX_MODEL_CALLS, 250);
  return async function request(path, body) {
    validateRequest(path, body, env);
    if (calls >= maxCalls) throw Error('Model call limit reached; start a new process only after reviewing spending');
    let url = 'https://openrouter.ai' + path, headers = { 'Content-Type': 'application/json' }, payload = body;
    if (env.MODEL_RELAY) {
      const relay = new URL(env.MODEL_RELAY);
      if (relay.protocol !== 'http:' || relay.hostname !== '127.0.0.1' || relay.username || relay.password || relay.pathname !== '/' || relay.search || relay.hash) throw Error('MODEL_RELAY must be an HTTP loopback root URL');
      url = relay.href; headers.Authorization = 'Bearer ' + localToken(env); payload = { path, body };
    } else {
      key ||= getKey(); headers.Authorization = 'Bearer ' + key;
    }
    calls++;
    const started = Date.now();
    // Never hedge/retry a paid POST: a lost response may still have been billed.
    const response = await fetchImpl(url, { method: 'POST', redirect: 'error', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error('Model service returned HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw Error('Model service returned an error');
    return env.MODEL_RELAY ? data : { data, latencyMs: Date.now() - started };
  };
}
