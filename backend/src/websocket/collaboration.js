const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Store active collaboration sessions
const rooms = new Map(); // noteId -> Set of socket IDs
const users = new Map(); // socket ID -> user info
const cursors = new Map(); // noteId -> Map of cursors (socketId -> position)
const documentVersions = new Map(); // noteId -> version number

class CollaborationService {
  constructor(io) {
    this.io = io;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        next();
      } catch (err) {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.id})`);

      // Store user info
      users.set(socket.id, {
        id: socket.userId,
        email: socket.userEmail,
        socketId: socket.id,
        color: this.generateUserColor(socket.userId),
        name: socket.userEmail.split('@')[0]
      });

      // Handle joining a note for collaboration
      socket.on('join-note', (noteId) => {
        this.handleJoinNote(socket, noteId);
      });

      // Handle leaving a note
      socket.on('leave-note', (noteId) => {
        this.handleLeaveNote(socket, noteId);
      });

      // Handle content changes (Operational Transformation compatible)
      socket.on('content-change', (data) => {
        this.handleContentChange(socket, data);
      });

      // Handle cursor position updates
      socket.on('cursor-move', (data) => {
        this.handleCursorMove(socket, data);
      });

      // Handle selection changes
      socket.on('selection-change', (data) => {
        this.handleSelectionChange(socket, data);
      });

      // Handle title changes
      socket.on('title-change', (data) => {
        this.handleTitleChange(socket, data);
      });

      // Handle typing indicators
      socket.on('typing-start', (noteId) => {
        this.handleTypingStart(socket, noteId);
      });

      socket.on('typing-stop', (noteId) => {
        this.handleTypingStop(socket, noteId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  handleJoinNote(socket, noteId) {
    const roomName = `note:${noteId}`;

    // Leave any other note rooms first
    socket.rooms.forEach(room => {
      if (room.startsWith('note:') && room !== roomName) {
        socket.leave(room);
        this.removeFromRoom(socket, room.replace('note:', ''));
      }
    });

    // Join the new room
    socket.join(roomName);

    // Add to room tracking
    if (!rooms.has(noteId)) {
      rooms.set(noteId, new Set());
      cursors.set(noteId, new Map());
      documentVersions.set(noteId, 0);
    }
    rooms.get(noteId).add(socket.id);

    // Get current collaborators
    const collaborators = this.getCollaborators(noteId);

    // Notify the joining user about current collaborators
    socket.emit('collaborators-update', {
      noteId,
      collaborators,
      version: documentVersions.get(noteId)
    });

    // Notify others about the new collaborator
    socket.to(roomName).emit('user-joined', {
      noteId,
      user: users.get(socket.id)
    });

    // Send current cursors to the joining user
    const currentCursors = cursors.get(noteId);
    if (currentCursors && currentCursors.size > 0) {
      socket.emit('cursors-sync', {
        noteId,
        cursors: Array.from(currentCursors.entries()).map(([socketId, cursor]) => ({
          ...cursor,
          user: users.get(socketId)
        }))
      });
    }

    console.log(`User ${socket.userId} joined note ${noteId}. Active: ${rooms.get(noteId).size}`);
  }

  handleLeaveNote(socket, noteId) {
    const roomName = `note:${noteId}`;
    socket.leave(roomName);
    this.removeFromRoom(socket, noteId);
  }

  removeFromRoom(socket, noteId) {
    const room = rooms.get(noteId);
    if (room) {
      room.delete(socket.id);

      // Remove cursor
      const noteCursors = cursors.get(noteId);
      if (noteCursors) {
        noteCursors.delete(socket.id);
      }

      // Notify others
      this.io.to(`note:${noteId}`).emit('user-left', {
        noteId,
        userId: socket.userId,
        socketId: socket.id
      });

      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(noteId);
        cursors.delete(noteId);
        documentVersions.delete(noteId);
      }
    }
  }

  handleContentChange(socket, data) {
    const { noteId, operation, version } = data;

    // Increment version
    const currentVersion = documentVersions.get(noteId) || 0;
    const newVersion = currentVersion + 1;
    documentVersions.set(noteId, newVersion);

    // Broadcast to other users in the room
    socket.to(`note:${noteId}`).emit('content-changed', {
      noteId,
      operation,
      version: newVersion,
      userId: socket.userId,
      socketId: socket.id,
      timestamp: Date.now()
    });

    // Acknowledge to sender
    socket.emit('change-acknowledged', {
      noteId,
      version: newVersion
    });
  }

  handleCursorMove(socket, data) {
    const { noteId, position, selection } = data;

    const noteCursors = cursors.get(noteId);
    if (noteCursors) {
      noteCursors.set(socket.id, {
        position,
        selection,
        timestamp: Date.now()
      });

      // Broadcast cursor position to others
      socket.to(`note:${noteId}`).emit('cursor-moved', {
        noteId,
        socketId: socket.id,
        user: users.get(socket.id),
        position,
        selection
      });
    }
  }

  handleSelectionChange(socket, data) {
    const { noteId, selection } = data;

    // Broadcast selection to others
    socket.to(`note:${noteId}`).emit('selection-changed', {
      noteId,
      socketId: socket.id,
      user: users.get(socket.id),
      selection
    });
  }

  handleTitleChange(socket, data) {
    const { noteId, title } = data;

    // Broadcast title change to others
    socket.to(`note:${noteId}`).emit('title-changed', {
      noteId,
      title,
      userId: socket.userId,
      timestamp: Date.now()
    });
  }

  handleTypingStart(socket, noteId) {
    socket.to(`note:${noteId}`).emit('user-typing', {
      noteId,
      user: users.get(socket.id)
    });
  }

  handleTypingStop(socket, noteId) {
    socket.to(`note:${noteId}`).emit('user-stopped-typing', {
      noteId,
      socketId: socket.id
    });
  }

  handleDisconnect(socket) {
    console.log(`User disconnected: ${socket.userId} (${socket.id})`);

    // Remove from all rooms
    rooms.forEach((socketIds, noteId) => {
      if (socketIds.has(socket.id)) {
        this.removeFromRoom(socket, noteId);
      }
    });

    // Remove user info
    users.delete(socket.id);
  }

  getCollaborators(noteId) {
    const room = rooms.get(noteId);
    if (!room) return [];

    return Array.from(room).map(socketId => users.get(socketId)).filter(Boolean);
  }

  generateUserColor(userId) {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];

    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  // Get active note sessions (for admin/monitoring)
  getActiveSessions() {
    const sessions = [];
    rooms.forEach((socketIds, noteId) => {
      sessions.push({
        noteId,
        userCount: socketIds.size,
        users: Array.from(socketIds).map(id => users.get(id)).filter(Boolean)
      });
    });
    return sessions;
  }
}

module.exports = CollaborationService;
