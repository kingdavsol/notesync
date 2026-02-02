import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      // Sync when coming back online
      if (online && !isOnline) {
        sync();
      }
    });

    // Load last sync time
    loadLastSync();

    // Initial sync
    sync();

    return () => unsubscribe();
  }, []);

  async function loadLastSync() {
    const time = await AsyncStorage.getItem('lastSyncTime');
    setLastSync(time);
  }

  const sync = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);

    try {
      // Pull changes
      const pullResult = await api.syncPull(lastSync || undefined);

      // Save pulled data locally
      if (pullResult.notes) {
        await AsyncStorage.setItem('notes', JSON.stringify(pullResult.notes));
      }
      if (pullResult.folders) {
        await AsyncStorage.setItem('folders', JSON.stringify(pullResult.folders));
      }
      if (pullResult.tags) {
        await AsyncStorage.setItem('tags', JSON.stringify(pullResult.tags));
      }

      // Update last sync time
      const newSyncTime = new Date().toISOString();
      await AsyncStorage.setItem('lastSyncTime', newSyncTime);
      setLastSync(newSyncTime);

      // Push any pending changes
      const pendingChanges = await AsyncStorage.getItem('pendingChanges');
      if (pendingChanges) {
        const changes = JSON.parse(pendingChanges);
        if (changes.length > 0) {
          await api.syncPush({ notes: changes });
          await AsyncStorage.removeItem('pendingChanges');
        }
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, lastSync]);

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, lastSync, sync }}>
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
