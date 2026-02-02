const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all folders
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT f.*, 
                    (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.deleted_at IS NULL) as note_count
             FROM folders f 
             WHERE f.user_id = $1 
             ORDER BY f.name`,
            [req.user.id]
        );
        res.json({ folders: result.rows });
    } catch (err) {
        console.error('Get folders error:', err);
        res.status(500).json({ error: 'Failed to get folders' });
    }
});

// Create folder
router.post('/', async (req, res) => {
    try {
        const { name, parent_id } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name required' });
        }

        const result = await db.query(
            'INSERT INTO folders (user_id, name, parent_id) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, name, parent_id || null]
        );

        await db.query(
            'INSERT INTO sync_log (user_id, entity_type, entity_id, action) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'folder', result.rows[0].id, 'create']
        );

        res.status(201).json({ folder: result.rows[0] });
    } catch (err) {
        console.error('Create folder error:', err);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Update folder
router.put('/:id', async (req, res) => {
    try {
        const { name, parent_id } = req.body;

        const result = await db.query(
            `UPDATE folders SET 
                name = COALESCE($1, name),
                parent_id = $2,
                updated_at = NOW()
             WHERE id = $3 AND user_id = $4
             RETURNING *`,
            [name, parent_id, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json({ folder: result.rows[0] });
    } catch (err) {
        console.error('Update folder error:', err);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});

// Delete folder
router.delete('/:id', async (req, res) => {
    try {
        // Move notes to no folder before deleting
        await db.query(
            'UPDATE notes SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        const result = await db.query(
            'DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json({ message: 'Folder deleted' });
    } catch (err) {
        console.error('Delete folder error:', err);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

module.exports = router;
