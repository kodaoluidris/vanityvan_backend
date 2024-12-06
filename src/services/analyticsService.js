const { Op } = require('sequelize');
const { Load, Request, User, sequelize } = require('../models');
const logger = require('../utils/logger');

class AnalyticsService {
  async getLoadStatistics(userId, timeframe = '30d') {
    try {
      const startDate = this.getStartDate(timeframe);

      const stats = await Load.findAll({
        where: {
          userId,
          createdAt: {
            [Op.gte]: startDate
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          'status',
          'load_type'
        ],
        group: ['date', 'status', 'load_type'],
        raw: true
      });

      return this.formatLoadStats(stats);
    } catch (error) {
      logger.error('Error getting load statistics:', error);
      throw error;
    }
  }

  async getRequestAnalytics(userId) {
    try {
      const requests = await Request.findAll({
        where: {
          [Op.or]: [
            { requesterId: userId },
            { ownerId: userId }
          ]
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('proposed_rate')), 'avgRate']
        ],
        group: ['status'],
        raw: true
      });

      return this.formatRequestStats(requests);
    } catch (error) {
      logger.error('Error getting request analytics:', error);
      throw error;
    }
  }

  async getUserPerformanceMetrics(userId) {
    try {
      const metrics = await Request.findAll({
        where: { requesterId: userId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalRequests'],
          [
            sequelize.literal(
              `SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END)`
            ),
            'acceptedRequests'
          ],
          [
            sequelize.literal(
              `AVG(CASE WHEN status = 'ACCEPTED' THEN proposed_rate ELSE NULL END)`
            ),
            'avgAcceptedRate'
          ]
        ],
        raw: true
      });

      return this.calculatePerformanceScore(metrics[0]);
    } catch (error) {
      logger.error('Error getting user performance metrics:', error);
      throw error;
    }
  }

  async getMarketTrends() {
    try {
      const trends = await Load.findAll({
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('created_at')), 'date'],
          'load_type',
          [sequelize.fn('AVG', sequelize.col('rate')), 'avgRate'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        group: ['date', 'load_type'],
        order: [['date', 'ASC']],
        raw: true
      });

      return this.formatMarketTrends(trends);
    } catch (error) {
      logger.error('Error getting market trends:', error);
      throw error;
    }
  }

  // Helper methods
  getStartDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '7d':
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
  }

  formatLoadStats(stats) {
    const formatted = {
      byDate: {},
      byStatus: {},
      byType: {}
    };

    stats.forEach(stat => {
      // Format by date
      if (!formatted.byDate[stat.date]) {
        formatted.byDate[stat.date] = 0;
      }
      formatted.byDate[stat.date] += parseInt(stat.count);

      // Format by status
      if (!formatted.byStatus[stat.status]) {
        formatted.byStatus[stat.status] = 0;
      }
      formatted.byStatus[stat.status] += parseInt(stat.count);

      // Format by type
      if (!formatted.byType[stat.load_type]) {
        formatted.byType[stat.load_type] = 0;
      }
      formatted.byType[stat.load_type] += parseInt(stat.count);
    });

    return formatted;
  }

  formatRequestStats(requests) {
    return {
      summary: requests.reduce((acc, curr) => {
        acc[curr.status.toLowerCase()] = {
          count: parseInt(curr.count),
          avgRate: parseFloat(curr.avgRate)
        };
        return acc;
      }, {}),
      totalRequests: requests.reduce((sum, curr) => sum + parseInt(curr.count), 0)
    };
  }

  calculatePerformanceScore(metrics) {
    const acceptanceRate = metrics.totalRequests > 0
      ? (metrics.acceptedRequests / metrics.totalRequests) * 100
      : 0;

    return {
      totalRequests: parseInt(metrics.totalRequests),
      acceptedRequests: parseInt(metrics.acceptedRequests),
      acceptanceRate: parseFloat(acceptanceRate.toFixed(2)),
      avgAcceptedRate: parseFloat(metrics.avgAcceptedRate) || 0,
      performanceScore: this.calculateScore(acceptanceRate, metrics.avgAcceptedRate)
    };
  }

  calculateScore(acceptanceRate, avgRate) {
    // Custom scoring algorithm
    const acceptanceScore = (acceptanceRate / 100) * 50; // 50% weight to acceptance rate
    const rateScore = Math.min((avgRate / 1000) * 50, 50); // 50% weight to average rate
    return Math.round(acceptanceScore + rateScore);
  }

  formatMarketTrends(trends) {
    return trends.reduce((acc, trend) => {
      const date = trend.date.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {};
      }
      acc[date][trend.load_type] = {
        avgRate: parseFloat(trend.avgRate),
        count: parseInt(trend.count)
      };
      return acc;
    }, {});
  }
}

module.exports = new AnalyticsService(); 