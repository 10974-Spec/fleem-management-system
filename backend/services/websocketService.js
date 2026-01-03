const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const redisService = require('./redisService');

class WebSocketService {
  constructor() {
    this.io = null;
    this.tenantConnections = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('WebSocket server initialized');
  }

  authenticateSocket(socket, next) {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role
      };
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  }

  handleConnection(socket) {
    const { tenantId, userId } = socket.user;
    
    if (!this.tenantConnections.has(tenantId)) {
      this.tenantConnections.set(tenantId, new Set());
    }
    
    this.tenantConnections.get(tenantId).add(socket.id);

    socket.join(`tenant:${tenantId}`);
    socket.join(`user:${userId}`);

    console.log(`User ${userId} connected to tenant ${tenantId}`);

    socket.on('subscribe:locations', () => {
      socket.join(`tenant:${tenantId}:locations`);
    });

    socket.on('subscribe:alerts', () => {
      socket.join(`tenant:${tenantId}:alerts`);
    });

    socket.on('location:update', (data) => {
      this.broadcastToTenant(tenantId, 'locations', data);
    });

    socket.on('disconnect', () => {
      if (this.tenantConnections.has(tenantId)) {
        this.tenantConnections.get(tenantId).delete(socket.id);
        if (this.tenantConnections.get(tenantId).size === 0) {
          this.tenantConnections.delete(tenantId);
        }
      }
      console.log(`User ${userId} disconnected`);
    });
  }

  broadcastToTenant(tenantId, event, data) {
    this.io.to(`tenant:${tenantId}`).emit(event, data);
  }

  broadcastToTenantRoom(tenantId, room, event, data) {
    this.io.to(`tenant:${tenantId}:${room}`).emit(event, data);
  }

  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  emitAlert(tenantId, alert) {
    this.broadcastToTenantRoom(tenantId, 'alerts', 'alert:new', alert);
    redisService.publish('alerts', { tenantId, alert });
  }

  emitLocationUpdate(tenantId, vehicleId, location) {
    const update = { vehicleId, ...location, timestamp: new Date() };
    this.broadcastToTenantRoom(tenantId, 'locations', 'location:update', update);
    redisService.publish('locations', { tenantId, update });
  }

  getConnectedTenants() {
    return Array.from(this.tenantConnections.keys());
  }

  getTenantConnectionCount(tenantId) {
    return this.tenantConnections.get(tenantId)?.size || 0;
  }
}

module.exports = new WebSocketService();