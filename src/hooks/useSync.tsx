import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { database } from '../models';
import SyncService from '../services/sync';
import { AppState } from '../models';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  conflicts: string[];
  sync: () => Promise<void>;
  markNoteForSync: (noteId: string) => Promise<void>;
  resolveConflictWithServer: (noteId: string) => Promise<void>;
  resolveConflictWithLocal: (noteId: string) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

// Create singleton sync service instance
const syncService = new SyncService(database);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
    });

    // Listen to sync events
    const removeSyncListener = syncService.addListener(event => {
      if (event.type === 'sync_start') {
        setIsSyncing(true);
      } else if (event.type === 'sync_complete') {
        setIsSyncing(false);
        loadLastSync();
      } else if (event.type === 'sync_error') {
        setIsSyncing(false);
        console.error('Sync error:', event.data);
      } else if (event.type === 'conflict') {
        setConflicts(prev => [...prev, event.data.noteId]);
      }
    });

    // Load last sync time
    loadLastSync();

    // Initial sync
    sync();

    return () => {
      unsubscribe();
      removeSyncListener();
    };
  }, []);

  async function loadLastSync() {
    const time = await AppState.getValue(database, 'last_sync_at');
    setLastSync(time);
  }

  const sync = useCallback(async () => {
    try {
      await syncService.sync();
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }, []);

  const markNoteForSync = useCallback(async (noteId: string) => {
    await syncService.markNoteForSync(noteId);
  }, []);

  const resolveConflictWithServer = useCallback(async (noteId: string) => {
    await syncService.resolveConflictWithServer(noteId);
    setConflicts(prev => prev.filter(id => id !== noteId));
  }, []);

  const resolveConflictWithLocal = useCallback(async (noteId: string) => {
    await syncService.resolveConflictWithLocal(noteId);
    setConflicts(prev => prev.filter(id => id !== noteId));
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        lastSync,
        conflicts,
        sync,
        markNoteForSync,
        resolveConflictWithServer,
        resolveConflictWithLocal
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
