# NoteSync

A cross-device note-taking application with offline support and Evernote import.

## Features

- **Cross-Device Sync**: Access your notes from any device
- **Selective Offline Access**: Mark specific notes for offline availability
- **Evernote Import**: Import your existing notes from Evernote (.enex files)
- **PWA Support**: Install as a native-like app on mobile and desktop
- **Rich Text Editing**: Basic formatting (bold, italic, lists)
- **Organization**: Folders and tags for note organization
- **Search**: Full-text search across all notes
- **Conflict Resolution**: Last-write-wins with conflict detection

## Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL
- JWT authentication
- XML parsing for Evernote import

**Frontend:**
- React 18
- Vite build system
- IndexedDB (Dexie.js) for offline storage
- Service Worker for PWA functionality

## Project Structure

```
notesync/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express app entry
│   │   ├── routes/           # API routes
│   │   │   ├── auth.js       # Authentication
│   │   │   ├── notes.js      # Notes CRUD
│   │   │   ├── folders.js    # Folders CRUD
│   │   │   ├── tags.js       # Tags CRUD
│   │   │   ├── sync.js       # Sync endpoints
│   │   │   └── import.js     # Evernote import
│   │   ├── services/
│   │   │   └── evernoteImporter.js
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT middleware
│   │   └── utils/
│   │       └── db.js         # PostgreSQL connection
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── run.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx          # React entry
│   │   ├── App.jsx           # Main app with routing
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── NoteList.jsx
│   │   │   ├── NoteEditor.jsx
│   │   │   └── ImportModal.jsx
│   │   ├── services/
│   │   │   ├── api.js        # API client
│   │   │   ├── db.js         # IndexedDB (Dexie)
│   │   │   └── sync.js       # Sync service
│   │   └── styles/
│   │       └── global.css
│   ├── public/
│   │   ├── sw.js             # Service worker
│   │   └── manifest.json     # PWA manifest
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Database Setup

```bash
# Create database
createdb notesync

# Or via psql
psql -U postgres
CREATE DATABASE notesync;
\q
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your settings:
# DATABASE_URL=postgresql://user:password@localhost:5432/notesync
# JWT_SECRET=your-secret-key-here
# PORT=3001
# FRONTEND_URL=http://localhost:3000

# Run migrations
npm run migrate

# Start server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 4. Access the App

Open http://localhost:3000 in your browser.

## Deployment

### Backend (VPS)

```bash
# On your VPS
git clone <your-repo>
cd notesync/backend

# Install dependencies
npm install --production

# Set environment variables
export DATABASE_URL="postgresql://..."
export JWT_SECRET="..."
export NODE_ENV="production"
export FRONTEND_URL="https://yourdomain.com"

# Run with PM2
pm2 start src/index.js --name notesync-api
```

### Frontend (Static Hosting or VPS)

```bash
cd frontend

# Build for production
npm run build

# The dist/ folder can be served by:
# - Nginx
# - Caddy
# - Any static host (Vercel, Netlify, etc.)
```

### Nginx Example Config

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/notesync/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Update password

### Notes
- `GET /api/notes` - List notes (with filters)
- `GET /api/notes/:id` - Get single note
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Soft delete
- `POST /api/notes/:id/toggle-offline` - Toggle offline flag

### Folders
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `PUT /api/folders/:id` - Rename folder
- `DELETE /api/folders/:id` - Delete folder

### Tags
- `GET /api/tags` - List tags
- `POST /api/tags` - Create tag
- `DELETE /api/tags/:id` - Delete tag

### Sync
- `POST /api/sync/pull` - Get changes since timestamp
- `POST /api/sync/push` - Push local changes
- `GET /api/sync/offline` - Get offline-enabled notes

### Import
- `POST /api/import/evernote` - Upload .enex file
- `GET /api/import/history` - Get import stats

## Offline Behavior

1. **Selective Caching**: Only notes marked as "offline" are stored in IndexedDB
2. **Change Queue**: Edits made offline are queued and synced when online
3. **Service Worker**: Caches app shell for offline app access
4. **Conflict Detection**: If server has newer changes, local version saved as conflict

## Evernote Import

The importer handles:
- Note content (ENML → HTML conversion)
- Tags
- Created/updated timestamps
- Attachments (stored as files)
- Duplicate detection via Evernote GUID

ENML elements converted:
- `<en-note>` → `<div>`
- `<en-todo>` → checkboxes
- `<en-media>` → attachment placeholders

## PWA Installation

### Desktop (Chrome)
1. Visit the app
2. Click install icon in address bar
3. Or: Menu → "Install NoteSync"

### Mobile
1. Visit the app in browser
2. iOS: Share → "Add to Home Screen"
3. Android: Menu → "Add to Home Screen"

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | required |
| JWT_SECRET | Secret for JWT signing | required |
| PORT | API server port | 3001 |
| NODE_ENV | Environment | development |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |

## License

MIT
