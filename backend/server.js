const mongoose = require('mongoose');
const app = require('./app');
const redisService = require('./services/redisService');
const websocketService = require('./services/websocketService');
const gpsServer = require('./services/gpsServer');
const eventHandlers = require('./services/eventHandlers');
const inngestService = require('./services/inngestService');
const { checkDeviceOfflineAlerts } = require('./utils/alertEngine');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fleet_management';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    websocketService.initialize(server);
    redisService.initialize();
    gpsServer.initialize();
    eventHandlers.initialize();
    inngestService.initialize(app);

    setInterval(checkDeviceOfflineAlerts, 5 * 60 * 1000);

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        mongoose.connection.close(false, () => {
          redisService.client.quit();
          console.log('All connections closed.');
          process.exit(0);
        });
      });
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });