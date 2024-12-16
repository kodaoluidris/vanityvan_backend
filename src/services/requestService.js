const { LoadRequest, Load, User, Notification, sequelize } = require('../models');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const NotificationService = require('./notificationService');

class RequestService {
  static async createRequest(requesterId, loadId, requestData) {
    const transaction = await sequelize.transaction();

    try {
      // Get load details
      const load = await Load.findByPk(loadId);
      if (!load || load.status !== 'ACTIVE') {
        throw new ValidationError('Load not found or inactive');
      }

      // Prevent self-requests
      if (load.userId === requesterId) {
        throw new ValidationError('Cannot request your own load');
      }

      // Check for existing request
      const existingRequest = await LoadRequest.findOne({
        where: {
          loadId,
          requesterId,
          status: 'PENDING'
        }
      });

      if (existingRequest) {
        throw new ValidationError('Request already exists');
      }

      // Create request
      const request = await LoadRequest.create({
        loadId,
        requesterId,
        ownerId: load.userId,
        message: requestData.message,
        proposedRate: requestData.proposedRate
      }, { transaction });

      // Create notification for load owner
      await NotificationService.create({
        userId: load.userId,
        type: 'NEW_REQUEST',
        referenceId: request.id,
        content: {
          loadId,
          requestId: request.id,
          requesterName: requestData.requesterName
        }
      }, transaction);

      await transaction.commit();
      return request;
    } catch (error) {
      await transaction.rollback();
      logger.error('Create request error:', error);
      throw error;
    }
  }

  static async getRequests(userId, type = 'received') {
    try {
      const whereClause = type === 'received' 
        ? { ownerId: userId }
        : { requesterId: userId };

      const requests = await LoadRequest.findAll({
        where: whereClause,
        include: [
          {
            model: Load,
            include: [
              {
                model: User,
                attributes: ['companyName']
              }
            ]
          },
          {
            model: User,
            as: 'requester',
            attributes: ['companyName', 'firstName', 'lastName']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return requests;
    } catch (error) {
      logger.error('Get requests error:', error);
      throw error;
    }
  }

  static async updateRequestStatus(requestId, userId, updateData) {
    const transaction = await sequelize.transaction();

    try {
      const request = await LoadRequest.findOne({
        where: { 
          id: requestId,
          ownerId: userId
        },
        include: [
          {
            model: Load
          }
        ]
      });

      if (!request) {
        throw new ValidationError('Request not found or unauthorized');
      }

      await request.update({
        status: updateData.status,
        responseMessage: updateData.message
      }, { transaction });

      // Create notification for requester
      await NotificationService.create({
        userId: request.requesterId,
        type: 'REQUEST_UPDATE',
        referenceId: request.id,
        content: {
          loadId: request.loadId,
          status: updateData.status,
          message: updateData.message
        }
      }, transaction);

      // If request is accepted, update load status
      if (updateData.status === 'ACCEPTED') {
        await request.Load.update({
          status: 'ASSIGNED',
          assignedTo: request.requesterId
        }, { transaction });
      }

      await transaction.commit();
      return request;
    } catch (error) {
      await transaction.rollback();
      logger.error('Update request status error:', error);
      throw error;
    }
  }
}

module.exports = RequestService; 