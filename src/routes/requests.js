const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const auth = require('../middleware/auth');
const { validateRequestStatus } = require('../middleware/validate');

// Update request status (accept/reject)

router.patch('/:requestId/status', auth, validateRequestStatus, requestController.updateRequestStatus);

module.exports = router; 