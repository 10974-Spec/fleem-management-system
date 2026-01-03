const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validation');

router.post('/callback', paymentController.paymentCallback);

router.use(authenticate, validateTenant);

router.post('/initiate', authorize('Admin'), validate('payment'), paymentController.initiatePayment);
router.get('/:id/status', authorize('Admin'), paymentController.getPaymentStatus);

module.exports = router;