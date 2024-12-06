const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

const limiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  }
});

// Specific limiter for authentication routes
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'auth-limit:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts per hour
  skipSuccessfulRequests: true
});

module.exports = {
  limiter,
  authLimiter
}; 