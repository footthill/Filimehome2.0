"""Validate a standalone universal APK using Android SDK tools; save public evidence."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('apk', type=Path)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--version-code', type=int)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
sdk = Path(os.environ['ANDROID_HOME'])
build_tools = sdk / 'build-tools' / '36.0.0'

def run(tool, *params):
    result = subprocess.run([str(build_tools / tool), *map(str, params)], capture_output=True, text=True)
    (args.output / (tool + '.txt')).write_text(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f'{tool} failed ({result.returncode}): {result.stdout}{result.stderr}')
    return result.stdout

badging = run('aapt', 'dump', 'badging', args.apk)
manifest = subprocess.run([str(build_tools / 'aapt'), 'dump', 'xmltree', str(args.apk), 'AndroidManifest.xml'], capture_output=True, text=True, check=True).stdout
(args.output / 'manifest.txt').write_text(manifest)
assert "name='com.footthill.filimehome'" in badging, 'Unexpected package name'
assert "sdkVersion:'24'" in badging, 'Unexpected minimum SDK'
assert "targetSdkVersion:'36'" in badging, 'Unexpected target SDK'
assert not re.search(r'android:(testOnly|debuggable)\([^\n]*=\(type 0x12\)0xffffffff', manifest), 'APK is test-only or debuggable'
assert not re.search(r'A: split\(', manifest), 'Split APK cannot be installed alone'
if args.version_code is not None:
    assert f"versionCode='{args.version_code}'" in badging, 'Unexpected version code'
certificates = run('apksigner', 'verify', '--verbose', '--print-certs', '--min-sdk-version', '24', '--max-sdk-version', '36', args.apk)
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in certificates, 'Missing v2 signature'
run('zipalign', '-c', '-P', '16', '-v', '4', args.apk)
with zipfile.ZipFile(args.apk) as archive:
    assert archive.testzip() is None, 'Corrupted APK ZIP member'
    names = archive.namelist()
    assert 'AndroidManifest.xml' in names and 'classes.dex' in names, 'Incomplete APK'
    abis = sorted({name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')})
    assert set(abis) == {'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'}, f'Incomplete universal APK: {abis}'
    for abi in abis:
        assert any(name.startswith(f'lib/{abi}/') and 'reactnative' in name for name in names), f'Missing React Native for {abi}'
sha256 = hashlib.sha256(args.apk.read_bytes()).hexdigest()
certificate = re.search(r'Signer #1 certificate SHA-256 digest: (\w+)', certificates).group(1)
report = {'filename': args.apk.name, 'size_bytes': args.apk.stat().st_size, 'sha256': sha256,
          'package': 'com.footthill.filimehome', 'min_sdk': 24, 'target_sdk': 36,
          'version_code': int(re.search(r"versionCode='(\d+)'", badging).group(1)),
          'abis': abis, 'certificate_sha256': certificate, 'zip_crc_verified': True,
          'signatures_verified': True, 'zip_alignment_16kb_verified': True}
(args.output / 'metadata.json').write_text(json.dumps(report, indent=2) + '\n')
(args.output / 'SHA256SUMS').write_text(f'{sha256}  {args.apk.name}\n')
print(json.dumps(report, indent=2))
