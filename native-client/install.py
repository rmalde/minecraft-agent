"""Install pinned macOS renderer dependencies; use --libraries-only for build checks."""
import argparse
import concurrent.futures
import json
import pathlib
import platform
import sys
import zipfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
from runtime import ROOT, artifact, download


def install(libraries_only=False):
    if platform.system() != 'Darwin' or platform.machine() not in ('arm64', 'x86_64'):
        raise RuntimeError('Native renderer supports macOS arm64/x86_64 only; use the headless bot elsewhere')
    root = ROOT / 'native-client'
    version = json.loads((ROOT / 'research/version-1.16.5.json').read_text())
    cp = []
    native_jars = []
    for lib in version['libraries']:
        rules = lib.get('rules', [])
        allowed = not rules
        for rule in rules:
            osrule = rule.get('os', {})
            if not osrule or osrule.get('name') == 'osx':
                allowed = rule['action'] == 'allow'
        if not allowed:
            continue
        group, name, _ = lib['name'].split(':')[:3]
        if group == 'org.lwjgl':
            cp.append(str(artifact(name)))
            suffix = '-natives-macos-arm64' if platform.machine() == 'arm64' else '-natives-macos'
            native_jars.append(artifact(name + suffix))
        elif name in ('jna', 'log4j-core', 'log4j-api'):
            cp.append(str(artifact(name)))
        elif lib.get('downloads', {}).get('artifact'):
            a = lib['downloads']['artifact']
            destination = (root / 'libraries' / a['path']).resolve()
            if not destination.is_relative_to((root / 'libraries').resolve()):
                raise ValueError('Library path escapes cache')
            cp.append(str(download(a['url'], destination, a['sha1'], 'sha1')))
    client = version['downloads']['client']
    cp.append(str(download(client['url'], root / 'client.jar', client['sha1'], 'sha1')))
    natives = root / 'natives' / platform.machine()
    natives.mkdir(parents=True, exist_ok=True)
    for jar in native_jars:
        with zipfile.ZipFile(jar) as archive:
            for name in archive.namelist():
                if name.endswith('.dylib'):
                    (natives / pathlib.Path(name).name).write_bytes(archive.read(name))
    idx = version['assetIndex']
    if not libraries_only:
        index = download(idx['url'], root / 'assets/indexes' / (idx['id'] + '.json'), idx['sha1'], 'sha1')
        jobs = [(f'https://resources.download.minecraft.net/{a["hash"][:2]}/{a["hash"]}', root / 'assets/objects' / a['hash'][:2] / a['hash'], a['hash'], 'sha1') for a in json.loads(index.read_text())['objects'].values()]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda args: download(*args), jobs))
    (root / 'classpath.txt').write_text(':'.join(dict.fromkeys(cp)))
    (root / 'config.json').write_text(json.dumps({'mainClass': version['mainClass'], 'assetIndex': idx['id'], 'natives': str(natives)}))
    print('Verified renderer dependencies ready' + (' (assets skipped)' if libraries_only else ''))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--libraries-only', action='store_true')
    install(parser.parse_args().libraries_only)
