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
  Image,
  Modal,
  FlatList,
  Share,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Q } from '@nozbe/watermelondb';
import { database, Note } from '../models';
import Tag from '../models/Tag';
import NoteTag from '../models/NoteTag';
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
  const [images, setImages] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  // Checklist toggle mode
  const [checklistMode, setChecklistMode] = useState(false);
  // Formatting toolbar visibility (shows when content is focused)
  const [formattingBarVisible, setFormattingBarVisible] = useState(false);

  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { noteId, folderId } = route.params || {};
  const contentRef = useRef<TextInput>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const isMountedRef = useRef(true);
  // Track text selection for formatting
  const selectionRef = useRef({ start: 0, end: 0 });
  const { markNoteForSync } = useSync();

  useEffect(() => {
    loadTags();
    if (noteId) {
      loadNote();
    }
  }, [noteId]);

  async function loadTags() {
    try {
      const tags = await database.collections.get<Tag>('tags').query().fetch();
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }

  async function loadNote() {
    setLoading(true);
    try {
      const noteRecord = await database.collections.get<Note>('notes').find(noteId!);
      setNote(noteRecord);
      setTitle(noteRecord.title);
      setIsPinned(noteRecord.isPinned);

      const { text, imgs } = parseContent(noteRecord.content);
      setContent(text);
      setImages(imgs);

      const noteTags = await noteRecord.noteTags.fetch();
      setSelectedTagIds(new Set(noteTags.map(nt => nt.tagId)));
    } catch (err) {
      console.error('Failed to load note:', err);
      Alert.alert('Error', 'Failed to load note');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  function buildContent(text: string, imgs: string[]): string {
    if (imgs.length === 0) return text;
    return text + imgs.map(img => `\n__IMG__${img}`).join('');
  }

  function parseContent(raw: string): { text: string; imgs: string[] } {
    const parts = raw.split('\n__IMG__');
    return {
      text: parts[0] || '',
      imgs: parts.slice(1),
    };
  }

  // Keep saveRef current so unmount effect can call the latest saveNote closure
  useEffect(() => {
    saveRef.current = saveNote;
  });

  // On unmount: cancel pending debounce and save immediately
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        saveRef.current();
      }
    };
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    if (!note && !title && !content && images.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveRef.current();
    }, 1000);
  }, [title, content, isPinned, images]);

  async function saveNote() {
    if (!title.trim() && !content.trim() && images.length === 0) return;

    try {
      let savedNoteId: string;
      const fullContent = buildContent(content, images);

      await database.write(async () => {
        if (note) {
          await note.update(n => {
            n.title = title || 'Untitled';
            n.content = fullContent;
            n.contentPlain = stripMarkdown(content);
            n.isPinned = isPinned;
            n.syncStatus = 'pending';
            n.updatedAt = new Date();
          });
          savedNoteId = note.id;
        } else {
          const newNote = await database.collections.get<Note>('notes').create(n => {
            n.title = title || 'Untitled';
            n.content = fullContent;
            n.contentPlain = stripMarkdown(content);
            n.folderId = folderId || null;
            n.isPinned = isPinned;
            n.offlineEnabled = false;
            n.syncStatus = 'pending';
            n.updatedAt = new Date();
          });
          if (isMountedRef.current) setNote(newNote);
          savedNoteId = newNote.id;
        }
      });

      await markNoteForSync(savedNoteId!);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }

  async function saveNoteTags(noteId: string) {
    try {
      const existing = await database.collections
        .get<NoteTag>('note_tags')
        .query(Q.where('note_id', noteId))
        .fetch();

      await database.write(async () => {
        for (const nt of existing) {
          await nt.destroyPermanently();
        }
        for (const tagId of selectedTagIds) {
          await database.collections.get<NoteTag>('note_tags').create(nt => {
            nt.noteId = noteId;
            nt.tagId = tagId;
          });
        }
      });
    } catch (err) {
      console.error('Failed to save tags:', err);
    }
  }

  async function createAndSelectTag() {
    const name = newTagName.trim();
    if (!name) return;

    try {
      let tag: Tag;
      const existing = await database.collections
        .get<Tag>('tags')
        .query(Q.where('name', name))
        .fetch();

      if (existing.length > 0) {
        tag = existing[0];
      } else {
        await database.write(async () => {
          tag = await database.collections.get<Tag>('tags').create(t => {
            t.name = name;
          });
        });
        setAllTags(prev => [...prev, tag]);
      }

      setSelectedTagIds(prev => new Set([...prev, tag!.id]));
      setNewTagName('');
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  }

  async function deleteNote() {
    if (!note) return;

    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const id = note.id;
            await database.write(async () => {
              await note.update(n => {
                n.deletedAt = new Date();
                n.syncStatus = 'pending';
              });
            });
            await markNoteForSync(id);
            navigation.goBack();
          } catch (err) {
            console.error('Failed to delete note:', err);
            Alert.alert('Error', 'Failed to delete note');
          }
        },
      },
    ]);
  }

  function togglePin() {
    setIsPinned(prev => !prev);
  }

  async function shareNote() {
    try {
      await Share.share({
        title: title || 'Untitled',
        message: `${title || 'Untitled'}\n\n${content}`,
      });
    } catch (_) {}
  }

  // Strip markdown and HTML for plain text storage
  function stripMarkdown(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/==([^=]+)==/g, '$1')
      .replace(/^#{1,6}\s/gm, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function handleTranscription(text: string) {
    setContent(prev => (prev ? `${prev}\n\n${text}` : text));
    setShowVoiceRecorder(false);
  }

  // ─── Checklist mode ───────────────────────────────────────────
  function toggleChecklistMode() {
    const next = !checklistMode;
    setChecklistMode(next);
    if (next) {
      // Seed first checkbox if content area is empty or ends with newline
      setContent(prev => {
        if (prev === '' || prev.endsWith('\n')) return prev + '☐ ';
        return prev + '\n☐ ';
      });
      contentRef.current?.focus();
    }
  }

  function handleContentChange(newText: string) {
    if (checklistMode) {
      // Detect Enter pressed at end: new text is 1 char longer and ends with \n
      if (newText.length === content.length + 1 && newText.endsWith('\n')) {
        setContent(newText + '☐ ');
        return;
      }
      // Detect Enter inserted anywhere (pasting with newline, etc.)
      if (newText.length > content.length) {
        const added = newText.slice(content.length);
        if (added.includes('\n')) {
          const enhanced = newText.replace(/\n(?!☐ |☑ )/g, '\n☐ ');
          setContent(enhanced);
          return;
        }
      }
    }
    setContent(newText);
  }

  // Tap ☐ to toggle it to ☑ (and vice versa) by replacing at cursor position
  function handleCheckboxTap(pos: number) {
    const char = content[pos];
    if (char === '☐') {
      setContent(content.substring(0, pos) + '☑' + content.substring(pos + 1));
    } else if (char === '☑') {
      setContent(content.substring(0, pos) + '☐' + content.substring(pos + 1));
    }
  }

  // ─── Formatting helpers ───────────────────────────────────────
  function applyFormat(before: string, after: string = before) {
    const { start, end } = selectionRef.current;
    const selected = content.substring(start, end);
    const newContent =
      content.substring(0, start) +
      before +
      (selected || 'text') +
      after +
      content.substring(end);
    setContent(newContent);
    contentRef.current?.focus();
  }

  function applyLinePrefix(prefix: string) {
    const { start } = selectionRef.current;
    // Find the start of the current line
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const line = content.substring(lineStart);
    // Toggle: if line already starts with this prefix, remove it
    if (line.startsWith(prefix)) {
      setContent(
        content.substring(0, lineStart) + line.substring(prefix.length)
      );
    } else {
      setContent(content.substring(0, lineStart) + prefix + line);
    }
    contentRef.current?.focus();
  }

  // ─── Image picker ─────────────────────────────────────────────
  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant photo library access to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImages(prev => [...prev, result.assets[0].base64!]);
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImages(prev => [...prev, result.assets[0].base64!]);
    }
  }

  function removeImage(index: number) {
    Alert.alert('Remove Image', 'Remove this image from the note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setImages(prev => prev.filter((_, i) => i !== index)),
      },
    ]);
  }

  // ─── Sync status display ──────────────────────────────────────
  function getSyncStatusText(): string {
    if (!note) return '';
    if (note.syncStatus === 'synced') return 'Synced';
    if (note.syncStatus === 'pending') return 'Pending';
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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          {note && (
            <Text style={[styles.syncStatus, { color: getSyncStatusColor() }]}>
              {getSyncStatusText()}
            </Text>
          )}
          <TouchableOpacity onPress={shareNote} style={styles.headerButton}>
            <Icon name="share-2" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePin} style={styles.headerButton}>
            <Icon
              name="bookmark"
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
  }, [isPinned, note, note?.syncStatus, title, content]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2dbe60" />
      </View>
    );
  }

  const selectedTags = allTags.filter(t => selectedTagIds.has(t.id));

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

        {/* Selected tags display */}
        {selectedTags.length > 0 && (
          <View style={styles.tagsRow}>
            {selectedTags.map(tag => (
              <TouchableOpacity
                key={tag.id}
                style={styles.tagChip}
                onPress={() => {
                  setSelectedTagIds(prev => {
                    const next = new Set(prev);
                    next.delete(tag.id);
                    return next;
                  });
                }}
              >
                <Icon name="tag" size={11} color="#2dbe60" />
                <Text style={styles.tagChipText}>{tag.name}</Text>
                <Icon name="x" size={11} color="#2dbe60" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput
          ref={contentRef}
          style={styles.contentInput}
          placeholder={checklistMode ? '☐ First item...' : 'Start writing...'}
          placeholderTextColor="#999"
          value={content}
          onChangeText={handleContentChange}
          onSelectionChange={e => {
            selectionRef.current = e.nativeEvent.selection;
          }}
          onFocus={() => setFormattingBarVisible(true)}
          onBlur={() => setFormattingBarVisible(false)}
          multiline
          textAlignVertical="top"
        />

        {/* Attached images */}
        {images.length > 0 && (
          <ScrollView horizontal style={styles.imagesRow} showsHorizontalScrollIndicator={false}>
            {images.map((b64, i) => (
              <TouchableOpacity key={i} onLongPress={() => removeImage(i)}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${b64}` }}
                  style={styles.thumbnail}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {images.length > 0 && (
          <Text style={styles.imageTip}>Long-press an image to remove it</Text>
        )}
      </ScrollView>

      {/* ─── Formatting toolbar (visible when content is focused) ── */}
      {formattingBarVisible && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.formattingBar}
          contentContainerStyle={styles.formattingBarContent}
          keyboardShouldPersistTaps="always"
        >
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyFormat('**', '**')}
          >
            <Text style={styles.fmtBtnTextBold}>B</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyFormat('*', '*')}
          >
            <Text style={styles.fmtBtnTextItalic}>I</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyFormat('<u>', '</u>')}
          >
            <Text style={styles.fmtBtnTextUnderline}>U</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyFormat('~~', '~~')}
          >
            <Text style={styles.fmtBtnTextStrike}>S</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyFormat('==', '==')}
          >
            <Text style={[styles.fmtBtnText, { backgroundColor: '#fff59d', paddingHorizontal: 3, borderRadius: 2 }]}>H</Text>
          </TouchableOpacity>
          <View style={styles.fmtDivider} />
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyLinePrefix('# ')}
          >
            <Text style={styles.fmtBtnText}>H1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyLinePrefix('## ')}
          >
            <Text style={styles.fmtBtnText}>H2</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyLinePrefix('> ')}
          >
            <Icon name="corner-down-right" size={16} color="#555" />
          </TouchableOpacity>
          <View style={styles.fmtDivider} />
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyLinePrefix('• ')}
          >
            <Icon name="list" size={16} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fmtBtn}
            onPress={() => applyLinePrefix('1. ')}
          >
            <Icon name="hash" size={16} color="#555" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ─── Media + actions toolbar ─────────────────────────────── */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => setShowVoiceRecorder(true)}>
          <Icon name="mic" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={pickFromGallery}>
          <Icon name="image" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={pickFromCamera}>
          <Icon name="camera" size={22} color="#666" />
        </TouchableOpacity>
        {/* Checklist toggle — green when active */}
        <TouchableOpacity
          style={[styles.toolbarButton, checklistMode && styles.toolbarButtonActive]}
          onPress={toggleChecklistMode}
        >
          <Icon
            name="check-square"
            size={22}
            color={checklistMode ? '#2dbe60' : '#666'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => setShowTagModal(true)}>
          <Icon name="tag" size={22} color={selectedTagIds.size > 0 ? '#2dbe60' : '#666'} />
        </TouchableOpacity>
      </View>

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onTranscription={handleTranscription}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Tag Picker Modal */}
      <Modal
        visible={showTagModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          saveNoteTags(note?.id || '');
          setShowTagModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.tagModalOverlay}
          activeOpacity={1}
          onPress={() => {
            saveNoteTags(note?.id || '');
            setShowTagModal(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.tagModalSheet}>
            <View style={styles.tagModalHandle} />
            <Text style={styles.tagModalTitle}>Tags</Text>

            <View style={styles.newTagRow}>
              <TextInput
                style={styles.newTagInput}
                placeholder="New tag name..."
                placeholderTextColor="#999"
                value={newTagName}
                onChangeText={setNewTagName}
                onSubmitEditing={createAndSelectTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.newTagButton} onPress={createAndSelectTag}>
                <Icon name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={allTags}
              keyExtractor={item => item.id}
              style={styles.tagList}
              renderItem={({ item }) => {
                const selected = selectedTagIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.tagRow, selected && styles.tagRowSelected]}
                    onPress={() => {
                      setSelectedTagIds(prev => {
                        const next = new Set(prev);
                        if (selected) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                  >
                    <Icon name="tag" size={16} color={selected ? '#2dbe60' : '#999'} />
                    <Text style={[styles.tagRowText, selected && styles.tagRowTextSelected]}>
                      {item.name}
                    </Text>
                    {selected && <Icon name="check" size={16} color="#2dbe60" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.tagEmptyText}>No tags yet — create one above</Text>
              }
            />

            <TouchableOpacity
              style={styles.tagDoneButton}
              onPress={() => {
                saveNoteTags(note?.id || '');
                setShowTagModal(false);
              }}
            >
              <Text style={styles.tagDoneText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    padding: 16,
    paddingBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45,190,96,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  tagChipText: { fontSize: 12, color: '#2dbe60', fontWeight: '500' },
  contentInput: {
    fontSize: 16,
    color: '#333',
    padding: 16,
    paddingTop: 8,
    minHeight: 300,
    lineHeight: 24,
  },
  imagesRow: { paddingHorizontal: 16, paddingVertical: 8 },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  imageTip: { fontSize: 11, color: '#bbb', textAlign: 'center', paddingBottom: 4 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { padding: 8, marginLeft: 8 },
  syncStatus: { fontSize: 12, fontWeight: '500', marginRight: 8 },
  // Formatting bar
  formattingBar: {
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    backgroundColor: '#f5f5f5',
    maxHeight: 44,
  },
  formattingBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 44,
  },
  fmtBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
  },
  fmtBtnText: { fontSize: 14, color: '#333', fontWeight: '500' },
  fmtBtnTextBold: { fontSize: 15, color: '#333', fontWeight: '900' },
  fmtBtnTextItalic: { fontSize: 15, color: '#333', fontStyle: 'italic', fontWeight: '500' },
  fmtBtnTextUnderline: { fontSize: 15, color: '#333', textDecorationLine: 'underline', fontWeight: '600' },
  fmtBtnTextStrike: { fontSize: 15, color: '#333', textDecorationLine: 'line-through', fontWeight: '500' },
  fmtDivider: { width: 1, height: 20, backgroundColor: '#ddd', marginHorizontal: 4 },
  // Media toolbar
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolbarButton: { padding: 12, marginRight: 8 },
  toolbarButtonActive: {
    backgroundColor: 'rgba(45, 190, 96, 0.1)',
    borderRadius: 8,
  },
  // Tag modal
  tagModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  tagModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  tagModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  tagModalTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 16 },
  newTagRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  newTagInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  newTagButton: {
    backgroundColor: '#2dbe60',
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagList: { maxHeight: 240 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 12,
    marginBottom: 4,
  },
  tagRowSelected: { backgroundColor: 'rgba(45,190,96,0.08)' },
  tagRowText: { flex: 1, fontSize: 15, color: '#333' },
  tagRowTextSelected: { color: '#2dbe60', fontWeight: '500' },
  tagEmptyText: { color: '#aaa', textAlign: 'center', padding: 20 },
  tagDoneButton: {
    backgroundColor: '#2dbe60',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  tagDoneText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
