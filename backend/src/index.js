require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initializeWebSocket } = require('./websocket');

const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const foldersRoutes = require('./routes/folders');
const tagsRoutes = require('./routes/tags');
const syncRoutes = require('./routes/sync');
const importRoutes = require('./routes/import');
const drawingsRoutes = require('./routes/drawings');
const linksRoutes = require('./routes/links');
const searchRoutes = require('./routes/search');
const shareRoutes = require('./routes/share');
const remindersRoutes = require('./routes/reminders');
const templatesRoutes = require('./routes/templates');
const versionsRoutes = require('./routes/versions');
const transcribeRoutes = require('./routes/transcribe');

const { sanitizeMiddleware, securityHeaders } = require('./middleware/security');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize WebSocket for real-time collaboration
const io = initializeWebSocket(server);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware - Apply before other middleware
app.use(securityHeaders);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS - Strict configuration
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'],
    maxAge: 86400 // 24 hours
}));

// Rate limiting - Different limits for different endpoints
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Stricter for auth endpoints
    message: { error: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit uploads
    message: { error: 'Upload limit reached, please try again later' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/import', uploadLimiter);

// Body parsing with size limits
app.use(express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sanitize all inputs
app.use(sanitizeMiddleware);

// Static files for attachments (with security)
app.use('/uploads', (req, res, next) => {
    // Prevent directory traversal
    if (req.path.includes('..')) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}, express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/import', importRoutes);
app.use('/api/drawings', drawingsRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/versions', versionsRoutes);
app.use('/api/transcribe', transcribeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public help / legal pages ─────────────────────────────────────────────
const publicDir = path.join(__dirname, '../public');
app.get('/help',     (req, res) => res.sendFile(path.join(publicDir, 'help.html')));
app.get('/privacy',  (req, res) => res.sendFile(path.join(publicDir, 'privacy.html')));
app.get('/security', (req, res) => res.sendFile(path.join(publicDir, 'security.html')));
app.get('/terms',    (req, res) => res.sendFile(path.join(publicDir, 'terms.html')));
app.get('/contact',  (req, res) => res.sendFile(path.join(publicDir, 'contact.html')));
app.get('/disclosure', (req, res) => res.sendFile(path.join(publicDir, 'disclosure.html')));

// ── Contact form submission ───────────────────────────────────────────────
const fs = require('fs');
const contactLogPath = path.join(__dirname, '../../logs/contact.log');

app.post('/api/contact', (req, res) => {
    try {
        const { name, email, category, message } = req.body || {};
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'name, email, and message are required' });
        }
        const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            name: String(name).substring(0, 200),
            email: String(email).substring(0, 200),
            category: String(category || 'general').substring(0, 50),
            message: String(message).substring(0, 2000),
        });
        const logDir = path.dirname(contactLogPath);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(contactLogPath, entry + '\n');
        console.log(`[CONTACT] From: ${email} | Category: ${category}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Contact form error:', err);
        res.status(500).json({ error: 'Failed to submit message' });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

server.listen(PORT, () => {
    console.log(`NoteSync API running on port ${PORT}`);
    console.log(`WebSocket server ready for real-time collaboration`);
});

module.exports = { app, server, io };
