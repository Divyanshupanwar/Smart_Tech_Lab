const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const User = require('../models/user');
const Battle = require('../models/battle');
const redisClient = require('../config/redis');

let battleNamespace = null;

const allowedOrigins = () => [
    process.env.FRONTEND_ORIGIN,
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
].filter(Boolean);

const userRoom = (userId) => `user:${userId}`;
const battleRoom = (battleId) => `battle:${battleId}`;

const initializeBattleSockets = async (httpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: allowedOrigins(), credentials: true },
        connectionStateRecovery: { maxDisconnectionDuration: 120000, skipMiddlewares: false }
    });
    if (redisClient.isOpen) {
        const pubClient = redisClient.duplicate();
        const subClient = pubClient.duplicate();
        try {
            await Promise.all([pubClient.connect(), subClient.connect()]);
            io.adapter(createAdapter(pubClient, subClient));
        } catch (error) {
            console.error('Socket.IO Redis adapter unavailable:', error.message);
            await Promise.allSettled([
                pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
                subClient.isOpen ? subClient.quit() : Promise.resolve()
            ]);
            throw new Error('Socket.IO Redis adapter initialization failed.');
        }
    }

    battleNamespace = io.of('/battle');

    battleNamespace.use(async (socket, next) => {
        try {
            const token = cookie.parse(socket.request.headers.cookie || '').token;
            if (!token) return next(new Error('Authentication required.'));
            const payload = jwt.verify(token, process.env.JWT_KEY);
            if (!payload?._id) return next(new Error('Invalid session.'));
            const user = await User.findById(payload._id).select('_id role authVersion firstName emailID');
            if (!user || (payload.authVersion ?? 0) !== (user.authVersion ?? 0)) return next(new Error('Session expired.'));
            if (redisClient.isOpen && await redisClient.exists(`token:${token}`)) return next(new Error('Session expired.'));
            if (user.role !== 'user') return next(new Error('Student account required.'));
            socket.data.user = user;
            socket.data.token = token;
            next();
        } catch (_error) {
            next(new Error('Authentication failed.'));
        }
    });

    battleNamespace.on('connection', async (socket) => {
        const userId = socket.data.user._id.toString();
        socket.join(userRoom(userId));
        if (redisClient.isOpen) await redisClient.sAdd(`battle:sockets:user:${userId}`, socket.id).catch(() => {});

        socket.on('battle:join', async (payload, acknowledge = () => {}) => {
            try {
                const battle = await Battle.findById(payload?.battleId).select('_id status players');
                if (!battle || !battle.players.some((player) => player.userId.toString() === userId)) {
                    return acknowledge({ ok: false, message: 'You are not a player in this battle.' });
                }
                socket.join(battleRoom(battle._id.toString()));
                await Battle.updateOne({ _id: battle._id, 'players.userId': socket.data.user._id }, {
                    $set: { 'players.$.connectionStatus': 'connected', 'players.$.disconnectedAt': null }
                });
                battleNamespace.to(battleRoom(battle._id.toString())).emit('battle:presence', {
                    userId,
                    status: 'connected',
                    serverTime: new Date().toISOString()
                });
                acknowledge({ ok: true, status: battle.status, battleId: battle._id });
            } catch (_error) {
                acknowledge({ ok: false, message: 'Unable to join battle room.' });
            }
        });

        socket.on('disconnect', async () => {
            if (redisClient.isOpen) {
                await redisClient.sRem(`battle:sockets:user:${userId}`, socket.id).catch(() => {});
                const socketsRemaining = await redisClient.sCard(`battle:sockets:user:${userId}`).catch(() => 0);
                if (socketsRemaining > 0) return;
            }
            const now = new Date();
            const activeBattles = await Battle.find({
                'players.userId': socket.data.user._id,
                status: { $in: ['COUNTDOWN', 'ACTIVE'] }
            }).select('_id');
            for (const battle of activeBattles) {
                await Battle.updateOne({ _id: battle._id, 'players.userId': socket.data.user._id }, {
                    $set: { 'players.$.connectionStatus': 'disconnected', 'players.$.disconnectedAt': now }
                });
                battleNamespace.to(battleRoom(battle._id.toString())).emit('battle:presence', {
                    userId,
                    status: 'disconnected',
                    serverTime: now.toISOString()
                });
            }
            if (redisClient.isOpen) await redisClient.del(`battle:sockets:user:${userId}`).catch(() => {});
        });
    });

    return io;
};

const emitToUser = (userId, event, payload) => {
    battleNamespace?.to(userRoom(String(userId))).emit(event, payload);
};

const emitToBattle = (battleId, event, payload) => {
    battleNamespace?.to(battleRoom(String(battleId))).emit(event, payload);
};

module.exports = { emitToBattle, emitToUser, initializeBattleSockets };
