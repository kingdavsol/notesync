const { app, BrowserWindow, Menu, Tray, shell, ipcMain, nativeTheme, globalShortcut, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// Initialize store for app settings
const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    theme: 'system',
    startMinimized: false,
    minimizeToTray: true,
    apiUrl: 'https://notesync.example.com/api'
  }
});

let mainWindow;
let tray = null;
let isQuitting = false;

// Determine if we're in development
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const { width, height, x, y } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 800,
    minHeight: 600,
    title: 'NoteSync',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false // Don't show until ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      mainWindow.show();
    }
  });

  // Save window position on close
  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }

    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open NoteSync',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'New Note',
      accelerator: 'CmdOrCtrl+N',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('new-note');
      }
    },
    { type: 'separator' },
    {
      label: 'Quick Capture',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => {
        createQuickCaptureWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Preferences',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('open-settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('NoteSync');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createQuickCaptureWindow() {
  const quickCapture = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  if (isDev) {
    quickCapture.loadURL('http://localhost:3000/quick-capture');
  } else {
    quickCapture.loadFile(path.join(__dirname, 'app', 'index.html'), {
      hash: '/quick-capture'
    });
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('new-note')
        },
        {
          label: 'New Notebook',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => mainWindow.webContents.send('new-notebook')
        },
        { type: 'separator' },
        {
          label: 'Import',
          submenu: [
            {
              label: 'From Evernote (.enex)',
              click: () => mainWindow.webContents.send('import-evernote')
            }
          ]
        },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export All Notes',
              click: () => mainWindow.webContents.send('export-all')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Sync Now',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('sync')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('find')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+\\',
          click: () => mainWindow.webContents.send('toggle-sidebar')
        }
      ]
    },
    {
      label: 'Note',
      submenu: [
        {
          label: 'Share',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('share-note')
        },
        {
          label: 'Add Reminder',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow.webContents.send('add-reminder')
        },
        { type: 'separator' },
        {
          label: 'Pin Note',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send('pin-note')
        },
        {
          label: 'Move to Notebook',
          click: () => mainWindow.webContents.send('move-note')
        },
        { type: 'separator' },
        {
          label: 'Delete Note',
          accelerator: 'CmdOrCtrl+Backspace',
          click: () => mainWindow.webContents.send('delete-note')
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        {
          label: 'Always on Top',
          type: 'checkbox',
          click: (menuItem) => {
            mainWindow.setAlwaysOnTop(menuItem.checked);
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://notesync.example.com/docs')
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => mainWindow.webContents.send('show-shortcuts')
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => autoUpdater.checkForUpdatesAndNotify()
        },
        { type: 'separator' },
        {
          label: 'About NoteSync',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About NoteSync',
              message: 'NoteSync Desktop',
              detail: `Version ${app.getVersion()}\n\nCross-platform note taking with offline sync.`
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => mainWindow.webContents.send('open-settings')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function registerGlobalShortcuts() {
  // Global shortcut for quick capture
  globalShortcut.register('CmdOrCtrl+Alt+N', () => {
    createQuickCaptureWindow();
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
  createMenu();
  registerGlobalShortcuts();

  // Check for updates
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.handle('get-store', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store', (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.on('set-badge', (event, count) => {
  if (process.platform === 'darwin') {
    app.dock.setBadge(count > 0 ? count.toString() : '');
  }
});

// Theme handling
ipcMain.handle('get-theme', () => {
  const theme = store.get('theme');
  if (theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return theme;
});

ipcMain.on('set-theme', (event, theme) => {
  store.set('theme', theme);
  if (theme === 'system') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = theme;
  }
});

nativeTheme.on('updated', () => {
  mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});

// Auto updater events
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
