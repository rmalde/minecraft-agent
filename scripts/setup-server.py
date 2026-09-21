"""Prepare a separate loopback test server; never accepts the Minecraft EULA for you."""
import json
from runtime import ROOT, artifact, download

root = ROOT / 'server'
version = json.loads((ROOT / 'research/version-1.16.5.json').read_text())['downloads']['server']
download(version['url'], root / 'server.jar', version['sha1'], 'sha1')
for name in ('log4j-api', 'log4j-core'):
    artifact(name)
properties = root / 'server.properties'
if not properties.exists():
    properties.write_text('server-ip=127.0.0.1\nserver-port=25576\nonline-mode=false\nenable-rcon=false\nenable-query=false\nlevel-name=agent-world\nlevel-seed=8398967436125155523\ngamemode=survival\ndifficulty=peaceful\nspawn-protection=0\nview-distance=8\n')
if not (root / 'eula.txt').exists():
    (root / 'eula.txt').write_text('# Read https://aka.ms/MinecraftEULA before changing this to true.\neula=false\n')
print('Server files verified. Review server/eula.txt; existing configuration was preserved.')
