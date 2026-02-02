import Dexie from 'dexie';

// Local IndexedDB database for offline support
export const db = new Dexie('NoteSync');

db.version(1).stores({
  // Notes with sync metadata
  notes: '++localId, id, title, folderId, offlineEnabled, updatedAt, syncStatus, deletedAt',
  
  // Folders
  folders: '++localId, id, name, parentId, updatedAt',
  
  // Tags
  tags: '++localId, id, name',
  
  // Note-tag relations
  noteTags: '[noteLocalId+tagLocalId], noteLocalId, tagLocalId',
  
  // Sync queue for pending changes
  syncQueue: '++id, entityType, entityLocalId, action, timestamp',
  
  // App state
  appState: 'key'
});

// Sync status values
export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  CONFLICT: 'conflict'
};

// Helper functions
export async function getOfflineNotes() {
  return db.notes
    .where('offlineEnabled')
    .equals(1)
    .and(note => !note.deletedAt)
    .toArray();
}

export async function getPendingChanges() {
  return db.syncQueue.toArray();
}

export async function clearPendingChanges() {
  return db.syncQueue.clear();
}

export async function addToSyncQueue(entityType, entityLocalId, action) {
  return db.syncQueue.add({
    entityType,
    entityLocalId,
    action,
    timestamp: new Date().toISOString()
  });
}

export async function getLastSyncTime() {
  const state = await db.appState.get('lastSync');
  return state?.value || null;
}

export async function setLastSyncTime(time) {
  return db.appState.put({ key: 'lastSync', value: time });
}

export async function saveNote(note) {
  const existing = note.localId 
    ? await db.notes.get(note.localId)
    : note.id 
      ? await db.notes.where('id').equals(note.id).first()
      : null;

  if (existing) {
    await db.notes.update(existing.localId, {
      ...note,
      updatedAt: new Date().toISOString()
    });
    return existing.localId;
  } else {
    return db.notes.add({
      ...note,
      updatedAt: new Date().toISOString(),
      syncStatus: note.id ? SYNC_STATUS.SYNCED : SYNC_STATUS.PENDING
    });
  }
}

export async function deleteNoteLocal(localId) {
  const note = await db.notes.get(localId);
  if (note) {
    await db.notes.update(localId, {
      deletedAt: new Date().toISOString(),
      syncStatus: SYNC_STATUS.PENDING
    });
    await addToSyncQueue('note', localId, 'delete');
  }
}

export async function saveFolder(folder) {
  const existing = folder.localId
    ? await db.folders.get(folder.localId)
    : folder.id
      ? await db.folders.where('id').equals(folder.id).first()
      : null;

  if (existing) {
    await db.folders.update(existing.localId, folder);
    return existing.localId;
  } else {
    return db.folders.add(folder);
  }
}

export async function saveTag(tag) {
  const existing = tag.localId
    ? await db.tags.get(tag.localId)
    : tag.id
      ? await db.tags.where('id').equals(tag.id).first()
      : null;

  if (existing) {
    await db.tags.update(existing.localId, tag);
    return existing.localId;
  } else {
    return db.tags.add(tag);
  }
}

// Clear all local data (for logout)
export async function clearAllData() {
  await db.notes.clear();
  await db.folders.clear();
  await db.tags.clear();
  await db.noteTags.clear();
  await db.syncQueue.clear();
  await db.appState.clear();
}

export default db;
