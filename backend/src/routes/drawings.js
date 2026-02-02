const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get drawings for a note
router.get('/note/:noteId', async (req, res) => {
    try {
        // Verify note ownership
        const noteCheck = await db.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [req.params.noteId, req.user.id]
        );
        
        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const result = await db.query(
            'SELECT * FROM drawings WHERE note_id = $1 ORDER BY created_at',
            [req.params.noteId]
        );

        res.json({ drawings: result.rows });
    } catch (err) {
        console.error('Get drawings error:', err);
        res.status(500).json({ error: 'Failed to get drawings' });
    }
});

// Create drawing
router.post('/', async (req, res) => {
    try {
        const { note_id, drawing_data, thumbnail } = req.body;

        // Verify note ownership
        const noteCheck = await db.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [note_id, req.user.id]
        );
        
        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const result = await db.query(
            `INSERT INTO drawings (note_id, drawing_data, thumbnail)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [note_id, drawing_data, thumbnail]
        );

        res.status(201).json({ drawing: result.rows[0] });
    } catch (err) {
        console.error('Create drawing error:', err);
        res.status(500).json({ error: 'Failed to create drawing' });
    }
});

// Update drawing
router.put('/:id', async (req, res) => {
    try {
        const { drawing_data, thumbnail } = req.body;

        // Verify ownership via note
        const check = await db.query(
            `SELECT d.id FROM drawings d
             JOIN notes n ON d.note_id = n.id
             WHERE d.id = $1 AND n.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Drawing not found' });
        }

        const result = await db.query(
            `UPDATE drawings SET 
                drawing_data = $1,
                thumbnail = $2,
                updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [drawing_data, thumbnail, req.params.id]
        );

        res.json({ drawing: result.rows[0] });
    } catch (err) {
        console.error('Update drawing error:', err);
        res.status(500).json({ error: 'Failed to update drawing' });
    }
});

// Delete drawing
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM drawings d
             USING notes n
             WHERE d.note_id = n.id AND d.id = $1 AND n.user_id = $2
             RETURNING d.id`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Drawing not found' });
        }

        res.json({ message: 'Drawing deleted' });
    } catch (err) {
        console.error('Delete drawing error:', err);
        res.status(500).json({ error: 'Failed to delete drawing' });
    }
});

module.exports = router;
