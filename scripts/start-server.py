import json
import os
from runtime import ROOT, artifact, executable

server = ROOT / 'server'
if not (server / 'server.jar').exists():
    raise SystemExit('Run python3 scripts/setup-server.py first')
properties = dict(line.split('=', 1) for line in (server / 'server.properties').read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
if properties.get('server-ip') != '127.0.0.1' or properties.get('enable-rcon', 'false') != 'false' or properties.get('enable-query', 'false') != 'false':
    raise SystemExit('This offline test server must bind 127.0.0.1 with RCON and query disabled')
observer = ROOT / 'observer/dragon-observer.jar'
if not observer.exists():
    raise SystemExit('Build the observer first: ./build-observer.sh')
# Parent classpath precedence replaces the old logging classes inside the vanilla jar.
cp = os.pathsep.join(str(artifact(n)) for n in ('log4j-api', 'log4j-core')) + os.pathsep + str(server / 'server.jar')
java = executable('java')
os.chdir(server)
os.execv(java, [java, '-javaagent:' + str(observer) + '=3093', '-Xms512M', '-Xmx2G', '-cp', cp, 'net.minecraft.server.Main', 'nogui'])
