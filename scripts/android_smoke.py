"""Verify a compiled preview APK without requiring backend credentials."""
import argparse
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'com.footthill.filimehome'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('apk', type=Path)
parser.add_argument('--previous-apk', type=Path)
parser.add_argument('--expected-sdk', type=int)
parser.add_argument('--expected-version-code', type=int)
parser.add_argument('--verify-fresh-install', action='store_true', help='Emulator-only uninstall/reinstall check')
args = parser.parse_args()


def adb(*args, check=True, timeout=90):
    result = subprocess.run(['adb', *args], capture_output=True, text=True, timeout=timeout)
    if args and args[0] in ('install', 'uninstall'):
        with Path('android-install.log').open('a') as log:
            log.write('adb ' + ' '.join(args) + '\n' + result.stdout + result.stderr + f'\nExit code: {result.returncode}\n')
    if check and result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout + result.stderr


def ui():
    adb('shell', 'uiautomator', 'dump', '/sdcard/filimehome-ui.xml')
    xml = adb('shell', 'cat', '/sdcard/filimehome-ui.xml')
    Path('android-ui.xml').write_text(xml)
    return ET.fromstring(xml)


def wait_text(label, timeout=90, heading=False):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            tree = ui()
            nodes = list(tree.iter('node'))
            height = max((int(re.findall(r'\d+', n.get('bounds', '0 0 0 0'))[-1]) for n in nodes), default=800)
            def matches(node):
                if label not in (node.get('text', '') + node.get('content-desc', '')):
                    return False
                if not heading:
                    return True
                bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
                return node.get('text') == label and len(bounds) == 4 and bounds[1] < height / 2
            if any(matches(n) for n in nodes):
                print('Verified visible screen:', label, flush=True)
                return tree
        except (RuntimeError, ET.ParseError, subprocess.TimeoutExpired):
            pass
        time.sleep(2)
    raise AssertionError('Screen did not become visible: ' + label)


def tap(label):
    tree = ui()
    for node in tree.iter('node'):
        text, description = node.get('text', ''), node.get('content-desc', '')
        if text == label or description == label or description.startswith(label + ', tab'):
            bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
            if len(bounds) == 4:
                adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))
                return
    raise AssertionError('Control not found: ' + label)


try:
    adb('logcat', '-c')
    properties = {key: adb('shell', 'getprop', key).strip() for key in [
        'ro.build.version.sdk', 'ro.product.model', 'ro.product.cpu.abilist',
        'ro.build.fingerprint', 'ro.kernel.qemu',
    ]}
    properties['page_size'] = adb('shell', 'getconf', 'PAGESIZE').strip()
    properties['data_free_space'] = adb('shell', 'df', '-h', '/data').strip()
    Path('android-device.json').write_text(json.dumps(properties, indent=2))
    print('Android emulator properties:', json.dumps(properties), flush=True)
    if args.expected_sdk is not None:
        assert properties['ro.build.version.sdk'] == str(args.expected_sdk), 'Wrong Android API level'
    if args.verify_fresh_install:
        assert properties['ro.kernel.qemu'] == '1', 'Uninstall check is only allowed on an emulator'
    Path('android-package-before.log').write_text(adb('shell', 'dumpsys', 'package', PACKAGE, check=False))
    if args.previous_apk and args.previous_apk.exists():
        print('Diagnosing the original APK:', flush=True)
        print(adb('install', '-r', '--no-streaming', str(args.previous_apk), check=False, timeout=600), flush=True)
        Path('android-evidence/previous-install-logcat.txt').parent.mkdir(parents=True, exist_ok=True)
        Path('android-evidence/previous-install-logcat.txt').write_text(adb('logcat', '-d', check=False))
        Path('android-evidence/previous-package.txt').write_text(adb('shell', 'dumpsys', 'package', PACKAGE, check=False))
    print('Installing the universal APK (normal package-manager security checks):', flush=True)
    print(adb('install', '-r', '--no-streaming', str(args.apk), timeout=600), flush=True)
    package = adb('shell', 'dumpsys', 'package', PACKAGE)
    Path('android-package-after.log').write_text(package)
    if args.expected_version_code is not None:
        assert re.search(r'\bversionCode=' + str(args.expected_version_code) + r'\b', package), 'Wrong installed version'
    adb('shell', 'am', 'force-stop', PACKAGE)
    print(adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity'), flush=True)
    wait_text('FilimeHome')
    if not adb('shell', 'pidof', PACKAGE).strip():
        raise AssertionError('Application process is not running')
    for tab, screen in [('Movies', 'Movies'), ('Series', 'Series'), ('Search', 'Explore'), ('Favorites', 'Your collection')]:
        tap(tab)
        wait_text(screen, heading=True)
    tap('Open profile')
    wait_text('Your profile')
    adb('shell', 'input', 'keyevent', '4')
    wait_text('Your collection')
    adb('shell', 'input', 'keyevent', '4')
    wait_text('Explore')
    if args.verify_fresh_install:
        # Disposable emulator only; no physical-device data is removed.
        print(adb('uninstall', PACKAGE), flush=True)
        print(adb('install', '--no-streaming', str(args.apk), timeout=600), flush=True)
        print(adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity'), flush=True)
        wait_text('FilimeHome')
        assert adb('shell', 'pidof', PACKAGE).strip(), 'Fresh installation exited'
        print('Android 15 fresh installation and cold launch passed.', flush=True)
    print('Android startup, tab navigation, profile and hardware back checks passed.', flush=True)
finally:
    # Retain evidence even if a UI assertion or startup fails.
    Path('android-startup.log').write_text(adb('logcat', '-d', check=False))
    Path('android-activities.log').write_text(adb('shell', 'dumpsys', 'activity', 'activities', check=False))
    with open('filimehome-startup.png', 'wb') as image:
        subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, timeout=60, check=False)
