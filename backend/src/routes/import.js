const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const EvernoteImporter = require('../services/evernoteImporter');

const router = express.Router();
router.use(authenticateToken);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/temp');
        fs.mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir));
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.enex')) {
            cb(null, true);
        } else {
            cb(new Error('Only .enex files are allowed'), false);
        }
    }
});

// Import from Evernote .enex file
router.post('/evernote', upload.single('file'), async (req, res) => {
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        filePath = req.file.path;

        const importer = new EvernoteImporter(db, req.user.id);
        const result = await importer.importFromFile(filePath);

        // Clean up temp file
        await fs.unlink(filePath).catch(() => {});

        res.json({
            success: true,
            message: `Imported ${result.imported} notes`,
            imported: result.imported,
            tags: result.tags,
            errors: result.errors.length > 0 ? result.errors : undefined
        });
    } catch (err) {
        // Clean up temp file on error
        if (filePath) {
            await fs.unlink(filePath).catch(() => {});
        }

        console.error('Evernote import error:', err);
        res.status(500).json({ 
            error: 'Import failed', 
            message: err.message 
        });
    }
});

// Import from raw ENEX content (for pasting XML directly)
router.post('/evernote/raw', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'No content provided' });
        }

        const importer = new EvernoteImporter(db, req.user.id);
        const result = await importer.importFromString(content);

        res.json({
            success: true,
            message: `Imported ${result.imported} notes`,
            imported: result.imported,
            tags: result.tags,
            errors: result.errors.length > 0 ? result.errors : undefined
        });
    } catch (err) {
        console.error('Evernote raw import error:', err);
        res.status(500).json({ 
            error: 'Import failed', 
            message: err.message 
        });
    }
});

// Get import status/history (optional feature)
router.get('/history', async (req, res) => {
    try {
        // Get notes imported from Evernote
        const result = await db.query(
            `SELECT COUNT(*) as count, MIN(created_at) as first_import, MAX(created_at) as last_import
             FROM notes 
             WHERE user_id = $1 AND evernote_guid IS NOT NULL`,
            [req.user.id]
        );

        res.json({
            evernote: {
                total_imported: parseInt(result.rows[0].count),
                first_import: result.rows[0].first_import,
                last_import: result.rows[0].last_import
            }
        });
    } catch (err) {
        console.error('Import history error:', err);
        res.status(500).json({ error: 'Failed to get import history' });
    }
});

module.exports = router;
