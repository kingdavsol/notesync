-- NoteSync Database Migration: Sharing, Reminders, and Version History
-- Run this after 001_initial_schema.sql

-- Note sharing table (public links)
CREATE TABLE IF NOT EXISTS note_shares (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    share_token VARCHAR(64) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    allow_edit BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) DEFAULT NULL,
    expires_at TIMESTAMP DEFAULT NULL,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE
);

-- Shared with specific users
CREATE TABLE IF NOT EXISTS note_collaborators (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) DEFAULT 'view', -- 'view', 'edit', 'admin'
    invited_by INTEGER REFERENCES users(id),
    accepted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(note_id, user_id)
);

-- Note reminders
CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    remind_at TIMESTAMP NOT NULL,
    title VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(100), -- e.g., 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
    notified BOOLEAN DEFAULT FALSE,
    snoozed_until TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note version history
CREATE TABLE IF NOT EXISTS note_versions (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    content_plain TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    change_summary VARCHAR(255)
);

-- Note templates
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    is_default BOOLEAN DEFAULT FALSE, -- Built-in templates
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web clips (for web clipper extension)
CREATE TABLE IF NOT EXISTS web_clips (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    source_title VARCHAR(500),
    clipped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    clip_type VARCHAR(50) DEFAULT 'full_page' -- 'full_page', 'article', 'selection', 'screenshot'
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_note_shares_token ON note_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_collaborators_user ON note_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_note_collaborators_note ON note_collaborators(note_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, remind_at) WHERE notified = FALSE;
CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);

-- Add reminder count to users for badge display
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_reminders INTEGER DEFAULT 0;

-- Add share_count to notes for quick lookup
ALTER TABLE notes ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- Insert default templates
INSERT INTO templates (user_id, name, description, content, category, is_default, icon) VALUES
(NULL, 'Meeting Notes', 'Template for meeting notes', '<h2>Meeting: [Title]</h2>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Attendees:</strong></p>
<ul><li>[Name]</li></ul>
<h3>Agenda</h3>
<ol><li>[Topic]</li></ol>
<h3>Discussion</h3>
<p>[Notes]</p>
<h3>Action Items</h3>
<div class="checklist-item" data-checklist="true">
<input type="checkbox"><span contenteditable="true">Action item</span>
</div>
<h3>Next Meeting</h3>
<p>[Date/Time]</p>', 'Work', TRUE, 'users'),

(NULL, 'Project Plan', 'Template for project planning', '<h2>Project: [Name]</h2>
<p><strong>Start Date:</strong> [Date]</p>
<p><strong>Target Completion:</strong> [Date]</p>
<h3>Objectives</h3>
<ul><li>[Objective]</li></ul>
<h3>Milestones</h3>
<div class="checklist-item" data-checklist="true">
<input type="checkbox"><span contenteditable="true">Milestone 1</span>
</div>
<h3>Resources</h3>
<ul><li>[Resource]</li></ul>
<h3>Risks</h3>
<ul><li>[Risk]</li></ul>
<h3>Notes</h3>
<p>[Additional notes]</p>', 'Work', TRUE, 'folder'),

(NULL, 'Daily Journal', 'Template for daily journaling', '<h2>[Date]</h2>
<h3>Grateful For</h3>
<ol><li>[Item]</li></ol>
<h3>Today''s Goals</h3>
<div class="checklist-item" data-checklist="true">
<input type="checkbox"><span contenteditable="true">Goal</span>
</div>
<h3>Reflection</h3>
<p>[Thoughts]</p>
<h3>Tomorrow''s Focus</h3>
<p>[Plans]</p>', 'Personal', TRUE, 'book'),

(NULL, 'Recipe', 'Template for recipes', '<h2>[Recipe Name]</h2>
<p><strong>Prep Time:</strong> [Time]</p>
<p><strong>Cook Time:</strong> [Time]</p>
<p><strong>Servings:</strong> [Number]</p>
<h3>Ingredients</h3>
<ul>
<li>[Amount] [Ingredient]</li>
</ul>
<h3>Instructions</h3>
<ol>
<li>[Step]</li>
</ol>
<h3>Notes</h3>
<p>[Tips, variations, etc.]</p>', 'Personal', TRUE, 'utensils'),

(NULL, 'Book Notes', 'Template for book notes and highlights', '<h2>[Book Title]</h2>
<p><strong>Author:</strong> [Author]</p>
<p><strong>Started:</strong> [Date]</p>
<p><strong>Finished:</strong> [Date]</p>
<p><strong>Rating:</strong> [1-5]</p>
<h3>Summary</h3>
<p>[Brief summary]</p>
<h3>Key Takeaways</h3>
<ul><li>[Takeaway]</li></ul>
<h3>Favorite Quotes</h3>
<blockquote>[Quote]</blockquote>
<h3>My Thoughts</h3>
<p>[Reflection]</p>', 'Personal', TRUE, 'book-open')
ON CONFLICT DO NOTHING;
