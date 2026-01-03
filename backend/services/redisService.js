const Redis = require('redis');
const redisConfig = require('../config/redis');

class RedisService {
  constructor() {
    this.client = null;
    this.pubClient = null;
    this.subClient = null;
  }

  initialize() {
    this.client = Redis.createClient(redisConfig);
    this.pubClient = this.client.duplicate();
    this.subClient = this.client.duplicate();

    this.client.on('connect', () => {
      console.log('Connected to Redis');
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.setupSubscriptions();
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttl });
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async publish(channel, message) {
    try {
      await this.pubClient.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Redis publish error:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      await this.subClient.subscribe(channel, (message) => {
        callback(JSON.parse(message));
      });
      return true;
    } catch (error) {
      console.error('Redis subscribe error:', error);
      return false;
    }
  }

  async cacheVehicleLocations(tenantId, locations) {
    const key = `tenant:${tenantId}:vehicle_locations`;
    return await this.set(key, locations, 30);
  }

  async getCachedVehicleLocations(tenantId) {
    const key = `tenant:${tenantId}:vehicle_locations`;
    return await this.get(key);
  }

  async cacheAlert(tenantId, alert) {
    const key = `tenant:${tenantId}:alert:${alert._id}`;
    return await this.set(key, alert, 86400);
  }

  async getCachedAlert(tenantId, alertId) {
    const key = `tenant:${tenantId}:alert:${alertId}`;
    return await this.get(key);
  }

  setupSubscriptions() {
    this.subscribe('alerts', (alert) => {
      console.log('Alert received:', alert);
    });

    this.subscribe('locations', (locationUpdate) => {
      console.log('Location update:', locationUpdate);
    });
  }
}

module.exports = new RedisService();