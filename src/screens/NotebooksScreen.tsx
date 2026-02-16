import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';

import { api } from '../services/api';
import { MainStackParamList } from '../navigation/MainNavigator';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface Folder {
  id: number;
  name: string;
  note_count: number;
  created_at: string;
}

export default function NotebooksScreen() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    loadFolders();
  }, []);

  async function loadFolders() {
    try {
      const data = await api.getFolders();
      setFolders(data.folders || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFolders();
  }, []);

  async function createFolder() {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      await api.createFolder({ name: newFolderName.trim() });
      setNewFolderName('');
      setShowCreateModal(false);
      loadFolders();
    } catch (err) {
      console.error('Failed to create folder:', err);
      Alert.alert('Error', 'Failed to create notebook');
    }
  }

  async function updateFolder() {
    if (!editingFolder || !newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      await api.updateFolder(editingFolder.id, { name: newFolderName.trim() });
      setNewFolderName('');
      setEditingFolder(null);
      loadFolders();
    } catch (err) {
      console.error('Failed to update folder:', err);
      Alert.alert('Error', 'Failed to update notebook');
    }
  }

  function confirmDeleteFolder(folder: Folder) {
    Alert.alert(
      'Delete Notebook',
      `Are you sure you want to delete "${folder.name}"? Notes inside will be moved to the default notebook.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteFolder(folder.id);
              loadFolders();
            } catch (err) {
              console.error('Failed to delete folder:', err);
              Alert.alert('Error', 'Failed to delete notebook');
            }
          },
        },
      ]
    );
  }

  function openEditModal(folder: Folder) {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
  }

  function renderFolder({ item }: { item: Folder }) {
    return (
      <TouchableOpacity
        style={styles.folderCard}
        onPress={() => navigation.navigate('NoteEditor', { folderId: item.id })}
        onLongPress={() => openEditModal(item)}
      >
        <View style={styles.folderIcon}>
          <Icon name="folder" size={24} color="#2dbe60" />
        </View>
        <View style={styles.folderInfo}>
          <Text style={styles.folderName}>{item.name}</Text>
          <Text style={styles.folderCount}>
            {item.note_count} {item.note_count === 1 ? 'note' : 'notes'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.folderMenu}
          onPress={() => openEditModal(item)}
        >
          <Icon name="more-vertical" size={20} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={folders}
        renderItem={renderFolder}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2dbe60']}
            tintColor="#2dbe60"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="folder" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No notebooks yet</Text>
            <Text style={styles.emptySubtext}>
              Create a notebook to organize your notes
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setNewFolderName('');
          setShowCreateModal(true);
        }}
      >
        <Icon name="folder-plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal || editingFolder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateModal(false);
          setEditingFolder(null);
          setNewFolderName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingFolder ? 'Edit Notebook' : 'New Notebook'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Notebook name"
              placeholderTextColor="#999"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              {editingFolder && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={() => {
                    setEditingFolder(null);
                    setNewFolderName('');
                    confirmDeleteFolder(editingFolder);
                  }}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setEditingFolder(null);
                  setNewFolderName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={editingFolder ? updateFolder : createFolder}
              >
                <Text style={styles.saveButtonText}>
                  {editingFolder ? 'Save' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  list: {
    padding: 16,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(45, 190, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  folderCount: {
    fontSize: 13,
    color: '#666',
  },
  folderMenu: {
    padding: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2dbe60',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    marginRight: 'auto',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
