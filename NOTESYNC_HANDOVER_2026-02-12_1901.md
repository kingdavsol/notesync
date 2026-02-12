# NoteSync Project Handover Document
**Date:** February 12, 2026 at 19:01 UTC
**Repository:** https://github.com/kingdavsol/notesync
**Live URL:** https://notesync.9gg.app
**Status:** Production Ready - Deployed and Operational

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Production Deployment Details](#production-deployment-details)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Features Implemented](#features-implemented)
6. [Recent Session Updates (Feb 12, 2026)](#recent-session-updates)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Environment Configuration](#environment-configuration)
10. [Known Issues & Solutions](#known-issues--solutions)
11. [Security Considerations](#security-considerations)
12. [Future Enhancements](#future-enhancements)

---

## Project Overview

NoteSync is a full-featured, cross-platform note-taking application similar to Evernote. It provides seamless synchronization across web platforms with offline-first capabilities and real-time collaboration.

### Key Highlights
- **Web Application**: Production-ready React SPA deployed on Contabo VPS
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
└── NOTESYNC_HANDOVER_2026-02-12_1901.md (this document)
```

### PM2 Process
```bash
pm2 id: 22
name: notesync
status: online
port: 3020
restarts: 6
uptime: varies
```

### Nginx Configuration
- **Config File**: `/etc/nginx/sites-available/notesync.9gg.app`
- **Frontend**: Serves static files from `/var/www/notesync/frontend/dist`
- **API Proxy**: `/api/*` → `http://127.0.0.1:3020`
- **WebSocket Proxy**: `/socket.io/*` → `http://127.0.0.1:3020`
- **SSL Certificates**: `/etc/letsencrypt/live/notesync.9gg.app/`

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

---

## Architecture

### Request Flow
```
User Browser
    ↓
HTTPS (443) → Nginx
    ↓
    ├→ Static Files (/) → /var/www/notesync/frontend/dist
    ├→ API Requests (/api/*) → Express (port 3020)
    └→ WebSocket (/socket.io/*) → Socket.IO (port 3020)
         ↓
    PostgreSQL Database (localhost:5432)
```

### Real-time Collaboration
```
User A ←→ Socket.IO Server ←→ User B
              ↓
    Collaboration Service
    (Rooms, Cursors, Presence)
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

- **Offline Support**
  - IndexedDB local storage
  - Offline mode detection
  - Sync queue for offline changes
  - Mark notes for offline access

---

## Recent Session Updates (Feb 12, 2026)

### Issues Fixed

#### 1. **DNS Resolution Issues**
- **Problem**: Contabo DNS resolver (209.126.15.52) had stale negative cache for notesync.9gg.app
- **Solution**:
  - Added entries to `/etc/hosts` for immediate fix
  - Updated `/etc/cloud/templates/hosts.debian.tmpl` for persistence
  - Configured systemd-resolved to use Google DNS (8.8.8.8, 8.8.4.4) as primary
  - Added Cloudflare DNS (1.1.1.1) as fallback

#### 2. **Text Input Direction Bug**
- **Problem**: Text was displaying backwards or from right-to-left in the note editor
- **Root Cause**: Using `dangerouslySetInnerHTML` with `contentEditable` caused cursor positioning issues
- **Solution**:
  - Removed `dangerouslySetInnerHTML` from contentEditable div
  - Added direct DOM manipulation via `contentRef.current.innerHTML`
  - Added explicit `direction: 'ltr'` and `textAlign: 'left'` to CSS
  - Changed to `suppressContentEditableWarning` approach
  - File: `/var/www/notesync/frontend/src/components/NoteEditor.jsx`

#### 3. **WebSocket Connection Issues**
- **Problem**: Frontend showing "Reconnecting to collaboration server..." constantly
- **Root Cause**: Missing `VITE_API_URL` environment variable, defaulting to localhost:3001
- **Solution**:
  - Created `/var/www/notesync/frontend/.env.production` with `VITE_API_URL=https://notesync.9gg.app`
  - Updated collaboration hook to use production URL
  - Backend WebSocket already configured with correct CORS

#### 4. **Sync Status Indicator**
- **Problem**: Generic "Reconnecting..." message, no clear sync status
- **Solution**: Replaced with proper status indicator showing:
  - **● Synchronized** (green) - Connected and synced
  - **● Synchronizing...** (orange) - Connecting or syncing changes
  - **● Offline** (red) - No internet connection
  - Located in bottom-right corner with clean styling
  - File: `/var/www/notesync/frontend/src/components/CollaborativeEditor.jsx`

#### 5. **Search Function Failures**
- **Problem**: Search failing with error "invalid input syntax for type integer: 'null'"
- **Root Cause**: Frontend passing string "null" for folder_id parameter
- **Solution**:
  - Added validation: `if (folder_id && folder_id !== 'null' && folder_id !== 'undefined')`
  - Added `parseInt()` conversion for folder_id
  - Applied fix to both `/routes/notes.js` and `/routes/search.js`

#### 6. **Tags Not Appearing in Sidebar**
- **Problem**: Tags created and saved to database but not showing in sidebar
- **Root Cause**: Dashboard not reloading tags list after note updates
- **Solution**:
  - Added `api.getTags()` call in `updateNote()` function after successful save
  - Tags now refresh automatically within 1 second (when auto-save triggers)
  - File: `/var/www/notesync/frontend/src/pages/Dashboard.jsx`

### Files Modified in This Session
```
Backend:
- /var/www/notesync/backend/src/routes/notes.js (folder_id validation)
- /var/www/notesync/backend/src/routes/search.js (folder_id validation)

Frontend:
- /var/www/notesync/frontend/.env.production (NEW - API URL config)
- /var/www/notesync/frontend/src/components/NoteEditor.jsx (text direction fix)
- /var/www/notesync/frontend/src/components/CollaborativeEditor.jsx (sync status)
- /var/www/notesync/frontend/src/pages/Dashboard.jsx (tags reload)

System:
- /etc/hosts (DNS entries)
- /etc/cloud/templates/hosts.debian.tmpl (persistent DNS)
- /etc/systemd/resolved.conf.d/dns_servers.conf (NEW - DNS config)
```

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

#### note_versions
```sql
- id (serial primary key)
- note_id (foreign key → notes)
- version_number (integer)
- title, content, content_plain
- created_by (foreign key → users)
- created_at
- change_summary (text)
```

#### note_shares
```sql
- id (serial primary key)
- note_id (foreign key → notes)
- token (varchar(64), unique)
- password_hash (varchar(255), nullable)
- allow_edit (boolean, default false)
- expires_at (timestamp, nullable)
- created_by, created_at, accessed_at, access_count
```

#### note_collaborators
```sql
- id (serial primary key)
- note_id (foreign key → notes)
- user_id (foreign key → users)
- invited_by (foreign key → users)
- permission (enum: 'view', 'edit')
- invited_at
```

#### Other Tables
- drawings (note sketches)
- note_links (internal links between notes)
- reminders (scheduled reminders)
- sync_log (sync history)
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
POST   /:id/toggle-offline    - Toggle offline access
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

### Versions (`/api/versions`)
```
GET    /note/:noteId          - Get version history
GET    /:id                   - Get specific version
POST   /:id/restore           - Restore version
GET    /compare/:id1/:id2     - Compare two versions
DELETE /note/:noteId/cleanup  - Delete old versions
```

### Links (`/api/links`)
```
GET    /from/:noteId          - Get outgoing links
GET    /to/:noteId            - Get backlinks
POST   /                      - Create link
DELETE /:id                   - Delete link
GET    /search?q=...          - Search notes for linking
```

### Templates (`/api/templates`)
```
GET    /                      - Get all templates
GET    /categories            - Get template categories
GET    /:id                   - Get template
POST   /                      - Create template
POST   /from-note/:noteId     - Create template from note
PUT    /:id                   - Update template
DELETE /:id                   - Delete template
POST   /:id/create-note       - Create note from template
```

### Other Endpoints
- `/api/drawings` - Drawing management
- `/api/reminders` - Reminder CRUD
- `/api/sync` - Sync operations (pull, push, offline)
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

### Email Configuration (Resend)
- **Domain**: notesync.9gg.app
- **Sending Address**: noreply@notesync.9gg.app
- **API Key**: re_hHt9xNMb_4TteA5ZWohuXZvUGYBb4AvNU
- **DNS Records** (via Namecheap):
  - `send.notesync` CNAME → `feedback-smtp.us-east-1.amazonses.com`
  - `resend._domainkey.notesync` TXT → DKIM key
  - Root SPF includes `amazonses.com`
  - DMARC set to `p=none` for deliverability

---

## Known Issues & Solutions

### Issue: DNS Resolution Failures
- **Symptom**: "Network error" in browser, domain not resolving
- **Cause**: Contabo DNS servers caching stale records
- **Solution**: System now uses Google DNS (8.8.8.8) as primary, with local hosts entries as backup

### Issue: Text Appearing Backwards
- **Symptom**: Text flows from right to left or appears reversed
- **Cause**: `dangerouslySetInnerHTML` + `contentEditable` interaction
- **Solution**: Fixed in NoteEditor.jsx with direct DOM manipulation and explicit LTR direction

### Issue: "Reconnecting to collaboration server"
- **Symptom**: Constant reconnection message
- **Cause**: WebSocket trying to connect to localhost instead of production URL
- **Solution**: Created .env.production with correct VITE_API_URL

### Issue: Search Returns No Results
- **Symptom**: Search fails even with existing notes
- **Cause**: String "null" being passed as folder_id
- **Solution**: Added validation to reject "null" strings before database query

### Issue: Tags Not Visible After Creation
- **Symptom**: Tags saved to database but sidebar doesn't update
- **Cause**: Dashboard not refreshing tags after note save
- **Solution**: Added getTags() call in updateNote() function

---

## Security Considerations

### Implemented Security Measures
- **Authentication**: JWT tokens with HTTP-only session storage
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
- **Content Security Policy**: Restrictive CSP with specific allowances
- **Email Verification**: Required for new accounts
- **Share Link Security**: Optional password protection, expiration dates

### Security Headers Applied
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: (configured via Helmet)
```

### Database Security
- Separate user account (`notesync`) with minimal privileges
- Password-protected PostgreSQL access
- Soft deletes (data retention for recovery)
- Foreign key constraints enforced

---

## Future Enhancements

### Planned Features
- **Mobile Apps**: React Native iOS/Android apps
- **Desktop Apps**: Electron builds for Windows/Mac/Linux
- **Browser Extension**: Web clipper for Chrome/Firefox
- **Advanced Features**:
  - Encryption for sensitive notes
  - Two-factor authentication
  - OAuth providers (Google, GitHub)
  - Note templates marketplace
  - Advanced formatting (LaTeX, diagrams)
  - File attachments (currently in schema but not implemented)
  - Export to PDF, Markdown, HTML
  - Bulk operations
  - Note templates with variables
  - Reminders and notifications (partially implemented)
  - Web clips (schema exists, implementation pending)

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

### DNS Management
```bash
# Flush DNS cache
resolvectl flush-caches

# Check DNS resolution
nslookup notesync.9gg.app 8.8.8.8
dig notesync.9gg.app @1.1.1.1
```

---

## Testing Checklist

### Functional Testing
- [ ] User registration and email verification
- [ ] Login/logout
- [ ] Create, edit, delete notes
- [ ] Auto-save functionality
- [ ] Search with various filters
- [ ] Tag creation and sidebar display
- [ ] Folder organization
- [ ] Share link creation (public and password-protected)
- [ ] Collaborator invitation
- [ ] Version history and restore
- [ ] Real-time collaboration (multi-user)
- [ ] Offline mode
- [ ] WebSocket connection status indicator

### Browser Testing
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers

### Performance Testing
- [ ] Page load time
- [ ] Search performance with many notes
- [ ] Auto-save responsiveness
- [ ] WebSocket latency

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

---

**End of Handover Document**
