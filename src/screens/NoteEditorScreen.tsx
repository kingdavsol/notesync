import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather as Icon } from '@expo/vector-icons';
import { database, Note } from '../models';
import { useSync } from '../hooks/useSync';
import { MainStackParamList } from '../navigation/MainNavigator';
import VoiceRecorder from '../components/VoiceRecorder';

type RouteProps = RouteProp<MainStackParamList, 'NoteEditor'>;

export default function NoteEditorScreen() {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { noteId, folderId } = route.params || {};
  const contentRef = useRef<TextInput>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { markNoteForSync } = useSync();

  useEffect(() => {
    if (noteId) {
      loadNote();
    }
  }, [noteId]);

  async function loadNote() {
    setLoading(true);
    try {
      const noteRecord = await database.collections.get<Note>('notes').find(noteId!);
      setNote(noteRecord);
      setTitle(noteRecord.title);
      setContent(noteRecord.content);
      setIsPinned(noteRecord.isPinned);
    } catch (err) {
      console.error('Failed to load note:', err);
      Alert.alert('Error', 'Failed to load note');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  // Auto-save with debounce
  useEffect(() => {
    if (!note && !title && !content) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, isPinned]);

  async function saveNote() {
    if (!title.trim() && !content.trim()) {
      return;
    }

    try {
      let savedNoteId: string;

      await database.write(async () => {
        if (note) {
          // Update existing note
          await note.update(n => {
            n.title = title || 'Untitled';
            n.content = content;
            n.contentPlain = stripHtml(content);
            n.isPinned = isPinned;
            n.syncStatus = 'pending';
            n.updatedAt = new Date();
          });
          savedNoteId = note.id;
        } else {
          // Create new note
          const newNote = await database.collections.get<Note>('notes').create(n => {
            n.title = title || 'Untitled';
            n.content = content;
            n.contentPlain = stripHtml(content);
            n.folderId = folderId || null;
            n.isPinned = isPinned;
            n.offlineEnabled = false;
            n.syncStatus = 'pending';
            n.updatedAt = new Date();
          });
          setNote(newNote);
          savedNoteId = newNote.id;
        }
      });

      // markNoteForSync calls database.write() internally — must be OUTSIDE write block
      await markNoteForSync(savedNoteId!);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }

  async function deleteNote() {
    if (!note) return;

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const noteId = note.id;
              await database.write(async () => {
                await note.update(n => {
                  n.deletedAt = new Date();
                  n.syncStatus = 'pending';
                });
              });
              // markNoteForSync calls database.write() — must be OUTSIDE write block
              await markNoteForSync(noteId);
              navigation.goBack();
            } catch (err) {
              console.error('Failed to delete note:', err);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  }

  function togglePin() {
    setIsPinned(prev => !prev);
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function handleTranscription(text: string) {
    // Append transcribed text to content
    setContent(prev => (prev ? `${prev}\n\n${text}` : text));
    setShowVoiceRecorder(false);
  }

  function getSyncStatusText(): string {
    if (!note) return '';
    if (note.syncStatus === 'synced') return 'Synced';
    if (note.syncStatus === 'pending') return 'Syncing...';
    if (note.syncStatus === 'conflict') return 'Conflict';
    return '';
  }

  function getSyncStatusColor(): string {
    if (!note) return '#999';
    if (note.syncStatus === 'synced') return '#2dbe60';
    if (note.syncStatus === 'pending') return '#ff9800';
    if (note.syncStatus === 'conflict') return '#f44336';
    return '#999';
  }

  // Set up header buttons
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          {note && (
            <Text style={[styles.syncStatus, { color: getSyncStatusColor() }]}>
              {getSyncStatusText()}
            </Text>
          )}
          <TouchableOpacity onPress={togglePin} style={styles.headerButton}>
            <Icon
              name={isPinned ? 'bookmark' : 'bookmark'}
              size={20}
              color={isPinned ? '#fff' : 'rgba(255,255,255,0.7)'}
            />
          </TouchableOpacity>
          {note && (
            <TouchableOpacity onPress={deleteNote} style={styles.headerButton}>
              <Icon name="trash-2" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>
      ),
      title: note ? 'Edit Note' : 'New Note',
    });
  }, [isPinned, note, note?.syncStatus]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2dbe60" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          onSubmitEditing={() => contentRef.current?.focus()}
        />

        <TextInput
          ref={contentRef}
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor="#999"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowVoiceRecorder(true)}
        >
          <Icon name="mic" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Icon name="image" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Icon name="camera" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Icon name="check-square" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Icon name="tag" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onTranscription={handleTranscription}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    padding: 16,
    paddingBottom: 8,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 16,
    paddingTop: 8,
    minHeight: 300,
    lineHeight: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  syncStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolbarButton: {
    padding: 12,
    marginRight: 8,
  },
});
