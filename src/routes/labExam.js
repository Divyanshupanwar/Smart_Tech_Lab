const express = require('express');
const userMiddleware = require('../middleware/userMiddleWare');
const teacherMiddleware = require('../middleware/teacherMiddleware');
const examRateLimiter = require('../middleware/examRateLimiter');
const {
    createExam,
    cancelExam,
    deleteExam,
    exportResultsCsv,
    finishAttempt,
    getMyActiveAttempt,
    getAttempt,
    getExam,
    heartbeatAttempt,
    joinExam,
    listExams,
    listParticipants,
    listProctoringEvents,
    listResults,
    publishExam,
    reportProctoringEvent,
    runQuestion,
    saveDraft,
    submitQuestion,
    unpublishExam,
    updateExam
} = require('../controllers/labExam');

const router = express.Router();

router.get('/', userMiddleware, listExams);
router.post('/', teacherMiddleware, createExam);
router.get('/attempts/active', userMiddleware, getMyActiveAttempt);
router.get('/attempts/:attemptId', userMiddleware, getAttempt);
router.put('/attempts/:attemptId/drafts/:questionId', userMiddleware, saveDraft);
router.post('/attempts/:attemptId/questions/:questionId/run', userMiddleware, examRateLimiter('run'), runQuestion);
router.post('/attempts/:attemptId/questions/:questionId/submit', userMiddleware, examRateLimiter('submit'), submitQuestion);
router.post('/attempts/:attemptId/finish', userMiddleware, finishAttempt);
router.post('/attempts/:attemptId/heartbeat', userMiddleware, heartbeatAttempt);
router.post('/attempts/:attemptId/proctoring-events', userMiddleware, examRateLimiter('proctor'), reportProctoringEvent);

router.get('/:examId/participants', teacherMiddleware, listParticipants);
router.get('/:examId/results.csv', teacherMiddleware, exportResultsCsv);
router.get('/:examId/results', teacherMiddleware, listResults);
router.get('/:examId/proctoring-events', teacherMiddleware, listProctoringEvents);
router.post('/:examId/publish', teacherMiddleware, publishExam);
router.post('/:examId/unpublish', teacherMiddleware, unpublishExam);
router.post('/:examId/cancel', teacherMiddleware, cancelExam);
router.post('/:examId/join', userMiddleware, joinExam);
router.get('/:examId', userMiddleware, getExam);
router.put('/:examId', teacherMiddleware, updateExam);
router.delete('/:examId', teacherMiddleware, deleteExam);

module.exports = router;
