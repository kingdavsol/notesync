const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get version history for a note
router.get('/note/:noteId', async (req, res) => {
    try {
        const { limit } = req.query;

        // Verify ownership
        const noteCheck = await db.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [req.params.noteId, req.user.id]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        let query = `
            SELECT nv.*, u.email as created_by_email
            FROM note_versions nv
            LEFT JOIN users u ON nv.created_by = u.id
            WHERE nv.note_id = $1
            ORDER BY nv.version_number DESC
        `;
        const params = [req.params.noteId];

        if (limit) {
            query += ` LIMIT $2`;
            params.push(parseInt(limit));
        }

        const result = await db.query(query, params);
        res.json({ versions: result.rows });
    } catch (err) {
        console.error('Get versions error:', err);
        res.status(500).json({ error: 'Failed to get version history' });
    }
});

// Get specific version
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT nv.*, u.email as created_by_email
             FROM note_versions nv
             LEFT JOIN users u ON nv.created_by = u.id
             JOIN notes n ON nv.note_id = n.id
             WHERE nv.id = $1 AND n.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }

        res.json({ version: result.rows[0] });
    } catch (err) {
        console.error('Get version error:', err);
        res.status(500).json({ error: 'Failed to get version' });
    }
});

// Restore note to specific version
router.post('/:id/restore', async (req, res) => {
    try {
        // Get version
        const versionResult = await db.query(
            `SELECT nv.*, n.user_id
             FROM note_versions nv
             JOIN notes n ON nv.note_id = n.id
             WHERE nv.id = $1 AND n.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        // First, save current state as a new version
        const currentNote = await db.query(
            'SELECT * FROM notes WHERE id = $1',
            [version.note_id]
        );

        if (currentNote.rows.length > 0) {
            const current = currentNote.rows[0];

            // Get next version number
            const versionNum = await db.query(
                'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM note_versions WHERE note_id = $1',
                [version.note_id]
            );

            await db.query(
                `INSERT INTO note_versions (note_id, version_number, title, content, content_plain, created_by, change_summary)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    version.note_id,
                    versionNum.rows[0].next_version,
                    current.title,
                    current.content,
                    current.content_plain,
                    req.user.id,
                    'Auto-saved before restore'
                ]
            );
        }

        // Restore note to the selected version
        const result = await db.query(
            `UPDATE notes SET
                title = $1,
                content = $2,
                content_plain = $3,
                updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [version.title, version.content, version.content_plain, version.note_id]
        );

        // Log sync action
        await db.query(
            'INSERT INTO sync_log (user_id, entity_type, entity_id, action) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'note', version.note_id, 'update']
        );

        res.json({
            note: result.rows[0],
            message: `Restored to version ${version.version_number}`
        });
    } catch (err) {
        console.error('Restore version error:', err);
        res.status(500).json({ error: 'Failed to restore version' });
    }
});

// Compare two versions
router.get('/compare/:id1/:id2', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT nv.*
             FROM note_versions nv
             JOIN notes n ON nv.note_id = n.id
             WHERE nv.id IN ($1, $2) AND n.user_id = $3
             ORDER BY nv.version_number`,
            [req.params.id1, req.params.id2, req.user.id]
        );

        if (result.rows.length !== 2) {
            return res.status(404).json({ error: 'Versions not found' });
        }

        res.json({
            older: result.rows[0],
            newer: result.rows[1]
        });
    } catch (err) {
        console.error('Compare versions error:', err);
        res.status(500).json({ error: 'Failed to compare versions' });
    }
});

// Delete old versions (keep last N)
router.delete('/note/:noteId/cleanup', async (req, res) => {
    try {
        const { keep } = req.query;
        const keepCount = parseInt(keep) || 10;

        // Verify ownership
        const noteCheck = await db.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [req.params.noteId, req.user.id]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Delete all but the last N versions
        const result = await db.query(
            `DELETE FROM note_versions
             WHERE note_id = $1 AND id NOT IN (
                 SELECT id FROM note_versions
                 WHERE note_id = $1
                 ORDER BY version_number DESC
                 LIMIT $2
             )
             RETURNING id`,
            [req.params.noteId, keepCount]
        );

        res.json({
            deleted: result.rowCount,
            message: `Deleted ${result.rowCount} old versions, kept last ${keepCount}`
        });
    } catch (err) {
        console.error('Cleanup versions error:', err);
        res.status(500).json({ error: 'Failed to cleanup versions' });
    }
});

module.exports = router;
