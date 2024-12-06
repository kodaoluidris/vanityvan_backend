const express = require('express');
const router = express.Router();
const loadboardController = require('../controllers/loadboardController');
const auth = require('../middleware/auth');

router.get('/scrape', auth, loadboardController.getAllLoadboardData);

module.exports = router; 