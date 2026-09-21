import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { root, localToken } from '../lib/config.mjs';
let failed = false;
function check(label, ok, hint) { console.log(`${ok ? 'OK' : 'MISSING'} ${label}${ok ? '' : ': ' + hint}`); if (!ok) failed = true; }
check('Node 22+', Number(process.versions.node.split('.')[0]) >= 22, 'install Node 22 or newer');
for (const name of ['java', 'javac', 'jar']) {
 const home=process.env.MC_JAVA_HOME||process.env.JAVA_HOME;
 const result=spawnSync(home?home+'/bin/'+name:name,[name==='jar'?'--version':'-version'],{encoding:'utf8'});
 check(name,!result.error&&result.status===0,'set MC_JAVA_HOME or JAVA_HOME to a JDK 17+');
}
check('ffmpeg',spawnSync(process.env.FFMPEG||'ffmpeg',['-version'],{stdio:'ignore'}).status===0,'install ffmpeg or set FFMPEG (native recording only)');
try { localToken(); check('Local token',true); } catch { check('Local token',false,'npm run configure'); }
check('Model credential configured',!!(process.env.MC_OPENROUTER_KEY_FILE||process.env.MC_OPENROUTER_API_KEY||process.env.MC_GOOGLE_PROJECT||process.env.MODEL_RELAY),'see SETUP.md; no API requests are made by doctor');
for(const [file,hint] of [['node_modules/mineflayer/package.json','npm ci --ignore-scripts'],['server/server.jar','python3 scripts/setup-server.py'],['observer/dragon-observer.jar','./build-observer.sh']])check(file,existsSync(root+file),hint);
console.log('Native renderer is optional and currently macOS-only. Doctor does not validate model access or accept the EULA.');
process.exitCode=failed?1:0;
