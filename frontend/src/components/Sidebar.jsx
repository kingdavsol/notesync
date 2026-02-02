import React, { useState } from 'react';
import { 
  Folder, Tag, Download, CloudOff, Plus, 
  LogOut, ChevronDown, ChevronRight, Trash2, X,
  FileText, Settings
} from 'lucide-react';

export default function Sidebar({
  user,
  folders,
  tags,
  selectedFolder,
  selectedTag,
  showOfflineOnly,
  onSelectFolder,
  onSelectTag,
  onToggleOfflineOnly,
  onCreateFolder,
  onDeleteFolder,
  onImport,
  onLogout,
  isOpen,
  onClose
}) {
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  function handleCreateFolder(e) {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={styles.sidebar}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <FileText size={20} color="#2dbe60" />
          </div>
          <span style={styles.logoText}>NoteSync</span>
        </div>
        <button 
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          style={styles.closeBtn}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {/* All Notes */}
        <button
          style={{
            ...styles.navItem,
            ...((!selectedFolder && !selectedTag && !showOfflineOnly) ? styles.navItemActive : {})
          }}
          onClick={() => { onSelectFolder(null); onSelectTag(null); }}
        >
          <FileText size={18} style={styles.navIcon} />
          <span>All Notes</span>
        </button>

        {/* Offline Only */}
        <button
          style={{
            ...styles.navItem,
            ...(showOfflineOnly ? styles.navItemActive : {})
          }}
          onClick={onToggleOfflineOnly}
        >
          <CloudOff size={18} style={styles.navIcon} />
          <span>Available Offline</span>
        </button>

        {/* Notebooks/Folders Section */}
        <div style={styles.section}>
          <button 
            style={styles.sectionHeader}
            onClick={() => setFoldersExpanded(!foldersExpanded)}
          >
            {foldersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>NOTEBOOKS</span>
            <button
              style={styles.addBtn}
              onClick={e => { e.stopPropagation(); setShowNewFolder(true); }}
              title="New Notebook"
            >
              <Plus size={14} />
            </button>
          </button>

          {foldersExpanded && (
            <div style={styles.sectionContent}>
              {showNewFolder && (
                <form onSubmit={handleCreateFolder} style={styles.newFolderForm}>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Notebook name"
                    autoFocus
                    style={styles.newFolderInput}
                  />
                  <button type="submit" style={styles.newFolderSubmit}>
                    Add
                  </button>
                </form>
              )}

              {folders.map(folder => (
                <div key={folder.id} style={styles.folderItem}>
                  <button
                    style={{
                      ...styles.navItem,
                      ...styles.navItemNested,
                      ...(selectedFolder === folder.id ? styles.navItemActive : {})
                    }}
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <Folder size={16} style={styles.navIcon} />
                    <span style={styles.folderName}>{folder.name}</span>
                    <span style={styles.count}>{folder.note_count || 0}</span>
                  </button>
                  <button
                    style={styles.deleteBtn}
                    onClick={() => onDeleteFolder(folder.id)}
                    title="Delete notebook"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {folders.length === 0 && !showNewFolder && (
                <p style={styles.empty}>No notebooks yet</p>
              )}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div style={styles.section}>
          <button 
            style={styles.sectionHeader}
            onClick={() => setTagsExpanded(!tagsExpanded)}
          >
            {tagsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>TAGS</span>
          </button>

          {tagsExpanded && (
            <div style={styles.sectionContent}>
              {tags.map(tag => (
                <button
                  key={tag.id}
                  style={{
                    ...styles.navItem,
                    ...styles.navItemNested,
                    ...(selectedTag === tag.name ? styles.navItemActive : {})
                  }}
                  onClick={() => onSelectTag(tag.name)}
                >
                  <Tag size={16} style={styles.navIcon} />
                  <span style={styles.folderName}>{tag.name}</span>
                  <span style={styles.count}>{tag.note_count || 0}</span>
                </button>
              ))}

              {tags.length === 0 && (
                <p style={styles.empty}>No tags yet</p>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div style={styles.footer}>
        <button
          style={styles.importBtn}
          onClick={onImport}
        >
          <Download size={16} />
          Import from Evernote
        </button>

        <div style={styles.user}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <span style={styles.email}>{user?.email}</span>
          </div>
          <button
            style={styles.logoutBtn}
            onClick={onLogout}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar .closeBtn { display: flex !important; }
        }
      `}</style>
    </aside>
  );
}

const styles = {
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fafafa',
    borderRight: '1px solid #eff2f3'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid #eff2f3'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(45, 190, 96, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    fontWeight: 600,
    fontSize: '16px',
    color: '#1a1a1a'
  },
  closeBtn: {
    display: 'none'
  },
  nav: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 0'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    color: '#525e63',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    textAlign: 'left'
  },
  navItemNested: {
    paddingLeft: '24px'
  },
  navItemActive: {
    background: 'rgba(45, 190, 96, 0.08)',
    color: '#2dbe60'
  },
  navIcon: {
    flexShrink: 0,
    opacity: 0.7
  },
  section: {
    marginTop: '8px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    color: '#7b868a',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    textAlign: 'left'
  },
  addBtn: {
    marginLeft: 'auto',
    padding: '4px',
    background: 'none',
    border: 'none',
    color: '#7b868a',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionContent: {
    marginTop: '2px'
  },
  folderItem: {
    display: 'flex',
    alignItems: 'center'
  },
  folderName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  count: {
    fontSize: '11px',
    color: '#aeb6b8',
    background: '#eff2f3',
    padding: '2px 6px',
    borderRadius: '10px',
    marginLeft: 'auto'
  },
  deleteBtn: {
    padding: '6px',
    background: 'none',
    border: 'none',
    color: '#aeb6b8',
    cursor: 'pointer',
    opacity: 0,
    transition: 'opacity 0.1s ease'
  },
  newFolderForm: {
    display: 'flex',
    gap: '8px',
    padding: '8px 16px 8px 24px'
  },
  newFolderInput: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid #e0e4e5',
    borderRadius: '6px',
    background: '#fff'
  },
  newFolderSubmit: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    background: '#2dbe60',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  empty: {
    padding: '8px 24px',
    fontSize: '13px',
    color: '#aeb6b8'
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #eff2f3'
  },
  importBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px',
    marginBottom: '12px',
    background: '#eff2f3',
    border: 'none',
    borderRadius: '8px',
    color: '#525e63',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.1s ease'
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflow: 'hidden'
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#2dbe60',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0
  },
  email: {
    fontSize: '13px',
    color: '#525e63',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    padding: '8px',
    background: 'none',
    border: 'none',
    color: '#7b868a',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};
