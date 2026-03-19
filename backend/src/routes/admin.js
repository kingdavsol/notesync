const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

// Admin stats endpoint
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (ID 1)
    if (req.user?.id !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const totalUsersRes = await db.query('SELECT COUNT(*) as count FROM users');
    const paidUsersRes = await db.query('SELECT COUNT(*) as count FROM users WHERE subscription_tier IN ($1, $2, $3)', ['Starter', 'Pro', 'Premium']);
    const freeUsersRes = await db.query('SELECT COUNT(*) as count FROM users WHERE subscription_tier IS NULL OR subscription_tier = $1', ['free']);
    const totalNotesRes = await db.query('SELECT COUNT(*) as count FROM notes WHERE deleted_at IS NULL');
    const totalStorageRes = await db.query('SELECT COALESCE(SUM(LENGTH(content)), 0) as bytes FROM notes WHERE deleted_at IS NULL');
    
    const tierBreakdownRes = await db.query(`
      SELECT subscription_tier, COUNT(*) as count 
      FROM users 
      GROUP BY subscription_tier 
      ORDER BY subscription_tier
    `);

    const notesPerUserRes = await db.query(`
      SELECT u.id, u.email, u.subscription_tier, COUNT(n.id) as note_count, COALESCE(SUM(LENGTH(n.content)), 0) as storage_bytes
      FROM users u
      LEFT JOIN notes n ON u.id = n.user_id AND n.deleted_at IS NULL
      GROUP BY u.id, u.email, u.subscription_tier
      ORDER BY note_count DESC
      LIMIT 50
    `);

    const totalStorage = totalStorageRes.rows[0]?.bytes || 0;

    res.json({
      summary: {
        totalUsers: totalUsersRes.rows[0]?.count || 0,
        paidUsers: paidUsersRes.rows[0]?.count || 0,
        freeUsers: freeUsersRes.rows[0]?.count || 0,
        totalNotes: totalNotesRes.rows[0]?.count || 0,
        totalStorageBytes: totalStorage,
        totalStorageMB: Math.round((totalStorage / 1024 / 1024) * 100) / 100,
      },
      tierBreakdown: tierBreakdownRes.rows,
      topUsers: notesPerUserRes.rows,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Signup rate (last 7 days)
router.get('/signups', authenticateToken, async (req, res) => {
  try {
    if (req.user?.id !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const signupsRes = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json(signupsRes.rows);
  } catch (err) {
    console.error('Admin signups error:', err);
    res.status(500).json({ error: 'Failed to fetch signups' });
  }
});

module.exports = router;
