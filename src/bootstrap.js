require('dotenv').config();

const mongoose = require('mongoose');
const main = require('./config/db');
const redisClient = require('./config/redis');

let dbPromise = null;
let redisPromise = null;

const ensureDatabaseConnection = async () => {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    if (!dbPromise) {
        dbPromise = main().catch((error) => {
            dbPromise = null;
            throw error;
        });
    }

    await dbPromise;
};

const ensureRedisConnection = async () => {
    if (redisClient.isOpen) {
        return redisClient;
    }

    if (!process.env.REDIS_HOST || !process.env.REDIS_PORT || !process.env.REDIS_PASS) {
        return null;
    }

    if (!redisPromise) {
        redisPromise = redisClient.connect()
            .then(() => redisClient)
            .catch((error) => {
                console.error('Redis unavailable, continuing without cache:', error.message);
                return null;
            })
            .finally(() => {
                redisPromise = null;
            });
    }

    return redisPromise;
};

const ensureAppReady = async () => {
    await ensureDatabaseConnection();
    await ensureRedisConnection();
};

module.exports = { ensureAppReady };
