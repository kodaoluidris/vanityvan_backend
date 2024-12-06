const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const { 
    validateLoadBoardUrls,
    validateGeneralSettings,
    validateAlertPreferences,
    validateServiceAreas,
    validateRouteAlerts
} = require('../middleware/validate');

// Get all settings
router.get('/', auth, SettingsController.getSettings);

// // Update load board URLs
router.patch('/load-board-urls', auth, validateLoadBoardUrls, SettingsController.updateLoadBoardUrls);

// // Update general settings
router.patch('/general', auth, validateGeneralSettings, SettingsController.updateGeneralSettings);

// // Update alert preferences
// router.patch('/alerts', auth, validateAlertPreferences, SettingsController.updateAlertPreferences);

// // Update service areas
// router.patch('/service-areas', auth, validateServiceAreas, SettingsController.updateServiceAreas);

// // Update route alerts
// router.patch('/route-alerts', auth, validateRouteAlerts, SettingsController.updateRouteAlerts);

module.exports = router; 