const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Generate a unique share token
function generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Create a public share link for a note
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { note_id, allow_edit, password, expires_in_days } = req.body;

        // Verify ownership
        const noteCheck = await db.query(
            'SELECT id, user_id FROM notes WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [note_id, req.user.id]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Check if share already exists
        const existingShare = await db.query(
            'SELECT * FROM note_shares WHERE note_id = $1 AND created_by = $2',
            [note_id, req.user.id]
        );

        if (existingShare.rows.length > 0) {
            // Return existing share
            const share = existingShare.rows[0];
            return res.json({
                share: {
                    id: share.id,
                    token: share.share_token,
                    url: `${process.env.FRONTEND_URL}/shared/${share.share_token}`,
                    allow_edit: share.allow_edit,
                    has_password: !!share.password_hash,
                    expires_at: share.expires_at,
                    view_count: share.view_count,
                    created_at: share.created_at
                }
            });
        }

        const token = generateShareToken();
        const passwordHash = password ? await bcrypt.hash(password, 10) : null;
        const expiresAt = expires_in_days
            ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
            : null;

        const result = await db.query(
            `INSERT INTO note_shares (note_id, share_token, allow_edit, password_hash, expires_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [note_id, token, allow_edit || false, passwordHash, expiresAt, req.user.id]
        );

        // Update share count on note
        await db.query(
            'UPDATE notes SET share_count = share_count + 1 WHERE id = $1',
            [note_id]
        );

        const share = result.rows[0];
        res.status(201).json({
            share: {
                id: share.id,
                token: share.share_token,
                url: `${process.env.FRONTEND_URL}/shared/${share.share_token}`,
                allow_edit: share.allow_edit,
                has_password: !!passwordHash,
                expires_at: share.expires_at,
                created_at: share.created_at
            }
        });
    } catch (err) {
        console.error('Create share error:', err);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});

// Get share settings for a note
router.get('/note/:noteId', authenticateToken, async (req, res) => {
    try {
        const shares = await db.query(
            `SELECT ns.*, u.email as created_by_email
             FROM note_shares ns
             JOIN users u ON ns.created_by = u.id
             WHERE ns.note_id = $1`,
            [req.params.noteId]
        );

        const collaborators = await db.query(
            `SELECT nc.*, u.email
             FROM note_collaborators nc
             JOIN users u ON nc.user_id = u.id
             WHERE nc.note_id = $1`,
            [req.params.noteId]
        );

        res.json({
            shares: shares.rows.map(s => ({
                id: s.id,
                token: s.share_token,
                url: `${process.env.FRONTEND_URL}/shared/${s.share_token}`,
                allow_edit: s.allow_edit,
                has_password: !!s.password_hash,
                expires_at: s.expires_at,
                view_count: s.view_count,
                created_at: s.created_at
            })),
            collaborators: collaborators.rows.map(c => ({
                id: c.id,
                email: c.email,
                permission: c.permission,
                accepted: !!c.accepted_at,
                created_at: c.created_at
            }))
        });
    } catch (err) {
        console.error('Get share settings error:', err);
        res.status(500).json({ error: 'Failed to get share settings' });
    }
});

// Update share settings
router.put('/:shareId', authenticateToken, async (req, res) => {
    try {
        const { allow_edit, password, expires_in_days, remove_password } = req.body;

        // Verify ownership through note
        const shareCheck = await db.query(
            `SELECT ns.* FROM note_shares ns
             JOIN notes n ON ns.note_id = n.id
             WHERE ns.id = $1 AND n.user_id = $2`,
            [req.params.shareId, req.user.id]
        );

        if (shareCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Share not found' });
        }

        let passwordHash = shareCheck.rows[0].password_hash;
        if (remove_password) {
            passwordHash = null;
        } else if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const expiresAt = expires_in_days !== undefined
            ? (expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null)
            : shareCheck.rows[0].expires_at;

        const result = await db.query(
            `UPDATE note_shares SET
                allow_edit = COALESCE($1, allow_edit),
                password_hash = $2,
                expires_at = $3
             WHERE id = $4
             RETURNING *`,
            [allow_edit, passwordHash, expiresAt, req.params.shareId]
        );

        res.json({
            share: {
                id: result.rows[0].id,
                token: result.rows[0].share_token,
                url: `${process.env.FRONTEND_URL}/shared/${result.rows[0].share_token}`,
                allow_edit: result.rows[0].allow_edit,
                has_password: !!passwordHash,
                expires_at: result.rows[0].expires_at
            }
        });
    } catch (err) {
        console.error('Update share error:', err);
        res.status(500).json({ error: 'Failed to update share' });
    }
});

// Delete share link
router.delete('/:shareId', authenticateToken, async (req, res) => {
    try {
        const shareCheck = await db.query(
            `SELECT ns.note_id FROM note_shares ns
             JOIN notes n ON ns.note_id = n.id
             WHERE ns.id = $1 AND n.user_id = $2`,
            [req.params.shareId, req.user.id]
        );

        if (shareCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Share not found' });
        }

        await db.query('DELETE FROM note_shares WHERE id = $1', [req.params.shareId]);

        // Update share count
        await db.query(
            'UPDATE notes SET share_count = GREATEST(share_count - 1, 0) WHERE id = $1',
            [shareCheck.rows[0].note_id]
        );

        res.json({ message: 'Share link deleted' });
    } catch (err) {
        console.error('Delete share error:', err);
        res.status(500).json({ error: 'Failed to delete share' });
    }
});

// Access shared note (public endpoint)
router.get('/view/:token', async (req, res) => {
    try {
        const share = await db.query(
            `SELECT ns.*, n.title, n.content, n.updated_at, u.email as owner_email
             FROM note_shares ns
             JOIN notes n ON ns.note_id = n.id
             JOIN users u ON n.user_id = u.id
             WHERE ns.share_token = $1 AND n.deleted_at IS NULL`,
            [req.params.token]
        );

        if (share.rows.length === 0) {
            return res.status(404).json({ error: 'Shared note not found' });
        }

        const shareData = share.rows[0];

        // Check expiration
        if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
            return res.status(410).json({ error: 'This share link has expired' });
        }

        // Check password
        if (shareData.password_hash) {
            const { password } = req.query;
            if (!password) {
                return res.json({ requires_password: true });
            }
            const valid = await bcrypt.compare(password, shareData.password_hash);
            if (!valid) {
                return res.status(401).json({ error: 'Invalid password' });
            }
        }

        // Increment view count
        await db.query(
            'UPDATE note_shares SET view_count = view_count + 1 WHERE id = $1',
            [shareData.id]
        );

        res.json({
            note: {
                title: shareData.title,
                content: shareData.content,
                updated_at: shareData.updated_at,
                owner: shareData.owner_email.split('@')[0] // Show username only
            },
            share: {
                allow_edit: shareData.allow_edit,
                view_count: shareData.view_count + 1
            }
        });
    } catch (err) {
        console.error('View shared note error:', err);
        res.status(500).json({ error: 'Failed to load shared note' });
    }
});

// Invite collaborator
router.post('/invite', authenticateToken, async (req, res) => {
    try {
        const { note_id, email, permission } = req.body;

        // Verify ownership
        const noteCheck = await db.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [note_id, req.user.id]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Find user by email
        const userResult = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found. They need to create an account first.' });
        }

        const collaboratorId = userResult.rows[0].id;

        // Can't invite yourself
        if (collaboratorId === req.user.id) {
            return res.status(400).json({ error: 'Cannot invite yourself' });
        }

        // Add collaborator
        const result = await db.query(
            `INSERT INTO note_collaborators (note_id, user_id, permission, invited_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (note_id, user_id) DO UPDATE SET permission = $3
             RETURNING *`,
            [note_id, collaboratorId, permission || 'view', req.user.id]
        );

        res.status(201).json({
            collaborator: {
                id: result.rows[0].id,
                email,
                permission: result.rows[0].permission
            }
        });
    } catch (err) {
        console.error('Invite collaborator error:', err);
        res.status(500).json({ error: 'Failed to invite collaborator' });
    }
});

// Remove collaborator
router.delete('/collaborator/:id', authenticateToken, async (req, res) => {
    try {
        // Verify ownership
        const check = await db.query(
            `SELECT nc.id FROM note_collaborators nc
             JOIN notes n ON nc.note_id = n.id
             WHERE nc.id = $1 AND n.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Collaborator not found' });
        }

        await db.query('DELETE FROM note_collaborators WHERE id = $1', [req.params.id]);
        res.json({ message: 'Collaborator removed' });
    } catch (err) {
        console.error('Remove collaborator error:', err);
        res.status(500).json({ error: 'Failed to remove collaborator' });
    }
});

// Get notes shared with me
router.get('/shared-with-me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT n.id, n.title, n.content, n.updated_at,
                    nc.permission, u.email as owner_email
             FROM note_collaborators nc
             JOIN notes n ON nc.note_id = n.id
             JOIN users u ON n.user_id = u.id
             WHERE nc.user_id = $1 AND n.deleted_at IS NULL
             ORDER BY n.updated_at DESC`,
            [req.user.id]
        );

        res.json({ notes: result.rows });
    } catch (err) {
        console.error('Get shared notes error:', err);
        res.status(500).json({ error: 'Failed to get shared notes' });
    }
});

module.exports = router;
