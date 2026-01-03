const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');

router.use(authenticate, validateTenant);

router.get('/', tenantController.getTenant);
router.put('/', authorize('Admin'), tenantController.updateTenant);
router.get('/stats', tenantController.getTenantStats);

module.exports = router;