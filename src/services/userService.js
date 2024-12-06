const { User, Load, Request } = require('../models');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class UserService {
  static async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        throw new ValidationError('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }

  static async updateProfile(userId, updateData) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new ValidationError('User not found');
      }

      await user.update(updateData);

      // Return user data without password
      const { password, ...userData } = user.toJSON();
      return userData;
    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }

  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new ValidationError('User not found');
      }

      const isValidPassword = await user.validatePassword(currentPassword);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }

      await user.update({ password: newPassword });
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  static async getDashboardStats(userId) {
    try {
      const [activeLoads, pendingRequests, completedLoads] = await Promise.all([
        Load.count({
          where: {
            userId,
            status: 'ACTIVE'
          }
        }),
        Request.count({
          where: {
            ownerId: userId,
            status: 'PENDING'
          }
        }),
        Load.count({
          where: {
            userId,
            status: 'COMPLETED'
          }
        })
      ]);

      // Get recent activity
      const recentActivity = await Load.findAll({
        where: { userId },
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Request,
            where: { status: 'PENDING' },
            required: false
          }
        ]
      });

      return {
        stats: {
          activeLoads,
          pendingRequests,
          completedLoads
        },
        recentActivity
      };
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      throw error;
    }
  }

  static async deactivateAccount(userId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new ValidationError('User not found');
      }

      await user.update({ status: 'inactive' });
    } catch (error) {
      logger.error('Deactivate account error:', error);
      throw error;
    }
  }

  static async updateNotificationPreferences(userId, preferences) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new ValidationError('User not found');
      }

      await user.update({ notificationPreferences: preferences });
      return user.notificationPreferences;
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      throw error;
    }
  }
}

module.exports = UserService; 