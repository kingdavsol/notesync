import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export function useCollaboration(noteId, token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [documentVersion, setDocumentVersion] = useState(0);

  const pendingChanges = useRef([]);
  const typingTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Collaboration socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Collaboration socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Collaboration connection error:', error.message);
    });

    // Handle collaborator updates
    newSocket.on('collaborators-update', (data) => {
      setCollaborators(data.collaborators);
      setDocumentVersion(data.version);
    });

    newSocket.on('user-joined', (data) => {
      setCollaborators(prev => {
        if (prev.find(c => c.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
    });

    newSocket.on('user-left', (data) => {
      setCollaborators(prev => prev.filter(c => c.socketId !== data.socketId));
      setRemoteCursors(prev => {
        const updated = new Map(prev);
        updated.delete(data.socketId);
        return updated;
      });
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.socketId);
        return updated;
      });
    });

    // Handle cursor updates
    newSocket.on('cursor-moved', (data) => {
      setRemoteCursors(prev => {
        const updated = new Map(prev);
        updated.set(data.socketId, {
          user: data.user,
          position: data.position,
          selection: data.selection
        });
        return updated;
      });
    });

    newSocket.on('cursors-sync', (data) => {
      const cursorMap = new Map();
      data.cursors.forEach(cursor => {
        cursorMap.set(cursor.user.socketId, cursor);
      });
      setRemoteCursors(cursorMap);
    });

    // Handle content changes from others
    newSocket.on('content-changed', (data) => {
      setDocumentVersion(data.version);
      // This will be handled by the editor component
    });

    newSocket.on('change-acknowledged', (data) => {
      setDocumentVersion(data.version);
      // Remove acknowledged change from pending
      pendingChanges.current = pendingChanges.current.filter(
        c => c.version !== data.version
      );
    });

    // Handle title changes
    newSocket.on('title-changed', (data) => {
      // Will be handled by parent component
    });

    // Handle typing indicators
    newSocket.on('user-typing', (data) => {
      setTypingUsers(prev => new Set([...prev, data.user.socketId]));
    });

    newSocket.on('user-stopped-typing', (data) => {
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.socketId);
        return updated;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Join/leave note room
  useEffect(() => {
    if (!socket || !connected || !noteId) return;

    socket.emit('join-note', noteId);

    return () => {
      socket.emit('leave-note', noteId);
    };
  }, [socket, connected, noteId]);

  // Send content change
  const sendContentChange = useCallback((operation) => {
    if (!socket || !connected || !noteId) return;

    const change = {
      noteId,
      operation,
      version: documentVersion
    };

    pendingChanges.current.push(change);
    socket.emit('content-change', change);
  }, [socket, connected, noteId, documentVersion]);

  // Send cursor position
  const sendCursorPosition = useCallback((position, selection) => {
    if (!socket || !connected || !noteId) return;

    socket.emit('cursor-move', {
      noteId,
      position,
      selection
    });
  }, [socket, connected, noteId]);

  // Send title change
  const sendTitleChange = useCallback((title) => {
    if (!socket || !connected || !noteId) return;

    socket.emit('title-change', {
      noteId,
      title
    });
  }, [socket, connected, noteId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping) => {
    if (!socket || !connected || !noteId) return;

    if (isTyping) {
      socket.emit('typing-start', noteId);

      // Auto-stop after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing-stop', noteId);
      }, 3000);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.emit('typing-stop', noteId);
    }
  }, [socket, connected, noteId]);

  // Subscribe to remote content changes
  const onRemoteChange = useCallback((callback) => {
    if (!socket) return () => {};

    socket.on('content-changed', callback);
    return () => socket.off('content-changed', callback);
  }, [socket]);

  // Subscribe to remote title changes
  const onRemoteTitleChange = useCallback((callback) => {
    if (!socket) return () => {};

    socket.on('title-changed', callback);
    return () => socket.off('title-changed', callback);
  }, [socket]);

  return {
    connected,
    collaborators,
    remoteCursors,
    typingUsers,
    documentVersion,
    sendContentChange,
    sendCursorPosition,
    sendTitleChange,
    sendTypingIndicator,
    onRemoteChange,
    onRemoteTitleChange
  };
}
