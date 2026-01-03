const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { gpsDataLimiter } = require('../middleware/rateLimiter');

router.use(authenticate, validateTenant);

router.get('/live', authorize('Admin', 'Manager', 'Driver'), trackingController.getLiveLocations);
router.get('/history', authorize('Admin', 'Manager'), trackingController.getVehicleHistory);
router.get('/trip', authorize('Admin', 'Manager'), trackingController.getTripSummary);

module.exports = router;