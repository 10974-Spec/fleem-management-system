const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');

router.use(authenticate, validateTenant);

router.get('/plans', subscriptionController.getPlans);
router.get('/current', subscriptionController.getCurrentSubscription);
router.get('/vehicle-limit', subscriptionController.checkVehicleLimit);
router.get('/billing', authorize('Admin'), subscriptionController.getBillingHistory);
router.post('/upgrade', authorize('Admin'), subscriptionController.upgradeToPremium);

module.exports = router;