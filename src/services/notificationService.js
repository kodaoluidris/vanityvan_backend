const { Notification, User } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
  async createNotification(data) {
    return await Notification.create(data);
  }

  async getUserNotifications(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get total count for pagination
      const totalCount = await Notification.count({
        where: { userId }
      });

      // Get paginated notifications
      const notifications = await Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit: limit,
        offset: offset,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'companyName']
          }
        ]
      });

      // Calculate pagination details
      const totalPages = Math.ceil(totalCount / limit);

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error in getUserNotifications:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    return await Notification.count({
      where: {
        userId,
        isRead: false
      }
    });
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await notification.update({
      isRead: true,
      readAt: new Date()
    });
  }

  async markAllAsRead(userId) {
    return await Notification.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          userId,
          isRead: false
        }
      }
    );
  }

  // Helper method to create load request notification
  async createLoadRequestNotification(loadId, requesterId, brokerId, loadTitle) {
    const requester = await User.findByPk(requesterId);
    
    return this.createNotification({
      userId: brokerId,
      type: 'LOAD_REQUEST',
      title: 'New Load Request',
      message: `${requester.companyName} has requested your load: ${loadTitle}`,
      referenceId: loadId,
      referenceType: 'LOAD'
    });
  }
}

module.exports = new NotificationService(); 