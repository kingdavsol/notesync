const express = require('express');
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all reminders for user
router.get('/', async (req, res) => {
    try {
        const { upcoming_only, include_snoozed } = req.query;

        let query = `
            SELECT r.*, n.title as note_title
            FROM reminders r
            JOIN notes n ON r.note_id = n.id
            WHERE r.user_id = $1
        `;

        const params = [req.user.id];

        if (upcoming_only === 'true') {
            query += ` AND r.remind_at > NOW() AND r.notified = FALSE`;
        }

        if (include_snoozed !== 'true') {
            query += ` AND (r.snoozed_until IS NULL OR r.snoozed_until < NOW())`;
        }

        query += ` ORDER BY r.remind_at ASC`;

        const result = await db.query(query, params);
        res.json({ reminders: result.rows });
    } catch (err) {
        console.error('Get reminders error:', err);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

// Get reminders for a specific note
router.get('/note/:noteId', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM reminders
             WHERE note_id = $1 AND user_id = $2
             ORDER BY remind_at ASC`,
            [req.params.noteId, req.user.id]
        );
        res.json({ reminders: result.rows });
    } catch (err) {
        console.error('Get note reminders error:', err);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

// Create reminder
router.post('/', async (req, res) => {
    try {
        const { note_id, remind_at, title, is_recurring, recurrence_rule } = req.body;

        // Verify note ownership
        const noteCheck = await db.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [note_id, req.user.id]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const result = await db.query(
            `INSERT INTO reminders (note_id, user_id, remind_at, title, is_recurring, recurrence_rule)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [note_id, req.user.id, remind_at, title, is_recurring || false, recurrence_rule]
        );

        // Update pending reminders count
        await db.query(
            'UPDATE users SET pending_reminders = pending_reminders + 1 WHERE id = $1',
            [req.user.id]
        );

        res.status(201).json({ reminder: result.rows[0] });
    } catch (err) {
        console.error('Create reminder error:', err);
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

// Update reminder
router.put('/:id', async (req, res) => {
    try {
        const { remind_at, title, is_recurring, recurrence_rule } = req.body;

        const result = await db.query(
            `UPDATE reminders SET
                remind_at = COALESCE($1, remind_at),
                title = COALESCE($2, title),
                is_recurring = COALESCE($3, is_recurring),
                recurrence_rule = COALESCE($4, recurrence_rule),
                notified = FALSE,
                snoozed_until = NULL
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [remind_at, title, is_recurring, recurrence_rule, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        res.json({ reminder: result.rows[0] });
    } catch (err) {
        console.error('Update reminder error:', err);
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});

// Snooze reminder
router.post('/:id/snooze', async (req, res) => {
    try {
        const { minutes } = req.body;
        const snoozeUntil = new Date(Date.now() + (minutes || 15) * 60 * 1000);

        const result = await db.query(
            `UPDATE reminders SET snoozed_until = $1
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [snoozeUntil, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        res.json({ reminder: result.rows[0] });
    } catch (err) {
        console.error('Snooze reminder error:', err);
        res.status(500).json({ error: 'Failed to snooze reminder' });
    }
});

// Mark reminder as done
router.post('/:id/done', async (req, res) => {
    try {
        const reminder = await db.query(
            'SELECT * FROM reminders WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (reminder.rows.length === 0) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        const reminderData = reminder.rows[0];

        if (reminderData.is_recurring && reminderData.recurrence_rule) {
            // Calculate next occurrence based on recurrence rule
            const nextRemindAt = calculateNextOccurrence(
                new Date(reminderData.remind_at),
                reminderData.recurrence_rule
            );

            await db.query(
                `UPDATE reminders SET remind_at = $1, notified = FALSE, snoozed_until = NULL
                 WHERE id = $2`,
                [nextRemindAt, req.params.id]
            );

            const updated = await db.query(
                'SELECT * FROM reminders WHERE id = $1',
                [req.params.id]
            );

            res.json({ reminder: updated.rows[0], message: 'Recurring reminder rescheduled' });
        } else {
            // Non-recurring: mark as notified (done)
            await db.query(
                'UPDATE reminders SET notified = TRUE WHERE id = $1',
                [req.params.id]
            );

            // Decrement pending count
            await db.query(
                'UPDATE users SET pending_reminders = GREATEST(pending_reminders - 1, 0) WHERE id = $1',
                [req.user.id]
            );

            res.json({ message: 'Reminder marked as done' });
        }
    } catch (err) {
        console.error('Mark done error:', err);
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});

// Delete reminder
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id, notified',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        // Decrement pending count if reminder wasn't notified
        if (!result.rows[0].notified) {
            await db.query(
                'UPDATE users SET pending_reminders = GREATEST(pending_reminders - 1, 0) WHERE id = $1',
                [req.user.id]
            );
        }

        res.json({ message: 'Reminder deleted' });
    } catch (err) {
        console.error('Delete reminder error:', err);
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});

// Get due reminders (for polling)
router.get('/due', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT r.*, n.title as note_title
             FROM reminders r
             JOIN notes n ON r.note_id = n.id
             WHERE r.user_id = $1
               AND r.notified = FALSE
               AND r.remind_at <= NOW()
               AND (r.snoozed_until IS NULL OR r.snoozed_until <= NOW())
             ORDER BY r.remind_at ASC`,
            [req.user.id]
        );

        res.json({ reminders: result.rows });
    } catch (err) {
        console.error('Get due reminders error:', err);
        res.status(500).json({ error: 'Failed to get due reminders' });
    }
});

// Helper to calculate next occurrence
function calculateNextOccurrence(currentDate, rule) {
    const now = new Date();
    let next = new Date(currentDate);

    // Simple rule parsing (FREQ=DAILY, FREQ=WEEKLY, FREQ=MONTHLY)
    if (rule.includes('FREQ=DAILY')) {
        while (next <= now) {
            next.setDate(next.getDate() + 1);
        }
    } else if (rule.includes('FREQ=WEEKLY')) {
        while (next <= now) {
            next.setDate(next.getDate() + 7);
        }
    } else if (rule.includes('FREQ=MONTHLY')) {
        while (next <= now) {
            next.setMonth(next.getMonth() + 1);
        }
    } else {
        // Default to daily
        next.setDate(next.getDate() + 1);
    }

    return next;
}

module.exports = router;
