const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname) || '.webm'}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Transcribe audio file
// In production, this would integrate with:
// - OpenAI Whisper API
// - Google Cloud Speech-to-Text
// - AWS Transcribe
// - Azure Speech Services
router.post('/', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const duration = req.body.duration || 0;

    // TODO: Integrate with actual transcription service
    // Example with OpenAI Whisper:
    // const transcription = await openai.audio.transcriptions.create({
    //   file: fs.createReadStream(audioPath),
    //   model: 'whisper-1',
    //   language: 'en'
    // });

    // For now, return a placeholder response
    // In production, replace this with actual API call
    const mockTranscription = {
      text: `Voice note recorded (Duration: ${Math.round(duration)}s). To enable full transcription, configure a speech-to-text service like OpenAI Whisper, Google Speech-to-Text, or AWS Transcribe.`,
      confidence: 0.95,
      language: 'en',
      duration: duration
    };

    // Clean up the uploaded file after processing
    // In production, you might want to keep it for a while
    setTimeout(() => {
      fs.unlink(audioPath, (err) => {
        if (err) console.error('Failed to delete audio file:', err);
      });
    }, 60000); // Delete after 1 minute

    res.json({
      success: true,
      text: mockTranscription.text,
      transcription: mockTranscription.text,
      metadata: {
        confidence: mockTranscription.confidence,
        language: mockTranscription.language,
        duration: mockTranscription.duration
      }
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// Get transcription status (for async processing)
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  // For async transcription jobs (useful for long recordings)
  res.json({
    jobId: req.params.jobId,
    status: 'completed',
    progress: 100
  });
});

module.exports = router;
