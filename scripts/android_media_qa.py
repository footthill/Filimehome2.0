"""Android 15 native MP4/HLS/download/offline QA against original generated media."""
import json
import re
import ssl
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path('media-qa-evidence')
OUT.mkdir(exist_ok=True)
PACKAGE = 'com.footthill.filimehome'
results = []

def adb(*args):
    result = subprocess.run(['adb', *args],capture_output=True,text=True,timeout=90,check=True)
    return result.stdout

def ui():
    adb('shell','uiautomator','dump','/sdcard/media-qa.xml')
    xml = adb('shell','cat','/sdcard/media-qa.xml')
    (OUT/'last-ui.xml').write_text(xml)
    return ET.fromstring(xml)

def nodes(): return list(ui().iter('node'))

def find(label):
    for n in nodes():
        if n.get('text') == label or n.get('content-desc') == label or n.get('content-desc','').startswith(label+', tab'):
            return n
    return None

def wait(label,timeout=90):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        n=find(label)
        if n is not None: return n
        time.sleep(1)
    raise AssertionError('Missing control/state: '+label)

def tap(label):
    n=wait(label)
    assert n.get('enabled')!='false','Disabled control: '+label
    bounds=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
    adb('shell','input','tap',str((bounds[0]+bounds[2])//2),str((bounds[1]+bounds[3])//2))

def scroll_to(label):
    for _ in range(8):
        if find(label) is not None: return
        adb('shell','input','swipe','360','1300','360','500','350')
    raise AssertionError('Missing scrolled control: '+label)

def open_title(title):
    # Home's bounded featured cards are enough; Explore gives exact search for all fixtures.
    tap('Explore'); tap('Search movie catalog')
    adb('shell','input','keyevent','KEYCODE_MOVE_END')
    adb('shell','input','keyevent','--longpress','KEYCODE_DEL')
    # Clear a preceding query through app restart: each test launches fresh navigation.
    adb('shell','input','text',('Fixture '+title).replace(' ','%s'))
    adb('shell','input','keyevent','4')
    tap('View Fixture '+title)
    wait('Fixture '+title)

def restart():
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity');wait('FilimeHome')

def position():
    for n in nodes():
        if n.get('resource-id','').endswith('playback-position'):
            m=re.match(r'(\d+):(\d+) /',n.get('text',''))
            if m:return int(m[1])*60+int(m[2])
    return -1

def advancing():
    deadline=time.monotonic()+40
    while time.monotonic()<deadline:
        if position()>=2:return
        time.sleep(1)
    raise AssertionError('Native player did not advance decoded playback time')

def record(name):
    results.append({'test':name,'result':'passed'})
    (OUT/'results.json').write_text(json.dumps(results,indent=2))
    print('PASSED:',name,flush=True)
    with (OUT/(re.sub('[^a-z0-9]+','-',name.lower())+'.png')).open('wb') as f:
        subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)

try:
    assert adb('shell','getprop','ro.build.version.sdk').strip()=='35'
    assert adb('shell','getprop','ro.kernel.qemu').strip()=='1','Fixture QA is emulator-only'
    adb('reverse','tcp:8443','tcp:8443')
    adb('install','-r','--no-streaming','fixture-qa-apk/app-release.apk')
    for title in ['MP4','HLS','Redirect','Headers']:
        restart();open_title(title);scroll_to('Watch Now');tap('Watch Now');wait('Ready to play')
        tap('Play / Pause');advancing();tap('Play / Pause')
        before=position();time.sleep(2);after=position();assert abs(after-before)<=1,'Pause failed'
        tap('+10 seconds')
        deadline=time.monotonic()+10
        while position()<before+7 and time.monotonic()<deadline:time.sleep(0.5)
        assert position()>=before+7,'Seek failed'
        tap('−10 seconds');tap('Fullscreen');time.sleep(2);adb('shell','input','keyevent','4')
        wait('Ready to play');record(title+' native playback pause seek fullscreen')
    for title in ['Denied','Expired']:
        restart();open_title(title);scroll_to('Watch Now');assert wait('Watch Now').get('enabled')=='false'
        assert find('Download authorized MP4') is None
        record(title+' rights/source gate')
    restart();open_title('Retry');scroll_to('Watch Now');tap('Watch Now');wait('Playback failed')
    context=ssl.create_default_context(cafile='media-fixtures/ca.pem')
    urllib.request.urlopen('https://127.0.0.1:8443/control/recover',context=context,timeout=15).read()
    tap('Reload video');wait('Ready to play');tap('Play / Pause');advancing();record('Native failed-source retry recovery')
    for title in ['Interrupted','Invalid','Corrupt']:
        restart();open_title(title);scroll_to('Download authorized MP4');tap('Download authorized MP4')
        deadline=time.monotonic()+90
        while time.monotonic()<deadline:
            texts=[n.get('text','') for n in nodes()]
            if any('connection was interrupted' in t or 'media request failed' in t for t in texts):break
            time.sleep(1)
        else:raise AssertionError('Failed download did not surface an error')
        tap('Downloads');wait('No downloaded movies yet.');record(title+' download rejection and cleanup')
    urllib.request.urlopen('https://127.0.0.1:8443/control/download-recover',context=context,timeout=15).read()
    restart();open_title('Interrupted');scroll_to('Download authorized MP4');tap('Download authorized MP4');wait('Download complete');tap('Downloads');wait('Play offline');tap('Remove');wait('No downloaded movies yet.');record('Interrupted download explicit retry succeeds')
    restart();open_title('Slow');scroll_to('Download authorized MP4');tap('Download authorized MP4');scroll_to('Pause download');tap('Pause download');wait('Resume download');tap('Resume download');wait('Cancel download');tap('Cancel download');wait('Download canceled');tap('Downloads');wait('No downloaded movies yet.');record('Download pause resume cancel')
    restart();open_title('Download Only');scroll_to('Download authorized MP4');tap('Download authorized MP4');wait('Download complete');tap('Downloads');wait('Play offline');record('Authorized MP4 download and completed file')
    # Remove the network tunnel, proving offline playback cannot fetch fixture media.
    adb('reverse','--remove','tcp:8443');tap('Play offline');wait('Ready to play');tap('Play / Pause');advancing();record('Completed download native offline playback without network')
    adb('shell','input','keyevent','4');tap('Remove');wait('No downloaded movies yet.');record('Remove completed download')
finally:
    (OUT/'logcat.txt').write_text(adb('logcat','-d'))
    (OUT/'results.json').write_text(json.dumps(results,indent=2))
