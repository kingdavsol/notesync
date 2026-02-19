# NoteSync — Handover 2026-02-19 22:25

## Current Status

All code is committed and pushed to `main`. **Waiting for EAS build quota to reset on March 1 2026** (markd98 free plan) to get a new APK.

Latest commit: `18421a8`

---

## EAS Project Configuration

| Field | Value |
|---|---|
| Expo Account | `markd98` |
| Project slug | `notesync` |
| Project ID | `b30e6bd3-4217-4a85-b13f-628721a8462b` |
| GitHub Repo | `kingdavsol/notesync` (branch: `main`) |
| Robot Token (markd98) | `EXPO_TOKEN=yZvl5ETVjlWM9Kq_nHb4Lf6Ik2NVjs9KiF40o3P0` |
| Robot name | `Notesync-Claude` |
| 9gg.app Token | `qMUFtTOxs5X9Iz1IncU8jElVWTQXn94TwO0l1dHC` |

> **NOTE**: Do NOT use the 9gg.app token to create new EAS projects. It created duplicate project entries (`check-9gg.app/notesync`) in a previous session — those should be deleted from expo.dev. Always build under `markd98`.

### Trigger a new build (when quota resets March 1):
```bash
cd /var/www/notesync
export EXPO_TOKEN="yZvl5ETVjlWM9Kq_nHb4Lf6Ik2NVjs9KiF40o3P0"
npx eas-cli build --platform android --profile preview --non-interactive --no-wait
```

---

## Android Signing Credentials

| Field | Value |
|---|---|
| Keystore file | `notesync-keystore.p12` (repo root) |
| Keystore password | `NoteSync2026!` |
| Key alias | `notesync-key` |
| Key password | `NoteSync2026!` |
| Valid until | July 2053 |
| Config | `credentials.json` at repo root |
| EAS setting | `credentialsSource: "local"` in all eas.json profiles |

---

## Backend

| Field | Value |
|---|---|
| URL | `https://notesync.9gg.app/api` |
| Server | Contabo VPS `195.26.248.151` |
| Process manager | PM2 (process name: `notesync`) |
| Location | `/var/www/notesync/backend/` |
| Restart | `pm2 restart notesync` |

**Backend .env** (not committed — set on server):
```
GROQ_API_KEY=<redacted — retrieve from /var/www/notesync/backend/.env on Contabo VPS>
```

---

## What Was Fixed / Added This Session

### Bug Fix 1 — Title not saving on navigate-back
- **Root cause**: Auto-save debounce `useEffect` cleanup cancelled the pending 1-second timeout when user navigated back, leaving WatermelonDB record as "Untitled" while local React state still showed the typed title.
- **Fix** (`NoteEditorScreen.tsx`):
  - Added `saveRef` (updated every render with latest `saveNote` closure)
  - Added `isMountedRef` (guards `setNote()` after unmount)
  - Removed cleanup return from debounce effect
  - Added unmount-only effect: cancels debounce timeout and fires `saveRef.current()` immediately

### Bug Fix 2 — Sync dot stays orange (pending) forever
- **Root cause**: Notes with photo attachments stored images as `__IMG__base64data` appended to content string. This pushed the JSON sync payload over the 10 MB body limit, causing `syncPush` to fail silently.
- **Fix**:
  - `sync.ts` `pushChanges()`: strips `__IMG__` markers before pushing → `note.content.replace(/\n__IMG__[^\n]*/g, '').trim()`
  - `backend/src/index.js`: raised `express.json({ limit: '50mb' })` and urlencoded limit to match

### Feature — Search actually filters notes
- The search bar in `NotesScreen.tsx` was collecting input but never filtering the list.
- Fixed with `useMemo` client-side filter on `title` and `contentPlain`.

### Feature — Long-press to pin / unpin / delete from list
- Long-pressing any note card shows an `Alert.alert` action sheet: **Pin to top** / **Unpin**, **Delete**, **Cancel**.
- No need to open the note just to pin it.
- Writes directly to WatermelonDB and calls `markNoteForSync`.

### Feature — "PINNED" section header
- Pinned notes grouped at top with a **PINNED** label.
- When both pinned and unpinned notes exist, a **NOTES** label separates them.
- Pinned note cards get a green left border (`borderLeftWidth: 3, borderLeftColor: '#2dbe60'`).

### Feature — Share button in note editor
- Added a `share-2` icon button in the NoteEditorScreen header.
- Calls React Native `Share.share({ title, message })` — works with any app (WhatsApp, email, etc.).

### Feature — Custom app icon
- Generated 1024×1024 icon via Node.js + sharp:
  - Vibrant green gradient background (rounded square)
  - White elephant face (frontal: head + two ears + eyes + blush)
  - **Page-fold corner** on the left ear — subtle Evernote nod
  - Trunk forms a **circular sync symbol** (two 150° arcs with arrowheads)
- Files written to `assets/icon.png`, `assets/adaptive-icon.png`, `assets/favicon.png`
- Splash screen: icon centred on green background → `assets/splash.png`
- `app.json` updated with `"icon"`, `"splash.image"`, and `"android.adaptiveIcon"` paths

---

## Current app.json

```json
{
  "expo": {
    "name": "NoteSync",
    "slug": "notesync",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "icon": "./assets/icon.png",
    "owner": "markd98",
    "extra": { "eas": { "projectId": "b30e6bd3-4217-4a85-b13f-628721a8462b" } },
    "splash": {
      "image": "./assets/splash.png",
      "backgroundColor": "#2dbe60",
      "resizeMode": "contain"
    },
    "ios": { "supportsTablet": true, "bundleIdentifier": "app.gg9.notesync" },
    "android": {
      "package": "app.gg9.notesync",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#2dbe60"
      },
      "permissions": ["RECORD_AUDIO", "WRITE_EXTERNAL_STORAGE", "READ_EXTERNAL_STORAGE"]
    },
    "plugins": [
      "expo-dev-client",
      "expo-updates",
      ["expo-image-picker", {
        "photosPermission": "NoteSync needs access to your photos to attach images to notes.",
        "cameraPermission": "NoteSync needs access to your camera to take photos for notes."
      }]
    ]
  }
}
```

---

## Current eas.json

```json
{
  "cli": { "version": ">= 5.9.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true, "distribution": "internal",
      "credentialsSource": "local", "node": "20.11.1",
      "android": { "gradleCommand": ":app:assembleDebug", "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal", "credentialsSource": "local", "node": "20.11.1",
      "android": { "buildType": "apk" }
    },
    "production": {
      "credentialsSource": "local", "node": "20.11.1",
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

> Use `preview` profile for a sideloadable APK. Use `production` for a Play Store `.aab`.

---

## Evernote Feature Parity — Current State

| Feature | Status |
|---|---|
| Note creation + text | ✅ |
| Notebooks / folders | ✅ |
| Tags | ✅ |
| Full-text search | ✅ Fixed this session |
| Pin / starred notes | ✅ Improved this session (long-press UX) |
| Photo attachments | ✅ |
| Voice transcription | ✅ Groq Whisper whisper-large-v3 |
| Offline access | ✅ WatermelonDB SQLite |
| Checklists | ✅ |
| Cross-device sync | ✅ |
| Share notes | ✅ Added this session |
| Reminders | ⚠️ Backend done — no mobile UI yet |
| Dark mode | ❌ Not implemented |
| Sort options | ❌ Only pinned-first + date |
| Note history / versions | ⚠️ Backend done — no mobile UI yet |

**Recommended next features** (highest impact):
1. Reminders UI — backend route exists at `/api/reminders`
2. Sort options — by title / created / updated
3. Dark mode — theme context + StyleSheet swap

---

## Git History (This Session)

```
18421a8  revert: restore markd98 owner and original projectId
d345747  chore: link project to check-9gg.app Expo account (projectId 292ec9d7)  ← superseded by revert
6ad2f9d  feat: add NoteSync elephant icon with sync symbol and splash screen
2f4acbe  fix: save title on back-navigation, fix sync, add pin UX and search
9488b85  feat: wire up Groq whisper-large-v3 for real voice transcription  (prev session)
```

---

## Icon Regeneration

The icon was generated by `/tmp/gen-icon.js` using `sharp`. To regenerate or tweak:

```bash
node /tmp/gen-icon.js
# Writes: assets/icon.png, assets/adaptive-icon.png, assets/favicon.png
# Also writes: /tmp/notesync-icon-preview.png  (for visual check)
```

Key design parameters in the script:
- Background gradient: `#40e080` → `#2dbe60` → `#0f6e38`
- Head circle: center `(512, 440)`, radius `205`
- Sync circle: center `(512, 820)`, radius `88`; arcs at θ 20°→170° and 200°→350°
- Page-fold triangle (left ear): `(348,258) (284,258) (348,326)` in dark green

---

## Project File Structure

```
/var/www/notesync/
├── App.tsx                        # Root component
├── app.json                       # Expo config (owner: markd98)
├── babel.config.js
├── credentials.json               # Android keystore config
├── eas.json                       # Build profiles
├── index.js                       # Entry point
├── notesync-keystore.p12          # Android signing keystore
├── package.json
├── yarn.lock
├── assets/
│   ├── icon.png                   # 1024×1024 app icon (NEW)
│   ├── adaptive-icon.png          # Android adaptive icon (NEW)
│   ├── favicon.png                # 48×48 web favicon (NEW)
│   └── splash.png                 # Splash screen (NEW)
├── src/
│   ├── components/
│   │   └── VoiceRecorder.tsx      # expo-av + expo-file-system
│   ├── models/                    # WatermelonDB models (JS)
│   ├── navigation/
│   │   └── MainNavigator.tsx
│   ├── screens/
│   │   ├── NotesScreen.tsx        # Search filter + long-press + section headers
│   │   ├── NoteEditorScreen.tsx   # Save-on-unmount fix + share button
│   │   └── ...
│   ├── hooks/
│   │   └── useSync.tsx            # SyncProvider context
│   └── services/
│       ├── api.ts                 # Backend API client
│       └── sync.ts                # Strips __IMG__ before push
└── backend/                       # Node.js backend
    └── src/
        ├── index.js               # 50MB body limit
        └── routes/
            └── transcribe.js      # Groq whisper-large-v3
```
