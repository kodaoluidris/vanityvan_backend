const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const auth = require('../middleware/auth');
const checkActiveUser = require('../middleware/checkActiveUser');

// Middleware to check if user is super admin
const isSuperAdmin = async (req, res, next) => {
    try {
        console.log('req.userData', req.userData);
        if (req.userData.userType !== 'SUPER_ADMIN') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Super Admin rights required.'
            });
        }
        next();
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error checking admin rights'
        });
    }
};

// Apply middleware to all routes
router.use(auth, checkActiveUser, isSuperAdmin);

// Dashboard
router.get('/', superAdminController.getSuperAdminDashboard);

// User Management
router.get('/users', superAdminController.manageUsers);
router.get('/users/:userId', superAdminController.getUserDetails);
router.patch('/users/:userId/status', superAdminController.updateUserStatus);

// Analytics
router.get('/analytics', superAdminController.getAnalytics);

// Activity Logs
router.get('/activity-logs', superAdminController.getActivityLogs);

// Add this new route for updating load status
router.patch('/loads/:loadId/status', superAdminController.updateLoadStatus);

module.exports = router; 