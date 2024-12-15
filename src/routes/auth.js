const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { validateRegistration, validateLogin, validateProfileUpdate } = require('../middleware/validate');
const auth = require('../middleware/auth');

router.get('/', AuthController.test);
router.post('/register', validateRegistration, AuthController.register);
router.post('/login', validateLogin, AuthController.login);
router.post('/refresh-token', auth, AuthController.refreshToken);
router.get('/profile', auth, AuthController.getProfile);
router.put('/profile/update', auth, validateProfileUpdate, AuthController.updateProfile);

module.exports = router; 