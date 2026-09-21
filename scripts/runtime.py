"""Shared runtime and verified-download helpers; importing this file has no side effects."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent

def executable(name):
    if name in ('java', 'javac', 'jar'):
        home = os.environ.get('MC_JAVA_HOME') or os.environ.get('JAVA_HOME')
        candidate = Path(home) / 'bin' / name if home else None
        if candidate:
            if not candidate.is_file():
                raise RuntimeError(f'{name} missing from configured Java home')
            return str(candidate)
    found = shutil.which(name)
    if not found:
        raise RuntimeError(f'{name} not found; set MC_JAVA_HOME/JAVA_HOME or PATH (FFMPEG for ffmpeg)')
    return found

def download(url, path, digest, algorithm='sha256'):
    path = Path(path)
    if not url.startswith('https://') or not digest:
        raise ValueError('Downloads require HTTPS and a pinned digest')
    def valid(p):
        return p.is_file() and hashlib.new(algorithm, p.read_bytes()).hexdigest() == digest
    if valid(path):
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = None
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            if not response.url.startswith('https://'):
                raise ValueError('Insecure download redirect')
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as out:
                tmp = Path(out.name)
                shutil.copyfileobj(response, out)
        if not valid(tmp):
            raise ValueError(f'Checksum mismatch: {path.name}')
        tmp.replace(path)
        return path
    finally:
        if tmp and tmp.exists():
            tmp.unlink()

def artifact(name):
    import json
    spec = json.loads((ROOT / 'scripts/artifacts.json').read_text())[name]
    return download(spec['url'], ROOT / spec['path'], spec['sha256'])
