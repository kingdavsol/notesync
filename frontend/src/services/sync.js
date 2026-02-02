import api from './api';
import db, { 
  SYNC_STATUS, 
  getLastSyncTime, 
  setLastSyncTime,
  getPendingChanges,
  clearPendingChanges,
  saveNote,
  saveFolder,
  saveTag
} from './db';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.isOnline = navigator.onLine;
    this.listeners = new Set();

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen for service worker sync messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_REQUESTED') {
          this.sync();
        }
      });
    }
  }

  handleOnline() {
    this.isOnline = true;
    this.notifyListeners({ type: 'online' });
    this.sync();
  }

  handleOffline() {
    this.isOnline = false;
    this.notifyListeners({ type: 'offline' });
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(cb => cb(event));
  }

  async sync() {
    if (this.isSyncing || !this.isOnline || !api.getToken()) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'sync_start' });

    try {
      // 1. Push local changes first
      await this.pushChanges();

      // 2. Pull remote changes
      await this.pullChanges();

      // 3. Update offline notes cache
      await this.updateOfflineCache();

      this.notifyListeners({ type: 'sync_complete' });
    } catch (err) {
      console.error('Sync failed:', err);
      this.notifyListeners({ type: 'sync_error', error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  async pushChanges() {
    const pendingNotes = await db.notes
      .where('syncStatus')
      .equals(SYNC_STATUS.PENDING)
      .toArray();

    if (pendingNotes.length === 0) return;

    const notesToPush = pendingNotes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      folder_id: note.folderId,
      offline_enabled: note.offlineEnabled,
      tags: note.tags || [],
      _isNew: !note.id,
      _localId: note.localId,
      _deleted: !!note.deletedAt,
      _baseUpdatedAt: note.baseUpdatedAt
    }));

    const result = await api.syncPush({ notes: notesToPush });

    // Update local notes with server IDs
    for (const mapping of result.results.notes) {
      await db.notes.update(mapping.local_id, {
        id: mapping.server.id,
        syncStatus: SYNC_STATUS.SYNCED,
        updatedAt: mapping.server.updated_at
      });
    }

    // Handle conflicts
    for (const conflict of result.results.conflicts) {
      await db.notes
        .where('id')
        .equals(conflict.note_id)
        .modify({ syncStatus: SYNC_STATUS.CONFLICT });
      
      this.notifyListeners({ 
        type: 'conflict', 
        noteId: conflict.note_id 
      });
    }

    // Clear sync queue
    await clearPendingChanges();
  }

  async pullChanges() {
    const lastSync = await getLastSyncTime();
    const result = await api.syncPull(lastSync);

    // Save pulled notes
    for (const note of result.notes) {
      await saveNote({
        id: note.id,
        title: note.title,
        content: note.content,
        folderId: note.folder_id,
        offlineEnabled: note.offline_enabled,
        isPinned: note.is_pinned,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        deletedAt: note.deleted_at,
        tags: note.tags?.map(t => t.name) || [],
        syncStatus: SYNC_STATUS.SYNCED
      });
    }

    // Save pulled folders
    for (const folder of result.folders) {
      await saveFolder({
        id: folder.id,
        name: folder.name,
        parentId: folder.parent_id,
        updatedAt: folder.updated_at
      });
    }

    // Save pulled tags
    for (const tag of result.tags) {
      await saveTag({
        id: tag.id,
        name: tag.name
      });
    }

    // Handle deletions
    for (const deletion of result.deletions) {
      if (deletion.entity_type === 'note') {
        const note = await db.notes.where('id').equals(deletion.entity_id).first();
        if (note) {
          await db.notes.delete(note.localId);
        }
      } else if (deletion.entity_type === 'folder') {
        const folder = await db.folders.where('id').equals(deletion.entity_id).first();
        if (folder) {
          await db.folders.delete(folder.localId);
        }
      }
    }

    await setLastSyncTime(result.server_time);
  }

  async updateOfflineCache() {
    try {
      const result = await api.getOfflineNotes();
      
      // Update local cache of offline-enabled notes
      for (const note of result.notes) {
        await saveNote({
          id: note.id,
          title: note.title,
          content: note.content,
          folderId: note.folder_id,
          offlineEnabled: true,
          isPinned: note.is_pinned,
          createdAt: note.created_at,
          updatedAt: note.updated_at,
          tags: note.tags?.map(t => t.name) || [],
          syncStatus: SYNC_STATUS.SYNCED
        });
      }
    } catch (err) {
      console.error('Failed to update offline cache:', err);
    }
  }

  // Get note (from local DB if offline, API if online)
  async getNote(id) {
    if (this.isOnline) {
      try {
        const result = await api.getNote(id);
        // Cache locally
        await saveNote({
          id: result.note.id,
          title: result.note.title,
          content: result.note.content,
          folderId: result.note.folder_id,
          offlineEnabled: result.note.offline_enabled,
          tags: result.note.tags?.map(t => t.name) || [],
          syncStatus: SYNC_STATUS.SYNCED
        });
        return result.note;
      } catch (err) {
        // Fallback to local
        const local = await db.notes.where('id').equals(id).first();
        if (local) return this.formatLocalNote(local);
        throw err;
      }
    } else {
      const local = await db.notes.where('id').equals(id).first();
      if (!local) throw new Error('Note not available offline');
      return this.formatLocalNote(local);
    }
  }

  formatLocalNote(note) {
    return {
      id: note.id,
      localId: note.localId,
      title: note.title,
      content: note.content,
      folder_id: note.folderId,
      offline_enabled: note.offlineEnabled,
      is_pinned: note.isPinned,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
      tags: note.tags || [],
      _isLocal: true,
      _syncStatus: note.syncStatus
    };
  }
}

export const syncService = new SyncService();
export default syncService;
