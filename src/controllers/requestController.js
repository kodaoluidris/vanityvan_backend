const RequestService = require('../services/requestService');
const { ValidationError } = require('../utils/errors');
const { Request, Load, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

class RequestController {
  static async createRequest(req, res, next) {
    try {
      const requesterId = req.userData.userId;
      const { loadId } = req.params;
      const requestData = {
        message: req.body.message,
        proposedRate: req.body.proposedRate,
        requesterName: `${req.userData.firstName} ${req.userData.lastName}`
      };

      const request = await RequestService.createRequest(
        requesterId,
        loadId,
        requestData
      );
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  static async getRequests(req, res, next) {
    try {
      const userId = req.userData.userId;
      const type = req.query.type || 'received'; // 'received' or 'sent'
      const requests = await RequestService.getRequests(userId, type);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  }

  static async updateRequestStatus(req, res) {
    try {
      const { requestId } = req.params;
      const { status, responseMessage } = req.body;
      
      // Validate status
      if (!['ACCEPTED', 'REJECTED'].includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid status. Must be either ACCEPTED or REJECTED'
        });
      }

      // Find the request with load and requester details
      const request = await Request.findOne({
        where: { id: requestId },
        include: [
          {
            model: Load,
            as: 'load',
            required: true
          },
          {
            model: User,
            as: 'requester',
            required: true,
            attributes: ['id', 'companyName', 'userType']
          }
        ]
      });

      if (!request) {
        return res.status(404).json({
          status: 'error',
          message: 'Request not found'
        });
      }

      // Check if load is already assigned
      if (request.load.status === 'ASSIGNED') {
        return res.status(400).json({
          status: 'error',
          message: 'This load has already been assigned to a carrier'
        });
      }

      // Security Checks
      
      // 1. Check if user is authorized (must be load owner or super admin)
      if (request.load.userId !== req.userData.userId && req.userData.userType !== 'SUPER_ADMIN') {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to update this request'
        });
      }

      // 2. Check if request is already processed
      if (request.status !== 'PENDING') {
        return res.status(400).json({
          status: 'error',
          message: `Request has already been ${request.status.toLowerCase()}`
        });
      }

      // 3. Check if load is still available
      if (request.load.status !== 'ACTIVE') {
        return res.status(400).json({
          status: 'error',
          message: `Load is no longer available. Current status: ${request.load.status}`
        });
      }

      // 4. Check if load has already been assigned
      if (request.load.assignedTo) {
        return res.status(400).json({
          status: 'error',
          message: 'Load has already been assigned to another carrier'
        });
      }

      // 5. Check if there's any accepted request for this load
      const existingAcceptedRequest = await Request.findOne({
        where: {
          loadId: request.loadId,
          status: 'ACCEPTED'
        }
      });

      if (existingAcceptedRequest) {
        return res.status(400).json({
          status: 'error',
          message: 'Load has already been accepted by another carrier'
        });
      }

      // 6. Verify requester is still active
      const requester = await User.findByPk(request.requesterId);
      if (!requester || requester.status !== 'ACTIVE'.toLocaleLowerCase()) {
        return res.status(400).json({
          status: 'error',
          message: 'Requester account is no longer active'
        });
      }

      // Start a transaction
      const transaction = await sequelize.transaction();

      try {
        // Update request status
        await request.update({
          status,
          responseMessage: responseMessage || null,
          updatedAt: new Date()
        }, { transaction });

        if (status === 'ACCEPTED') {
          // Double-check load status before accepting (race condition prevention)
          const currentLoad = await Load.findOne({
            where: {
              id: request.loadId,
              status: 'ACTIVE',
              assignedTo: null
            },
            lock: true,
            transaction
          });

          if (!currentLoad) {
            await transaction.rollback();
            return res.status(409).json({
              status: 'error',
              message: 'Load was just assigned to another carrier'
            });
          }

          // Update all other pending requests for this load to REJECTED
          await Request.update({
            status: 'REJECTED',
            responseMessage: 'Load assigned to another carrier',
            updatedAt: new Date()
          }, {
            where: {
              loadId: request.loadId,
              id: { [Op.ne]: requestId },
              status: 'PENDING'
            },
            transaction
          });

          // Update load status to ASSIGNED
          await currentLoad.update({
            status: 'ASSIGNED',
            assignedTo: request.requesterId,
            assignedAt: new Date(),
            updatedAt: new Date()
          }, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Fetch updated request with details
        const updatedRequest = await Request.findOne({
          where: { id: requestId },
          include: [
            {
              model: User,
              as: 'requester',
              attributes: ['id', 'companyName', 'contactName', 'email', 'phone']
            },
            {
              model: Load,
              as: 'load',
              attributes: ['id', 'loadType', 'status', 'pickupLocation', 'deliveryLocation', 'assignedTo']
            }
          ]
        });

        res.json({
          status: 'success',
          message: `Request ${status.toLowerCase()} successfully`,
          data: {
            request: updatedRequest.get({ plain: true })
          }
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Update request status error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error updating request status',
        error: error.message
      });
    }
  }
}

module.exports = RequestController; 