"""Real production APK/catalog/media acceptance. No fixture catalog or source injection."""
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path('live-media-evidence'); OUT.mkdir(exist_ok=True)
PACKAGE = 'com.footthill.filimehome'
results = []
# Reuse the native snapshot and bounded UI helpers, without running fixture tests.
helpers = Path('scripts/android_media_qa.py').read_text().split('\ntry:\n    assert adb')[0]
exec(helpers[helpers.index('def adb'):])

def check_state(seconds=60):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        texts = [n.get('text', '') for n in nodes()]
        if 'Ready to play' in texts: return
        if 'Playback failed' in texts: raise AssertionError('Production playback failed: ' + repr(texts))
        time.sleep(1)
    raise AssertionError('Production player did not become ready')

try:
    adb('install', '-r', '-t', 'ui-snapshot-build/snapshot.apk')
    restart();tap('Explore');tap('Search movie catalog');adb('shell','input','text','Runner');adb('shell','input','keyevent','4')
    tap('View Runner');wait('Runner');scroll_to('Watch Now');tap('Watch Now');check_state()
    tap('Play / Pause');advancing();record('Production Runner decoded playback advances')
    tap('Play / Pause');before=position();time.sleep(2);assert abs(position()-before)<=1
    tap('+10 seconds');time.sleep(2);assert position()>=before+7
    record('Production pause and seek')
    adb('shell','input','keyevent','4');scroll_to('Download authorized MP4');tap('Download authorized MP4')
    wait('Download complete',timeout=900);record('Production Runner actual complete MP4 transfer')
    tap('Downloads');wait('Play offline');tap('Play offline');check_state();tap('Play / Pause');advancing();record('Production downloaded MP4 native playback')
    adb('shell','input','keyevent','4');tap('Save to My Files')
    # Android document picker defaults to Downloads; enter a unique destination name.
    wait('SAVE');tap('SAVE');wait('Movie saved',timeout=120);adb('shell','input','keyevent','4')
    exported=adb('shell','find','/sdcard/Download','-name','Runner*.mp4').strip()
    assert exported, 'Saved movie missing from user-accessible Downloads'
    size=adb('shell','stat','-c','%s',exported.splitlines()[0]).strip();assert int(size)>12
    record('Android document picker saves completed movie to accessible Downloads')
finally:
    (OUT/'logcat.txt').write_text(adb('logcat','-d'))
    (OUT/'results.json').write_text(json.dumps(results,indent=2))
