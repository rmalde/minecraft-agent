import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { root, localToken } from '../lib/config.mjs';
mkdirSync(root + '.local', { recursive: true, mode: 0o700 });
if (!existsSync(root + '.local/token')) writeFileSync(root + '.local/token', randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 });
localToken();
console.log('Private local-service token ready. Configure your model credential as described in SETUP.md.');
