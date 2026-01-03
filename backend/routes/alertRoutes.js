const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');

router.use(authenticate, validateTenant);

router.get('/', authorize('Admin', 'Manager'), alertController.getAllAlerts);
router.get('/stats', authorize('Admin', 'Manager'), alertController.getAlertStats);
router.post('/:id/acknowledge', authorize('Admin', 'Manager'), alertController.acknowledgeAlert);
router.post('/:id/resolve', authorize('Admin', 'Manager'), alertController.resolveAlert);
router.delete('/:id', authorize('Admin'), alertController.deleteAlert);
router.post('/bulk/acknowledge', authorize('Admin', 'Manager'), alertController.bulkAcknowledge);

module.exports = router;