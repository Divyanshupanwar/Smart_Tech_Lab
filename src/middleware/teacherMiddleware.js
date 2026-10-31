const jwt = require('jsonwebtoken');
const User = require('../models/user');
const redisClient = require('../config/redis');

const teacherMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ message: 'Authentication required. Please login.' });

        const payload = jwt.verify(token, process.env.JWT_KEY);
        if (!payload?._id) return res.status(401).json({ message: 'Invalid token.' });

        const user = await User.findById(payload._id);
        if (!user) return res.status(401).json({ message: 'User does not exist.' });
        if ((payload.authVersion ?? 0) !== (user.authVersion ?? 0)) {
            return res.status(401).json({ message: 'Session expired. Please login again.' });
        }
        if (!['admin', 'teacher'].includes(user.role)) {
            return res.status(403).json({ message: 'Teacher or administrator access required.' });
        }
        if (redisClient.isOpen && await redisClient.exists(`token:${token}`)) {
            return res.status(401).json({ message: 'Session expired. Please login again.' });
        }

        req.result = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Authentication failed.' });
    }
};

module.exports = teacherMiddleware;
