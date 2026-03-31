const { createClient } = require('redis');

const redisClient = createClient({
    username: process.env.REDIS_USER || 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        tls: process.env.REDIS_TLS === 'true',
        reconnectStrategy: false,
        connectTimeout: 5000
    }
});

redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
});

module.exports = redisClient;
