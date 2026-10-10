"""Verify a compiled preview APK without requiring backend credentials."""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'com.footthill.filimehome'


def adb(*args, check=True, timeout=90):
    result = subprocess.run(['adb', *args], capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout


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
    print(adb('install', '-r', sys.argv[1], timeout=300), flush=True)
    adb('logcat', '-c')
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
    print('Android startup, tab navigation, profile and hardware back checks passed.', flush=True)
finally:
    # Retain evidence even if a UI assertion or startup fails.
    Path('android-startup.log').write_text(adb('logcat', '-d', check=False))
    Path('android-activities.log').write_text(adb('shell', 'dumpsys', 'activity', 'activities', check=False))
    with open('filimehome-startup.png', 'wb') as image:
        subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, timeout=60, check=False)
