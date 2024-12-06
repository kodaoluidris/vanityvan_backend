const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { validateProfileUpdate, validatePasswordChange } = require('../middleware/validate');
const upload = require('../utils/uploadConfig');
const UploadController = require('../controllers/uploadController');

router.get('/profile', auth, UserController.getProfile);
router.put('/profile', auth, validateProfileUpdate, UserController.updateProfile);
router.put('/password', auth, validatePasswordChange, UserController.changePassword);
router.get('/dashboard', auth, UserController.getDashboardStats);
router.post(
  '/profile-photo',
  auth,
  upload.single('photo'),
  UploadController.uploadProfilePhoto
);

module.exports = router; 