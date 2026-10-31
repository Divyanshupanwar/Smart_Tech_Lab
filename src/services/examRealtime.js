const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const LabExam = require('../models/labExam');
const redisClient = require('../config/redis');
const { canManageExam } = require('../utils/examRules');

let examNamespace = null;

const examRoom = (examId) => `exam:${examId}`;

const initializeExamSockets = (io) => {
    examNamespace = io.of('/exams');
    examNamespace.use(async (socket, next) => {
        try {
            const token = cookie.parse(socket.request.headers.cookie || '').token;
            if (!token) return next(new Error('Authentication required.'));
            const payload = jwt.verify(token, process.env.JWT_KEY);
            if (!payload?._id) return next(new Error('Invalid session.'));
            const user = await User.findById(payload._id).select('_id role authVersion');
            if (!user || (payload.authVersion ?? 0) !== (user.authVersion ?? 0)) return next(new Error('Session expired.'));
            if (redisClient.isOpen && await redisClient.exists(`token:${token}`)) return next(new Error('Session expired.'));
            if (!['teacher', 'admin'].includes(user.role)) return next(new Error('Teacher or administrator access required.'));
            socket.data.user = user;
            next();
        } catch (_error) {
            next(new Error('Authentication failed.'));
        }
    });

    examNamespace.on('connection', (socket) => {
        socket.on('exam:monitor:join', async (payload, acknowledge = () => {}) => {
            try {
                const exam = await LabExam.findById(payload?.examId).select('_id createdBy');
                if (!exam) return acknowledge({ ok: false, message: 'Examination not found.' });
                if (!canManageExam(exam, socket.data.user)) return acknowledge({ ok: false, message: 'You cannot monitor this examination.' });
                socket.join(examRoom(exam._id));
                acknowledge({ ok: true, examId: String(exam._id) });
            } catch (_error) {
                acknowledge({ ok: false, message: 'Unable to join examination monitoring.' });
            }
        });
    });

    return examNamespace;
};

const emitExamActivity = (examId, type, details = {}) => {
    examNamespace?.to(examRoom(examId)).emit('exam:activity', {
        examId: String(examId),
        type,
        receivedAt: new Date().toISOString(),
        ...details
    });
};

module.exports = { emitExamActivity, initializeExamSockets };
