const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validation');

router.post('/data', optionalAuth, deviceController.receiveData);

router.use(authenticate, validateTenant);

router.get('/', authorize('Admin', 'Manager'), deviceController.getAllDevices);
router.get('/:id', authorize('Admin', 'Manager'), deviceController.getDevice);
router.post('/', authorize('Admin'), validate('device'), deviceController.createDevice);
router.put('/:id', authorize('Admin'), deviceController.updateDevice);
router.delete('/:id', authorize('Admin'), deviceController.deleteDevice);
router.post('/:id/command', authorize('Admin'), deviceController.sendCommand);

module.exports = router;