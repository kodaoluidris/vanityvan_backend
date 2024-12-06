const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const auth = require('../middleware/auth');

router.get('/plans', subscriptionController.getPlans);
router.post('/create', auth, subscriptionController.createSubscription);
router.post('/cancel', auth, subscriptionController.cancelSubscription);
router.get('/status', auth, subscriptionController.getSubscriptionStatus);

module.exports = router; 