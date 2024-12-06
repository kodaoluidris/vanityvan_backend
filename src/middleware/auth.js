const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AuthenticationError } = require('../utils/errors');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // console.log('Auth Header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findByPk(decoded.id);

      if (!user || user.status !== 'active') {
        throw new AuthenticationError('User not found or inactive');
      }

      req.userData = {
        userId: user.id,
        email: user.email,
        userType: user.userType
      };

      next();
    } catch (error) {
      // console.log('Token verification error:', error);
      throw new AuthenticationError('Invalid token');
    }
  } catch (error) {
    // console.log('Auth error:', error);
    res.status(401).json({
      error: 'Authentication Error',
      message: error.message
    });
  }
};

module.exports = auth; 