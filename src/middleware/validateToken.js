const { body, validationResult } = require('express-validator');
const { User } = require('../models');

exports.validateToken = [
    // Middleware to check user existence and status
    async (req, res, next) => {
        try {
            // Get user from database
            const user = await User.findByPk(req.userData.userId);
            if (!user) {
                return res.status(401).json({
                    status: 'error',
                    message: 'User not found'
                });
            }
            
            // Check if user is active
            if (user.status !== 'ACTIVE'.toLocaleLowerCase()) {
                return res.status(403).json({
                    status: 'error',
                    message: 'User account is not active'
                });
            }

            // Check user type
            if (!['BROKER', 'CARRIER', 'SUPER_ADMIN'].includes(user.userType)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Invalid user type'
                });
            }

            // Add user to request object
            req.user = user;
            next();
        } catch (error) {
            console.error('Token validation error:', error);
            return res.status(401).json({
                status: 'error',
                message: 'Token validation failed',
                error: error.message
            });
        }
    },

    // Validation result handler
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];
