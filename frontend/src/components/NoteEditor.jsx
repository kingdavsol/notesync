import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trash2, CloudOff, Cloud, Tag, Folder, MoreVertical,
  CheckSquare, Link2, Pencil, ExternalLink, List,
  Share2, Bell, History, Pin, PinOff, Copy,
  Table, Code, Quote, Heading1, Heading2, Minus, Mic
} from 'lucide-react';
import DrawingCanvas from './DrawingCanvas';
import NoteLinkPicker from './NoteLinkPicker';
import ShareModal from './ShareModal';
import ReminderModal from './ReminderModal';
import VersionHistory from './VersionHistory';
import TableEditor from './TableEditor';
import CodeBlockEditor from './CodeBlockEditor';
import VoiceRecorder from './VoiceRecorder';
import api from '../services/api';

export default function NoteEditor({ 
  note, 
  folders, 
  tags: allTags,
  onUpdate, 
  onDelete, 
  onToggleOffline,
  isOnline 
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [noteTags, setNoteTags] = useState(note?.tags || []);
  const [folderId, setFolderId] = useState(note?.folder_id);
  const [showMenu, setShowMenu] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showDrawing, setShowDrawing] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [drawings, setDrawings] = useState([]);
  const [backlinks, setBacklinks] = useState([]);
  const saveTimeoutRef = useRef(null);
  const contentRef = useRef(null);

  // Reset when note changes
  useEffect(() => {
    setTitle(note?.title || '');
    const newContent = note?.content || '';
    setContent(newContent);
    setNoteTags(note?.tags?.map(t => typeof t === 'string' ? t : t.name) || []);
    setFolderId(note?.folder_id);

    // Update contentEditable div directly to prevent cursor issues
    if (contentRef.current && contentRef.current.innerHTML !== newContent) {
      contentRef.current.innerHTML = newContent;
    }

    // Load drawings and backlinks
    if (note?.id && isOnline) {
      loadDrawings();
      loadBacklinks();
    } else {
      setDrawings([]);
      setBacklinks([]);
    }
  }, [note?.id, note?.localId]);

  const loadDrawings = async () => {
    if (!note?.id) return;
    try {
      const data = await api.request(`/drawings/note/${note.id}`);
      setDrawings(data.drawings || []);
    } catch (err) {
      console.error('Failed to load drawings:', err);
    }
  };

  const loadBacklinks = async () => {
    if (!note?.id) return;
    try {
      const data = await api.request(`/links/to/${note.id}`);
      setBacklinks(data.backlinks || []);
    } catch (err) {
      console.error('Failed to load backlinks:', err);
    }
  };

  const handleSaveDrawing = async (drawingData) => {
    if (!note?.id) return;
    try {
      await api.request('/drawings', {
        method: 'POST',
        body: JSON.stringify({
          note_id: note.id,
          ...drawingData
        })
      });
      loadDrawings();
      setShowDrawing(false);
    } catch (err) {
      console.error('Failed to save drawing:', err);
    }
  };

  const handleInsertLink = async (targetNote) => {
    if (!note?.id) return;
    
    // Create link in database
    try {
      await api.request('/links', {
        method: 'POST',
        body: JSON.stringify({
          source_note_id: note.id,
          target_note_id: targetNote.id,
          link_text: targetNote.title
        })
      });
    } catch (err) {
      console.error('Failed to create link:', err);
    }

    // Insert link HTML into content
    const linkHtml = `<a href="#note-${targetNote.id}" class="internal-link" data-note-id="${targetNote.id}">${targetNote.title}</a>`;
    document.execCommand('insertHTML', false, linkHtml);
    
    setShowLinkPicker(false);
    contentRef.current?.focus();
  };

  const insertChecklist = () => {
    const checklistHtml = `
      <div class="checklist-item" data-checklist="true">
        <input type="checkbox" onclick="this.parentElement.classList.toggle('checked', this.checked)">
        <span contenteditable="true">Task item</span>
      </div>
    `;
    document.execCommand('insertHTML', false, checklistHtml);
    contentRef.current?.focus();
  };

  const insertExternalLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const text = prompt('Link text (optional):', url);
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text || url}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
      contentRef.current?.focus();
    }
  };

  // Auto-save with debounce
  const saveNote = useCallback(() => {
    if (!note) return;
    
    onUpdate({
      ...note,
      title,
      content,
      folder_id: folderId,
      tags: noteTags
    });
  }, [note, title, content, folderId, noteTags, onUpdate]);

  // Debounced save
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, folderId, noteTags]);

  function handleAddTag(e) {
    e.preventDefault();
    if (newTag.trim() && !noteTags.includes(newTag.trim())) {
      setNoteTags([...noteTags, newTag.trim()]);
      setNewTag('');
    }
    setShowTagInput(false);
  }

  function handleRemoveTag(tag) {
    setNoteTags(noteTags.filter(t => t !== tag));
  }

  function handleContentChange(e) {
    setContent(e.target.innerHTML);
  }

  // Basic formatting commands
  function execCommand(cmd, value = null) {
    document.execCommand(cmd, false, value);
    contentRef.current?.focus();
  }

  return (
    <div className="editor-container">
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => execCommand('bold')}
            title="Bold"
          >
            <b>B</b>
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => execCommand('italic')}
            title="Italic"
          >
            <i>I</i>
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => execCommand('underline')}
            title="Underline"
          >
            <u>U</u>
          </button>
          <span style={styles.divider} />
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => execCommand('insertUnorderedList')}
            title="Bullet list"
          >
            •
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => execCommand('insertOrderedList')}
            title="Numbered list"
          >
            1.
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={insertChecklist}
            title="Checklist"
          >
            <CheckSquare size={16} />
          </button>
          <span style={styles.divider} />
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => setShowLinkPicker(true)}
            title="Link to note"
            disabled={!note?.id || !isOnline}
          >
            <Link2 size={16} />
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={insertExternalLink}
            title="External link"
          >
            <ExternalLink size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowDrawing(true)}
            title="Add drawing"
            disabled={!note?.id || !isOnline}
          >
            <Pencil size={16} />
          </button>
          <span style={styles.divider} />
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => execCommand('formatBlock', 'h1')}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => execCommand('formatBlock', 'h2')}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => execCommand('formatBlock', 'blockquote')}
            title="Quote"
          >
            <Quote size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowTableEditor(true)}
            title="Insert table"
          >
            <Table size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowCodeEditor(true)}
            title="Insert code block"
          >
            <Code size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => document.execCommand('insertHorizontalRule')}
            title="Horizontal line"
          >
            <Minus size={16} />
          </button>
          <span style={styles.divider} />
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowVoiceRecorder(true)}
            title="Voice note"
          >
            <Mic size={16} />
          </button>
        </div>

        <div style={styles.toolbarRight}>
          {/* Folder selector */}
          <select
            value={folderId || ''}
            onChange={e => setFolderId(e.target.value || null)}
            style={styles.select}
          >
            <option value="">No folder</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {/* Offline toggle */}
          <button
            className={`btn btn-ghost btn-icon ${note?.offline_enabled ? 'active' : ''}`}
            onClick={() => onToggleOffline(note)}
            title={note?.offline_enabled ? 'Available offline' : 'Enable offline'}
            disabled={!isOnline}
            style={note?.offline_enabled ? { color: 'var(--accent)' } : {}}
          >
            {note?.offline_enabled ? <CloudOff size={18} /> : <Cloud size={18} />}
          </button>

          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical size={18} />
            </button>

            {showMenu && (
              <>
                <div
                  style={styles.menuOverlay}
                  onClick={() => setShowMenu(false)}
                />
                <div style={styles.menu}>
                  <button
                    style={styles.menuItem}
                    onClick={() => { setShowShareModal(true); setShowMenu(false); }}
                    disabled={!note?.id || !isOnline}
                  >
                    <Share2 size={16} />
                    Share note
                  </button>
                  <button
                    style={styles.menuItem}
                    onClick={() => { setShowReminderModal(true); setShowMenu(false); }}
                    disabled={!note?.id || !isOnline}
                  >
                    <Bell size={16} />
                    Set reminder
                  </button>
                  <button
                    style={styles.menuItem}
                    onClick={() => { setShowHistory(true); setShowMenu(false); }}
                    disabled={!note?.id || !isOnline}
                  >
                    <History size={16} />
                    Version history
                  </button>
                  <button
                    style={styles.menuItem}
                    onClick={() => {
                      onUpdate({ ...note, is_pinned: !note?.is_pinned });
                      setShowMenu(false);
                    }}
                  >
                    {note?.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
                    {note?.is_pinned ? 'Unpin note' : 'Pin note'}
                  </button>
                  <div style={styles.menuDivider} />
                  <button
                    style={{ ...styles.menuItem, color: 'var(--error)' }}
                    onClick={() => { onDelete(note); setShowMenu(false); }}
                  >
                    <Trash2 size={16} />
                    Delete note
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor header */}
      <div className="editor-header">
        <input
          type="text"
          className="editor-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled"
        />

        {/* Tags */}
        <div style={styles.tagsRow}>
          <Tag size={14} style={{ color: 'var(--text-muted)' }} />
          
          {noteTags.map((tag, i) => (
            <span key={i} className="tag">
              {tag}
              <button 
                onClick={() => handleRemoveTag(tag)}
                style={styles.tagRemove}
              >
                ×
              </button>
            </span>
          ))}

          {showTagInput ? (
            <form onSubmit={handleAddTag} style={{ display: 'inline-flex' }}>
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Add tag"
                autoFocus
                onBlur={() => setTimeout(() => setShowTagInput(false), 100)}
                style={styles.tagInput}
              />
            </form>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              style={styles.addTag}
            >
              + Add tag
            </button>
          )}
        </div>
      </div>

      {/* Editor body */}
      <div className="editor-body">
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleContentChange}
          onBlur={(e) => setContent(e.target.innerHTML)}
          style={styles.contentEditable}
          data-placeholder="Start writing..."
        ></div>
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        {!isOnline && (
          <span style={styles.offlineNotice}>
            <CloudOff size={12} />
            Editing offline - changes will sync when online
          </span>
        )}
        {note?._syncStatus === 'pending' && (
          <span style={styles.pendingNotice}>Changes pending sync</span>
        )}
      </div>

      {/* Drawings section */}
      {drawings.length > 0 && (
        <div style={styles.drawingsSection}>
          <h4 style={styles.sectionTitle}>
            <Pencil size={14} /> Drawings ({drawings.length})
          </h4>
          <div style={styles.drawingsGrid}>
            {drawings.map(drawing => (
              <div key={drawing.id} style={styles.drawingThumb}>
                <img 
                  src={drawing.thumbnail || drawing.drawing_data} 
                  alt="Drawing"
                  style={styles.drawingImg}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backlinks section */}
      {backlinks.length > 0 && (
        <div style={styles.backlinksSection}>
          <h4 style={styles.sectionTitle}>
            <Link2 size={14} /> Linked from ({backlinks.length})
          </h4>
          <div style={styles.backlinksList}>
            {backlinks.map(link => (
              <div key={link.id} style={styles.backlinkItem}>
                <Link2 size={12} />
                {link.source_title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawing canvas modal */}
      {showDrawing && (
        <DrawingCanvas
          onSave={handleSaveDrawing}
          onClose={() => setShowDrawing(false)}
        />
      )}

      {/* Note link picker modal */}
      {showLinkPicker && (
        <NoteLinkPicker
          excludeNoteId={note?.id}
          onSelect={handleInsertLink}
          onClose={() => setShowLinkPicker(false)}
        />
      )}

      {/* Share modal */}
      {showShareModal && note?.id && (
        <ShareModal
          note={note}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Reminder modal */}
      {showReminderModal && note?.id && (
        <ReminderModal
          note={note}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      {/* Version history modal */}
      {showHistory && note?.id && (
        <VersionHistory
          note={note}
          onRestore={(restoredNote) => {
            onUpdate(restoredNote);
            setTitle(restoredNote.title);
            setContent(restoredNote.content);
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Table editor modal */}
      {showTableEditor && (
        <TableEditor
          onInsert={(html) => {
            document.execCommand('insertHTML', false, html);
            contentRef.current?.focus();
          }}
          onClose={() => setShowTableEditor(false)}
        />
      )}

      {/* Code block editor modal */}
      {showCodeEditor && (
        <CodeBlockEditor
          onInsert={(html) => {
            document.execCommand('insertHTML', false, html);
            contentRef.current?.focus();
          }}
          onClose={() => setShowCodeEditor(false)}
        />
      )}

      {/* Voice recorder modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onTranscription={(text) => {
            // Insert transcribed text at cursor position
            const formattedText = text.replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, `<p>${formattedText}</p>`);
            contentRef.current?.focus();
            setShowVoiceRecorder(false);
          }}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  divider: {
    width: '1px',
    height: '20px',
    background: 'var(--border)',
    margin: '0 8px'
  },
  select: {
    padding: '6px 10px',
    fontSize: '13px',
    maxWidth: '150px'
  },
  tagsRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px'
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '0 0 0 4px',
    fontSize: '14px'
  },
  tagInput: {
    padding: '2px 8px',
    fontSize: '12px',
    width: '100px'
  },
  addTag: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 8px'
  },
  contentEditable: {
    minHeight: '400px',
    outline: 'none',
    lineHeight: '1.7',
    fontSize: '15px',
    direction: 'ltr',
    textAlign: 'left'
  },
  menuOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '4px',
    minWidth: '150px',
    zIndex: 11,
    boxShadow: 'var(--shadow)'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    textAlign: 'left'
  },
  menuDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '4px 0'
  },
  statusBar: {
    padding: '8px 16px',
    borderTop: '1px solid var(--border)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  offlineNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--warning)'
  },
  pendingNotice: {
    color: 'var(--accent)'
  },
  drawingsSection: {
    padding: '16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '12px'
  },
  drawingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '8px'
  },
  drawingThumb: {
    aspectRatio: '4/3',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    border: '1px solid var(--border)'
  },
  drawingImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  backlinksSection: {
    padding: '16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  backlinksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  backlinkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    cursor: 'pointer'
  }
};
