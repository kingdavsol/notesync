const express = require('express');
const crypto = require('crypto');
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
const { sendVerificationEmail } = require('../services/email');

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

// Generate a secure verification token
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

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
        const existing = await db.query('SELECT id, email_verified FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            // If user exists but isn't verified, allow re-sending verification
            if (!existing.rows[0].email_verified) {
                const token = generateVerificationToken();
                const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

                await db.query(
                    'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
                    [token, expires, existing.rows[0].id]
                );

                await sendVerificationEmail(email.toLowerCase(), token);

                return res.status(200).json({
                    message: 'Verification email resent. Please check your inbox.',
                    requiresVerification: true
                });
            }
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password with high cost factor
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate verification token
        const verificationToken = generateVerificationToken();
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create user (unverified)
        const result = await db.query(
            `INSERT INTO users (email, password_hash, email_verified, verification_token, verification_token_expires)
             VALUES ($1, $2, FALSE, $3, $4) RETURNING id, email, created_at`,
            [email.toLowerCase(), passwordHash, verificationToken, tokenExpires]
        );

        const user = result.rows[0];

        // Create default folder
        await db.query(
            'INSERT INTO folders (user_id, name) VALUES ($1, $2)',
            [user.id, 'My Notes']
        );

        // Send verification email
        const emailResult = await sendVerificationEmail(email.toLowerCase(), verificationToken);

        // Audit log
        auditLog('USER_REGISTERED', user.id, {
            ip: req.ip,
            email: user.email,
            emailSent: emailResult.success
        });

        res.status(201).json({
            message: 'Account created! Please check your email to verify your account.',
            requiresVerification: true,
            user: { id: user.id, email: user.email }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Verify email
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        // Find user with this token
        const result = await db.query(
            `SELECT id, email, email_verified, verification_token_expires
             FROM users WHERE verification_token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification link' });
        }

        const user = result.rows[0];

        // Already verified
        if (user.email_verified) {
            return res.json({ message: 'Email already verified. You can sign in.' });
        }

        // Check expiration
        if (new Date() > new Date(user.verification_token_expires)) {
            return res.status(400).json({
                error: 'Verification link has expired. Please request a new one.',
                expired: true
            });
        }

        // Mark as verified and clear token
        await db.query(
            `UPDATE users SET email_verified = TRUE, verification_token = NULL,
             verification_token_expires = NULL, updated_at = NOW() WHERE id = $1`,
            [user.id]
        );

        auditLog('EMAIL_VERIFIED', user.id, { email: user.email });

        // Generate auth token so they can log in immediately
        const authToken = generateToken(user);
        const csrfToken = setCsrfToken(user.id);

        res.json({
            message: 'Email verified successfully!',
            user: { id: user.id, email: user.email },
            token: authToken,
            csrfToken
        });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await db.query(
            'SELECT id, email, email_verified FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            // Don't reveal if email exists
            return res.json({ message: 'If that email exists, a verification link has been sent.' });
        }

        const user = result.rows[0];

        if (user.email_verified) {
            return res.json({ message: 'Email is already verified. You can sign in.' });
        }

        // Generate new token
        const token = generateVerificationToken();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await db.query(
            'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
            [token, expires, user.id]
        );

        await sendVerificationEmail(email.toLowerCase(), token);

        auditLog('VERIFICATION_RESENT', user.id, { email: user.email });

        res.json({ message: 'If that email exists, a verification link has been sent.' });
    } catch (err) {
        console.error('Resend verification error:', err);
        res.status(500).json({ error: 'Failed to resend verification' });
    }
});

// Login
router.post('/login', bruteForceProtection, validateBody(loginRules), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const result = await db.query(
            'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
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

        // Check if email is verified
        if (!user.email_verified) {
            auditLog('LOGIN_UNVERIFIED', user.id, { ip: req.ip, email });
            return res.status(403).json({
                error: 'Please verify your email before signing in.',
                requiresVerification: true,
                email: user.email
            });
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
            'SELECT id, email, email_verified, created_at FROM users WHERE id = $1',
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
