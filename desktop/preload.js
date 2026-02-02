const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Store
  getStore: (key) => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Theme
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),

  // Badge
  setBadge: (count) => ipcRenderer.send('set-badge', count),

  // Updates
  installUpdate: () => ipcRenderer.send('install-update'),

  // Event listeners
  onNewNote: (callback) => ipcRenderer.on('new-note', callback),
  onNewNotebook: (callback) => ipcRenderer.on('new-notebook', callback),
  onSync: (callback) => ipcRenderer.on('sync', callback),
  onFind: (callback) => ipcRenderer.on('find', callback),
  onToggleSidebar: (callback) => ipcRenderer.on('toggle-sidebar', callback),
  onShareNote: (callback) => ipcRenderer.on('share-note', callback),
  onAddReminder: (callback) => ipcRenderer.on('add-reminder', callback),
  onPinNote: (callback) => ipcRenderer.on('pin-note', callback),
  onMoveNote: (callback) => ipcRenderer.on('move-note', callback),
  onDeleteNote: (callback) => ipcRenderer.on('delete-note', callback),
  onImportEvernote: (callback) => ipcRenderer.on('import-evernote', callback),
  onExportAll: (callback) => ipcRenderer.on('export-all', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onShowShortcuts: (callback) => ipcRenderer.on('show-shortcuts', callback),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),

  // Remove listeners
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose platform detection
contextBridge.exposeInMainWorld('isElectron', true);
