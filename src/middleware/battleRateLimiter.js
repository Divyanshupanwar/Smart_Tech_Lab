const redisClient = require('../config/redis');

const localBuckets = new Map();
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 12;

const battleRateLimiter = async (req, res, next) => {
    const userId = req.result?._id?.toString();
    const battleId = String(req.params.battleId || 'unknown');
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    const key = `battle:rate:${userId}:${battleId}`;
    try {
        let count;
        if (redisClient.isOpen) {
            count = await redisClient.incr(key);
            if (count === 1) await redisClient.expire(key, WINDOW_SECONDS);
        } else {
            const now = Date.now();
            const bucket = localBuckets.get(key);
            if (!bucket || bucket.expiresAt <= now) {
                count = 1;
                localBuckets.set(key, { count, expiresAt: now + WINDOW_SECONDS * 1000 });
            } else count = ++bucket.count;
            if (localBuckets.size > 5000) for (const [keyValue, value] of localBuckets) if (value.expiresAt <= now) localBuckets.delete(keyValue);
        }
        if (count > MAX_REQUESTS) return res.status(429).json({ message: 'Too many code evaluation requests. Wait a minute and try again.' });
        return next();
    } catch (error) {
        console.error('Battle rate limiter unavailable:', error.message);
        return next();
    }
};

module.exports = battleRateLimiter;
