# Expo Build & Networking

## Why a dev build (not Expo Go)
Expo Go was unusable here: an SDK-validation bug (upstream #46846) plus a SIGSEGV in Go's bundled `libworklets.so` on the
Android 16 emulator. The app uses a **dev build** with `expo-dev-client`; Expo Go is uninstalled. Native modules in use:
expo-camera, expo-secure-store, Unistyles (Nitro). Adding/removing a native module ⇒ rebuild.

## Commands (from `apps/mobile/`)
```bash
pnpm exec expo run:android                                  # emulator dev build (Metro attached, live reload)
rm -rf android/app/build && pnpm exec expo run:android --variant release   # release APK for phones
adb devices                                                 # find serial
adb -s <SERIAL> install -r android/app/build/outputs/apk/release/app-release.apk
adb -s <SERIAL> uninstall com.pc165.rpsworker               # if INSTALL_FAILED_UPDATE_INCOMPATIBLE (signature mismatch)
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8080 tcp:8080   # emulator only; dies on emulator restart
adb -s <SERIAL> logcat "*:S" ReactNativeJS:V                # JS logs (quote "*:S" in zsh)
```
JS-only changes: Metro reload (dev build) — but phones on a release APK need a rebuild + reinstall.

## API URL — baked at build time
`EXPO_PUBLIC_API_URL` is compiled into the bundle. Verify what an APK carries:
```bash
unzip -p android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | strings | grep -E "api/v1" | head
```
Options, and when each fits:
| URL | Works for | Caveat |
|---|---|---|
| `http://10.0.2.2:8080` | emulator only | phones can't use it |
| `http://192.168.1.9:8080` (laptop LAN IP) | emulator + phones on same WiFi | DHCP may change; routers with client isolation block phone→laptop |
| `http://10.42.0.1:8080` (laptop hotspot: `nmcli device wifi hotspot ifname wlp0s20f3 ssid RPS-DEMO password …`) | phones + emulator, no internet needed | laptop loses WiFi internet while hosting (single radio); ideal for demos |
| `https://<x>.ngrok-free.dev` | phones anywhere, mobile data | interstitial page for browsers (app sends `ngrok-skip-browser-warning`); claim the free static domain and start with `ngrok http 8080 --domain=…` or the URL changes per session |
Backend binds `":" + PORT` (all interfaces) — no change needed. Test reachability first from the phone's browser: `http://<host>:8080/healthz`.

## Distribution (private, no store)
Direct APK (WhatsApp/Drive/USB), "allow unknown sources" once. Auth (enrollment code + PIN) is the real access control.
Post-deploy plan: EAS Build with a proper keystore + EAS Update for OTA JS updates; API URL becomes the Railway domain.

## pnpm + Expo essentials
Hoisted node_modules (root `.npmrc` + `pnpm-workspace.yaml nodeLinker: hoisted`). Packages with postinstall scripts must be
approved: `pnpm approve-builds` (sharp, unrs-resolver, core-js so far). Installed packages land in the **root** `node_modules`.
