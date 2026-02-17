# NoteSync Android EAS Build — Handover 2026-02-17 20:13

## Current Status

**Active EAS Build**: `3b0e01e8-b913-48bb-b61b-b4a9d77c4fd3`
- Profile: `preview` (produces APK)
- Platform: Android
- Commit: `0e0ef33`
- Dashboard: https://expo.dev/accounts/markd98/projects/notesync/builds/3b0e01e8-b913-48bb-b61b-b4a9d77c4fd3
- Status at session end: **Queued / Running**

---

## EAS Project Configuration

| Field | Value |
|---|---|
| Expo Account | `markd98` |
| Project slug | `notesync` |
| Project ID | `b30e6bd3-4217-4a85-b13f-628721a8462b` |
| GitHub Repo | `kingdavsol/notesync` (branch: `main`) |
| Robot Token | `EXPO_TOKEN=yZvl5ETVjlWM9Kq_nHb4Lf6Ik2NVjs9KiF40o3P0` |
| Robot name | `Notesync-Claude` |

The robot token has full CLI access. Use it like this:
```bash
export EXPO_TOKEN="yZvl5ETVjlWM9Kq_nHb4Lf6Ik2NVjs9KiF40o3P0"
npx eas-cli build:list --platform android --limit 5 --non-interactive
```

---

## Android Signing Credentials

| Field | Value |
|---|---|
| Keystore file | `notesync-keystore.p12` (at repo root) |
| Keystore password | `NoteSync2026!` |
| Key alias | `notesync-key` |
| Key password | `NoteSync2026!` |
| Valid until | July 2053 |
| Config | `credentials.json` at repo root |
| EAS setting | `credentialsSource: "local"` in all eas.json profiles |

---

## What Was Fixed This Session

### 1. EAS Config Mismatch (projectId)
- **Problem**: `app.json` had old `kingsol` projectId; GitHub repo was connected to `markd98/notesync`
- **Fix**: Updated `app.json` owner → `markd98`, projectId → `b30e6bd3-...`

### 2. Duplicate Expo Project Files
- **Problem**: `mobile/app.json`, `mobile/eas.json`, `mobile/package.json` all existed alongside root-level equivalents — EAS couldn't determine project root, caused "Failed to read '/package.json'"
- **Fix**: Removed all `mobile/` project config files from git; added to `.gitignore`

### 3. Bare Native Modules → Expo SDK
- **Problem**: `react-native-vector-icons`, `react-native-audio-recorder-player`, `react-native-fs` caused `EAS_BUILD_UNKNOWN_GRADLE_ERROR` — these need manual native linking not supported in Expo managed builds
- **Fix**:
  - `react-native-vector-icons/Feather` → `@expo/vector-icons` (Feather) — all 9 files
  - `react-native-audio-recorder-player` → `expo-av` (Audio.Recording API)
  - `react-native-fs` → `expo-file-system` (FileSystem API)
  - Added `expo-font` (required peer dependency of `@expo/vector-icons`)
  - `VoiceRecorder.tsx` fully rewritten to use new APIs

### 4. Dual Lock Files
- **Problem**: Both `package-lock.json` and `yarn.lock` existed — EAS warned about this; npm conflicts with yarn
- **Fix**: Removed `package-lock.json` from git; added to `.gitignore`; regenerated `yarn.lock`

### 5. Invalid `"platform"` in eas.json
- **Problem**: Added `"platform": "android"` to build profiles — not a valid EAS schema field
- **Fix**: Removed the field. To restrict to Android, select Android in dashboard or use `--platform android` in CLI

---

## Current eas.json

```json
{
  "cli": { "version": ">= 5.9.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "credentialsSource": "local",
      "node": "20.11.1",
      "android": { "gradleCommand": ":app:assembleDebug", "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "credentialsSource": "local",
      "node": "20.11.1",
      "android": { "buildType": "apk" }
    },
    "production": {
      "credentialsSource": "local",
      "node": "20.11.1",
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

---

## Current app.json

```json
{
  "expo": {
    "name": "NoteSync",
    "slug": "notesync",
    "version": "1.0.0",
    "owner": "markd98",
    "extra": { "eas": { "projectId": "b30e6bd3-4217-4a85-b13f-628721a8462b" } },
    "android": {
      "package": "app.gg9.notesync",
      "permissions": ["RECORD_AUDIO", "WRITE_EXTERNAL_STORAGE", "READ_EXTERNAL_STORAGE"]
    },
    "plugins": ["expo-dev-client", "expo-updates"]
  }
}
```

---

## Key Dependencies (package.json)

```json
{
  "@expo/vector-icons": "^14.0.0",
  "@nozbe/watermelondb": "^0.27.1",
  "@nozbe/with-observables": "^1.6.0",
  "expo": "~50.0.0",
  "expo-av": "~13.10.5",
  "expo-dev-client": "~3.3.12",
  "expo-file-system": "~16.0.8",
  "expo-font": "~11.10.3",
  "expo-updates": "~0.24.13",
  "react-native": "0.73.6"
}
```

---

## If the Active Build Fails

Check logs via CLI:
```bash
export EXPO_TOKEN="yZvl5ETVjlWM9Kq_nHb4Lf6Ik2NVjs9KiF40o3P0"
npx eas-cli build:list --platform android --limit 3 --non-interactive
```

The build output includes signed URL links to log files (valid for 15 minutes after query). Fetch them with `WebFetch` to see the Gradle error.

Common next errors to watch for:
- **WatermelonDB Gradle config**: May need `android/build.gradle` changes for SQLite/JSC
- **expo-updates config plugin**: May need `channel` field in eas.json build profiles
- **Babel decorator transform**: Ensure `babel.config.js` has `@babel/plugin-proposal-decorators` with `legacy: true`

### Trigger a new build:
```bash
export EXPO_TOKEN="yZvl5ETVjlWM9Kq_nHb4Lf6Ik2NVjs9KiF40o3P0"
npx eas-cli build --platform android --profile preview --non-interactive --json
```

---

## Git History (This Session)

```
0e0ef33  fix: replace bare native modules with Expo SDK equivalents
4018e29  fix: update owner and projectId to match connected Expo project
ea43402  fix: remove duplicate app.json/eas.json from mobile/ subdirectory
4206b3b  fix: remove invalid 'platform' field from eas.json build profiles
3d5c12d  fix: add yarn.lock so EAS Build uses locked dependency versions
```

---

## Project File Structure (Expo root)

```
/var/www/notesync/
├── App.tsx                    # Root component
├── app.json                   # Expo config (owner: markd98)
├── babel.config.js            # Babel with decorator support
├── credentials.json           # Android keystore config
├── eas.json                   # EAS build profiles
├── index.js                   # Entry point
├── notesync-keystore.p12      # Android signing keystore
├── package.json               # Dependencies (yarn only)
├── yarn.lock                  # Locked dependencies
├── src/
│   ├── components/
│   │   └── VoiceRecorder.tsx  # Uses expo-av + expo-file-system
│   ├── models/                # WatermelonDB models
│   ├── navigation/
│   │   └── MainNavigator.tsx  # Uses @expo/vector-icons
│   ├── screens/               # All screens use @expo/vector-icons
│   └── services/
│       ├── api.ts             # Backend API client
│       └── sync.ts            # Sync service
├── backend/                   # Node.js backend (separate)
└── mobile/                    # OLD - project configs removed from git
```
