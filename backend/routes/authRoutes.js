const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', validate('register'), authController.register);
router.post('/login', authLimiter, validate('login'), authController.login);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);

module.exports = router;