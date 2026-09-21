import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from runtime import ROOT, download, executable

class SetupTests(unittest.TestCase):
    def test_cached_artifact_is_verified(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'artifact'; p.write_bytes(b'good')
            digest = hashlib.sha256(b'good').hexdigest()
            self.assertEqual(download('https://example.invalid/file', p, digest), p)
            p.write_bytes(b'tampered')
            with patch('urllib.request.urlopen', side_effect=RuntimeError('network disabled')):
                with self.assertRaisesRegex(RuntimeError, 'network disabled'):
                    download('https://example.invalid/file', p, digest)
            self.assertEqual(p.read_bytes(), b'tampered')
    def test_unpinned_or_plaintext_download_refused(self):
        for url,digest in [('http://example.invalid/x','abc'),('https://example.invalid/x',None)]:
            with self.assertRaises(ValueError): download(url,Path('/unused'),digest)
    def test_runtime_home_with_spaces(self):
        with tempfile.TemporaryDirectory(prefix='mc java ') as d:
            p=Path(d)/'bin';p.mkdir();(p/'java').touch()
            with patch.dict('os.environ',{'MC_JAVA_HOME':d}):self.assertEqual(executable('java'),str(p/'java'))
    def test_all_executable_overrides_have_digests(self):
        entries=json.loads((ROOT/'scripts/artifacts.json').read_text())
        for entry in entries.values():
            self.assertRegex(entry['sha256'],r'^[a-f0-9]{64}$')
            self.assertTrue(entry['url'].startswith('https://repo.maven.apache.org/'))
        self.assertIn('log4j-core',entries)

if __name__ == '__main__': unittest.main()
