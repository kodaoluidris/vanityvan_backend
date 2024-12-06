const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

redis.on('error', (err) => {
  logger.error('Redis cache error:', err);
});

const cache = (duration) => {
  return async (req, res, next) => {
    if (process.env.CACHE_ENABLED !== 'true') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;

    try {
      const cachedResponse = await redis.get(key);

      if (cachedResponse) {
        return res.json(JSON.parse(cachedResponse));
      }

      // Modify res.json to cache the response
      const originalJson = res.json;
      res.json = function(body) {
        redis.setex(key, duration, JSON.stringify(body))
          .catch(err => logger.error('Redis cache set error:', err));
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

const clearCache = async (pattern) => {
  try {
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    logger.error('Clear cache error:', error);
  }
};

module.exports = {
  cache,
  clearCache
}; 