const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validation');

router.use(authenticate, validateTenant);

router.get('/', authorize('Admin', 'Manager'), maintenanceController.getAllMaintenance);
router.get('/upcoming', authorize('Admin', 'Manager'), maintenanceController.getUpcomingMaintenance);
router.get('/:id', authorize('Admin', 'Manager'), maintenanceController.getMaintenance);
router.post('/', authorize('Admin', 'Manager'), validate('maintenance'), maintenanceController.createMaintenance);
router.put('/:id', authorize('Admin', 'Manager'), maintenanceController.updateMaintenance);
router.delete('/:id', authorize('Admin'), maintenanceController.deleteMaintenance);

module.exports = router;