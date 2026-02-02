const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Full-text search with filters and ranking
router.get('/', async (req, res) => {
    try {
        const { 
            q,              // Search query
            folder_id,      // Filter by folder
            tags,           // Filter by tags (comma-separated)
            has_checklist,  // Filter notes with checklists
            has_drawing,    // Filter notes with drawings
            has_links,      // Filter notes with internal links
            date_from,      // Created after
            date_to,        // Created before
            sort,           // Sort: relevance, updated, created
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT DISTINCT ON (n.id)
                n.id, n.title, n.content, n.folder_id, n.offline_enabled,
                n.is_pinned, n.created_at, n.updated_at,
                f.name as folder_name,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) 
                    FILTER (WHERE t.id IS NOT NULL), '[]'
                ) as tags,
                (SELECT COUNT(*) FROM drawings d WHERE d.note_id = n.id) as drawing_count,
                (SELECT COUNT(*) FROM note_links nl WHERE nl.source_note_id = n.id) as link_count
        `;

        // Add relevance ranking if search query provided
        if (q) {
            query += `,
                ts_rank(
                    to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_plain, '')),
                    plainto_tsquery('english', $2)
                ) as relevance
            `;
        }

        query += `
            FROM notes n
            LEFT JOIN folders f ON n.folder_id = f.id
            LEFT JOIN note_tags nt ON n.id = nt.note_id
            LEFT JOIN tags t ON nt.tag_id = t.id
            WHERE n.user_id = $1 AND n.deleted_at IS NULL
        `;

        const params = [req.user.id];
        let paramIndex = 2;

        // Full-text search
        if (q) {
            query += ` AND (
                to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_plain, '')) 
                @@ plainto_tsquery('english', $${paramIndex})
                OR n.title ILIKE $${paramIndex + 1}
                OR n.content_plain ILIKE $${paramIndex + 1}
            )`;
            params.push(q, `%${q}%`);
            paramIndex += 2;
        }

        // Folder filter
        if (folder_id) {
            query += ` AND n.folder_id = $${paramIndex}`;
            params.push(folder_id);
            paramIndex++;
        }

        // Date range
        if (date_from) {
            query += ` AND n.created_at >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            query += ` AND n.created_at <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }

        // Has checklist (contains checkbox HTML)
        if (has_checklist === 'true') {
            query += ` AND (n.content ILIKE '%type="checkbox"%' OR n.content ILIKE '%data-checklist%')`;
        }

        // Has drawing
        if (has_drawing === 'true') {
            query += ` AND EXISTS (SELECT 1 FROM drawings d WHERE d.note_id = n.id)`;
        }

        // Has internal links
        if (has_links === 'true') {
            query += ` AND EXISTS (SELECT 1 FROM note_links nl WHERE nl.source_note_id = n.id)`;
        }

        query += ` GROUP BY n.id, f.name`;

        // Sorting
        if (q && (!sort || sort === 'relevance')) {
            query += ` ORDER BY n.id, relevance DESC, n.updated_at DESC`;
        } else if (sort === 'created') {
            query += ` ORDER BY n.id, n.created_at DESC`;
        } else {
            query += ` ORDER BY n.id, n.updated_at DESC`;
        }

        // Pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        // Filter by tags in JS (simpler than complex SQL)
        let notes = result.rows;
        if (tags) {
            const tagList = tags.split(',').map(t => t.trim().toLowerCase());
            notes = notes.filter(n => 
                n.tags.some(t => tagList.includes(t.name.toLowerCase()))
            );
        }

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(DISTINCT n.id) as total
            FROM notes n
            WHERE n.user_id = $1 AND n.deleted_at IS NULL
        `;
        const countParams = [req.user.id];
        
        if (q) {
            countQuery += ` AND (
                to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_plain, '')) 
                @@ plainto_tsquery('english', $2)
                OR n.title ILIKE $3
            )`;
            countParams.push(q, `%${q}%`);
        }

        const countResult = await db.query(countQuery, countParams);

        res.json({ 
            notes,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Search suggestions (for autocomplete)
router.get('/suggest', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }

        // Get matching titles
        const titles = await db.query(
            `SELECT DISTINCT title FROM notes 
             WHERE user_id = $1 AND deleted_at IS NULL
             AND title ILIKE $2
             LIMIT 5`,
            [req.user.id, `%${q}%`]
        );

        // Get matching tags
        const tagResults = await db.query(
            `SELECT DISTINCT name FROM tags 
             WHERE user_id = $1 AND name ILIKE $2
             LIMIT 5`,
            [req.user.id, `%${q}%`]
        );

        res.json({
            suggestions: {
                titles: titles.rows.map(r => r.title),
                tags: tagResults.rows.map(r => r.name)
            }
        });
    } catch (err) {
        console.error('Suggest error:', err);
        res.status(500).json({ error: 'Suggestion failed' });
    }
});

module.exports = router;
