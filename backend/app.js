const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const alertRoutes = require('./routes/alertRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/tenants', apiLimiter, tenantRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/vehicles', apiLimiter, vehicleRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/alerts', apiLimiter, alertRoutes);
app.use('/api/maintenance', apiLimiter, maintenanceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Fleet Management API'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;