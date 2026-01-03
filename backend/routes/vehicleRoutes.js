const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/auth');
const { validateTenant, checkVehicleLimit } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validation');

router.use(authenticate, validateTenant);

router.get('/', authorize('Admin', 'Manager', 'Driver'), vehicleController.getAllVehicles);
router.get('/:id', authorize('Admin', 'Manager', 'Driver'), vehicleController.getVehicle);
router.post('/', authorize('Admin', 'Manager'), checkVehicleLimit, validate('vehicle'), vehicleController.createVehicle);
router.put('/:id', authorize('Admin', 'Manager'), vehicleController.updateVehicle);
router.delete('/:id', authorize('Admin'), vehicleController.deleteVehicle);

module.exports = router;