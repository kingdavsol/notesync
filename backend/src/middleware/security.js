const crypto = require('crypto');

// XSS Protection - Sanitize user input
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Deep sanitize object
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeInput(obj);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    const sanitized = {};
    for (const key of Object.keys(obj)) {
        // Skip content field - we want to preserve HTML for notes
        if (key === 'content' || key === 'drawing_data') {
            sanitized[key] = obj[key];
        } else {
            sanitized[key] = sanitizeObject(obj[key]);
        }
    }
    return sanitized;
}

// Middleware to sanitize request body
function sanitizeMiddleware(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
    next();
}

// CSRF Token Generation
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

// CSRF Protection Middleware
const csrfTokens = new Map(); // In production, use Redis

function csrfProtection(req, res, next) {
    // Skip for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const token = req.headers['x-csrf-token'];
    const userId = req.user?.id;

    if (!token || !userId) {
        return res.status(403).json({ error: 'CSRF token missing' });
    }

    const storedToken = csrfTokens.get(userId.toString());
    if (!storedToken || storedToken !== token) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
}

// Generate and store CSRF token for user
function setCsrfToken(userId) {
    const token = generateCsrfToken();
    csrfTokens.set(userId.toString(), token);
    
    // Auto-expire after 24 hours
    setTimeout(() => {
        csrfTokens.delete(userId.toString());
    }, 24 * 60 * 60 * 1000);
    
    return token;
}

// Input Validation
const validators = {
    email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    },
    
    password: (value) => {
        // Min 8 chars, at least one letter and one number
        return value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value);
    },
    
    noteTitle: (value) => {
        return typeof value === 'string' && value.length <= 500;
    },
    
    noteContent: (value) => {
        // Max 10MB of content
        return typeof value === 'string' && value.length <= 10 * 1024 * 1024;
    },
    
    id: (value) => {
        return Number.isInteger(Number(value)) && Number(value) > 0;
    },
    
    folderName: (value) => {
        return typeof value === 'string' && value.length > 0 && value.length <= 255;
    },
    
    tagName: (value) => {
        return typeof value === 'string' && value.length > 0 && value.length <= 100;
    }
};

function validate(field, value) {
    if (!validators[field]) return true;
    return validators[field](value);
}

// Validation middleware factory
function validateBody(rules) {
    return (req, res, next) => {
        const errors = [];
        
        for (const [field, config] of Object.entries(rules)) {
            const value = req.body[field];
            
            // Required check
            if (config.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            // Type validation
            if (value !== undefined && config.type) {
                if (config.type === 'string' && typeof value !== 'string') {
                    errors.push(`${field} must be a string`);
                }
                if (config.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
                    errors.push(`${field} must be a number`);
                }
                if (config.type === 'boolean' && typeof value !== 'boolean') {
                    errors.push(`${field} must be a boolean`);
                }
                if (config.type === 'array' && !Array.isArray(value)) {
                    errors.push(`${field} must be an array`);
                }
            }
            
            // Custom validator
            if (value !== undefined && config.validator && !validate(config.validator, value)) {
                errors.push(`${field} is invalid`);
            }
            
            // Min/max length
            if (value !== undefined && typeof value === 'string') {
                if (config.minLength && value.length < config.minLength) {
                    errors.push(`${field} must be at least ${config.minLength} characters`);
                }
                if (config.maxLength && value.length > config.maxLength) {
                    errors.push(`${field} must be at most ${config.maxLength} characters`);
                }
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }
        
        next();
    };
}

// Brute force protection
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function bruteForceProtection(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.body.email || ''}`;
    
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    
    // Reset if lockout period has passed
    if (Date.now() - attempts.firstAttempt > LOCKOUT_TIME) {
        attempts.count = 0;
        attempts.firstAttempt = Date.now();
    }
    
    if (attempts.count >= MAX_ATTEMPTS) {
        const remainingTime = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.firstAttempt)) / 1000 / 60);
        return res.status(429).json({ 
            error: 'Too many login attempts', 
            retryAfter: remainingTime 
        });
    }
    
    // Store the attempt tracker for use after authentication
    req.loginAttemptKey = key;
    next();
}

function recordFailedAttempt(key) {
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;
    loginAttempts.set(key, attempts);
}

function clearFailedAttempts(key) {
    loginAttempts.delete(key);
}

// Note content encryption (for sensitive notes)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Security headers middleware (supplement to helmet)
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
}

// Audit logging
function auditLog(action, userId, details = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        userId,
        details,
        ip: details.ip || 'unknown'
    };
    
    // In production, write to secure audit log storage
    console.log('[AUDIT]', JSON.stringify(logEntry));
}

module.exports = {
    sanitizeMiddleware,
    sanitizeInput,
    csrfProtection,
    setCsrfToken,
    validateBody,
    validate,
    bruteForceProtection,
    recordFailedAttempt,
    clearFailedAttempts,
    encrypt,
    decrypt,
    securityHeaders,
    auditLog
};
