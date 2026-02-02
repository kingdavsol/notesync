import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  onClose: () => void;
}

// Note: In production, you would use:
// - react-native-audio-recorder-player for recording
// - @react-native-voice/voice for speech-to-text
// - Or a cloud API like Google Speech-to-Text, Whisper API

export default function VoiceRecorder({ onTranscription, onClose }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkPermission();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  async function checkPermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'NoteSync needs access to your microphone to record voice notes.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
      }
    } else {
      // iOS permissions are handled by the native module
      setHasPermission(true);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function startRecording() {
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to use voice recording.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsRecording(true);
    setRecordingTime(0);

    // In production, start actual recording here:
    // await audioRecorderPlayer.startRecorder();
    // or
    // Voice.start('en-US');
  }

  async function stopRecording() {
    setIsRecording(false);
    setIsProcessing(true);

    // In production:
    // 1. Stop recording: await audioRecorderPlayer.stopRecorder();
    // 2. Get the audio file path
    // 3. Send to transcription API
    // 4. Get transcription result

    // Simulating transcription process
    setTimeout(() => {
      // This would be replaced with actual transcription result
      const mockTranscription = `Voice note recorded at ${new Date().toLocaleTimeString()}. Duration: ${formatTime(recordingTime)}.`;

      setIsProcessing(false);
      onTranscription(mockTranscription);
    }, 1500);
  }

  function cancelRecording() {
    setIsRecording(false);
    setRecordingTime(0);
    onClose();
  }

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={cancelRecording}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={cancelRecording}>
            <Icon name="x" size={24} color="#666" />
          </TouchableOpacity>

          <Text style={styles.title}>
            {isProcessing ? 'Processing...' : isRecording ? 'Recording' : 'Tap to Record'}
          </Text>

          {isRecording && (
            <Text style={styles.timer}>{formatTime(recordingTime)}</Text>
          )}

          <Animated.View
            style={[
              styles.recordButtonContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                isProcessing && styles.recordButtonProcessing,
              ]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Icon name="loader" size={32} color="#fff" />
              ) : isRecording ? (
                <Icon name="square" size={32} color="#fff" />
              ) : (
                <Icon name="mic" size={32} color="#fff" />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.hint}>
            {isProcessing
              ? 'Transcribing your voice note...'
              : isRecording
              ? 'Tap to stop recording'
              : 'Tap the microphone to start'}
          </Text>

          {!isRecording && !isProcessing && (
            <View style={styles.infoBox}>
              <Icon name="info" size={16} color="#666" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Voice notes will be automatically transcribed to text and added to your note.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    color: '#dc3545',
    marginBottom: 24,
    fontVariant: ['tabular-nums'],
  },
  recordButtonContainer: {
    marginVertical: 24,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2dbe60',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2dbe60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: '#dc3545',
    shadowColor: '#dc3545',
  },
  recordButtonProcessing: {
    backgroundColor: '#6c757d',
    shadowColor: '#6c757d',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginHorizontal: 16,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
