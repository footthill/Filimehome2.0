"""Real production APK/catalog/media acceptance. No fixture catalog or source injection."""
import json
import array
import math
import re
import subprocess
import time
import wave
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

def wait_catalog_loaded(seconds=180):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        for node in nodes():
            if node.get('resource-id', '').endswith('catalog-result-count'):
                match = re.fullmatch(r'(\d+) titles?', node.get('text', ''))
                if match and int(match.group(1)) > 0:
                    return int(match.group(1))
        time.sleep(1)
    raise AssertionError('Production catalog did not finish loading before media search')

def audio_sample(name, seconds):
    path = OUT / (name + '.wav')
    try:
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-f', 'pulse', '-i', 'filimehome.monitor',
                        '-t', str(seconds), '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', str(path)], check=True, timeout=seconds + 20)
        with wave.open(str(path), 'rb') as wav:
            samples = array.array('h', wav.readframes(wav.getnframes()))
    finally:
        path.unlink(missing_ok=True)  # Keep metrics only, including on capture failures.
    assert samples, 'Emulator audio capture returned no PCM samples'
    return {'peak': max(abs(value) for value in samples), 'rms': math.sqrt(sum(value * value for value in samples) / len(samples))}

def audio_acceptance():
    # No touches during capture: button sounds cannot satisfy movie-audio acceptance.
    time.sleep(2)
    paused = audio_sample('paused', 3)
    tap('Play / Pause'); time.sleep(3)
    playing = audio_sample('playing', 8)
    metrics = {'paused': paused, 'playing': playing}
    (OUT / 'audio-output.json').write_text(json.dumps(metrics, indent=2))
    assert playing['peak'] > 100 and playing['rms'] > max(5, paused['rms'] * 2), 'No decoded movie audio signal reached the emulator output'
    (OUT / 'audio-flinger.txt').write_text(adb('shell', 'dumpsys', 'media.audio_flinger'))
    record('Real movie audio reaches emulator output during playback')
    tap('Play / Pause')

def native_video_evidence():
    logs = adb('logcat', '-d', '-s', 'ReactNativeJS:I', '*:S')
    assert 'firstVideoFrame' in logs, 'Video view never reported a rendered movie frame'
    assert 'renderedPlaybackProgress' in logs, 'No rendered video advanced during playback'
    (OUT / 'native-playback-events.txt').write_text('\n'.join(line for line in logs.splitlines() if 'FILIMEHOME_PLAYER' in line))

try:
    adb('install', '-r', '-t', 'ui-snapshot-build/snapshot.apk')
    media = json.loads(Path('backend-audit/approved-media.json').read_text())
    assert re.fullmatch(r'[A-Za-z0-9 ]{3,45}', media['query']), 'Unsafe Android input query'
    adb('logcat', '-c')
    restart();tap('Explore');wait_catalog_loaded();tap('Search movie catalog');adb('shell','input','text',media['query'].replace(' ', '%s'));adb('shell','input','keyevent','4')
    scroll_to('View ' + media['title']);tap('View ' + media['title']);wait(media['title']);scroll_to('Watch Now');tap('Watch Now');check_state()
    tap('Play / Pause');advancing();native_video_evidence();record('Production real-catalog MP4 rendered playback advances')
    tap('Play / Pause');before=position();time.sleep(2);assert abs(position()-before)<=1
    tap('+10 seconds');time.sleep(2);assert position()>=before+7
    record('Production pause and seek')
    audio_acceptance()
    tap('Fullscreen');time.sleep(2)
    if find('Got it') is not None: tap('Got it')
    wait('Hide player controls');time.sleep(1);adb('shell','input','keyevent','4');check_state();record('Production fullscreen and Back')
    adb('shell','input','keyevent','4');scroll_to('Download authorized MP4');tap('Download authorized MP4')
    wait('Download complete',timeout=900);record('Production real-catalog MP4 complete transfer')
    scroll_to('Downloads');tap('Downloads');scroll_to('Play offline');tap('Play offline');check_state();tap('Play / Pause');advancing();record('Production downloaded MP4 native playback')
    adb('shell','input','keyevent','4');scroll_to('Save to My Files');tap('Save to My Files')
    # Android document picker defaults to Downloads; enter a unique destination name.
    wait('SAVE');tap('SAVE');wait('Movie saved',timeout=120);dismiss_alert('Movie saved')
    exported=adb('shell','find','/sdcard/Download','-name','*.mp4').strip()
    assert exported, 'Saved movie missing from user-accessible Downloads'
    size=adb('shell','stat','-c','%s',exported.splitlines()[0]).strip();assert int(size)>12
    record('Android document picker saves completed movie to accessible Downloads')
    scroll_to('Open saved movie');tap('Open saved movie');time.sleep(2)
    foreground=adb('shell','dumpsys','activity','activities')
    if find('Open movie') is not None:
        results.append({'test': 'External video app', 'result': 'unavailable on emulator; in-app downloaded playback passed'})
        (OUT / 'results.json').write_text(json.dumps(results, indent=2))
        print('LIMITATION: emulator has no external video app; the app reports this visibly.', flush=True)
        dismiss_alert('Open movie')
    else:
        assert 'video/mp4' in foreground or 'resolver' in foreground.lower(), 'Android did not handle the saved-file view intent'
        record('Completed accessible movie opens with Android video intent')
    if media['narrator']:
        restart();tap('Abasobanuzi');scroll_to('Browse ' + media['narrator']);tap('Browse ' + media['narrator'])
        wait('Narrator: ' + media['narrator']);tap('Show all narrators');wait('Explore')
        record('Abasobanuzi opens real narrator catalog and clears its filter')
finally:
    (OUT/'logcat.txt').write_text(adb('logcat','-d'))
    (OUT/'results.json').write_text(json.dumps(results,indent=2))
