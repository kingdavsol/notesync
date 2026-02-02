import React from 'react';
import { CloudOff, Pin } from 'lucide-react';

export default function NoteList({ notes, selectedNote, onSelect, onToggleOffline }) {
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }

  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, len = 80) {
    if (!str || str.length <= len) return str;
    return str.slice(0, len) + '...';
  }

  const isSelected = (note) => {
    if (selectedNote?.id && note.id) return selectedNote.id === note.id;
    if (selectedNote?.localId && note.localId) return selectedNote.localId === note.localId;
    return false;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.count}>{notes.length} notes</span>
      </div>

      <div style={styles.list}>
        {notes.length === 0 ? (
          <div style={styles.empty}>
            <p>No notes found</p>
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id || note.localId}
              className={`note-item ${isSelected(note) ? 'active' : ''}`}
              onClick={() => onSelect(note)}
            >
              <div className="note-item-title">
                {note.is_pinned && <Pin size={14} style={{ color: 'var(--accent)' }} />}
                <span>{note.title || 'Untitled'}</span>
                {note.offline_enabled && (
                  <span 
                    className="offline-badge"
                    onClick={e => { e.stopPropagation(); onToggleOffline(note); }}
                    title="Available offline"
                  >
                    <CloudOff size={10} />
                  </span>
                )}
              </div>
              
              <div className="note-item-preview">
                {truncate(stripHtml(note.content)) || 'No content'}
              </div>
              
              <div className="note-item-meta">
                <span>{formatDate(note.updated_at)}</span>
                {note.tags && note.tags.length > 0 && (
                  <span style={styles.tags}>
                    {note.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag" style={{ marginLeft: '4px' }}>
                        {typeof tag === 'string' ? tag : tag.name}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </span>
                )}
                {note._isLocal && note._syncStatus === 'pending' && (
                  <span style={styles.pendingBadge}>Pending sync</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '320px',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
    flexShrink: 0
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  count: {
    fontSize: '13px',
    color: 'var(--text-muted)'
  },
  list: {
    flex: 1,
    overflow: 'auto'
  },
  empty: {
    padding: '24px 16px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  tags: {
    display: 'inline-flex',
    alignItems: 'center'
  },
  pendingBadge: {
    fontSize: '10px',
    color: 'var(--warning)',
    marginLeft: '8px'
  }
};
