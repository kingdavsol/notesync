const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all links from a note (outgoing)
router.get('/from/:noteId', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT nl.*, n.title as target_title
             FROM note_links nl
             JOIN notes n ON nl.target_note_id = n.id
             WHERE nl.source_note_id = $1 AND n.user_id = $2`,
            [req.params.noteId, req.user.id]
        );

        res.json({ links: result.rows });
    } catch (err) {
        console.error('Get outgoing links error:', err);
        res.status(500).json({ error: 'Failed to get links' });
    }
});

// Get all links to a note (backlinks/incoming)
router.get('/to/:noteId', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT nl.*, n.title as source_title
             FROM note_links nl
             JOIN notes n ON nl.source_note_id = n.id
             WHERE nl.target_note_id = $1 AND n.user_id = $2`,
            [req.params.noteId, req.user.id]
        );

        res.json({ backlinks: result.rows });
    } catch (err) {
        console.error('Get backlinks error:', err);
        res.status(500).json({ error: 'Failed to get backlinks' });
    }
});

// Create link between notes
router.post('/', async (req, res) => {
    try {
        const { source_note_id, target_note_id, link_text } = req.body;

        // Verify both notes belong to user
        const check = await db.query(
            'SELECT id FROM notes WHERE id IN ($1, $2) AND user_id = $3',
            [source_note_id, target_note_id, req.user.id]
        );

        if (check.rows.length !== 2) {
            return res.status(404).json({ error: 'One or both notes not found' });
        }

        const result = await db.query(
            `INSERT INTO note_links (source_note_id, target_note_id, link_text)
             VALUES ($1, $2, $3)
             ON CONFLICT (source_note_id, target_note_id) 
             DO UPDATE SET link_text = EXCLUDED.link_text
             RETURNING *`,
            [source_note_id, target_note_id, link_text]
        );

        res.status(201).json({ link: result.rows[0] });
    } catch (err) {
        console.error('Create link error:', err);
        res.status(500).json({ error: 'Failed to create link' });
    }
});

// Delete link
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM note_links nl
             USING notes n
             WHERE nl.source_note_id = n.id AND nl.id = $1 AND n.user_id = $2
             RETURNING nl.id`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found' });
        }

        res.json({ message: 'Link deleted' });
    } catch (err) {
        console.error('Delete link error:', err);
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

// Search notes for linking (autocomplete)
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ notes: [] });
        }

        const result = await db.query(
            `SELECT id, title FROM notes 
             WHERE user_id = $1 AND deleted_at IS NULL
             AND title ILIKE $2
             ORDER BY updated_at DESC
             LIMIT 10`,
            [req.user.id, `%${q}%`]
        );

        res.json({ notes: result.rows });
    } catch (err) {
        console.error('Search notes error:', err);
        res.status(500).json({ error: 'Failed to search notes' });
    }
});

module.exports = router;
