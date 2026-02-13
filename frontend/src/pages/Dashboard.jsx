import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useSync } from '../App';
import api from '../services/api';
import db from '../services/db';
import Sidebar from '../components/Sidebar';
import NoteList from '../components/NoteList';
import CollaborativeEditor from '../components/CollaborativeEditor';
import ImportModal from '../components/ImportModal';
import AdvancedSearch from '../components/AdvancedSearch';
import { Menu, Plus, RefreshCw, Wifi, WifiOff, Search } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isOnline, isSyncing, sync } = useSync();
  
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOfflineOnly, setShowOfflineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      if (isOnline) {
        const [notesRes, foldersRes, tagsRes] = await Promise.all([
          api.getNotes({
            folder_id: selectedFolder,
            tag: selectedTag,
            search: searchQuery,
            offline_only: showOfflineOnly
          }),
          api.getFolders(),
          api.getTags()
        ]);
        setNotes(notesRes.notes);
        setFolders(foldersRes.folders);
        setTags(tagsRes.tags);
      } else {
        // Load from local DB when offline
        let localNotes = await db.notes.toArray();
        localNotes = localNotes.filter(n => !n.deletedAt);
        
        if (showOfflineOnly) {
          localNotes = localNotes.filter(n => n.offlineEnabled);
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          localNotes = localNotes.filter(n => 
            n.title?.toLowerCase().includes(q) || 
            n.content?.toLowerCase().includes(q)
          );
        }
        
        setNotes(localNotes.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          folder_id: n.folderId,
          offline_enabled: n.offlineEnabled,
          updated_at: n.updatedAt,
          tags: n.tags || [],
          _isLocal: true
        })));
        
        const localFolders = await db.folders.toArray();
        setFolders(localFolders);
        
        const localTags = await db.tags.toArray();
        setTags(localTags);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [isOnline, selectedFolder, selectedTag, searchQuery, showOfflineOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create new note
  async function createNote() {
    try {
      if (isOnline) {
        const { note } = await api.createNote({
          title: 'Untitled',
          content: '',
          folder_id: selectedFolder
        });
        setNotes(prev => [note, ...prev]);
        setSelectedNote(note);
      } else {
        // Create locally
        const localId = await db.notes.add({
          title: 'Untitled',
          content: '',
          folderId: selectedFolder,
          offlineEnabled: true,
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        const note = await db.notes.get(localId);
        const formatted = {
          localId: note.localId,
          title: note.title,
          content: note.content,
          folder_id: note.folderId,
          offline_enabled: note.offlineEnabled,
          updated_at: note.updatedAt,
          _isLocal: true
        };
        
        setNotes(prev => [formatted, ...prev]);
        setSelectedNote(formatted);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  }

  // Update note
  async function updateNote(note) {
    try {
      if (isOnline && note.id) {
        const { note: updated } = await api.updateNote(note.id, {
          title: note.title,
          content: note.content,
          folder_id: note.folder_id,
          offline_enabled: note.offline_enabled,
          tags: note.tags
        });
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
        setSelectedNote(updated);

        // Reload tags to show newly created tags
        const tagsRes = await api.getTags();
        setTags(tagsRes.tags);
      } else {
        // Update locally
        const localId = note.localId || (await db.notes.where('id').equals(note.id).first())?.localId;
        if (localId) {
          await db.notes.update(localId, {
            title: note.title,
            content: note.content,
            folderId: note.folder_id,
            offlineEnabled: note.offline_enabled,
            tags: note.tags,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });
          loadData();
        }
      }
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  }

  // Delete note
  async function deleteNote(note) {
    if (!confirm('Delete this note?')) return;
    
    try {
      if (isOnline && note.id) {
        await api.deleteNote(note.id);
      } else {
        const localId = note.localId || (await db.notes.where('id').equals(note.id).first())?.localId;
        if (localId) {
          await db.notes.update(localId, {
            deletedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });
        }
      }
      setNotes(prev => prev.filter(n => n.id !== note.id && n.localId !== note.localId));
      if (selectedNote?.id === note.id || selectedNote?.localId === note.localId) {
        setSelectedNote(null);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  // Toggle offline
  async function toggleOffline(note) {
    try {
      if (isOnline && note.id) {
        const result = await api.toggleOffline(note.id);
        setNotes(prev => prev.map(n => 
          n.id === note.id ? { ...n, offline_enabled: result.offline_enabled } : n
        ));
        if (selectedNote?.id === note.id) {
          setSelectedNote(prev => ({ ...prev, offline_enabled: result.offline_enabled }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle offline:', err);
    }
  }

  // Create folder
  async function createFolder(name) {
    try {
      const { folder } = await api.createFolder(name);
      setFolders(prev => [...prev, folder]);
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  }

  // Delete folder
  async function deleteFolder(id) {
    if (!confirm('Delete this folder? Notes will be moved to no folder.')) return;
    try {
      await api.deleteFolder(id);
      setFolders(prev => prev.filter(f => f.id !== id));
      if (selectedFolder === id) {
        setSelectedFolder(null);
      }
      loadData();
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  }

  // Handle import complete
  function handleImportComplete() {
    setShowImport(false);
    loadData();
    sync();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        user={user}
        folders={folders}
        tags={tags}
        selectedFolder={selectedFolder}
        selectedTag={selectedTag}
        showOfflineOnly={showOfflineOnly}
        onSelectFolder={id => { setSelectedFolder(id); setSelectedTag(null); }}
        onSelectTag={tag => { setSelectedTag(tag); setSelectedFolder(null); }}
        onToggleOfflineOnly={() => setShowOfflineOnly(!showOfflineOnly)}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onImport={() => setShowImport(true)}
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <button 
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(true)}
            style={{ display: 'none' }}
          >
            <Menu size={20} />
          </button>

          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ maxWidth: '300px' }}
          />

          <button
            className="btn btn-ghost"
            onClick={() => setShowAdvancedSearch(true)}
            title="Advanced Search"
          >
            <Search size={16} />
            Advanced
          </button>

          <div style={{ flex: 1 }} />

          {/* Sync status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isOnline ? (
              <span className="status-dot status-online" title="Online" />
            ) : (
              <span className="offline-badge">
                <WifiOff size={12} />
                Offline
              </span>
            )}

            <button 
              className="btn btn-ghost btn-icon"
              onClick={sync}
              disabled={isSyncing || !isOnline}
              title="Sync now"
            >
              <RefreshCw size={18} className={isSyncing ? 'spinning' : ''} />
            </button>

            <button 
              className="btn btn-primary"
              onClick={createNote}
            >
              <Plus size={18} />
              New Note
            </button>
          </div>
        </header>

        {/* Content area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Note list */}
          <NoteList
            notes={notes}
            selectedNote={selectedNote}
            onSelect={setSelectedNote}
            onToggleOffline={toggleOffline}
          />

          {/* Editor with real-time collaboration */}
          {selectedNote ? (
            <CollaborativeEditor
              note={selectedNote}
              folders={folders}
              tags={tags}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onToggleOffline={toggleOffline}
              isOnline={isOnline}
            />
          ) : (
            <div className="editor-container" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <h3>Select a note or create a new one</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                  {!isOnline && 'You\'re offline. Only offline-enabled notes are available.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onComplete={handleImportComplete}
        />
      )}

      {/* Advanced search modal */}
      {showAdvancedSearch && (
        <AdvancedSearch
          folders={folders}
          tags={tags}
          onSelectNote={setSelectedNote}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .header .btn-icon:first-child { display: flex !important; }
        }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
