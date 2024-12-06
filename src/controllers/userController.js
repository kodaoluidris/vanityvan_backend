const UserService = require('../services/userService');
const { ValidationError } = require('../utils/errors');

class UserController {
  static async getProfile(req, res, next) {
    try {
      const userId = req.userData.userId;
      const profile = await UserService.getProfile(userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const userId = req.userData.userId;
      const updateData = {
        companyName: req.body.companyName,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone
      };

      const profile = await UserService.updateProfile(userId, updateData);
      res.json(profile);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const userId = req.userData.userId;
      const { currentPassword, newPassword } = req.body;

      await UserService.changePassword(userId, currentPassword, newPassword);
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  static async getDashboardStats(req, res, next) {
    try {
      const userId = req.userData.userId;
      const stats = await UserService.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController; 