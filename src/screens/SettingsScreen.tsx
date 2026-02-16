import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useSync } from '../hooks/useSync';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isOnline, lastSyncTime, sync, isSyncing } = useSync();
  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);

  function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  }

  function formatSyncTime(date: Date | null): string {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  }

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Icon name="user" size={24} color="#2dbe60" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{user?.email || 'Not signed in'}</Text>
              <Text style={styles.accountPlan}>Free Plan</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sync Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name={isOnline ? 'wifi' : 'wifi-off'} size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Connection Status</Text>
              <Text style={styles.rowSubtitle}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={sync} disabled={isSyncing || !isOnline}>
            <View style={styles.rowIcon}>
              <Icon name="refresh-cw" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Sync Now</Text>
              <Text style={styles.rowSubtitle}>
                Last synced: {formatSyncTime(lastSyncTime)}
              </Text>
            </View>
            {isSyncing && <Text style={styles.syncingText}>Syncing...</Text>}
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="cloud" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Auto-sync</Text>
              <Text style={styles.rowSubtitle}>Sync changes automatically</Text>
            </View>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: '#e0e0e0', true: 'rgba(45, 190, 96, 0.4)' }}
              thumbColor={autoSync ? '#2dbe60' : '#f4f4f4'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="download" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Offline Mode</Text>
              <Text style={styles.rowSubtitle}>Download all notes for offline access</Text>
            </View>
            <Switch
              value={offlineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: '#e0e0e0', true: 'rgba(45, 190, 96, 0.4)' }}
              thumbColor={offlineMode ? '#2dbe60' : '#f4f4f4'}
            />
          </View>
        </View>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setTheme('light')}
          >
            <View style={styles.rowIcon}>
              <Icon name="sun" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Light</Text>
            </View>
            {theme === 'light' && <Icon name="check" size={20} color="#2dbe60" />}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setTheme('dark')}
          >
            <View style={styles.rowIcon}>
              <Icon name="moon" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Dark</Text>
            </View>
            {theme === 'dark' && <Icon name="check" size={20} color="#2dbe60" />}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setTheme('system')}
          >
            <View style={styles.rowIcon}>
              <Icon name="smartphone" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>System</Text>
            </View>
            {theme === 'system' && <Icon name="check" size={20} color="#2dbe60" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="bell" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Push Notifications</Text>
              <Text style={styles.rowSubtitle}>Reminders and shared note alerts</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#e0e0e0', true: 'rgba(45, 190, 96, 0.4)' }}
              thumbColor={notifications ? '#2dbe60' : '#f4f4f4'}
            />
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="info" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Version</Text>
              <Text style={styles.rowSubtitle}>1.0.0</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="file-text" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Terms of Service</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="shield" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Privacy Policy</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="help-circle" size={20} color="#666" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Help & Support</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="log-out" size={20} color="#dc3545" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>NoteSync for Mobile</Text>
        <Text style={styles.footerText}>Made with love</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(45, 190, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  accountPlan: {
    fontSize: 13,
    color: '#666',
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  online: {
    backgroundColor: '#2dbe60',
  },
  offline: {
    backgroundColor: '#ff9800',
  },
  syncingText: {
    fontSize: 13,
    color: '#2dbe60',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc3545',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
});
