const { Notification, User } = require('../models');
const { Op } = require('sequelize');
const loadNotificationTemplate = require('../templates/loadNotificationEmail');
const emailService = require('./emailService');
const zipcodes = require('zipcodes'); // You'll need to install this package
// const { getUnreadCount } = require('../controllers/notificationController');

class NotificationService {
  constructor() {
    this.calculateDistance = this.calculateDistance.bind(this);
  }

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

  calculateDistance(zipcode1, zipcode2) {
    const location1 = zipcodes.lookup(zipcode1);
    const location2 = zipcodes.lookup(zipcode2);
    
    if (!location1 || !location2) return null;

    // Calculate distance using the Haversine formula
    const R = 3959; // Earth's radius in miles
    const lat1 = location1.latitude * Math.PI / 180;
    const lat2 = location2.latitude * Math.PI / 180;
    const lon1 = location1.longitude * Math.PI / 180;
    const lon2 = location2.longitude * Math.PI / 180;

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async findUsersInRange(loadData, excludeUserId = null) {
    try {
      const users = await User.findAll({
        where: {
          status: 'active',
          emailAlerts: true,
          id: excludeUserId ? { [Op.ne]: excludeUserId } : undefined
        }
      });

      const usersToNotify = [];

      for (const user of users) {
        // Skip if user has no service areas
        if (!user.serviceAreas || user.serviceAreas.length === 0) continue;

        // Check each service area of the user
        for (const area of user.serviceAreas) {
          const distance = this.calculateDistance(loadData.pickupZip, area.zipCode);
          
          // If distance calculation failed or distance is within range
          if (distance && distance <= area.radius) {
            // Check if the load type matches user preferences
            const matchesPreferences = (
              (loadData.loadType === 'RFP' && user.alertPreferences.rfpAlerts) ||
              (loadData.loadType === 'RFD' && user.userType === 'RFD_CARRIER') ||
              (loadData.loadType === 'TRUCK' && user.alertPreferences.openTruckAlerts)
            );

            if (matchesPreferences) {
              usersToNotify.push(user);
              break; // Break after first match for this user
            }
          }
        }
      }

      return usersToNotify;
    } catch (error) {
      console.error('Error finding users in range:', error);
      throw error;
    }
  }

  async sendLoadNotifications(loadData, excludeUserId = null) {
    try {
      const usersToNotify = await this.findUsersInRange(loadData, excludeUserId);
      
      const notifications = usersToNotify.map(async (user) => {
        try {
          await emailService.sendEmail(
            user.email,
            `New Load Alert - ${loadData.pickupLocation} to ${loadData.deliveryLocation}`,
            'load-notification', // You'll need to create this template
            {
              name: user.firstName,
              load: {
                ...loadData,
                pickupDate: new Date(loadData.pickupDate).toLocaleDateString(),
                deliveryDate: new Date(loadData.deliveryDate).toLocaleDateString(),
                rate: loadData.rate.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD'
                })
              },
              viewLoadUrl: `${process.env.FRONTEND_URL}/loads/${loadData.id}`
            }
          );
        } catch (error) {
          console.error(`Failed to send notification to user ${user.id}:`, error);
        }
      });

      await Promise.allSettled(notifications);

      return {
        success: true,
        notifiedUsers: usersToNotify.length
      };
    } catch (error) {
      console.error('Error sending load notifications:', error);
      throw error;
    }
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

// Create and export a single instance
const notificationService = new NotificationService();
module.exports = notificationService; 