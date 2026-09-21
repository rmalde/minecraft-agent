import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function positiveInt(value, fallback, maximum = 100000) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > maximum) throw Error('Invalid positive integer configuration');
  return n;
}
export function privateFile(path) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > 16384) throw Error('Credential must be a small regular file');
  if (process.platform !== 'win32' && (stat.mode & 0o077)) throw Error('Credential file must be private (chmod 600)');
  const value = readFileSync(path, 'utf8').trim();
  if (!value || /[\r\n]/.test(value)) throw Error('Credential must contain one nonempty line');
  return value;
}
export function localToken(env = process.env) {
  const token = privateFile(env.MC_LOCAL_TOKEN_FILE || root + '.local/token');
  if (token.length < 32) throw Error('Local token must contain at least 32 characters; run npm run configure');
  return token;
}
export function authorized(req, token, origin) {
  const port = req.socket.localPort;
  if (req.headers.host !== `127.0.0.1:${port}`) return false;
  if (req.headers.origin && req.headers.origin !== origin) return false;
  const received = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from('Bearer ' + token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export function loadApiKey(env = process.env) {
  // Deliberate project-specific opt-in; never consume an unrelated ambient API key.
  if (env.MC_OPENROUTER_KEY_FILE) return privateFile(env.MC_OPENROUTER_KEY_FILE);
  if (env.MC_OPENROUTER_API_KEY?.trim()) return env.MC_OPENROUTER_API_KEY.trim();
  if (env.MC_GOOGLE_PROJECT) {
    if (!/^[a-z][a-z0-9-]{4,62}$/.test(env.MC_GOOGLE_PROJECT)) throw Error('Invalid MC_GOOGLE_PROJECT');
    const secret = env.MC_GOOGLE_SECRET || 'OPENROUTER_API_KEY';
    if (!/^[A-Za-z0-9_-]+$/.test(secret)) throw Error('Invalid MC_GOOGLE_SECRET');
    return execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=' + secret, '--project=' + env.MC_GOOGLE_PROJECT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  throw Error('Configure MC_OPENROUTER_KEY_FILE, MC_OPENROUTER_API_KEY or MC_GOOGLE_PROJECT. See SETUP.md.');
}
