const AuthService = require('../services/authService');
const { ValidationError } = require('../utils/errors');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email'); // Assuming you have an email utility

class AuthController {
  static async test(req, res, next) {
    try {
      res.status(201).json({
        status: 'success',
        data: {
          user: [
            {data:"this is just to test the endpoint"}
          ]
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }
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
          status: 'error',
          message: 'Registration failed',
          errors: [{
            field: 'dotNumber',
            message: 'DOT number is required for carriers'
          }]
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
          message: 'Registration failed',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? {
          name: error.name,
          message: error.message,
          details: error.errors || error.original || error
        } : 'An unexpected error occurred'
      });
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

  static async changePassword(req, res) {
    try {
      const { old_password, new_password, confirm_password } = req.body;

      // Validation
      if (!old_password || !new_password || !confirm_password) {
        return res.status(400).json({
          status: 'error',
          message: 'All fields are required',
          errors: [
            !old_password ? { field: 'old_password', message: 'Old password is required' } : null,
            !new_password ? { field: 'new_password', message: 'New password is required' } : null,
            !confirm_password ? { field: 'confirm_password', message: 'Confirm password is required' } : null
          ].filter(Boolean)
        });
      }

      // Check if new password matches confirm password
      if (new_password !== confirm_password) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match',
          errors: [{
            field: 'confirm_password',
            message: 'New password and confirm password must match'
          }]
        });
      }

      // Get user from database
      const user = await User.findByPk(req.userData.userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Verify old password using bcrypt.compareSync
      const isValidPassword = bcrypt.compareSync(old_password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid old password',
          errors: [{
            field: 'old_password',
            message: 'Current password is incorrect'
          }]
        });
      }

      // Update password
      await user.update({ password: new_password });

      res.status(200).json({
        status: 'success',
        message: 'Password updated successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to change password',
        error: error.message
      });
    }
  }

  // Request password reset
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is required',
          errors: [{
            field: 'email',
            message: 'Please provide your email address'
          }]
        });
      }

      // Find user by email
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'No account found with that email address'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      // Save hashed token in database
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      await user.update({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: tokenExpiry
      });

      // Create reset URL
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      console.log(resetUrl);
      // Email content
      const emailContent = {
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested to reset your password. Click the link below to reset it:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      };
      console.log(emailContent);
      // Send email
      await sendEmail(emailContent);

      res.status(200).json({
        status: 'success',
        message: 'Password reset link sent to email'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process password reset request',
        error: error.message
      });
    }
  }

  // Reset password with token
  static async resetPassword(req, res) {
    try {
      const { token, new_password, confirm_password } = req.body;

      // Validation
      if (!token || !new_password || !confirm_password) {
        return res.status(400).json({
          status: 'error',
          message: 'All fields are required',
          errors: [
            !token ? { field: 'token', message: 'Token is required' } : null,
            !new_password ? { field: 'new_password', message: 'New password is required' } : null,
            !confirm_password ? { field: 'confirm_password', message: 'Confirm password is required' } : null
          ].filter(Boolean)
        });
      }

      // Check if passwords match
      if (new_password !== confirm_password) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match',
          errors: [{
            field: 'confirm_password',
            message: 'New password and confirm password must match'
          }]
        });
      }

      // Hash the token from the URL
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid token
      const user = await User.findOne({
        where: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: {
            [Op.gt]: new Date() // Token not expired
          }
        }
      });

      if (!user) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or expired reset token'
        });
      }

      // Update password
      await user.update({
        password: new_password,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });

      res.status(200).json({
        status: 'success',
        message: 'Password has been reset successfully'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to reset password',
        error: error.message
      });
    }
  }
}

module.exports = AuthController; 