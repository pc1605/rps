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
adb -s <SERIAL> uninstall com.rpsworker.app                 # if INSTALL_FAILED_UPDATE_INCOMPATIBLE (signature mismatch)
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8080 tcp:8080   # emulator only; dies on emulator restart
adb -s <SERIAL> logcat "*:S" ReactNativeJS:V                # JS logs (quote "*:S" in zsh)
```
JS-only changes: Metro reload (dev build) — but phones on a release APK need a rebuild + reinstall.

## Release signing — RPS's own key (never change it)
Phones install an update only when it is signed by the **same key** as the installed app. Lose or change the key and
every phone must uninstall, reinstall and be set up again. Release APKs are signed with RPS's own key (from 28 Nov
2026); the earlier test APKs used the public debug key, so a phone that has one installs the first signed APK only
after uninstalling it.
- **Key file**: `~/.rps/rps-release.keystore` (next to the Firebase files). Not in Git. Keep two copies off the
  laptop (USB drive, password manager) together with its password.
- **Passwords**: `~/.gradle/gradle.properties` (outside the repo, `chmod 600`):
  `RPS_RELEASE_STORE_FILE`, `RPS_RELEASE_STORE_PASSWORD`, `RPS_RELEASE_KEY_ALIAS=rps`, `RPS_RELEASE_KEY_PASSWORD`.
- **How**: `android/` is generated and not in Git, so `plugins/with-release-signing.js` (listed in `app.json`) writes
  the release signing into `android/app/build.gradle` on every `expo prebuild`. A release build without the
  properties stops with an error instead of falling back to the debug key.
- Check an APK's signer (SDK build-tools; `keytool -printcert -jarfile` shows nothing, the APK has no v1 signature):
  `~/Android/Sdk/build-tools/<version>/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk`
  → `Signer #1 certificate DN: CN=RPS Worker, …`, never `CN=Android Debug`. Key SHA-256 starts `add0ed8e`.

## API URL — baked at build time
`EXPO_PUBLIC_API_URL` is compiled into the bundle. Verify what an APK carries:
```bash
unzip -p android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | strings | grep -E "api/v1" | head
```
**Release APKs use the live server.** `apps/mobile/.env.production` (committed — the address is public) sets
`https://rps.riddhicarmats.com/api/v1`. A release build bundles with `NODE_ENV=production`, and Expo reads
`.env.production.local` → `.env.local` → `.env.production` → `.env` (first wins), so it beats the dev `.env`. Dev
builds keep using `.env` (ngrok / LAN below). A `.env.local` would win over `.env.production` — don't keep one when
building for the factory. Run the `unzip … | grep api/v1` check above on every APK before sending it out.

Options for development, and when each fits:
| URL | Works for | Caveat |
|---|---|---|
| `http://10.0.2.2:8080` | emulator only | phones can't use it |
| `http://192.168.1.9:8080` (laptop LAN IP) | emulator + phones on same WiFi | DHCP may change; routers with client isolation block phone→laptop |
| `http://10.42.0.1:8080` (laptop hotspot: `nmcli device wifi hotspot ifname wlp0s20f3 ssid RPS-DEMO password …`) | phones + emulator, no internet needed | laptop loses WiFi internet while hosting (single radio); ideal for demos |
| `https://<x>.ngrok-free.dev` | phones anywhere, mobile data | interstitial page for browsers (app sends `ngrok-skip-browser-warning`); claim the free static domain and start with `ngrok http 8080 --domain=…` or the URL changes per session |
Backend binds `":" + PORT` (all interfaces) — no change needed. Test reachability first from the phone's browser: `http://<host>:8080/healthz`.

## Distribution (private, no store)
Direct APK (WhatsApp/Drive/USB), "allow unknown sources" once. Auth (enrollment code + PIN) is the real access control.
Later, maybe: EAS Build with a proper keystore + EAS Update for OTA JS updates. The API URL stays
`rps.riddhicarmats.com` (Lightsail, D46) — moving the server only changes the DNS record, not the APK.

## pnpm + Expo essentials
Hoisted node_modules (root `.npmrc` + `pnpm-workspace.yaml nodeLinker: hoisted`). Packages with postinstall scripts must be
approved: `pnpm approve-builds` (sharp, unrs-resolver, core-js so far). Installed packages land in the **root** `node_modules`.
