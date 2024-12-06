const prometheus = require('prom-client');
const logger = require('../utils/logger');

class MonitoringService {
  constructor() {
    // Enable collection of default metrics
    prometheus.collectDefaultMetrics();

    // Custom metrics
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.activeUsers = new prometheus.Gauge({
      name: 'active_users_total',
      help: 'Total number of active users'
    });

    this.activeLoads = new prometheus.Gauge({
      name: 'active_loads_total',
      help: 'Total number of active loads'
    });

    this.requestsTotal = new prometheus.Counter({
      name: 'requests_total',
      help: 'Total number of requests',
      labelNames: ['method', 'endpoint', 'status']
    });
  }

  trackRequest(req, res, duration) {
    this.httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || 'unknown',
        status_code: res.statusCode
      },
      duration
    );

    this.requestsTotal.inc({
      method: req.method,
      endpoint: req.route?.path || 'unknown',
      status: res.statusCode
    });
  }

  async updateMetrics() {
    try {
      const [activeUsers, activeLoads] = await Promise.all([
        this.countActiveUsers(),
        this.countActiveLoads()
      ]);

      this.activeUsers.set(activeUsers);
      this.activeLoads.set(activeLoads);
    } catch (error) {
      logger.error('Error updating metrics:', error);
    }
  }

  async getMetrics() {
    return await prometheus.register.metrics();
  }

  // Helper methods to count active entities
  async countActiveUsers() {
    const { User } = require('../models');
    return await User.count({ where: { status: 'active' } });
  }

  async countActiveLoads() {
    const { Load } = require('../models');
    return await Load.count({ where: { status: 'ACTIVE' } });
  }
}

module.exports = new MonitoringService(); 