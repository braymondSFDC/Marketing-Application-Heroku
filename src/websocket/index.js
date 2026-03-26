'use strict';

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { Redis } = require('ioredis');

/**
 * Initialize Socket.io with Redis adapter for multi-dyno support.
 * Returns the Socket.io server instance.
 */
function initializeWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // Standalone mode — accept all origins
        cb(null, true);
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Redis adapter for horizontal scaling across dynos
  if (process.env.REDIS_URL) {
    const pubClient = new Redis(process.env.REDIS_URL, {
      tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    console.log('[WebSocket] Redis adapter connected');
  }

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Join journey-specific room
    socket.on('join:journey', (journeyId) => {
      socket.join(`journey:${journeyId}`);
      console.log(`[WebSocket] ${socket.id} joined journey:${journeyId}`);
    });

    socket.on('leave:journey', (journeyId) => {
      socket.leave(`journey:${journeyId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Emit an event to all clients watching a specific journey.
 */
function emitToJourney(io, journeyId, eventName, data) {
  io.to(`journey:${journeyId}`).emit(eventName, data);
}

module.exports = { initializeWebSocket, emitToJourney };
