const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { 
    bruteForceProtection, 
    recordFailedAttempt, 
    clearFailedAttempts,
    setCsrfToken,
    validateBody,
    auditLog 
} = require('../middleware/security');

const router = express.Router();

// Validation rules
const registerRules = {
    email: { required: true, type: 'string', validator: 'email' },
    password: { required: true, type: 'string', minLength: 8 }
};

const loginRules = {
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
};

// Register
router.post('/register', validateBody(registerRules), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Additional password strength check
        if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
            return res.status(400).json({ 
                error: 'Password must contain at least one letter and one number' 
            });
        }

        // Check if user exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password with high cost factor
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = await db.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
            [email.toLowerCase(), passwordHash]
        );

        const user = result.rows[0];
        const token = generateToken(user);
        const csrfToken = setCsrfToken(user.id);

        // Create default folder
        await db.query(
            'INSERT INTO folders (user_id, name) VALUES ($1, $2)',
            [user.id, 'My Notes']
        );

        // Audit log
        auditLog('USER_REGISTERED', user.id, { 
            ip: req.ip, 
            email: user.email 
        });

        res.status(201).json({
            user: { id: user.id, email: user.email },
            token,
            csrfToken
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', bruteForceProtection, validateBody(loginRules), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const result = await db.query(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            recordFailedAttempt(req.loginAttemptKey);
            auditLog('LOGIN_FAILED', null, { ip: req.ip, email, reason: 'user_not_found' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password using timing-safe comparison
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            recordFailedAttempt(req.loginAttemptKey);
            auditLog('LOGIN_FAILED', user.id, { ip: req.ip, email, reason: 'invalid_password' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Clear failed attempts on successful login
        clearFailedAttempts(req.loginAttemptKey);

        const token = generateToken(user);
        const csrfToken = setCsrfToken(user.id);

        // Audit log
        auditLog('LOGIN_SUCCESS', user.id, { ip: req.ip, email: user.email });

        res.json({
            user: { id: user.id, email: user.email },
            token,
            csrfToken
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Refresh CSRF token
        const csrfToken = setCsrfToken(req.user.id);

        res.json({ 
            user: result.rows[0],
            csrfToken 
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
            return res.status(400).json({ 
                error: 'New password must contain at least one letter and one number' 
            });
        }

        // Get current hash
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!valid) {
            auditLog('PASSWORD_CHANGE_FAILED', req.user.id, { ip: req.ip, reason: 'invalid_current' });
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        const newHash = await bcrypt.hash(newPassword, 12);
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, req.user.id]
        );

        auditLog('PASSWORD_CHANGED', req.user.id, { ip: req.ip });

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Logout (invalidate CSRF token)
router.post('/logout', authenticateToken, (req, res) => {
    auditLog('LOGOUT', req.user.id, { ip: req.ip });
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
