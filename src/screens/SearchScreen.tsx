import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { debounce } from 'lodash';
import { Q } from '@nozbe/watermelondb';

import { api } from '../services/api';
import { database, Note } from '../models';
import { MainStackParamList } from '../navigation/MainNavigator';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface SearchResult {
  id: number;
  title: string;
  content: string;
  folder_name?: string;
  updated_at: string;
  match_context?: string;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }

      setLoading(true);
      setSearched(true);

      try {
        const data = await api.getNotes({ search: searchQuery });
        setResults(data.notes || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  function handleSearch(text: string) {
    setQuery(text);
    performSearch(text);
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <Text key={i} style={styles.highlight}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  }

  async function openNote(serverId: number) {
    // Look up local WatermelonDB record by server_id
    const matches = await database.collections
      .get<Note>('notes')
      .query(Q.where('server_id', serverId))
      .fetch();

    if (matches.length > 0) {
      navigation.navigate('NoteEditor', { noteId: matches[0].id });
    } else {
      // Note not yet synced locally — navigate anyway, NoteEditor handles miss gracefully
      navigation.navigate('NoteEditor', { noteId: serverId.toString() });
    }
  }

  function renderResult({ item }: { item: SearchResult }) {
    const preview = stripHtml(item.content).substring(0, 120);

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => openNote(item.id)}
      >
        <Text style={styles.resultTitle} numberOfLines={1}>
          {highlightMatch(item.title || 'Untitled', query)}
        </Text>
        <Text style={styles.resultPreview} numberOfLines={2}>
          {highlightMatch(preview || 'No content', query)}
        </Text>
        {item.folder_name && (
          <View style={styles.resultMeta}>
            <Icon name="folder" size={12} color="#666" />
            <Text style={styles.resultFolder}>{item.folder_name}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={handleSearch}
          autoFocus
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Icon name="x" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2dbe60" />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyContainer}>
                <Icon name="search" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>
                  Try different keywords or check your spelling
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="search" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Search your notes</Text>
                <Text style={styles.emptySubtext}>
                  Find notes by title, content, or tags
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    height: 48,
    marginLeft: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  resultCard: {
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
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  resultPreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultFolder: {
    fontSize: 12,
    color: '#666',
  },
  highlight: {
    backgroundColor: 'rgba(45, 190, 96, 0.2)',
    color: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
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
    textAlign: 'center',
  },
});
