const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname) || '.m4a'}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

router.post('/', authenticateToken, upload.single('audio'), async (req, res) => {
  const audioPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      language: 'en',
      response_format: 'json',
    });

    const text = transcription.text?.trim() || '';
    console.log(`Transcription complete: "${text.substring(0, 80)}"`);

    res.json({
      success: true,
      text,
      transcription: text,
    });

  } catch (error) {
    console.error('Transcription error:', error?.message || error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  } finally {
    if (audioPath) {
      fs.unlink(audioPath, err => {
        if (err) console.error('Failed to delete audio file:', err);
      });
    }
  }
});

// Get transcription status (for async processing)
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  res.json({ jobId: req.params.jobId, status: 'completed', progress: 100 });
});

module.exports = router;
