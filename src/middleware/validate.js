const { body, validationResult } = require('express-validator');
const { User } = require('../models');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

exports.validateRegistration = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('userType')
    .isIn(['BROKER', 'RFD_CARRIER', 'RFP_CARRIER'])
    .withMessage('Invalid user type'),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required'),
  
  body('dotNumber')
    .custom((value, { req }) => {
      if ((req.body.userType === 'RFD_CARRIER' || req.body.userType === 'RFP_CARRIER') && !value) {
        throw new Error('DOT number is required for carriers');
      }
      if (value && !/^\d{7}$/.test(value)) {
        throw new Error('DOT number must be 7 digits');
      }
      return true;
    }),
  
  body('contactName')
    .trim()
    .notEmpty()
    .withMessage('Contact name is required'),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid URL'),
  
  body('loadBoardUrls')
    .optional()
    .isArray()
    .withMessage('Load board URLs must be an array')
    .custom((urls) => {
      if (urls && urls.length > 0) {
        urls.forEach(url => {
          if (!url.match(/^https?:\/\/.+/)) {
            throw new Error('Invalid URL in load board URLs');
          }
        });
      }
      return true;
    }),
  
  handleValidationErrors
];

exports.validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  handleValidationErrors
];

exports.validateLoad = [
  body('loadType').isIn(['RFD', 'RFP', 'TRUCK']),
  body('pickupLocation').notEmpty(),
  body('deliveryLocation').optional(),
  body('pickupDate').isISO8601(),
  body('deliveryDate').isISO8601().optional(),
  body('weight').optional().isFloat({ min: 0 }),
  body('rate').optional().isFloat({ min: 0 }),
  body('cubic_feet')
    .optional()
    .isInt({ min: 1, max: 4000 })
    .withMessage('Cubic feet must be between 1 and 4000'),
  handleValidationErrors
];

exports.validateRequest = [
  body('message').optional().isString(),
  body('proposedRate').optional().isFloat({ min: 0 }),
  handleValidationErrors
];

exports.validateProfileUpdate = [
  body('companyName').optional().notEmpty(),
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  body('phone').optional().isMobilePhone(),
  handleValidationErrors
];

exports.validatePasswordChange = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  handleValidationErrors
]; 
exports.validateRequestStatus = [
  body('status')
      .isIn(['ACCEPTED', 'REJECTED'])
      .withMessage('Status must be either ACCEPTED or REJECTED'),
  body('responseMessage')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Response message must be between 1 and 500 characters'),
  // Validation middleware function
  (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({
              status: 'error',
              message: 'Invalid request data',
              errors: errors.array()
          });
      }
      next();
  }
];

exports.validateToken = [
    // Validate user existence and status
    async (req, res, next) => {
        try {
            const user = await User.findByPk(req.userData.userId);

            if (!user) {
                return res.status(401).json({
                    errors: [{
                        type: 'field',
                        value: req.userData.userId,
                        msg: 'User not found',
                        path: 'userId',
                        location: 'token'
                    }]
                });
            }

            if (user.status !== 'ACTIVE'.toLocaleLowerCase()) {
                return res.status(403).json({
                    errors: [{
                        type: 'field',
                        value: user.status,
                        msg: 'User account is not active',
                        path: 'status',
                        location: 'user'
                    }]
                });
            }

            if (!['BROKER', 'RFP_CARRIER', 'RFD_CARRIER', 'SUPER_ADMIN'].includes(user.userType)) {
                return res.status(403).json({
                    errors: [{
                        type: 'field',
                        value: user.userType,
                        msg: 'Invalid user type',
                        path: 'userType',
                        location: 'user'
                    }]
                });
            }

            // Add user to request for later use
            req.user = user;
            next();

        } catch (error) {
            console.error('Token validation error:', error);
            return res.status(401).json({
                errors: [{
                    type: 'server',
                    msg: 'Token validation failed',
                    error: error.message
                }]
            });
        }
    }
];

exports.validateLoadBoardUrls = [
    body('loadBoardUrls')
        .isArray()
        .withMessage('Load board URLs must be an array')
        .custom((urls) => {
            if (urls && urls.length > 0) {
                urls.forEach(url => {
                    if (!url.match(/^https?:\/\/.+/)) {
                        throw new Error('Invalid URL format');
                    }
                });
            }
            return true;
        }),
    handleValidationErrors
];

exports.validateGeneralSettings = [
    body('notifications')
        .optional()
        .isBoolean()
        .withMessage('Notifications must be a boolean value'),
    
    body('emailAlerts')
        .optional()
        .isBoolean()
        .withMessage('Email alerts must be a boolean value'),
    
    body('language')
        .optional()
        .isIn(['en', 'es', 'fr'])
        .withMessage('Language must be one of: en, es, fr'),
    
    body('timezone')
        .optional()
        .isIn(['UTC', 'EST', 'PST'])
        .withMessage('Timezone must be one of: UTC, EST, PST'),
    
    handleValidationErrors
];

exports.validateAlertPreferences = [
    body('rfpAlerts')
        .optional()
        .isBoolean()
        .withMessage('RFP alerts must be a boolean value'),
    
    body('openTruckAlerts')
        .optional()
        .isBoolean()
        .withMessage('Open truck alerts must be a boolean value'),
    
    handleValidationErrors
];

exports.validateServiceAreas = [
    body('serviceAreas')
        .isArray()
        .withMessage('Service areas must be an array'),
    
    body('serviceAreas.*.zipCode')
        .matches(/^\d{5}$/)
        .withMessage('ZIP code must be 5 digits'),
    
    body('serviceAreas.*.radius')
        .isInt({ min: 1, max: 500 })
        .withMessage('Radius must be between 1 and 500 miles'),
    
    handleValidationErrors
];

exports.validateRouteAlerts = [
    body('routeAlerts')
        .isArray()
        .withMessage('Route alerts must be an array'),
    
    body('routeAlerts.*.originZip')
        .matches(/^\d{5}$/)
        .withMessage('Origin ZIP code must be 5 digits'),
    
    body('routeAlerts.*.destinationZip')
        .matches(/^\d{5}$/)
        .withMessage('Destination ZIP code must be 5 digits'),
    
    handleValidationErrors
];