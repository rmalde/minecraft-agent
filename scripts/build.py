import pathlib
import subprocess
import sys
from runtime import ROOT, artifact, executable

kind = sys.argv[1]
java = executable('javac')
jar = executable('jar')
assist = artifact('javassist')
if kind == 'observer':
    dest = ROOT / 'observer/classes'
    sources = [ROOT / 'observer/DragonObserver.java']
    cp = str(assist)
    manifest = ROOT / 'observer/MANIFEST.MF'
    out = ROOT / 'observer/dragon-observer.jar'
elif kind == 'native':
    dest = ROOT / 'native-client/classes'
    sources = [ROOT / 'native-client' / f for f in ['NativeViewAgent.java', 'FrameCapture.java', 'NativeUi.java']]
    cp = str(assist) + ':' + (ROOT / 'native-client/classpath.txt').read_text()
    manifest = ROOT / 'native-client/MANIFEST.MF'
    out = ROOT / 'native-client/native-view-agent.jar'
else:
    raise SystemExit('Expected observer or native')
dest.mkdir(parents=True, exist_ok=True)
subprocess.run([java, '--release', '17', '-proc:none', '-cp', cp, '-d', str(dest), *map(str, sources)], check=True)
subprocess.run([jar, 'cfm', str(out), str(manifest), '-C', str(dest), '.'], check=True)
print('Built', out.name)
