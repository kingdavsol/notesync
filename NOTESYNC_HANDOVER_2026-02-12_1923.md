# NoteSync Project Handover Document
**Date:** February 12, 2026 at 19:23 UTC
**Repository:** https://github.com/kingdavsol/notesync
**Live URL:** https://notesync.9gg.app
**Status:** Production Ready - Web App Live, Mobile App in Development

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Production Deployment Details](#production-deployment-details)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Features Implemented](#features-implemented)
6. [Session Updates - Feb 12, 2026 (19:01-19:23)](#session-updates)
7. [Cross-Platform Development Plan](#cross-platform-development-plan)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Environment Configuration](#environment-configuration)
11. [Known Issues & Solutions](#known-issues--solutions)
12. [Security Considerations](#security-considerations)
13. [Future Enhancements](#future-enhancements)

---

## Project Overview

NoteSync is a full-featured, cross-platform note-taking application similar to Evernote. It provides seamless synchronization across web platforms with offline-first capabilities and real-time collaboration.

### Key Highlights
- **Web Application**: Production-ready React SPA deployed on Contabo VPS (✅ LIVE)
- **Mobile Apps**: React Native scaffold exists, under active development
- **Real-time collaboration**: WebSocket-based collaborative editing with presence indicators
- **Email Verification**: Resend-powered email verification for new users
- **Offline-first**: Full functionality without internet, auto-sync when online
- **Rich text editing**: Tables, code blocks, drawings, checklists, voice notes
- **Advanced Search**: Full-text search with PostgreSQL FTS
- **Version History**: Automatic version snapshots for notes
- **Sharing & Collaboration**: Share notes with public links or invite collaborators

---

## Production Deployment Details

### Server Information
- **VPS Provider**: Contabo
- **IP Address**: 195.26.248.151
- **Domain**: notesync.9gg.app (also available as noted.9gg.app)
- **SSL**: Let's Encrypt (auto-renewed via Certbot)
- **Web Server**: Nginx 1.18.0
- **Process Manager**: PM2
- **Database**: PostgreSQL 14

### Deployment Structure
```
/var/www/notesync/
├── backend/
│   ├── src/
│   │   ├── index.js (Express server on port 3020)
│   │   ├── routes/ (API endpoints)
│   │   ├── middleware/ (Auth, security, validation)
│   │   ├── services/ (Email, collaboration)
│   │   ├── websocket/ (Socket.IO collaboration server)
│   │   └── utils/
│   ├── migrations/ (PostgreSQL migrations)
│   ├── .env (Production environment variables)
│   └── package.json
├── frontend/
│   ├── src/ (React source code)
│   ├── dist/ (Built static files served by Nginx)
│   ├── .env.production
│   └── package.json
├── mobile/ (React Native - IN DEVELOPMENT)
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── navigation/
│   ├── android/
│   └── package.json
├── desktop/ (Electron - PLANNED)
└── web-clipper/ (Browser Extension - PLANNED)
```

### PM2 Process
```bash
pm2 id: 22
name: notesync
status: online
port: 3020
restarts: 7
uptime: varies
```

### Nginx Configuration
- **Config File**: `/etc/nginx/sites-available/notesync.9gg.app`
- **Frontend**: Serves static files from `/var/www/notesync/frontend/dist`
- **API Proxy**: `/api/*` → `http://127.0.0.1:3020`
- **WebSocket Proxy**: `/socket.io/*` → `http://127.0.0.1:3020`
- **SSL Certificates**: `/etc/letsencrypt/live/notesync.9gg.app/`
- **Caching**: HTML never cached, static assets cached 7 days

---

## Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 4.18.2 |
| Database | PostgreSQL | 14 |
| WebSocket | Socket.IO | 4.7.2 |
| Authentication | JWT | jsonwebtoken 9.0.2 |
| Security | Helmet, bcryptjs | Latest |
| Email Service | Resend | Latest |
| Rate Limiting | express-rate-limit | Latest |

### Frontend (Web)
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 18.2.0 |
| Build Tool | Vite | 5.4.21 |
| Routing | React Router | 6.20.1 |
| Offline Storage | Dexie (IndexedDB) | 3.2.4 |
| Icons | Lucide React | 0.294.0 |
| WebSocket Client | Socket.IO Client | 4.7.2 |

### Mobile (React Native - In Development)
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React Native | 0.73.1 |
| Database | WatermelonDB (SQLite) | PLANNED |
| Navigation | React Navigation | 6.x |
| Storage | AsyncStorage + SQLite | Hybrid |
| Network | @react-native-community/netinfo | Latest |
| Rich Text | react-native-pell-rich-editor | Latest |

---

## Architecture

### Request Flow
```
User Browser/Mobile App
    ↓
HTTPS (443) → Nginx / Native HTTP
    ↓
    ├→ Static Files (/) → /var/www/notesync/frontend/dist
    ├→ API Requests (/api/*) → Express (port 3020)
    └→ WebSocket (/socket.io/*) → Socket.IO (port 3020)
         ↓
    PostgreSQL Database (localhost:5432)
```

### Cross-Platform Sync Architecture
```
┌─────────────────────────────────────────────────────────┐
│                   Backend Server                         │
│         PostgreSQL + Express + Socket.IO                 │
│              (Single Source of Truth)                    │
└──────────────────┬──────────────────────────────────────┘
                   │
      ┌────────────┼────────────┬──────────────┐
      ↓            ↓            ↓              ↓
┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
│   Web    │ │  Android │ │   iOS    │  │ Desktop  │
│ IndexedDB│ │  SQLite  │ │  SQLite  │  │ IndexedDB│
│ (Dexie)  │ │(WatermelonDB)│(WatermelonDB)│(Dexie)│
└──────────┘ └──────────┘ └──────────┘  └──────────┘
     ↑            ↑            ↑              ↑
     └────────────┴────────────┴──────────────┘
         Bidirectional Sync (Push/Pull)
         - Conflict Detection
         - Dual-ID System (local + server)
         - Offline Queue
```

---

## Features Implemented

### Core Features ✅
- **User Authentication**
  - Email/password registration with validation
  - JWT token-based authentication
  - Email verification via Resend
  - Session management
  - CSRF protection

- **Note Management**
  - Create, read, update, delete notes
  - Rich text editor with contentEditable
  - Auto-save (1-second debounce)
  - Folder organization
  - Tag system with auto-complete
  - Pin notes
  - Soft delete with trash

- **Search & Discovery**
  - Full-text search (PostgreSQL FTS)
  - Search by title, content, tags
  - Filter by folder, tags, date range
  - Advanced search modal
  - Search suggestions

- **Collaboration**
  - Real-time collaborative editing
  - User presence indicators
  - Remote cursor positions
  - Typing indicators
  - Sync status: Synchronized, Synchronizing, Offline

- **Version Control**
  - Automatic version snapshots
  - View version history
  - Restore previous versions
  - Compare versions

- **Sharing**
  - Public share links with optional password
  - Share link expiration
  - Invite collaborators by email
  - Permission levels (view/edit)
  - Revoke access

- **Rich Content**
  - Tables
  - Code blocks with syntax highlighting
  - Checklists
  - Internal note links (bidirectional)
  - Backlinks
  - Drawings/sketches
  - Voice recordings

- **Offline Support (Web)**
  - IndexedDB local storage
  - Offline mode detection
  - Sync queue for offline changes
  - Mark notes for offline access

---

## Session Updates - Feb 12, 2026 (19:01-19:23)

### 1. Site Performance Issue Resolved ✅
**Problem**: Users experiencing "Network error" or site not loading
**Cause**: Browser caching stale `index.html` that referenced deleted JavaScript files
**Solution**:
- Updated Nginx configuration to prevent HTML caching with `Cache-Control: no-cache, no-store, must-revalidate`
- Static assets (CSS, JS, images) still cache for 7 days for performance
- File: `/etc/nginx/sites-available/notesync.9gg.app`

### 2. WebSocket Authentication Bug Fixed ✅
**Problem**: Mobile apps couldn't connect to WebSocket collaboration server
**Cause**: Backend expected `decoded.userId` but JWT contains `decoded.id`
**Solution**: Updated to support both fields: `socket.userId = decoded.id || decoded.userId`
**File**: `/var/www/notesync/backend/src/websocket/collaboration.js` (line 27)

### 3. Cross-Platform Development Analysis Completed ✅
**Analyzed**:
- Existing React Native mobile app at `/var/www/notesync/mobile/`
- Identified 6 critical bugs preventing production use
- Compared web offline storage (Dexie) vs mobile (AsyncStorage)
- Reviewed backend sync API compatibility

**Key Findings**:
- Mobile app has basic scaffold but incomplete offline storage
- Uses AsyncStorage (flat JSON) instead of structured SQLite database
- Sync parameter mismatch: sends `{ since }` instead of `{ last_sync_at }`
- No dual-ID system (local vs server IDs)
- No conflict detection on client side
- Registration flow incompatible with email verification

---

## Cross-Platform Development Plan

### Overview
Goal: Build native Android app with full offline support that syncs through the same backend/database as the web app.

### Implementation Plan Location
**Detailed Plan**: `/root/.claude/plans/fizzy-jumping-perlis.md`

### High-Level Roadmap

#### Phase 1: Mobile App Foundation (4-6 hours)
**Status**: Ready to begin

**Tasks**:
1. ✅ Fix backend WebSocket JWT auth (COMPLETED)
2. ⏳ Install WatermelonDB dependencies
   ```bash
   npm install @nozbe/watermelondb @nozbe/with-observables
   npm install --save-dev @babel/plugin-proposal-decorators
   ```
3. ⏳ Create WatermelonDB models and schema
   - Note model (with server_id, sync_status, dual-ID system)
   - Folder model
   - Tag model
   - NoteTag junction model
   - SyncQueue model
   - AppState model (key-value store)

4. ⏳ Fix API service (`src/services/api.ts`)
   - Update base URL: `'https://notesync.9gg.app/api'`
   - Fix syncPull to send `{ last_sync_at, device_id }`
   - Add CSRF token support
   - Handle 401/403 errors properly

5. ⏳ Create Sync Service (`src/services/sync.ts`)
   - Replicate web sync logic:
     - Push local changes first
     - Pull remote changes
     - Update offline cache
   - Conflict detection with server-wins strategy
   - Observer pattern for sync events

6. ⏳ Fix Auth Hook (`src/hooks/useAuth.tsx`)
   - Handle email verification flow
   - Add `verifyEmail(token)` method
   - Add `resendVerification(email)` method
   - Don't store token until email verified

#### Phase 2: Mobile Screens (3-4 hours)
**Status**: Waiting for Phase 1

**Updates Needed**:
1. NotesScreen - Use WatermelonDB observables, add pull-to-refresh
2. NoteEditorScreen - Auto-save with 1s debounce, show sync status
3. VerifyEmailScreen (NEW) - Email verification flow
4. LoginScreen - Handle `requiresVerification` error
5. RegisterScreen - Navigate to VerifyEmailScreen after registration

#### Phase 3: Android Configuration (1-2 hours)
**Status**: Waiting for Phase 2

**Tasks**:
1. Configure AndroidManifest.xml
   - Deep links for email verification (`notesync://verify?token=...`)
   - Permissions (INTERNET, NETWORK_STATE, RECORD_AUDIO)
2. Update build.gradle
   - minSdkVersion 23 (for WatermelonDB)
   - SQLite support
3. Configure babel.config.js for decorators

#### Phase 4: Testing & Build (2-3 hours)
**Status**: Waiting for Phase 3

**Testing Checklist**:
- [ ] Register account and verify email
- [ ] Login with verified account
- [ ] Create note online (syncs immediately)
- [ ] Create note offline (queues for sync)
- [ ] Edit note offline (queues for sync)
- [ ] Delete note offline (queues for sync)
- [ ] Conflict test: edit same note on web and mobile while offline
- [ ] WebSocket collaboration (cursors, presence)

**Build Commands**:
```bash
cd /var/www/notesync/mobile
npx react-native run-android --variant=release
cd android
./gradlew assembleRelease
# APK output: android/app/build/outputs/apk/release/app-release.apk
```

### Key Technical Decisions

**Why WatermelonDB over Raw SQLite**:
- Built specifically for React Native
- Observable queries (auto-updating UI)
- Lazy loading for performance
- Built-in sync adapter patterns
- Better developer experience than raw SQLite

**Why SQLite over AsyncStorage**:
- AsyncStorage limited to 6MB (too small for notes)
- No indexing = slow searches
- No relational queries
- No transactions
- Can't scale to hundreds of notes

**Sync Strategy**:
- **Push first, then pull** (matches web app)
- **Dual-ID system**: Every entity has `localId` (WatermelonDB) and `serverId` (PostgreSQL)
- **Server-wins conflict resolution**: Server version always wins, client notified
- **Three sync statuses**: `synced`, `pending`, `conflict`
- **Sync queue**: Track which entities need syncing

### Critical Files for Mobile Development

**New Files to Create**:
1. `src/models/Note.js` - WatermelonDB Note model
2. `src/models/Folder.js` - WatermelonDB Folder model
3. `src/models/Tag.js` - WatermelonDB Tag model
4. `src/models/NoteTag.js` - Junction table model
5. `src/models/SyncQueue.js` - Sync queue model
6. `src/models/AppState.js` - Key-value store model
7. `src/models/schema.js` - WatermelonDB schema definition
8. `src/services/sync.ts` - Sync service (300+ lines)
9. `src/screens/VerifyEmailScreen.tsx` - Email verification screen

**Files to Modify**:
1. `src/services/api.ts` - Fix API URL and sync params
2. `src/hooks/useAuth.tsx` - Fix email verification flow
3. `src/hooks/useSync.tsx` - Rewrite with WatermelonDB
4. `src/screens/NotesScreen.tsx` - Use WatermelonDB observables
5. `src/screens/NoteEditorScreen.tsx` - Add auto-save
6. `src/screens/LoginScreen.tsx` - Handle verification errors
7. `src/screens/RegisterScreen.tsx` - Navigate to verification
8. `android/app/src/main/AndroidManifest.xml` - Deep links
9. `babel.config.js` - Add decorators plugin
10. `package.json` - Add WatermelonDB dependencies

### Existing Mobile Code Issues

**Bugs Identified**:
1. **No Structured Database**: Uses AsyncStorage flat JSON blobs
2. **Sync Parameter Mismatch**: Sends `{ since }` instead of `{ last_sync_at }`
3. **WebSocket Auth**: ✅ FIXED in backend
4. **No Dual-ID System**: Can't track offline-created notes
5. **No Conflict Detection**: No client-side handling
6. **Registration Bug**: Expects token immediately, but server requires email verification

### Timeline Estimate
- **Phase 1**: 4-6 hours (Database & Sync foundation)
- **Phase 2**: 3-4 hours (Mobile screens)
- **Phase 3**: 1-2 hours (Android configuration)
- **Phase 4**: 2-3 hours (Testing & APK build)
- **Total**: 10-15 hours of focused development

### Next Steps
1. Complete WatermelonDB installation
2. Create all 6 database models
3. Build sync service
4. Update screens for WatermelonDB
5. Configure Android build
6. Test offline functionality
7. Build release APK

---

## Database Schema

### PostgreSQL Database: `notesync`
- **User**: notesync
- **Password**: notesync2026
- **Connection**: localhost:5432

### Migrations Applied
1. `001_initial_schema.sql` - Base tables
2. `002_sync_features.sql` - Sync log, offline support
3. `003_email_verification.sql` - Email verification tokens

### Key Tables

#### users
```sql
- id (serial primary key)
- email (unique, not null)
- password_hash (not null)
- email_verified (boolean, default false)
- verification_token (varchar(64))
- verification_token_expires (timestamp)
- created_at, updated_at
```

#### notes
```sql
- id (serial primary key)
- user_id (foreign key → users)
- folder_id (foreign key → folders, nullable)
- title (varchar(500), default 'Untitled')
- content (text)
- content_plain (text) - for full-text search
- offline_enabled (boolean, default false)
- is_pinned (boolean, default false)
- created_at, updated_at, deleted_at
- Indexes: user_id, folder_id, deleted_at, full-text search (GIN)
```

#### folders
```sql
- id (serial primary key)
- user_id (foreign key → users)
- parent_id (foreign key → folders, nullable)
- name (varchar(255))
- created_at, updated_at
```

#### tags
```sql
- id (serial primary key)
- user_id (foreign key → users)
- name (varchar(100))
- created_at
- UNIQUE(user_id, name)
```

#### note_tags (junction table)
```sql
- note_id (foreign key → notes)
- tag_id (foreign key → tags)
- PRIMARY KEY(note_id, tag_id)
```

#### sync_log
```sql
- id (serial primary key)
- user_id (foreign key → users)
- entity_type (varchar: 'note', 'folder')
- entity_id (integer)
- action (varchar: 'create', 'update', 'delete')
- timestamp (timestamp, default NOW())
```

#### Other Tables
- drawings (note sketches)
- note_links (internal links between notes)
- note_versions (version history)
- note_shares (public share links)
- note_collaborators (invited collaborators)
- reminders (scheduled reminders)
- attachments (file uploads)
- web_clips (saved web content)

---

## API Endpoints

### Authentication (`/api/auth`)
```
POST   /register              - Create account (sends verification email)
GET    /verify?token=...      - Verify email (returns auth token)
POST   /resend-verification   - Resend verification email
POST   /login                 - Login (returns JWT + CSRF token)
GET    /me                    - Get current user
POST   /change-password       - Change password
POST   /logout                - Logout
```

### Notes (`/api/notes`)
```
GET    /                      - Get all notes (filters: folder_id, tag, search, offline_only)
GET    /:id                   - Get single note
POST   /                      - Create note
PUT    /:id                   - Update note (auto-creates tags)
DELETE /:id                   - Soft delete note
POST   /:id/restore           - Restore deleted note
POST   /:id/toggle-offline    - Toggle offline access
```

### Sync (`/api/sync`) ⭐ Critical for Mobile
```
POST   /pull                  - Pull changes since last_sync_at
                                Body: { last_sync_at, device_id }
                                Returns: { notes, folders, tags, deletions, server_time }

POST   /push                  - Push local changes to server
                                Body: { notes, folders, device_id }
                                Returns: { results: { notes, folders, conflicts }, server_time }

GET    /offline               - Get all offline-enabled notes
                                Returns: { notes }
```

### Search (`/api/search`)
```
GET    /?q=...                - Full-text search (filters: folder_id, tags, dates, has_*)
GET    /suggest?q=...         - Autocomplete suggestions
```

### Folders (`/api/folders`)
```
GET    /                      - Get folder tree
POST   /                      - Create folder
PUT    /:id                   - Rename/move folder
DELETE /:id                   - Delete folder (moves notes to root)
```

### Tags (`/api/tags`)
```
GET    /                      - Get all tags with note counts
POST   /                      - Create tag
PUT    /:id                   - Rename tag
DELETE /:id                   - Delete tag
```

### Sharing (`/api/share`)
```
POST   /create                - Create share link
GET    /note/:noteId          - Get shares for note
PUT    /:shareId              - Update share settings
DELETE /:shareId              - Revoke share link
GET    /view/:token           - Access shared note (public, no auth)
POST   /invite                - Invite collaborator
DELETE /collaborator/:id      - Remove collaborator
GET    /shared-with-me        - Get notes shared with user
```

### Other Endpoints
- `/api/versions` - Version history
- `/api/links` - Internal note links and backlinks
- `/api/templates` - Note templates
- `/api/drawings` - Drawing management
- `/api/reminders` - Reminder CRUD
- `/api/import` - Import from Evernote
- `/api/transcribe` - Voice transcription

---

## Environment Configuration

### Backend Environment Variables (`/var/www/notesync/backend/.env`)
```bash
PORT=3020
NODE_ENV=production
JWT_SECRET=notesync_jwt_secret_2026_production
DATABASE_URL=postgresql://notesync:notesync2026@localhost/notesync
FRONTEND_URL=https://notesync.9gg.app
RESEND_API_KEY=re_hHt9xNMb_4TteA5ZWohuXZvUGYBb4AvNU
FROM_EMAIL=NoteSync <noreply@notesync.9gg.app>
```

### Frontend Environment Variables (`/var/www/notesync/frontend/.env.production`)
```bash
VITE_API_URL=https://notesync.9gg.app
```

### Mobile Environment Variables (To Be Created)
**File**: `/var/www/notesync/mobile/.env`
```bash
API_URL=https://notesync.9gg.app/api
```

---

## Known Issues & Solutions

### Issue: Browser Caching Stale HTML ✅ FIXED
- **Symptom**: "Network error" or JavaScript files not found (404)
- **Cause**: Browser cached old index.html referencing deleted build files
- **Solution**: Nginx now sends `Cache-Control: no-cache` for HTML files
- **User Action**: Hard refresh browser (Ctrl+Shift+F5)

### Issue: WebSocket Auth for Mobile ✅ FIXED
- **Symptom**: Mobile app can't connect to Socket.IO collaboration
- **Cause**: JWT contains `id` but WebSocket expected `userId`
- **Solution**: Backend now accepts both: `decoded.id || decoded.userId`
- **File**: `/var/www/notesync/backend/src/websocket/collaboration.js:27`

### Issue: Mobile Sync Not Working ⏳ IN DEVELOPMENT
- **Symptom**: Mobile app sync fails or returns all data every time
- **Cause**: Multiple bugs (AsyncStorage, parameter mismatch, no dual-ID system)
- **Solution**: Implementing WatermelonDB with full sync service (Phase 1 of plan)
- **Status**: Backend ready, mobile implementation in progress

---

## Security Considerations

### Implemented Security Measures
- **Authentication**: JWT tokens with 7-day expiry
- **Password Hashing**: bcrypt with salt rounds
- **CSRF Protection**: Token-based CSRF validation on state-changing requests
- **Rate Limiting**:
  - General: 100 requests per 15 minutes
  - Auth endpoints: 10 requests per 15 minutes
  - Uploads: 20 requests per hour
- **Brute Force Protection**: IP-based login attempt tracking (5 attempts, 15-minute lockout)
- **Input Sanitization**: XSS prevention on all user inputs (except note content)
- **SQL Injection Prevention**: Parameterized queries throughout
- **Helmet.js**: Security headers (CSP, X-Frame-Options, etc.)
- **CORS**: Strict origin validation
- **Email Verification**: Required for new accounts
- **Share Link Security**: Optional password protection, expiration dates
- **WebSocket Authentication**: JWT verification before connection

### Security Headers Applied
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: (configured via Helmet)
Cache-Control: no-cache (HTML only)
```

---

## Future Enhancements

### Mobile Apps (IN PROGRESS)
- ✅ Android (React Native) - Implementation plan complete, development started
- ⏳ iOS (React Native) - Will use same codebase as Android with minimal platform-specific code
- **Shared Features**:
  - SQLite offline storage with WatermelonDB
  - Full sync with conflict detection
  - Push notifications for reminders
  - Biometric authentication
  - Share sheet integration
  - Widget support

### Desktop Apps (PLANNED)
- **Electron** for Windows, macOS, Linux
- Reuse web frontend code
- Native file system integration
- System tray integration
- Offline storage with Dexie (same as web)

### Browser Extension (PLANNED)
- **Web Clipper** for Chrome, Firefox, Edge
- Save web content directly to notes
- Context menu integration
- Quick note creation
- Existing scaffold at `/var/www/notesync/web-clipper/`

### Feature Enhancements
- Encryption for sensitive notes
- Two-factor authentication
- OAuth providers (Google, GitHub)
- Note templates marketplace
- Advanced formatting (LaTeX, diagrams)
- File attachments (schema exists, UI pending)
- Export to PDF, Markdown, HTML
- Bulk operations
- OCR for images
- Advanced reminders and notifications

### Infrastructure Improvements
- Redis for session storage and rate limiting
- CDN for static assets
- Automated backups
- Monitoring and alerting (Sentry, DataDog)
- CI/CD pipeline
- Staging environment
- Automated testing (unit, integration, e2e)

---

## Deployment Commands

### Build Frontend
```bash
cd /var/www/notesync/frontend
npm run build
```

### Restart Backend
```bash
pm2 restart notesync
pm2 logs notesync
pm2 status
```

### Database Operations
```bash
# Connect to database
sudo -u postgres psql -d notesync

# Run migration
sudo -u postgres psql -d notesync -f /var/www/notesync/backend/migrations/XXX_migration.sql

# Backup database
sudo -u postgres pg_dump notesync > notesync_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Nginx Operations
```bash
# Test configuration
nginx -t

# Reload configuration
systemctl reload nginx

# View logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### SSL Certificate Renewal
```bash
# Renew certificates (auto-renewed by Certbot)
certbot renew

# Force renewal
certbot renew --force-renewal

# Check expiration
certbot certificates
```

### Mobile Development
```bash
# Install dependencies
cd /var/www/notesync/mobile
npm install

# Run on Android device/emulator
npx react-native run-android

# Build release APK
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Run on iOS (requires macOS)
npx react-native run-ios
```

---

## Testing Checklist

### Web App Testing ✅
- [x] User registration and email verification
- [x] Login/logout
- [x] Create, edit, delete notes
- [x] Auto-save functionality
- [x] Search with various filters
- [x] Tag creation and sidebar display
- [x] Folder organization
- [x] Share link creation
- [x] Real-time collaboration (multi-user)
- [x] Offline mode
- [x] WebSocket connection status

### Mobile App Testing ⏳ (When Complete)
- [ ] Register account (receive email, verify)
- [ ] Login with verified account
- [ ] Create note while online (syncs immediately)
- [ ] Create note while offline (syncs when online)
- [ ] Edit note offline (queues for sync)
- [ ] Delete note offline (queues for sync)
- [ ] Create folder and tag
- [ ] Go offline, verify offline notes still accessible
- [ ] Come back online, verify sync completes
- [ ] Test conflict: edit same note on web and mobile while offline
- [ ] Verify WebSocket collaboration works (cursors, presence)
- [ ] Deep link email verification
- [ ] Push notifications (if implemented)

---

## Contact & Support

**Production URL**: https://notesync.9gg.app
**Alternate URL**: https://noted.9gg.app
**Repository**: https://github.com/kingdavsol/notesync
**Server**: 195.26.248.151 (Contabo VPS)
**Database**: PostgreSQL 14 on localhost
**Email Provider**: Resend (noreply@notesync.9gg.app)

---

## Document History

- **2026-02-02 12:00**: Initial handover document created
- **2026-02-12 19:01**: Updated with production deployment, bug fixes, and session details
- **2026-02-12 19:23**: Added cross-platform development plan and mobile app roadmap

---

**End of Handover Document**
