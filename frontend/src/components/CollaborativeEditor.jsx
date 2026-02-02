import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App';
import { useCollaboration } from '../hooks/useCollaboration';
import NoteEditor from './NoteEditor';
import CollaboratorPresence from './CollaboratorPresence';
import CollaboratorCursors from './CollaboratorCursors';

/**
 * Wrapper component that adds real-time collaboration to the NoteEditor
 */
export default function CollaborativeEditor({
  note,
  folders,
  tags,
  onUpdate,
  onDelete,
  onToggleOffline,
  isOnline
}) {
  const { token } = useAuth();
  const contentRef = useRef(null);
  const [localNote, setLocalNote] = useState(note);
  const lastUpdateRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);

  const {
    connected,
    collaborators,
    remoteCursors,
    typingUsers,
    sendContentChange,
    sendCursorPosition,
    sendTitleChange,
    sendTypingIndicator,
    onRemoteChange,
    onRemoteTitleChange
  } = useCollaboration(note?.id, token);

  // Sync local note with prop
  useEffect(() => {
    if (note && !isRemoteUpdateRef.current) {
      setLocalNote(note);
    }
    isRemoteUpdateRef.current = false;
  }, [note]);

  // Handle remote content changes
  useEffect(() => {
    if (!note?.id) return;

    const unsubscribe = onRemoteChange((data) => {
      if (data.noteId !== note.id) return;

      // Mark as remote update to prevent echo
      isRemoteUpdateRef.current = true;

      // Apply the operation to local content
      // In a production system, this would use Operational Transformation
      // For now, we just update the content directly
      setLocalNote(prev => ({
        ...prev,
        content: applyOperation(prev.content, data.operation)
      }));
    });

    return unsubscribe;
  }, [note?.id, onRemoteChange]);

  // Handle remote title changes
  useEffect(() => {
    if (!note?.id) return;

    const unsubscribe = onRemoteTitleChange((data) => {
      if (data.noteId !== note.id) return;

      isRemoteUpdateRef.current = true;
      setLocalNote(prev => ({
        ...prev,
        title: data.title
      }));
    });

    return unsubscribe;
  }, [note?.id, onRemoteTitleChange]);

  // Handle local updates and broadcast to collaborators
  const handleUpdate = useCallback((updatedNote) => {
    const previousNote = lastUpdateRef.current || localNote;
    lastUpdateRef.current = updatedNote;

    // Detect what changed
    if (updatedNote.content !== previousNote?.content) {
      // Create a simple operation for the change
      const operation = {
        type: 'replace',
        content: updatedNote.content,
        timestamp: Date.now()
      };
      sendContentChange(operation);
      sendTypingIndicator(true);
    }

    if (updatedNote.title !== previousNote?.title) {
      sendTitleChange(updatedNote.title);
    }

    // Call the original update handler
    onUpdate(updatedNote);
  }, [localNote, onUpdate, sendContentChange, sendTitleChange, sendTypingIndicator]);

  // Track cursor position
  const handleCursorMove = useCallback(() => {
    if (!contentRef.current) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Calculate offset from start of content
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(contentRef.current);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const offset = preCaretRange.toString().length;

    sendCursorPosition(
      { offset },
      selection.isCollapsed ? null : {
        start: offset,
        end: offset + selection.toString().length
      }
    );
  }, [sendCursorPosition]);

  // Set up cursor tracking
  useEffect(() => {
    const handleSelectionChange = () => {
      handleCursorMove();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleCursorMove]);

  // Only show collaboration UI if note exists and is saved
  const showCollaboration = note?.id && isOnline;

  return (
    <div style={styles.container}>
      {/* Collaboration status bar */}
      {showCollaboration && collaborators.length > 1 && (
        <div style={styles.collaborationBar}>
          <CollaboratorPresence
            collaborators={collaborators}
            typingUsers={typingUsers}
            connected={connected}
          />
        </div>
      )}

      {/* Editor with cursor overlays */}
      <div style={styles.editorWrapper}>
        <NoteEditor
          note={localNote}
          folders={folders}
          tags={tags}
          onUpdate={handleUpdate}
          onDelete={onDelete}
          onToggleOffline={onToggleOffline}
          isOnline={isOnline}
          contentRef={contentRef}
        />

        {/* Remote cursors */}
        {showCollaboration && (
          <CollaboratorCursors
            remoteCursors={remoteCursors}
            containerRef={contentRef}
          />
        )}
      </div>

      {/* Connection status indicator */}
      {showCollaboration && !connected && (
        <div style={styles.connectionWarning}>
          Reconnecting to collaboration server...
        </div>
      )}
    </div>
  );
}

/**
 * Apply an operation to content
 * This is a simplified version - production would use OT/CRDT
 */
function applyOperation(content, operation) {
  switch (operation.type) {
    case 'replace':
      return operation.content;
    case 'insert':
      return (
        content.slice(0, operation.position) +
        operation.text +
        content.slice(operation.position)
      );
    case 'delete':
      return (
        content.slice(0, operation.position) +
        content.slice(operation.position + operation.length)
      );
    default:
      return content;
  }
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  collaborationBar: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-primary)'
  },
  editorWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  connectionWarning: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--warning)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    zIndex: 1000
  }
};
