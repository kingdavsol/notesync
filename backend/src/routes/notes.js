const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth to all routes
router.use(authenticateToken);

// Get all notes (with optional filters)
router.get('/', async (req, res) => {
    try {
        const { folder_id, tag, search, offline_only, include_deleted } = req.query;
        
        let query = `
            SELECT n.id, n.title, n.content, n.folder_id, n.offline_enabled, 
                   n.is_pinned, n.created_at, n.updated_at, n.deleted_at,
                   f.name as folder_name,
                   COALESCE(
                       json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) 
                       FILTER (WHERE t.id IS NOT NULL), '[]'
                   ) as tags
            FROM notes n
            LEFT JOIN folders f ON n.folder_id = f.id
            LEFT JOIN note_tags nt ON n.id = nt.note_id
            LEFT JOIN tags t ON nt.tag_id = t.id
            WHERE n.user_id = $1
        `;
        
        const params = [req.user.id];
        let paramIndex = 2;

        if (!include_deleted) {
            query += ` AND n.deleted_at IS NULL`;
        }

        if (folder_id) {
            query += ` AND n.folder_id = $${paramIndex}`;
            params.push(folder_id);
            paramIndex++;
        }

        if (offline_only === 'true') {
            query += ` AND n.offline_enabled = TRUE`;
        }

        if (search) {
            query += ` AND (
                n.title ILIKE $${paramIndex} OR 
                n.content_plain ILIKE $${paramIndex} OR
                to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_plain, '')) @@ plainto_tsquery('english', $${paramIndex + 1})
            )`;
            params.push(`%${search}%`, search);
            paramIndex += 2;
        }

        query += ` GROUP BY n.id, f.name ORDER BY n.is_pinned DESC, n.updated_at DESC`;

        const result = await db.query(query, params);

        // If tag filter, filter in JS (simpler than complex SQL)
        let notes = result.rows;
        if (tag) {
            notes = notes.filter(n => n.tags.some(t => t.name === tag));
        }

        res.json({ notes });
    } catch (err) {
        console.error('Get notes error:', err);
        res.status(500).json({ error: 'Failed to get notes' });
    }
});

// Get single note
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT n.*, f.name as folder_name,
                    COALESCE(
                        json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) 
                        FILTER (WHERE t.id IS NOT NULL), '[]'
                    ) as tags
             FROM notes n
             LEFT JOIN folders f ON n.folder_id = f.id
             LEFT JOIN note_tags nt ON n.id = nt.note_id
             LEFT JOIN tags t ON nt.tag_id = t.id
             WHERE n.id = $1 AND n.user_id = $2
             GROUP BY n.id, f.name`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({ note: result.rows[0] });
    } catch (err) {
        console.error('Get note error:', err);
        res.status(500).json({ error: 'Failed to get note' });
    }
});

// Create note
router.post('/', async (req, res) => {
    try {
        const { title, content, folder_id, offline_enabled, tags } = req.body;

        // Strip HTML for plain text search
        const contentPlain = content ? content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

        const result = await db.query(
            `INSERT INTO notes (user_id, title, content, content_plain, folder_id, offline_enabled)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, title || 'Untitled', content || '', contentPlain, folder_id || null, offline_enabled || false]
        );

        const note = result.rows[0];

        // Add tags if provided
        if (tags && tags.length > 0) {
            for (const tagName of tags) {
                // Get or create tag
                const tagResult = await db.query(
                    `INSERT INTO tags (user_id, name) VALUES ($1, $2)
                     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [req.user.id, tagName]
                );
                
                await db.query(
                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [note.id, tagResult.rows[0].id]
                );
            }
        }

        // Log sync action
        await db.query(
            'INSERT INTO sync_log (user_id, entity_type, entity_id, action) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'note', note.id, 'create']
        );

        res.status(201).json({ note });
    } catch (err) {
        console.error('Create note error:', err);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

// Update note
router.put('/:id', async (req, res) => {
    try {
        const { title, content, folder_id, offline_enabled, is_pinned, tags, save_version } = req.body;

        // Verify ownership and get current state
        const check = await db.query(
            'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const currentNote = check.rows[0];
        const contentPlain = content ? content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

        // Save version if content changed significantly (or explicitly requested)
        const contentChanged = content && content !== currentNote.content;
        const titleChanged = title && title !== currentNote.title;

        if (save_version || (contentChanged && currentNote.content)) {
            // Get next version number
            const versionNum = await db.query(
                'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM note_versions WHERE note_id = $1',
                [req.params.id]
            );

            await db.query(
                `INSERT INTO note_versions (note_id, version_number, title, content, content_plain, created_by, change_summary)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    req.params.id,
                    versionNum.rows[0].next_version,
                    currentNote.title,
                    currentNote.content,
                    currentNote.content_plain,
                    req.user.id,
                    titleChanged ? 'Title and content updated' : 'Content updated'
                ]
            );
        }

        const result = await db.query(
            `UPDATE notes SET
                title = COALESCE($1, title),
                content = COALESCE($2, content),
                content_plain = COALESCE($3, content_plain),
                folder_id = $4,
                offline_enabled = COALESCE($5, offline_enabled),
                is_pinned = COALESCE($6, is_pinned),
                updated_at = NOW()
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [title, content, contentPlain, folder_id, offline_enabled, is_pinned, req.params.id, req.user.id]
        );

        // Update tags if provided
        if (tags !== undefined) {
            // Remove existing tags
            await db.query('DELETE FROM note_tags WHERE note_id = $1', [req.params.id]);

            // Add new tags
            for (const tagName of tags) {
                const tagResult = await db.query(
                    `INSERT INTO tags (user_id, name) VALUES ($1, $2)
                     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [req.user.id, tagName]
                );

                await db.query(
                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2)',
                    [req.params.id, tagResult.rows[0].id]
                );
            }
        }

        // Log sync action
        await db.query(
            'INSERT INTO sync_log (user_id, entity_type, entity_id, action) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'note', req.params.id, 'update']
        );

        res.json({ note: result.rows[0] });
    } catch (err) {
        console.error('Update note error:', err);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// Soft delete note
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE notes SET deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Log sync action
        await db.query(
            'INSERT INTO sync_log (user_id, entity_type, entity_id, action) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'note', req.params.id, 'delete']
        );

        res.json({ message: 'Note deleted' });
    } catch (err) {
        console.error('Delete note error:', err);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

// Restore note
router.post('/:id/restore', async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE notes SET deleted_at = NULL, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({ note: result.rows[0] });
    } catch (err) {
        console.error('Restore note error:', err);
        res.status(500).json({ error: 'Failed to restore note' });
    }
});

// Toggle offline
router.post('/:id/toggle-offline', async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE notes SET offline_enabled = NOT offline_enabled, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id, offline_enabled`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({ 
            id: result.rows[0].id,
            offline_enabled: result.rows[0].offline_enabled 
        });
    } catch (err) {
        console.error('Toggle offline error:', err);
        res.status(500).json({ error: 'Failed to toggle offline' });
    }
});

module.exports = router;
