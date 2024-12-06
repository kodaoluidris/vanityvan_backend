const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const loadRoutes = require('./loads');
const requestRoutes = require('./requests');
const dashboardRoutes = require('./dashboard');
const userRoutes = require('./users');
const settingsRoutes = require('./settings');
const superAdminRoutes = require('./superAdmin');
const loadBoardRoutes = require('./loadboard');

// Health check route
router.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// API routes
router.use('/auth', authRoutes);
router.use('/loads', loadRoutes);
router.use('/requests', requestRoutes);
router.use('/users', userRoutes);
router.use('/requests', requestRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', superAdminRoutes);
router.use('/loadboard', loadBoardRoutes);


module.exports = router; 