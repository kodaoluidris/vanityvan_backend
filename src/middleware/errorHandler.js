const logger = require('../utils/logger');
const { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError 
} = require('../utils/errors');
const multer = require('multer');

const errorHandler = (err, req, res, next) => {
  logger.error(err);

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      error: 'Authentication Error',
      message: err.message
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(403).json({
      error: 'Authorization Error',
      message: err.message
    });
  }

  // Sequelize errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      messages: err.errors.map(e => e.message)
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Conflict Error',
      message: 'Resource already exists'
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 5MB'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }

  // Default error
  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred'
      : err.message
  });
};

module.exports = errorHandler; 