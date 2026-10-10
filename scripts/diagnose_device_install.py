#!/usr/bin/env python3
"""Capture an authorized device's APK install result without uninstalling data.

Only `adb install -r --no-streaming` changes the device. The script never clears
logcat, removes an app, downgrades a package or changes Android security policy.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path


PACKAGE = 'com.footthill.filimehome'
LOG_TAGS = [
    'PackageManager:V', 'PackageManagerService:V', 'PackageInstaller:V',
    'PackageInstallerSession:V', 'InstallPackageHelper:V', 'installd:V',
    'artd:V', 'AndroidRuntime:E', '*:S',
]


def as_text(value):
    return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else (value or '')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path, help='Extracted, signed .apk file, not a GitHub artifact ZIP')
    parser.add_argument('-s', '--serial', help='Select one explicitly authorized adb device')
    parser.add_argument('--package', default=PACKAGE, help='Expected Android package name')
    parser.add_argument('--output-dir', type=Path, help='A new directory for diagnostic files')
    args = parser.parse_args()

    apk = args.apk.resolve()
    if not apk.is_file() or apk.suffix.lower() != '.apk':
        parser.error('Provide an existing extracted .apk file; do not pass the artifact ZIP.')
    try:
        with zipfile.ZipFile(apk) as archive:
            if 'AndroidManifest.xml' not in archive.namelist():
                parser.error('This archive is not an APK: AndroidManifest.xml is missing. Extract the artifact ZIP first.')
            corrupt_entry = archive.testzip()
            if corrupt_entry:
                parser.error('APK archive integrity failed for entry: ' + corrupt_entry)
    except (zipfile.BadZipFile, OSError) as error:
        parser.error('Cannot read the APK archive: ' + str(error))
    if not re.fullmatch(r'[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+', args.package):
        parser.error('The expected package name is invalid.')

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    output = args.output_dir or Path('device-install-evidence') / timestamp
    # Avoid overwriting evidence from an earlier installation attempt.
    output.mkdir(parents=True, exist_ok=False)
    records = []
    adb_prefix = ['adb']
    summary = {
        'started_utc': timestamp, 'apk_filename': apk.name,
        'apk_sha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
        'apk_bytes': apk.stat().st_size, 'expected_package': args.package,
        'install_attempted': False,
    }

    def save_result(name, command, returncode, stdout='', stderr='', timed_out=False):
        stdout, stderr = as_text(stdout), as_text(stderr)
        (output / (name + '.stdout.txt')).write_text(stdout, encoding='utf-8')
        (output / (name + '.stderr.txt')).write_text(stderr, encoding='utf-8')
        record = {'name': name, 'command': command, 'exit_code': returncode, 'timed_out': timed_out}
        records.append(record)
        (output / (name + '.command.json')).write_text(json.dumps(record, indent=2), encoding='utf-8')
        return returncode, stdout, stderr

    def capture(name, arguments, timeout=90):
        command = adb_prefix + arguments
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
            return save_result(name, command, result.returncode, result.stdout, result.stderr)
        except subprocess.TimeoutExpired as error:
            return save_result(name, command, 124, error.stdout, as_text(error.stderr) + '\nCommand timed out.', True)
        except OSError as error:
            return save_result(name, command, 127, stderr=str(error))

    def snapshot(prefix):
        for label, prop in [
            ('android-api', 'ro.build.version.sdk'), ('android-release', 'ro.build.version.release'),
            ('abis', 'ro.product.cpu.abilist'), ('manufacturer', 'ro.product.manufacturer'),
            ('model', 'ro.product.model'), ('fingerprint', 'ro.build.fingerprint'),
        ]:
            capture(prefix + '-' + label, ['shell', 'getprop', prop])
        capture(prefix + '-page-size', ['shell', 'getconf', 'PAGE_SIZE'])
        capture(prefix + '-disk-space', ['shell', 'df', '-h', '/data'])
        capture(prefix + '-users', ['shell', 'pm', 'list', 'users'])
        capture(prefix + '-package', ['shell', 'dumpsys', 'package', args.package])
        capture(prefix + '-package-path', ['shell', 'pm', 'path', args.package])
        capture(prefix + '-package-manager-logcat', ['logcat', '-d', '-v', 'threadtime', '-b', 'main', '-b', 'system', '-b', 'crash', *LOG_TAGS])

    exit_code = 1
    logger = None
    log_files = []
    log_command = None
    try:
        code, devices_output, _ = capture('devices', ['devices', '-l'])
        if code:
            raise RuntimeError('adb devices failed. Install Android platform-tools and inspect devices.stderr.txt.')
        states = {}
        for line in devices_output.splitlines():
            fields = line.split()
            if len(fields) >= 2 and not line.startswith('List of devices'):
                states[fields[0]] = fields[1]
        authorized = [serial for serial, state in states.items() if state == 'device']
        if args.serial:
            if states.get(args.serial) != 'device':
                raise RuntimeError('Selected device is not connected and authorized. Accept the USB debugging authorization on the intended device.')
            selected = args.serial
        elif len(authorized) == 1 and len(states) == 1:
            selected = authorized[0]
        else:
            raise RuntimeError('Connect exactly one authorized device, or select an authorized device explicitly with --serial. No installation was attempted.')
        adb_prefix = ['adb', '-s', selected]
        summary['device_serial'] = selected
        snapshot('before')

        log_command = adb_prefix + ['logcat', '-v', 'threadtime', '-b', 'main', '-b', 'system', '-b', 'crash', *LOG_TAGS]
        log_files = [open(output / 'install-package-manager-logcat.stdout.txt', 'w', encoding='utf-8'),
                     open(output / 'install-package-manager-logcat.stderr.txt', 'w', encoding='utf-8')]
        logger = subprocess.Popen(log_command, stdout=log_files[0], stderr=log_files[1], text=True)
        summary['install_attempted'] = True
        code, stdout, stderr = capture('adb-install', ['install', '-r', '--no-streaming', str(apk)], timeout=600)
        summary['install_exit_code'] = code
        summary['install_output'] = (stdout + stderr).strip()
        failure = re.search(r'\bINSTALL(?:_PARSE)?_FAILED_[A-Z0-9_]+\b', stdout + stderr)
        summary['package_manager_failure'] = failure.group(0) if failure else None
        summary['install_succeeded'] = code == 0 and bool(re.search(r'^Success\s*$', stdout, re.MULTILINE))
        snapshot('after')
        exit_code = 0 if summary['install_succeeded'] else 1
        print(summary['install_output'] or 'adb returned no installation output.')
        if failure:
            print('Exact package-manager result:', failure.group(0))
        print('No app was uninstalled and no Android security settings were changed.')
    except (OSError, RuntimeError) as error:
        summary['diagnostic_error'] = str(error)
        print(str(error), file=sys.stderr)
    finally:
        if logger:
            if logger.poll() is None:
                logger.terminate()
            try:
                logger.wait(timeout=15)
            except subprocess.TimeoutExpired:
                logger.kill()
                logger.wait(timeout=15)
            records.append({'name': 'install-package-manager-logcat', 'command': log_command,
                            'exit_code': logger.returncode, 'terminated_after_capture': True})
            (output / 'install-package-manager-logcat.command.json').write_text(json.dumps(records[-1], indent=2), encoding='utf-8')
        for stream in log_files:
            stream.close()
        summary['commands'] = records
        (output / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
        print('Diagnostic files:', output.resolve())
        print('Review logs before sharing: they contain device identifiers and package-manager information.')
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
