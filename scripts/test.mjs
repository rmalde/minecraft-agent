// Do not let Node's default discovery execute historical setup-*-test.mjs world tools.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const dirs=['.','optimization','optimization/pass-2','optimization/nether','optimization/eyes','tests'];
const files=dirs.flatMap(dir=>readdirSync(dir).filter(name=>name.endsWith('.test.mjs')).map(name=>dir+'/'+name));
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exitCode=result.status??1;
