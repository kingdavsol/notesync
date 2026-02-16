import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/with-observables';
import Icon from 'react-native-vector-icons/Feather';

import { database } from '../models';
import { Note } from '../models';
import { useSync } from '../hooks/useSync';
import { MainStackParamList } from '../navigation/MainNavigator';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface NotesScreenInnerProps {
  notes: Note[];
}

function NotesScreenInner({ notes }: NotesScreenInnerProps) {
  const [search, setSearch] = useState('');
  const { isOnline, isSyncing, sync } = useSync();
  const navigation = useNavigation<NavigationProp>();

  const handleRefresh = useCallback(async () => {
    await sync();
  }, [sync]);

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  }

  function getSyncStatusIcon(syncStatus: string) {
    if (syncStatus === 'synced') {
      return <View style={[styles.syncIndicator, styles.syncedIndicator]} />;
    }
    if (syncStatus === 'pending') {
      return <View style={[styles.syncIndicator, styles.pendingIndicator]} />;
    }
    if (syncStatus === 'conflict') {
      return <Icon name="alert-triangle" size={14} color="#ff9800" />;
    }
    return null;
  }

  function renderNote({ item }: { item: Note }) {
    const preview = stripHtml(item.contentPlain || item.content).substring(0, 100);

    return (
      <TouchableOpacity
        style={styles.noteCard}
        onPress={() => navigation.navigate('NoteEditor', { noteId: item.id })}
      >
        <View style={styles.noteHeader}>
          <Text style={styles.noteTitle} numberOfLines={1}>
            {item.isPinned && <Icon name="pin" size={14} color="#2dbe60" />}
            {' '}
            {item.title}
          </Text>
          <View style={styles.noteHeaderRight}>
            {getSyncStatusIcon(item.syncStatus)}
            {item.offlineEnabled && (
              <Icon name="cloud-off" size={14} color="#666" style={{ marginLeft: 8 }} />
            )}
          </View>
        </View>

        <Text style={styles.notePreview} numberOfLines={2}>
          {preview || 'No content'}
        </Text>

        <View style={styles.noteMeta}>
          <Text style={styles.noteDate}>{formatDate(item.updatedAt.toISOString())}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      {!isOnline && (
        <View style={styles.offlineBar}>
          <Icon name="wifi-off" size={14} color="#fff" />
          <Text style={styles.offlineText}>Offline</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="x" size={18} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Notes List */}
      <FlatList
        data={notes}
        renderItem={renderNote}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            colors={['#2dbe60']}
            tintColor="#2dbe60"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="file-text" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {search ? 'No notes found' : 'No notes yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {search ? 'Try a different search' : 'Tap + to create your first note'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NoteEditor', {})}
      >
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// Observable wrapper to subscribe to database changes
const enhance = withObservables([], () => ({
  notes: database.collections
    .get<Note>('notes')
    .query(
      Q.where('deleted_at', null),
      Q.sortBy('is_pinned', Q.desc),
      Q.sortBy('updated_at', Q.desc)
    )
    .observe(),
}));

export default enhance(NotesScreenInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#ff9800',
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  syncIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncedIndicator: {
    backgroundColor: '#2dbe60',
  },
  pendingIndicator: {
    backgroundColor: '#ff9800',
  },
  notePreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  noteFolder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteFolderText: {
    fontSize: 12,
    color: '#666',
  },
  noteTags: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(45, 190, 96, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 11,
    color: '#2dbe60',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2dbe60',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2dbe60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
