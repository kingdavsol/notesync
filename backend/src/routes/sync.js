const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Pull changes since last sync
router.post('/pull', async (req, res) => {
    try {
        const { last_sync_at, device_id } = req.body;
        const since = last_sync_at ? new Date(last_sync_at) : new Date(0);

        // Get updated notes
        const notes = await db.query(
            `SELECT n.*, 
                    COALESCE(
                        json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) 
                        FILTER (WHERE t.id IS NOT NULL), '[]'
                    ) as tags
             FROM notes n
             LEFT JOIN note_tags nt ON n.id = nt.note_id
             LEFT JOIN tags t ON nt.tag_id = t.id
             WHERE n.user_id = $1 AND n.updated_at > $2
             GROUP BY n.id
             ORDER BY n.updated_at`,
            [req.user.id, since]
        );

        // Get updated folders
        const folders = await db.query(
            'SELECT * FROM folders WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at',
            [req.user.id, since]
        );

        // Get updated tags
        const tags = await db.query(
            'SELECT * FROM tags WHERE user_id = $1 AND created_at > $2 ORDER BY created_at',
            [req.user.id, since]
        );

        // Get deleted items from sync log
        const deletions = await db.query(
            `SELECT entity_type, entity_id, timestamp 
             FROM sync_log 
             WHERE user_id = $1 AND action = 'delete' AND timestamp > $2
             ORDER BY timestamp`,
            [req.user.id, since]
        );

        const now = new Date().toISOString();

        res.json({
            notes: notes.rows,
            folders: folders.rows,
            tags: tags.rows,
            deletions: deletions.rows,
            server_time: now
        });
    } catch (err) {
        console.error('Sync pull error:', err);
        res.status(500).json({ error: 'Sync pull failed' });
    }
});

// Push local changes to server
router.post('/push', async (req, res) => {
    try {
        const { notes, folders, device_id } = req.body;
        const results = { notes: [], folders: [], conflicts: [] };

        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Process folders first
            if (folders && folders.length > 0) {
                for (const folder of folders) {
                    if (folder._deleted) {
                        await client.query(
                            'DELETE FROM folders WHERE id = $1 AND user_id = $2',
                            [folder.id, req.user.id]
                        );
                    } else if (folder._isNew) {
                        const result = await client.query(
                            'INSERT INTO folders (user_id, name, parent_id) VALUES ($1, $2, $3) RETURNING *',
                            [req.user.id, folder.name, folder.parent_id]
                        );
                        results.folders.push({ 
                            local_id: folder._localId, 
                            server: result.rows[0] 
                        });
                    } else {
                        await client.query(
                            'UPDATE folders SET name = $1, parent_id = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4',
                            [folder.name, folder.parent_id, folder.id, req.user.id]
                        );
                    }
                }
            }

            // Process notes
            if (notes && notes.length > 0) {
                for (const note of notes) {
                    if (note._deleted) {
                        await client.query(
                            'UPDATE notes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2',
                            [note.id, req.user.id]
                        );
                        await client.query(
                            'INSERT INTO sync_log (user_id, entity_type, entity_id, action, device_id) VALUES ($1, $2, $3, $4, $5)',
                            [req.user.id, 'note', note.id, 'delete', device_id]
                        );
                    } else if (note._isNew) {
                        const contentPlain = note.content ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                        
                        const result = await client.query(
                            `INSERT INTO notes (user_id, title, content, content_plain, folder_id, offline_enabled)
                             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                            [req.user.id, note.title, note.content, contentPlain, note.folder_id, note.offline_enabled]
                        );
                        
                        results.notes.push({ 
                            local_id: note._localId, 
                            server: result.rows[0] 
                        });

                        // Handle tags
                        if (note.tags && note.tags.length > 0) {
                            for (const tagName of note.tags) {
                                const tagResult = await client.query(
                                    `INSERT INTO tags (user_id, name) VALUES ($1, $2)
                                     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
                                     RETURNING id`,
                                    [req.user.id, tagName]
                                );
                                await client.query(
                                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                                    [result.rows[0].id, tagResult.rows[0].id]
                                );
                            }
                        }
                    } else {
                        // Check for conflicts
                        const existing = await client.query(
                            'SELECT updated_at FROM notes WHERE id = $1 AND user_id = $2',
                            [note.id, req.user.id]
                        );

                        if (existing.rows.length > 0) {
                            const serverUpdated = new Date(existing.rows[0].updated_at);
                            const clientBase = note._baseUpdatedAt ? new Date(note._baseUpdatedAt) : new Date(0);

                            // Conflict: server has newer changes
                            if (serverUpdated > clientBase) {
                                results.conflicts.push({
                                    note_id: note.id,
                                    local_content: note.content,
                                    local_title: note.title
                                });
                                continue;
                            }
                        }

                        const contentPlain = note.content ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

                        await client.query(
                            `UPDATE notes SET 
                                title = $1, content = $2, content_plain = $3, 
                                folder_id = $4, offline_enabled = $5, updated_at = NOW()
                             WHERE id = $6 AND user_id = $7`,
                            [note.title, note.content, contentPlain, note.folder_id, note.offline_enabled, note.id, req.user.id]
                        );

                        // Update tags
                        if (note.tags !== undefined) {
                            await client.query('DELETE FROM note_tags WHERE note_id = $1', [note.id]);
                            for (const tagName of note.tags) {
                                const tagResult = await client.query(
                                    `INSERT INTO tags (user_id, name) VALUES ($1, $2)
                                     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
                                     RETURNING id`,
                                    [req.user.id, tagName]
                                );
                                await client.query(
                                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2)',
                                    [note.id, tagResult.rows[0].id]
                                );
                            }
                        }
                    }
                }
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            results,
            server_time: new Date().toISOString()
        });
    } catch (err) {
        console.error('Sync push error:', err);
        res.status(500).json({ error: 'Sync push failed' });
    }
});

// Get offline-enabled notes (full content)
router.get('/offline', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT n.*, 
                    COALESCE(
                        json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) 
                        FILTER (WHERE t.id IS NOT NULL), '[]'
                    ) as tags
             FROM notes n
             LEFT JOIN note_tags nt ON n.id = nt.note_id
             LEFT JOIN tags t ON nt.tag_id = t.id
             WHERE n.user_id = $1 AND n.offline_enabled = TRUE AND n.deleted_at IS NULL
             GROUP BY n.id`,
            [req.user.id]
        );

        res.json({ notes: result.rows });
    } catch (err) {
        console.error('Get offline notes error:', err);
        res.status(500).json({ error: 'Failed to get offline notes' });
    }
});

module.exports = router;
