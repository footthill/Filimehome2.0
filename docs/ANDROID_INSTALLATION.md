# Android 15 installation and diagnosis

The Samsung Galaxy A05 installation message **"App not installed" does not identify
the failure reason**. A package-manager result from that device is required to
distinguish a signing conflict, damaged download, storage problem or device policy.
An emulator result cannot establish the exact cause of a physical-device failure.

## Corrected universal testing APK

- [Successful build and API 35 tests](https://github.com/footthill/Filimehome2.0/actions/runs/38073572979).
- [Download APK artifact ZIP](https://github.com/footthill/Filimehome2.0/actions/runs/38073572979/artifacts/11678032534).
- Extract and open **`FilimeHome-2.0-android15-universal.apk`** (71,221,207 bytes).
- APK SHA-256: `2866c21c2e3707807d4cb05d4e3694fcac00641754da44bbba5fdd9b16a96fc8`.
- Signing certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Actual APK manifest: package `com.footthill.filimehome`, version code **2**, minimum SDK **24**, target SDK **36**. No test-only/debuggable flag or split package.
- Actual packaged ABIs: **arm64-v8a, armeabi-v7a, x86, x86_64**.
- Signature verification, ZIP CRC integrity and 16 KB native-library ZIP alignment checks passed.
- [Package-manager logs, manifest, certificate checks and UI evidence](https://github.com/footthill/Filimehome2.0/actions/runs/38073572979/artifacts/11677358576).

Build source commit: `77aa393be1f84e75cec22c67022c22a25dea7995`.
Later documentation/device-diagnostic commits do not change the compiled native source.
The APK uses the existing Expo template preview certificate, with v1/v2/v3 signing
enabled and v2 verification required. The release-mode app is not debuggable.
This known testing certificate is for preview installation only; a production
release requires an independently controlled release signing identity. No private
keystore is included in the uploaded artifacts.

The API 35 Google APIs x86_64 emulator used 4 KB memory pages. The original APK
installed successfully, and the new APK updated it successfully with the same
certificate and increased version code. Home, Movies, Series, Search, Favorites,
Profile and hardware-back checks passed. On that disposable emulator the test
then removed the app, freshly installed the new APK, and verified cold launch
and a running application process. No physical-device data was removed.

The GitHub Actions download is a **ZIP containing an APK**. Download the artifact,
extract it, and install the `.apk` file. Renaming the ZIP to `.apk` does not make
it installable. Compare the extracted APK's checksum with the published checksum,
for example with `sha256sum path/to/filimehome.apk` on Linux or
`Get-FileHash .\filimehome.apk -Algorithm SHA256` in PowerShell.

On the Samsung phone: sign into GitHub if prompted, download the artifact, open
it in **My Files**, select **Extract**, then open the extracted
`FilimeHome-2.0-android15-universal.apk`. The same folder includes `SHA256SUMS`
and `metadata.json`. Use the filename and checksum to identify the correct file.

On the phone, use Android's ordinary installation flow and its per-source
installation permission for the source you chose. Keep Android's signature,
package-version and security checks enabled. If a Samsung or managed-device
policy blocks installation, follow the approved distribution or administrator
process. This project does not disable Samsung protections or override device
policy.

This preview uses the existing application package `com.footthill.filimehome`.
An update to an installed copy must have a compatible signing certificate and
version code. A newer APK signed by a different key cannot update that copy.
Do not remove an installed copy or its data until its signing conflict is
confirmed and any data-loss consequence is understood.

## Capture the physical Samsung installation result

Install Android SDK platform-tools on a computer and enable USB debugging through
the phone's developer settings. Connect the intended phone with USB and approve
that computer's debugging authorization on the phone. This authorization does
not disable APK verification. Run:

```sh
adb devices -l
python3 scripts/diagnose_device_install.py path/to/extracted-filimehome.apk
```

If multiple devices or emulators are connected, explicitly select the authorized
Samsung device:

```sh
python3 scripts/diagnose_device_install.py path/to/extracted-filimehome.apk --serial DEVICE_SERIAL
```

The script requires one authorized device or an explicit authorized serial. It
checks APK archive integrity and records its checksum before interacting with the
device. It captures device API/ABI/model, page size, free space, users, existing
package information and package-manager logcat before and after this command:

```sh
adb -s DEVICE_SERIAL install -r --no-streaming path/to/extracted-filimehome.apk
```

`-r` attempts an installation or compatible update while preserving package data.
The script records stdout, stderr and exit status even on installation failure.
It never uninstalls a package, clears logcat, permits version downgrades, bypasses
low-target-SDK restrictions or changes Android security settings. Results go into
a new `device-install-evidence/<UTC timestamp>/` directory. Inspect `summary.json`,
`adb-install.stdout.txt`, `adb-install.stderr.txt` and the package-manager logcat
files. Review files before sharing because they contain device identifiers and
package-manager information; they do not require passwords or private keys.

When installation succeeds, launch the app normally from its icon. To capture an
explicit launch on that same device:

```sh
adb -s DEVICE_SERIAL shell am start -W -n com.footthill.filimehome/.MainActivity
adb -s DEVICE_SERIAL shell dumpsys activity activities
adb -s DEVICE_SERIAL logcat -d -v threadtime AndroidRuntime:E PackageManager:V '*:S'
```

## Interpret the exact failure

| Package-manager result | Meaning and next step |
| --- | --- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | An installed copy has an incompatible signing identity. Inspect the installed package/certificate and use a compatible signed update. |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | The installed package has a newer version code. Use a compatible newer APK. |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | The APK lacks a native ABI supported by the device. Check `ro.product.cpu.abilist` against the packaged native libraries. |
| `INSTALL_FAILED_OLDER_SDK` | The APK's minimum SDK exceeds the device API. Check the actual manifest. |
| `INSTALL_FAILED_INVALID_APK` or `INSTALL_PARSE_FAILED_NO_CERTIFICATES` | Android rejected package contents or signing. Verify the extracted APK's checksum, ZIP integrity and apksigner result. |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` | Android cannot allocate installation space. Review `/data` free space and manage storage through the phone's standard settings. |
| `INSTALL_FAILED_USER_RESTRICTED` | Installation is restricted by a user, administrator or device policy. Use the authorized installation process. |

These are diagnostic examples, not a diagnosis of the Galaxy A05 failure. Other
results must be interpreted using their complete package-manager message.

## What the original APK evidence establishes

The original artifact was built by
[workflow run 38068221949](https://github.com/footthill/Filimehome2.0/actions/runs/38068221949).
Its native build log reported minimum SDK **24**, compile SDK **36** and target
SDK **36**, and compiled native modules for `armeabi-v7a`, `arm64-v8a`, `x86` and
`x86_64`. Its API 35 emulator `adb install -r` returned **`Success`**. A subsequent
activity-state assertion failed; that assertion was not an APK installation
failure. The later successful UI workflow used API 30, so it did not by itself
verify the Android 15 UI.

These original logs establish build settings and emulator installation, not the
integrity or signing identity of the copy downloaded to the Samsung device.
The new workflow also downloaded and inspected the original artifact: its
signature, ZIP CRC, SDK manifest and all four native-library directories passed.
It was installed successfully again on API 35. Thus the reported Samsung failure
was not reproduced on the emulator. The user confirmed a fresh installation and
was unsure whether the opened file was the APK or artifact ZIP. Installing the
ZIP is a possible explanation, not a confirmed diagnosis; only the physical
device's package-manager result can confirm its exact failure.
The corrected workflow inspects the actual uploaded APK rather than relying only
on Gradle build settings. Target SDK 36 does not require an API 36 device: minimum
SDK determines the oldest supported Android version. An API 35 device can install
a correctly packaged APK with minimum SDK 24 and target SDK 36.

## Emulator testing limits

An API 35 x86_64 emulator verifies Android 15 package-manager acceptance, launch
and the exercised navigation paths. It does not execute the ARM native libraries
used by the Samsung Galaxy A05. Universal APK inspection proves those libraries
are present; it does not replace physical ARM-device execution.

The emulator does not reproduce Samsung One UI, Knox, Auto Blocker, work-profile
policies, an existing app's signing identity, the phone's available storage,
download corruption, GPU/video-decoder behavior or real mobile connectivity.
Record the actual device page size; Android 15 does not imply every device uses
16 KB memory pages. Static alignment checks and an emulator with another page
size cannot establish native behavior on every 16 KB device.

Live Supabase authentication, catalog, authorized playback and downloads still
require the documented backend configuration and content rights. Installation
and navigation checks do not verify those live services.
