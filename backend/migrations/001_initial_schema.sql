-- NoteSync Database Schema
-- Run this on PostgreSQL

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Folders/Notebooks table
CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL DEFAULT 'Untitled',
    content TEXT,
    content_plain TEXT, -- For search indexing
    offline_enabled BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    evernote_guid VARCHAR(255) DEFAULT NULL -- For import tracking
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Note-Tags junction table
CREATE TABLE IF NOT EXISTS note_tags (
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    storage_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drawings table (for ink/sketch notes)
CREATE TABLE IF NOT EXISTS drawings (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    drawing_data TEXT NOT NULL, -- SVG or canvas JSON data
    thumbnail TEXT, -- Base64 thumbnail for preview
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note links table (internal links between notes)
CREATE TABLE IF NOT EXISTS note_links (
    id SERIAL PRIMARY KEY,
    source_note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    target_note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    link_text VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_note_id, target_note_id)
);

-- Sync log for tracking changes
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'note', 'folder', 'tag'
    entity_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(100)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_offline ON notes(user_id, offline_enabled) WHERE offline_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_log_user_timestamp ON sync_log(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Full text search on notes
CREATE INDEX IF NOT EXISTS idx_notes_search ON notes USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_plain, '')));
