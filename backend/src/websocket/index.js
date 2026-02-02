const { Server } = require('socket.io');
const CollaborationService = require('./collaboration');

function initializeWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Initialize collaboration service
  const collaborationService = new CollaborationService(io);

  // Namespace for collaboration
  const collaborationNamespace = io.of('/collaboration');

  // Store reference for external access
  io.collaborationService = collaborationService;

  console.log('WebSocket server initialized');

  return io;
}

module.exports = { initializeWebSocket };
