# RPS brand mark

Chosen 21 Nov 2026: direction **A, "Mat"**. A car floor mat seen from above (the cut corner is where a driver's mat
meets the centre console), with the R cut out of it. One flat shape, so it works in one colour with no changes.
This is a first version: the owner is showing it around, and it may change.

## Colours

| Use                                                        | Hex       |
| ---------------------------------------------------------- | --------- |
| Mark, app icon background, adaptive background             | `#B45309` |
| R on the app icon, light splash background                 | `#FAFAF7` |
| One-colour mark, "RPS" in the full logo                    | `#1C1917` |
| Dark splash background (same as the app's dark background) | `#161514` |
| "Riddhi Production System" line in the full logo           | `#6B6560` |
| Android monochrome + notification icons                    | `#FFFFFF` |

## Files and where they are used

| File                          | Size     | Used in                                                                            |
| ----------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `logo-mark.svg`               | vector   | Amber mark, transparent                                                            |
| `logo-full.svg`               | vector   | Mark + "RPS" + "Riddhi Production System" (text as outlines, IBM Plex Sans Medium) |
| `logo-mark-mono.svg`          | vector   | One-colour mark (`#1C1917`)                                                        |
| `icon.png`                    | 1024     | `apps/mobile/assets/` (app.json `icon`)                                            |
| `android-icon-foreground.png` | 1024     | `apps/mobile/assets/` (mark inside the 66 % safe circle)                           |
| `android-icon-background.png` | 1024     | `apps/mobile/assets/` (solid `#B45309`)                                            |
| `android-icon-monochrome.png` | 1024     | `apps/mobile/assets/` (Android 13 themed icon)                                     |
| `splash-icon.png`             | 1024     | `apps/mobile/assets/` (app.json `expo-splash-screen`)                              |
| `notification-icon.png`       | 96       | `apps/mobile/assets/` (expo-notifications `icon`)                                  |
| `favicon.ico`                 | 16/32/48 | `apps/admin-web/app/`                                                              |
| `icon.svg`                    | vector   | `apps/admin-web/app/`                                                              |
| `apple-icon.png`              | 180      | `apps/admin-web/app/`                                                              |

Icon changes on the phone show only after a new build (`expo prebuild` / a new APK); a JS reload is not enough.

Splash: light background `#FAFAF7`, dark `#161514`, the same as the app's own backgrounds so the first screen
follows with no colour jump. `app/_layout.tsx` keeps it up until the fonts have loaded.

## Changing the mark

The shapes are code in `source/marks.cjs` (direction A is `dirs.A`); `source/build.cjs` writes every file above.

```
cd docs/rps-kb/09-design/brand/source && npm pack opentype.js@1.3.4 && tar xzf opentype.js-1.3.4.tgz
OPENTYPE_JS=./package/dist/opentype.js OUT=.. NODE_PATH=../../../../../node_modules node build.cjs
rm -rf package opentype.js-1.3.4.tgz
```

Then copy the files into the app folders listed above.
