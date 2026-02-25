import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Switch,
  Modal,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { database } from '../models';
import { Q } from '@nozbe/watermelondb';
import {
  parseEnex,
  parseKeepJson,
  parseHtml,
  parsePlainText,
  findDuplicates,
  detectFileType,
} from '../utils/importParsers';

const ACCENT = '#2dbe60';

const SOURCE_OPTIONS = [
  { id: 'evernote', label: 'Evernote', icon: 'book', ext: '.enex', mime: '*/*' },
  { id: 'google-keep', label: 'Google Keep', icon: 'inbox', ext: '.json', mime: 'application/json' },
  { id: 'apple-notes', label: 'Apple Notes', icon: 'edit-3', ext: '.html', mime: 'text/html' },
  { id: 'onenote', label: 'OneNote', icon: 'layers', ext: '.html', mime: 'text/html' },
  { id: 'text', label: 'Text / Markdown', icon: 'file-text', ext: '.txt,.md', mime: 'text/*' },
];

export default function ImportScreen({ navigation }) {
  const [step, setStep] = useState('source'); // source | parsing | preview | importing | done
  const [selectedSource, setSelectedSource] = useState(null);
  const [parsedNotes, setParsedNotes] = useState([]);
  const [importStats, setImportStats] = useState({ notes: 0, folders: 0, tags: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeTrashed, setIncludeTrashed] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState(null);

  const pickAndParse = useCallback(async (source) => {
    try {
      setSelectedSource(source);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: source.id === 'text',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setStep('source');
        return;
      }

      setStep('parsing');

      const assets = result.assets || [result];
      let allNotes = [];

      for (const asset of assets) {
        const uri = asset.uri;
        const name = asset.name || 'unknown';
        const fileContent = await FileSystem.readAsStringAsync(uri);
        const fileType = detectFileType(name);

        let notes = [];
        switch (fileType) {
          case 'evernote':
            notes = parseEnex(fileContent);
            break;
          case 'google-keep':
            notes = parseKeepJson(fileContent);
            break;
          case 'html':
            notes = parseHtml(fileContent, name, source.id === 'onenote' ? 'onenote' : 'apple-notes');
            break;
          case 'text':
          case 'markdown':
            notes = parsePlainText(fileContent, name);
            break;
          default:
            // Try to detect from content
            if (fileContent.trim().startsWith('<')) {
              if (fileContent.includes('<en-export')) {
                notes = parseEnex(fileContent);
              } else {
                notes = parseHtml(fileContent, name, source.id);
              }
            } else if (fileContent.trim().startsWith('{') || fileContent.trim().startsWith('[')) {
              notes = parseKeepJson(fileContent);
            } else {
              notes = parsePlainText(fileContent, name);
            }
        }
        allNotes = allNotes.concat(notes);
      }

      if (allNotes.length === 0) {
        setError('No notes found in the selected file(s).');
        setStep('source');
        return;
      }

      // Filter Google Keep trashed/archived
      if (source.id === 'google-keep') {
        allNotes = allNotes.filter(n => {
          if (n.isTrashed && !includeTrashed) return false;
          if (n.isArchived && !includeArchived) return false;
          return true;
        });
      }

      // Check for duplicates against existing notes
      const existingNotes = await database.get('notes').query().fetch();
      const withDupeInfo = findDuplicates(allNotes, existingNotes);
      const dupes = withDupeInfo.filter(n => n.isDuplicate);

      setParsedNotes(withDupeInfo);
      setDuplicates(dupes);

      // Calculate stats
      const folders = new Set(withDupeInfo.filter(n => n.notebook).map(n => n.notebook));
      const tags = new Set(withDupeInfo.flatMap(n => n.tags || []));
      setImportStats({
        notes: withDupeInfo.length,
        folders: folders.size,
        tags: tags.size,
      });

      setStep('preview');
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to parse file');
      setStep('source');
    }
  }, [includeArchived, includeTrashed]);

  const toggleNote = (index) => {
    setParsedNotes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  };

  const toggleAll = () => {
    const allSelected = parsedNotes.every(n => n.selected);
    setParsedNotes(prev => prev.map(n => ({ ...n, selected: !allSelected })));
  };

  const doImport = useCallback(async () => {
    const toImport = parsedNotes.filter(n => n.selected);
    if (toImport.length === 0) {
      Alert.alert('Nothing to Import', 'Select at least one note to import.');
      return;
    }

    setStep('importing');
    setProgress({ current: 0, total: toImport.length });

    try {
      // Collect unique folders and tags
      const folderNames = [...new Set(toImport.filter(n => n.notebook).map(n => n.notebook))];
      const tagNames = [...new Set(toImport.flatMap(n => n.tags || []))];

      // Get existing folders and tags
      const existingFolders = await database.get('folders').query().fetch();
      const existingTags = await database.get('tags').query().fetch();

      const folderMap = new Map();
      existingFolders.forEach(f => folderMap.set(f.name.toLowerCase(), f.id));

      const tagMap = new Map();
      existingTags.forEach(t => tagMap.set(t.name.toLowerCase(), t.id));

      await database.write(async () => {
        // Create missing folders
        for (const fname of folderNames) {
          if (!folderMap.has(fname.toLowerCase())) {
            const folder = await database.get('folders').create(f => {
              f.name = fname;
              f.parentId = null;
            });
            folderMap.set(fname.toLowerCase(), folder.id);
          }
        }

        // Create missing tags (case-insensitive merge)
        for (const tname of tagNames) {
          if (!tagMap.has(tname.toLowerCase())) {
            const tag = await database.get('tags').create(t => {
              t.name = tname;
            });
            tagMap.set(tname.toLowerCase(), tag.id);
          }
        }

        // Import notes
        for (let i = 0; i < toImport.length; i++) {
          const n = toImport[i];

          const note = await database.get('notes').create(record => {
            record.title = n.title;
            record.content = n.content;
            record.contentPlain = n.content;
            record.folderId = n.notebook ? (folderMap.get(n.notebook.toLowerCase()) || null) : null;
            record.isPinned = n.isPinned || false;
            record.syncStatus = 'pending';
            record.offlineEnabled = false;
          });

          // Create note-tag associations
          if (n.tags && n.tags.length > 0) {
            for (const tagName of n.tags) {
              const tagId = tagMap.get(tagName.toLowerCase());
              if (tagId) {
                await database.get('note_tags').create(nt => {
                  nt.noteId = note.id;
                  nt.tagId = tagId;
                });
              }
            }
          }

          setProgress({ current: i + 1, total: toImport.length });
        }
      });

      setStep('done');
    } catch (err) {
      console.error('Import failed:', err);
      Alert.alert('Import Failed', err.message || 'An error occurred during import.');
      setStep('preview');
    }
  }, [parsedNotes]);

  const renderSourceSelection = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="download" size={48} color={ACCENT} />
        <Text style={styles.headerTitle}>Import Notes</Text>
        <Text style={styles.headerSubtitle}>
          Import your notes from other apps
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Source</Text>
        <View style={styles.card}>
          {SOURCE_OPTIONS.map((source, idx) => (
            <React.Fragment key={source.id}>
              {idx > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.row}
                onPress={() => pickAndParse(source)}
              >
                <View style={styles.rowIcon}>
                  <Icon name={source.icon} size={20} color="#666" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{source.label}</Text>
                  <Text style={styles.rowSubtitle}>
                    {source.ext} files
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Google Keep options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Options</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="archive" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Include Archived</Text>
              <Text style={styles.rowSubtitle}>Import archived notes (Google Keep)</Text>
            </View>
            <Switch
              value={includeArchived}
              onValueChange={setIncludeArchived}
              trackColor={{ false: '#e0e0e0', true: 'rgba(45, 190, 96, 0.4)' }}
              thumbColor={includeArchived ? ACCENT : '#f4f4f4'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="trash-2" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Include Trashed</Text>
              <Text style={styles.rowSubtitle}>Import trashed notes (Google Keep)</Text>
            </View>
            <Switch
              value={includeTrashed}
              onValueChange={setIncludeTrashed}
              trackColor={{ false: '#e0e0e0', true: 'rgba(45, 190, 96, 0.4)' }}
              thumbColor={includeTrashed ? ACCENT : '#f4f4f4'}
            />
          </View>
        </View>
      </View>

      {error && (
        <View style={styles.section}>
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderParsing = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={styles.parsingText}>Parsing files...</Text>
    </View>
  );

  const renderPreview = () => {
    const selectedCount = parsedNotes.filter(n => n.selected).length;
    const allSelected = parsedNotes.every(n => n.selected);

    return (
      <View style={styles.container}>
        {/* Summary header */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{importStats.notes}</Text>
            <Text style={styles.summaryLabel}>Notes</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{importStats.folders}</Text>
            <Text style={styles.summaryLabel}>Folders</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{importStats.tags}</Text>
            <Text style={styles.summaryLabel}>Tags</Text>
          </View>
        </View>

        {duplicates.length > 0 && (
          <View style={styles.warningBanner}>
            <Icon name="alert-triangle" size={16} color="#856404" />
            <Text style={styles.warningText}>
              {duplicates.length} potential duplicate(s) found
            </Text>
          </View>
        )}

        {/* Select all toggle */}
        <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll}>
          <Icon
            name={allSelected ? 'check-square' : 'square'}
            size={20}
            color={allSelected ? ACCENT : '#999'}
          />
          <Text style={styles.selectAllText}>
            {allSelected ? 'Deselect All' : 'Select All'} ({selectedCount}/{parsedNotes.length})
          </Text>
        </TouchableOpacity>

        {/* Notes list */}
        <FlatList
          data={parsedNotes}
          keyExtractor={(_, i) => String(i)}
          style={styles.notesList}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.noteItem, item.isDuplicate && styles.noteItemDuplicate]}
              onPress={() => toggleNote(index)}
            >
              <Icon
                name={item.selected ? 'check-square' : 'square'}
                size={18}
                color={item.selected ? ACCENT : '#ccc'}
                style={styles.noteCheck}
              />
              <View style={styles.noteInfo}>
                <Text style={styles.noteTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.notePreview} numberOfLines={1}>
                  {item.content?.substring(0, 80) || 'Empty note'}
                </Text>
                <View style={styles.noteMeta}>
                  {item.notebook ? (
                    <View style={styles.badge}>
                      <Icon name="folder" size={10} color="#666" />
                      <Text style={styles.badgeText}>{item.notebook}</Text>
                    </View>
                  ) : null}
                  {(item.tags || []).slice(0, 3).map((t, i) => (
                    <View key={i} style={styles.badge}>
                      <Icon name="tag" size={10} color="#666" />
                      <Text style={styles.badgeText}>{t}</Text>
                    </View>
                  ))}
                  {item.isDuplicate && (
                    <View style={[styles.badge, styles.dupeBadge]}>
                      <Text style={styles.dupeBadgeText}>
                        {item.exactMatch ? 'Exact Duplicate' : 'Possible Duplicate'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Import button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.importButton, selectedCount === 0 && styles.importButtonDisabled]}
            onPress={doImport}
            disabled={selectedCount === 0}
          >
            <Icon name="download" size={20} color="#fff" />
            <Text style={styles.importButtonText}>
              Import {selectedCount} Note{selectedCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderImporting = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={styles.parsingText}>
        Importing {progress.current} of {progress.total}...
      </Text>
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` },
          ]}
        />
      </View>
    </View>
  );

  const renderDone = () => (
    <View style={styles.centerContainer}>
      <View style={styles.doneIcon}>
        <Icon name="check-circle" size={64} color={ACCENT} />
      </View>
      <Text style={styles.doneTitle}>Import Complete!</Text>
      <Text style={styles.doneSubtitle}>
        {progress.current} note{progress.current !== 1 ? 's' : ''} imported successfully
      </Text>
      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  switch (step) {
    case 'source': return renderSourceSelection();
    case 'parsing': return renderParsing();
    case 'preview': return renderPreview();
    case 'importing': return renderImporting();
    case 'done': return renderDone();
    default: return renderSourceSelection();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 8,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowIcon: {
    width: 32,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 60,
  },
  errorCard: {
    padding: 16,
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
  },
  errorText: {
    color: '#856404',
    fontSize: 14,
  },
  parsingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  // Preview styles
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: ACCENT,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    gap: 8,
  },
  warningText: {
    color: '#856404',
    fontSize: 13,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectAllText: {
    fontSize: 14,
    color: '#666',
  },
  notesList: {
    flex: 1,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  noteItemDuplicate: {
    backgroundColor: '#fffbe6',
  },
  noteCheck: {
    marginRight: 12,
    marginTop: 2,
  },
  noteInfo: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  notePreview: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  noteMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    color: '#666',
  },
  dupeBadge: {
    backgroundColor: '#fff3cd',
  },
  dupeBadgeText: {
    fontSize: 11,
    color: '#856404',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  importButtonDisabled: {
    backgroundColor: '#ccc',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarBg: {
    width: '80%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  doneIcon: {
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  doneSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 8,
  },
  doneButton: {
    marginTop: 32,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
