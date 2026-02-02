const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all tags with note counts
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, 
                    COUNT(nt.note_id) as note_count
             FROM tags t
             LEFT JOIN note_tags nt ON t.id = nt.tag_id
             LEFT JOIN notes n ON nt.note_id = n.id AND n.deleted_at IS NULL
             WHERE t.user_id = $1
             GROUP BY t.id
             ORDER BY t.name`,
            [req.user.id]
        );
        res.json({ tags: result.rows });
    } catch (err) {
        console.error('Get tags error:', err);
        res.status(500).json({ error: 'Failed to get tags' });
    }
});

// Create tag
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name required' });
        }

        const result = await db.query(
            `INSERT INTO tags (user_id, name) VALUES ($1, $2)
             ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING *`,
            [req.user.id, name]
        );

        res.status(201).json({ tag: result.rows[0] });
    } catch (err) {
        console.error('Create tag error:', err);
        res.status(500).json({ error: 'Failed to create tag' });
    }
});

// Delete tag
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        res.json({ message: 'Tag deleted' });
    } catch (err) {
        console.error('Delete tag error:', err);
        res.status(500).json({ error: 'Failed to delete tag' });
    }
});

// Rename tag
router.put('/:id', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name required' });
        }

        const result = await db.query(
            'UPDATE tags SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [name, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        res.json({ tag: result.rows[0] });
    } catch (err) {
        console.error('Update tag error:', err);
        res.status(500).json({ error: 'Failed to update tag' });
    }
});

module.exports = router;
