const AuthService = require('../services/authService');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { User } = require('../models');
const jwt = require('jsonwebtoken');

class AuthController {
  static async register(req, res, next) {
    try {
      const {
        username,
        email,
        password,
        firstName,
        lastName,
        companyName,
        userType,
        dotNumber,
        contactName,
        phone,
        website,
        loadBoardUrls
      } = req.body;

      // Additional validation for carriers
      if ((userType === 'RFD_CARRIER' || userType === 'RFP_CARRIER') && !dotNumber) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'DOT number is required for carriers'
        });
      }

      // Create user
      const user = await User.create({
        username,
        email,
        password,
        firstName,
        lastName,
        companyName,
        userType,
        dotNumber,
        contactName,
        phone,
        website,
        loadBoardUrls: loadBoardUrls || []
      });

      // Generate token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          userType: user.userType  // Include userType in token
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Return user data (excluding password) and token
      const userData = user.toJSON();
      delete userData.password;

      res.status(201).json({
        status: 'success',
        data: {
          user: userData,
          token
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          status: 'error',
          message: 'Username or email already exists'
        });
      }

      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }

      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      
      // Find user with all necessary fields
      const user = await User.findOne({ 
        where: { email },
        attributes: [
          'id',
          'email',
          'password',
          'firstName',
          'lastName',
          'photo',
          'companyName',
          'userType',
          'dotNumber',
          'contactName',
          'phone',
          'status',
          'loadBoardUrls'
        ]
      });

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(401).json({
          status: 'error',
          message: 'Account is not active'
        });
      }

      // Generate token with user type
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          userType: user.userType
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Prepare user data based on user type
      const userData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        companyName: user.companyName,
        dotNumber: user.dotNumber,
        userType: user.userType,
        contactName: user.contactName,
        phone: user.phone,
        loadBoardUrls: user.loadBoardUrls,
      };

      // Add DOT number only for carriers
      if (user.userType === 'RFD_CARRIER' || user.userType === 'RFP_CARRIER') {
        userData.dotNumber = user.dotNumber;
      }

      // Add permissions based on user type
      userData.permissions = {
        canPostRFDLoad: user.userType === 'BROKER',
        canPostRFPLoad: user.userType === 'RFP_CARRIER',
        canPostTruck: user.userType === 'RFD_CARRIER',
        canViewRFDLoads: ['RFP_CARRIER', 'RFD_CARRIER'].includes(user.userType),
        canViewRFPLoads: user.userType === 'RFD_CARRIER',
        canViewTrucks: ['RFP_CARRIER', 'BROKER'].includes(user.userType)
      };

      res.json({
        status: 'success',
        data: {
          user: userData,
          token,
          message: `Welcome back, ${user.firstName}!`
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  static async refreshToken(req, res, next) {
    try {
      const token = await AuthService.refreshToken(req.userData.userId);
      res.json({ token });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.userData.userId, {
        attributes: { 
          exclude: ['password'] 
        }
      });

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        data: user
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.userData.userId);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Define updatable fields
      const updatableFields = [
        'firstName',
        'lastName',
        'companyName',
        'dotNumber',
        'contactName',
        'phone',
        'website',
        'loadBoardUrls'
      ];

      // Create update object with only allowed fields
      const updates = {};
      updatableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Handle password update separately if provided
      if (req.body.password) {
        updates.password = req.body.password;
      }

      // Update user
      await user.update(updates);

      // Fetch updated user (excluding password)
      const updatedUser = await User.findByPk(req.userData.userId, {
        attributes: { 
          exclude: ['password'] 
        }
      });

      res.json({
        status: 'success',
        message: 'Profile updated successfully',
        data: updatedUser
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      if (error instanceof ValidationError) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = AuthController; 