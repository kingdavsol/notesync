import { Database, Q } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import { Note, Folder, Tag, NoteTag, SyncQueue, AppState } from '../models';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SyncListener = (event: SyncEvent) => void;

interface SyncEvent {
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'conflict';
  data?: any;
}

class SyncService {
  private database: Database;
  private listeners: Set<SyncListener>;
  private isSyncing: boolean;
  private deviceId: string | null;

  constructor(database: Database) {
    this.database = database;
    this.listeners = new Set();
    this.isSyncing = false;
    this.deviceId = null;
    this.initializeDeviceId();
    this.setupNetworkListener();
  }

  private async initializeDeviceId() {
    let id = await AsyncStorage.getItem('deviceId');
    if (!id) {
      id = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('deviceId', id);
    }
    this.deviceId = id;
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isSyncing) {
        // Auto-sync when coming back online
        setTimeout(() => this.sync(), 1000);
      }
    });
  }

  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping');
      return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('Offline, skipping sync');
      return;
    }

    this.isSyncing = true;
    this.notify({ type: 'sync_start' });

    try {
      // 1. Push local changes first
      await this.pushChanges();

      // 2. Pull remote changes
      await this.pullChanges();

      // 3. Update offline cache
      await this.updateOfflineCache();

      this.notify({ type: 'sync_complete' });
    } catch (err) {
      console.error('Sync error:', err);
      this.notify({ type: 'sync_error', data: err });
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  private async pushChanges(): Promise<void> {
    const pendingNotes = await this.database.collections
      .get<Note>('notes')
      .query(Q.where('sync_status', 'pending'))
      .fetch();

    if (pendingNotes.length === 0) {
      console.log('No pending notes to push');
      return;
    }

    console.log(`Pushing ${pendingNotes.length} notes to server`);

    const notesToPush = await Promise.all(
      pendingNotes.map(async note => {
        const tags = await this.getNoteTags(note);
        return {
          id: note.serverId,
          title: note.title,
          content: note.content.replace(/\n__IMG__[^\n]*/g, '').trim(),
          content_plain: note.contentPlain,
          folder_id: note.folderId,
          tags,
          is_pinned: note.isPinned,
          offline_enabled: note.offlineEnabled,
          _isNew: !note.serverId,
          _localId: note.id,
          _deleted: !!note.deletedAt,
          _baseUpdatedAt: note.baseUpdatedAt?.getTime(),
        };
      })
    );

    const result = await api.syncPush({ notes: notesToPush });

    // Map server IDs back to local notes and handle conflicts
    await this.database.write(async () => {
      // Handle successful syncs
      if (result.results?.notes) {
        for (const item of result.results.notes) {
          const note = pendingNotes.find(n => n.id === item.local_id);
          if (note && item.server) {
            await note.update(n => {
              n.serverId = item.server.id;
              n.syncStatus = 'synced';
              n.updatedAt = new Date(item.server.updated_at);
              n.baseUpdatedAt = new Date(item.server.updated_at);
            });
          }
        }
      }

      // Handle conflicts
      if (result.results?.conflicts) {
        for (const conflict of result.results.conflicts) {
          const note = pendingNotes.find(n => n.serverId === conflict.note_id);
          if (note) {
            await note.update(n => {
              n.syncStatus = 'conflict';
            });
            this.notify({
              type: 'conflict',
              data: {
                noteId: note.id,
                serverVersion: conflict.server_version,
                clientVersion: note.updatedAt
              }
            });
          }
        }
      }
    });

    // Clear sync queue for successfully synced items
    const queueItems = await this.database.collections
      .get<SyncQueue>('sync_queue')
      .query()
      .fetch();

    await this.database.write(async () => {
      for (const item of queueItems) {
        await item.destroyPermanently();
      }
    });
  }

  private async pullChanges(): Promise<void> {
    const lastSync = await this.getLastSyncTime();
    console.log('Pulling changes since:', lastSync);

    const changes = await api.syncPull(lastSync, this.deviceId || undefined);

    await this.database.write(async () => {
      // Notes
      if (changes.notes) {
        for (const serverNote of changes.notes) {
          await this.saveNote(serverNote);
        }
      }

      // Folders
      if (changes.folders) {
        for (const serverFolder of changes.folders) {
          await this.saveFolder(serverFolder);
        }
      }

      // Tags
      if (changes.tags) {
        for (const serverTag of changes.tags) {
          await this.saveTag(serverTag);
        }
      }

      // Deletions
      if (changes.deletions) {
        for (const deletion of changes.deletions) {
          await this.handleDeletion(deletion);
        }
      }
    });

    if (changes.server_time) {
      await this.setLastSyncTime(changes.server_time);
    }
  }

  private async updateOfflineCache(): Promise<void> {
    try {
      // For now, we'll skip offline cache update as the API doesn't expose this method yet
      // This can be implemented later if needed
      // The offline-enabled flag is already synced via the notes sync
      console.log('Offline cache update skipped (using regular sync)');
    } catch (err) {
      console.error('Failed to update offline cache:', err);
    }
  }

  private async saveNote(serverNote: any): Promise<void> {
    const existing = await this.database.collections
      .get<Note>('notes')
      .query(Q.where('server_id', serverNote.id))
      .fetch();

    if (existing.length > 0) {
      const local = existing[0];

      // Only update if server version is newer or local is already synced
      const serverUpdated = new Date(serverNote.updated_at).getTime();
      const localUpdated = local.updatedAt.getTime();

      if (local.syncStatus === 'synced' || serverUpdated > localUpdated) {
        await local.update(n => {
          n.title = serverNote.title;
          n.content = serverNote.content;
          n.contentPlain = serverNote.content_plain || '';
          n.folderId = serverNote.folder_id;
          n.offlineEnabled = serverNote.offline_enabled || false;
          n.isPinned = serverNote.is_pinned || false;
          n.syncStatus = 'synced';
          n.updatedAt = new Date(serverNote.updated_at);
          n.baseUpdatedAt = new Date(serverNote.updated_at);
        });

        // Update tags
        await this.updateNoteTags(local, serverNote.tags || []);
      }
    } else {
      const newNote = await this.database.collections.get<Note>('notes').create(n => {
        n.serverId = serverNote.id;
        n.title = serverNote.title;
        n.content = serverNote.content;
        n.contentPlain = serverNote.content_plain || '';
        n.folderId = serverNote.folder_id;
        n.offlineEnabled = serverNote.offline_enabled || false;
        n.isPinned = serverNote.is_pinned || false;
        n.syncStatus = 'synced';
        n.createdAt = new Date(serverNote.created_at);
        n.updatedAt = new Date(serverNote.updated_at);
        n.baseUpdatedAt = new Date(serverNote.updated_at);
      });

      // Add tags
      if (serverNote.tags) {
        await this.updateNoteTags(newNote, serverNote.tags);
      }
    }
  }

  private async saveFolder(serverFolder: any): Promise<void> {
    const existing = await this.database.collections
      .get<Folder>('folders')
      .query(Q.where('server_id', serverFolder.id))
      .fetch();

    if (existing.length > 0) {
      await existing[0].update(f => {
        f.name = serverFolder.name;
        f.parentId = serverFolder.parent_id;
        f.updatedAt = new Date(serverFolder.updated_at);
      });
    } else {
      await this.database.collections.get<Folder>('folders').create(f => {
        f.serverId = serverFolder.id;
        f.name = serverFolder.name;
        f.parentId = serverFolder.parent_id;
        f.createdAt = new Date(serverFolder.created_at);
        f.updatedAt = new Date(serverFolder.updated_at);
      });
    }
  }

  private async saveTag(serverTag: any): Promise<void> {
    const existing = await this.database.collections
      .get<Tag>('tags')
      .query(Q.where('server_id', serverTag.id))
      .fetch();

    if (existing.length > 0) {
      await existing[0].update(t => {
        t.name = serverTag.name;
      });
    } else {
      await this.database.collections.get<Tag>('tags').create(t => {
        t.serverId = serverTag.id;
        t.name = serverTag.name;
        t.createdAt = new Date(serverTag.created_at || Date.now());
      });
    }
  }

  private async updateNoteTags(note: Note, tagNames: string[]): Promise<void> {
    // Get existing note_tags for this note
    const existingNoteTags = await this.database.collections
      .get<NoteTag>('note_tags')
      .query(Q.where('note_id', note.id))
      .fetch();

    // Remove all existing note_tags
    for (const nt of existingNoteTags) {
      await nt.destroyPermanently();
    }

    // Add new tags
    for (const tagName of tagNames) {
      // Find or create tag
      let tagRecords = await this.database.collections
        .get<Tag>('tags')
        .query(Q.where('name', tagName))
        .fetch();

      let tag: Tag;
      if (tagRecords.length === 0) {
        tag = await this.database.collections.get<Tag>('tags').create(t => {
          t.name = tagName;
          t.createdAt = new Date();
        });
      } else {
        tag = tagRecords[0];
      }

      // Create note_tag junction
      await this.database.collections.get<NoteTag>('note_tags').create(nt => {
        nt.noteId = note.id;
        nt.tagId = tag.id;
      });
    }
  }

  private async handleDeletion(deletion: any): Promise<void> {
    if (deletion.entity_type === 'note') {
      const notes = await this.database.collections
        .get<Note>('notes')
        .query(Q.where('server_id', deletion.entity_id))
        .fetch();

      for (const note of notes) {
        await note.update(n => {
          n.deletedAt = new Date(deletion.deleted_at);
        });
      }
    } else if (deletion.entity_type === 'folder') {
      const folders = await this.database.collections
        .get<Folder>('folders')
        .query(Q.where('server_id', deletion.entity_id))
        .fetch();

      for (const folder of folders) {
        await folder.destroyPermanently();
      }
    }
  }

  private async getNoteTags(note: Note): Promise<string[]> {
    const noteTags = await this.database.collections
      .get<NoteTag>('note_tags')
      .query(Q.where('note_id', note.id))
      .fetch();

    const tags = await Promise.all(
      noteTags.map(async nt => {
        const tag = await this.database.collections
          .get<Tag>('tags')
          .find(nt.tagId);
        return tag.name;
      })
    );

    return tags;
  }

  private async getLastSyncTime(): Promise<string | undefined> {
    const value = await AppState.getValue(this.database, 'last_sync_at');
    return value || undefined;
  }

  private async setLastSyncTime(timestamp: string): Promise<void> {
    // Write to AsyncStorage first (fast, reliable for UI reads)
    await AsyncStorage.setItem('last_sync_at', timestamp);
    // Also persist in WatermelonDB for consistency
    await AppState.setValue(this.database, 'last_sync_at', timestamp);
  }

  // Public API
  addListener(callback: SyncListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(event: SyncEvent): void {
    this.listeners.forEach(cb => cb(event));
  }

  // Helper to mark a note for sync
  async markNoteForSync(noteId: string): Promise<void> {
    await this.database.write(async () => {
      const note = await this.database.collections.get<Note>('notes').find(noteId);
      await note.update(n => {
        n.syncStatus = 'pending';
      });

      // Add to sync queue
      await this.database.collections.get<SyncQueue>('sync_queue').create(sq => {
        sq.entityType = 'note';
        sq.entityId = noteId;
        sq.action = note.serverId ? 'update' : 'create';
        sq.timestamp = new Date();
      });
    });
  }

  // Resolve conflict by accepting server version
  async resolveConflictWithServer(noteId: string): Promise<void> {
    await this.database.write(async () => {
      const note = await this.database.collections.get<Note>('notes').find(noteId);
      await note.update(n => {
        n.syncStatus = 'synced';
      });
    });
  }

  // Resolve conflict by keeping local version
  async resolveConflictWithLocal(noteId: string): Promise<void> {
    await this.database.write(async () => {
      const note = await this.database.collections.get<Note>('notes').find(noteId);
      await note.update(n => {
        n.syncStatus = 'pending';
      });
    });

    // Trigger sync to push local version
    await this.sync();
  }
}

export default SyncService;
