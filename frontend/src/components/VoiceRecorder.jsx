import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X, Loader, AlertCircle, Volume2 } from 'lucide-react';

export default function VoiceRecorder({ onTranscription, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  // Check for browser support
  const isSupported = 'mediaDevices' in navigator && 'MediaRecorder' in window;
  const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function startRecording() {
    setError('');
    setTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Visualize audio level
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      function updateLevel() {
        if (!isRecording) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      }

      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start visualization
      updateLevel();

      // If speech recognition is available, use it for live transcription
      if (hasSpeechRecognition) {
        startSpeechRecognition();
      }

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone access in your browser settings.'
        : 'Failed to start recording. Please check your microphone.');
    }
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(prev => {
        if (finalTranscript) {
          return prev + finalTranscript + ' ';
        }
        return prev;
      });
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.start();

    // Store reference to stop later
    mediaRecorderRef.current.recognition = recognition;
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();

      // Stop speech recognition if running
      if (mediaRecorderRef.current.recognition) {
        mediaRecorderRef.current.recognition.stop();
      }
    }

    setIsRecording(false);
    setAudioLevel(0);
  }

  async function processRecording() {
    stopRecording();
    setIsProcessing(true);

    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // If we have a transcript from speech recognition, use it
      if (transcript.trim()) {
        onTranscription(transcript.trim());
        return;
      }

      // Otherwise, if no speech recognition, show what we recorded
      // In production, you would send this to a transcription API like Whisper

      // For demo purposes, create a note indicating voice was recorded
      const duration = formatTime(recordingTime);
      onTranscription(`[Voice note recorded - Duration: ${duration}]\n\nNote: For full transcription, enable speech recognition in your browser or connect to a transcription service.`);

    } catch (err) {
      console.error('Failed to process recording:', err);
      setError('Failed to process recording');
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  }

  function cancelRecording() {
    stopRecording();
    setRecordingTime(0);
    setTranscript('');
    onClose();
  }

  if (!isSupported) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.header}>
            <h3 style={styles.title}>Voice Recording</h3>
            <button style={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div style={styles.errorContainer}>
            <AlertCircle size={48} color="#dc3545" />
            <p style={styles.errorText}>
              Voice recording is not supported in your browser.
              Please try using Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {isProcessing ? 'Processing...' : isRecording ? 'Recording' : 'Voice Note'}
          </h3>
          <button style={styles.closeBtn} onClick={cancelRecording}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {error ? (
            <div style={styles.errorContainer}>
              <AlertCircle size={48} color="#dc3545" />
              <p style={styles.errorText}>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => { setError(''); startRecording(); }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Recording visualization */}
              <div style={styles.visualizer}>
                <div
                  style={{
                    ...styles.recordButton,
                    ...(isRecording && styles.recordButtonActive),
                    ...(isProcessing && styles.recordButtonProcessing),
                    transform: `scale(${1 + audioLevel * 0.3})`
                  }}
                  onClick={isRecording ? processRecording : startRecording}
                >
                  {isProcessing ? (
                    <Loader size={32} className="spin" />
                  ) : isRecording ? (
                    <Square size={32} />
                  ) : (
                    <Mic size={32} />
                  )}
                </div>

                {isRecording && (
                  <div style={styles.levelBars}>
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.levelBar,
                          height: `${20 + audioLevel * 60 * (Math.random() * 0.5 + 0.5)}px`,
                          opacity: audioLevel > 0.1 ? 1 : 0.3
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Timer */}
              {isRecording && (
                <div style={styles.timer}>{formatTime(recordingTime)}</div>
              )}

              {/* Live transcript */}
              {transcript && (
                <div style={styles.transcriptBox}>
                  <Volume2 size={14} style={{ marginRight: 8, flexShrink: 0 }} />
                  <p style={styles.transcriptText}>{transcript}</p>
                </div>
              )}

              {/* Instructions */}
              <p style={styles.hint}>
                {isProcessing
                  ? 'Transcribing your voice note...'
                  : isRecording
                  ? 'Tap the button to stop recording'
                  : 'Tap the microphone to start recording'}
              </p>

              {!isRecording && !isProcessing && (
                <div style={styles.info}>
                  <AlertCircle size={14} />
                  <span>
                    Voice notes will be transcribed to text and added to your note.
                    {hasSpeechRecognition && ' Live transcription is enabled.'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div style={styles.footer}>
          <button className="btn btn-ghost" onClick={cancelRecording}>
            Cancel
          </button>
          {isRecording && (
            <button className="btn btn-primary" onClick={processRecording}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '400px',
    margin: '16px',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    color: 'var(--text-muted)'
  },
  content: {
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  visualizer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  recordButton: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 4px 12px rgba(45, 190, 96, 0.3)'
  },
  recordButtonActive: {
    background: '#dc3545',
    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
  },
  recordButtonProcessing: {
    background: '#6c757d',
    boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)',
    cursor: 'default'
  },
  levelBars: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '80px'
  },
  levelBar: {
    width: '4px',
    background: '#dc3545',
    borderRadius: '2px',
    transition: 'height 0.1s ease'
  },
  timer: {
    fontSize: '48px',
    fontWeight: 300,
    color: '#dc3545',
    fontVariantNumeric: 'tabular-nums',
    marginBottom: '16px'
  },
  transcriptBox: {
    display: 'flex',
    alignItems: 'flex-start',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    marginBottom: '16px',
    width: '100%',
    maxHeight: '120px',
    overflow: 'auto'
  },
  transcriptText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5
  },
  hint: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    marginBottom: '16px'
  },
  info: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.5
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    textAlign: 'center'
  },
  errorText: {
    margin: 0,
    color: 'var(--text-secondary)',
    lineHeight: 1.5
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border)'
  }
};
