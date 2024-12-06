const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const { validateToken } = require('../middleware/validate');

router.get('/broker', auth, validateToken, dashboardController.getBrokerDashboard);
router.get('/rfp-carrier', auth, validateToken, dashboardController.getRFPCarrierDashboard);
router.get('/rfd-carrier', auth, validateToken, dashboardController.getRFDCarrierDashboard);

module.exports = router; 