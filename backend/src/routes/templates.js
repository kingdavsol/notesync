const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all templates (user's + default)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;

        let query = `
            SELECT * FROM templates
            WHERE user_id = $1 OR is_default = TRUE
        `;
        const params = [req.user.id];

        if (category) {
            query += ` AND category = $2`;
            params.push(category);
        }

        query += ` ORDER BY is_default DESC, name ASC`;

        const result = await db.query(query, params);
        res.json({ templates: result.rows });
    } catch (err) {
        console.error('Get templates error:', err);
        res.status(500).json({ error: 'Failed to get templates' });
    }
});

// Get template categories
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT DISTINCT category, COUNT(*) as count
             FROM templates
             WHERE user_id = $1 OR is_default = TRUE
             GROUP BY category
             ORDER BY category`,
            [req.user.id]
        );
        res.json({ categories: result.rows });
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

// Get single template
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM templates
             WHERE id = $1 AND (user_id = $2 OR is_default = TRUE)`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ template: result.rows[0] });
    } catch (err) {
        console.error('Get template error:', err);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

// Create template
router.post('/', async (req, res) => {
    try {
        const { name, description, content, category, icon } = req.body;

        if (!name || !content) {
            return res.status(400).json({ error: 'Name and content are required' });
        }

        const result = await db.query(
            `INSERT INTO templates (user_id, name, description, content, category, icon)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, name, description, content, category || 'Custom', icon]
        );

        res.status(201).json({ template: result.rows[0] });
    } catch (err) {
        console.error('Create template error:', err);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Create template from existing note
router.post('/from-note/:noteId', async (req, res) => {
    try {
        const { name, description, category } = req.body;

        // Get note content
        const noteResult = await db.query(
            'SELECT title, content FROM notes WHERE id = $1 AND user_id = $2',
            [req.params.noteId, req.user.id]
        );

        if (noteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const note = noteResult.rows[0];

        const result = await db.query(
            `INSERT INTO templates (user_id, name, description, content, category)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                req.user.id,
                name || `Template from: ${note.title}`,
                description,
                note.content,
                category || 'Custom'
            ]
        );

        res.status(201).json({ template: result.rows[0] });
    } catch (err) {
        console.error('Create template from note error:', err);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Update template
router.put('/:id', async (req, res) => {
    try {
        const { name, description, content, category, icon } = req.body;

        // Only allow editing user's own templates
        const result = await db.query(
            `UPDATE templates SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                content = COALESCE($3, content),
                category = COALESCE($4, category),
                icon = COALESCE($5, icon),
                updated_at = NOW()
             WHERE id = $6 AND user_id = $7 AND is_default = FALSE
             RETURNING *`,
            [name, description, content, category, icon, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found or cannot be edited' });
        }

        res.json({ template: result.rows[0] });
    } catch (err) {
        console.error('Update template error:', err);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// Delete template
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM templates WHERE id = $1 AND user_id = $2 AND is_default = FALSE RETURNING id',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found or cannot be deleted' });
        }

        res.json({ message: 'Template deleted' });
    } catch (err) {
        console.error('Delete template error:', err);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// Create note from template
router.post('/:id/create-note', async (req, res) => {
    try {
        const { folder_id, title_override } = req.body;

        // Get template
        const templateResult = await db.query(
            `SELECT * FROM templates
             WHERE id = $1 AND (user_id = $2 OR is_default = TRUE)`,
            [req.params.id, req.user.id]
        );

        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateResult.rows[0];

        // Create note from template
        const contentPlain = template.content
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const noteResult = await db.query(
            `INSERT INTO notes (user_id, title, content, content_plain, folder_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                req.user.id,
                title_override || template.name,
                template.content,
                contentPlain,
                folder_id || null
            ]
        );

        // Log sync action
        await db.query(
            'INSERT INTO sync_log (user_id, entity_type, entity_id, action) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'note', noteResult.rows[0].id, 'create']
        );

        res.status(201).json({ note: noteResult.rows[0] });
    } catch (err) {
        console.error('Create note from template error:', err);
        res.status(500).json({ error: 'Failed to create note from template' });
    }
});

module.exports = router;
