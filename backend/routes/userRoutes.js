const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validateTenant } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');

router.use(authenticate, validateTenant);

router.get('/', authorize('Admin', 'Manager'), userController.getAllUsers);
router.get('/:id', authorize('Admin', 'Manager'), userController.getUser);
router.post('/', authorize('Admin'), userController.createUser);
router.put('/:id', authorize('Admin'), userController.updateUser);
router.delete('/:id', authorize('Admin'), userController.deleteUser);

module.exports = router;