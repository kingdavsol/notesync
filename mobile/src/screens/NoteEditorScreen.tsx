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
import Icon from 'react-native-vector-icons/Feather';

import { api } from '../services/api';
import { MainStackParamList } from '../navigation/MainNavigator';
import VoiceRecorder from '../components/VoiceRecorder';

type RouteProps = RouteProp<MainStackParamList, 'NoteEditor'>;

interface Note {
  id?: number;
  title: string;
  content: string;
  folder_id?: number;
  is_pinned: boolean;
  tags: { id: number; name: string }[];
}

export default function NoteEditorScreen() {
  const [note, setNote] = useState<Note>({
    title: '',
    content: '',
    is_pinned: false,
    tags: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { noteId, folderId } = route.params || {};
  const contentRef = useRef<TextInput>(null);

  useEffect(() => {
    if (noteId) {
      loadNote();
    } else if (folderId) {
      setNote(prev => ({ ...prev, folder_id: folderId }));
    }
  }, [noteId, folderId]);

  async function loadNote() {
    setLoading(true);
    try {
      const data = await api.getNote(noteId!);
      setNote(data);
    } catch (err) {
      console.error('Failed to load note:', err);
      Alert.alert('Error', 'Failed to load note');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function saveNote() {
    if (!note.title.trim() && !note.content.trim()) {
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      const noteData = {
        title: note.title || 'Untitled',
        content: note.content,
        folder_id: note.folder_id,
        is_pinned: note.is_pinned,
      };

      if (note.id) {
        await api.updateNote(note.id, noteData);
      } else {
        await api.createNote(noteData);
      }
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save note:', err);
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    if (!note.id) return;

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
              await api.deleteNote(note.id!);
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
    setNote(prev => ({ ...prev, is_pinned: !prev.is_pinned }));
  }

  function handleTranscription(text: string) {
    // Append transcribed text to content
    setNote(prev => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${text}` : text,
    }));
    setShowVoiceRecorder(false);
  }

  // Set up header buttons
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={togglePin} style={styles.headerButton}>
            <Icon
              name={note.is_pinned ? 'bookmark' : 'bookmark'}
              size={20}
              color={note.is_pinned ? '#fff' : 'rgba(255,255,255,0.7)'}
            />
          </TouchableOpacity>
          {note.id && (
            <TouchableOpacity onPress={deleteNote} style={styles.headerButton}>
              <Icon name="trash-2" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={saveNote}
            style={styles.headerButton}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="check" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      ),
      title: note.id ? 'Edit Note' : 'New Note',
    });
  }, [note.is_pinned, note.id, saving]);

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
          value={note.title}
          onChangeText={title => setNote(prev => ({ ...prev, title }))}
          returnKeyType="next"
          onSubmitEditing={() => contentRef.current?.focus()}
        />

        <TextInput
          ref={contentRef}
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor="#999"
          value={note.content}
          onChangeText={content => setNote(prev => ({ ...prev, content }))}
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
