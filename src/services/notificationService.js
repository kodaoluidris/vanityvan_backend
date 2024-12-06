const { Notification, User } = require('../models');
const logger = require('../utils/logger');
const WebSocket = require('ws');

class NotificationService {
  static wss = null;

  static initializeWebSocket(server) {
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'auth') {
            ws.userId = data.userId;
          }
        } catch (error) {
          logger.error('WebSocket message error:', error);
        }
      });
    });
  }

  static async create(notificationData, transaction = null) {
    try {
      const notification = await Notification.create({
        userId: notificationData.userId,
        type: notificationData.type,
        referenceId: notificationData.referenceId,
        content: notificationData.content
      }, { transaction });

      // Send real-time notification if user is connected
      this.sendRealTimeNotification(
        notificationData.userId,
        notification
      );

      return notification;
    } catch (error) {
      logger.error('Create notification error:', error);
      throw error;
    }
  }

  static sendRealTimeNotification(userId, notification) {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.userId === userId && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'notification',
            data: notification
          }));
        }
      });
    }
  }

  static async getUserNotifications(userId, options = {}) {
    try {
      const whereClause = { userId };
      
      if (!options.includeRead) {
        whereClause.isRead = false;
      }

      const notifications = await Notification.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: options.limit || 50
      });

      return notifications;
    } catch (error) {
      logger.error('Get notifications error:', error);
      throw error;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (notification) {
        await notification.update({ isRead: true });
      }

      return notification;
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      throw error;
    }
  }

  static async markAllAsRead(userId) {
    try {
      await Notification.update(
        { isRead: true },
        { where: { userId, isRead: false } }
      );
    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService; 