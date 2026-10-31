require('./config/loadEnv');

const mongoose = require('mongoose');
const main = require('./config/db');
const redisClient = require('./config/redis');
const LabExam = require('./models/labExam');
const ExamQuestion = require('./models/examQuestion');
const ExamAttempt = require('./models/examAttempt');
const ExamSubmission = require('./models/examSubmission');
const ProctoringEvent = require('./models/proctoringEvent');
const Battle = require('./models/battle');
const BattleSubmission = require('./models/battleSubmission');
const BattleInvitation = require('./models/battleInvitation');
const StudentBattleStats = require('./models/studentBattleStats');
const examModels = [LabExam, ExamQuestion, ExamAttempt, ExamSubmission, ProctoringEvent, Battle, BattleSubmission, BattleInvitation, StudentBattleStats];

let dbPromise = null;
let redisPromise = null;
let indexesPromise = null;

const ensureExamIndexes = async () => {
    if (!indexesPromise) {
        indexesPromise = Promise.all(examModels.map((model) => model.init())).catch((error) => {
            indexesPromise = null;
            throw error;
        });
    }
    await indexesPromise;
};

const ensureDatabaseConnection = async () => {
    if (mongoose.connection.readyState === 1) {
        await ensureExamIndexes();
        return;
    }

    if (!dbPromise) {
        dbPromise = main().catch((error) => {
            dbPromise = null;
            throw error;
        });
    }

    await dbPromise;
    await ensureExamIndexes();
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

module.exports = { ensureAppReady, ensureExamIndexes };
