"""Build an emulator-only UI snapshot helper using installed Android tools, no dependencies."""
import os
from pathlib import Path
import subprocess
import zipfile

sdk = Path(os.environ['ANDROID_HOME'])
tools = sdk / 'build-tools/36.0.0'
android = sdk / 'platforms/android-36/android.jar'
root = Path('scripts/android-ui')
out = Path('ui-snapshot-build')
classes = out / 'classes'
classes.mkdir(parents=True, exist_ok=True)
def run(*args): subprocess.run([str(a) for a in args], check=True)
run('javac', '-source', '8', '-target', '8', '-classpath', android, '-d', classes, root/'DumpInstrumentation.java')
run(tools/'d8', '--lib', android, '--output', out, *classes.rglob('*.class'))
run(tools/'aapt2', 'link', '-I', android, '--manifest', root/'AndroidManifest.xml', '-o', out/'unsigned.apk')
with zipfile.ZipFile(out/'unsigned.apk', 'a') as apk: apk.write(out/'classes.dex', 'classes.dex')
run(tools/'zipalign', '-f', '4', out/'unsigned.apk', out/'aligned.apk')
run(tools/'apksigner', 'sign', '--ks', 'mobile/android/app/debug.keystore', '--ks-key-alias', 'androiddebugkey', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', out/'snapshot.apk', out/'aligned.apk')
