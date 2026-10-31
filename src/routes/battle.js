const express = require('express');
const studentMiddleware = require('../middleware/studentMiddleware');
const battleRateLimiter = require('../middleware/battleRateLimiter');
const {
    acceptInvitation,
    cancelBattle,
    cancelMatchmaking,
    findMatch,
    findStudents,
    getActiveBattle,
    getBattle,
    getBattleLeaderboard,
    getMyStats,
    joinBattle,
    listInvitations,
    listLeaderboard,
    rejectInvitation,
    runBattleCode,
    saveBattleDraft,
    sendInvitation,
    submitBattleCode
} = require('../controllers/battle');

const router = express.Router();
router.use(studentMiddleware);

router.get('/students', findStudents);
router.get('/invitations', listInvitations);
router.post('/invitations', sendInvitation);
router.post('/invitations/:invitationId/accept', acceptInvitation);
router.post('/invitations/:invitationId/reject', rejectInvitation);
router.post('/matchmaking/find', findMatch);
router.post('/matchmaking/cancel', cancelMatchmaking);
router.post('/:battleId/cancel', cancelBattle);
router.get('/active', getActiveBattle);
router.get('/history', getMyStats);
router.get('/leaderboard', listLeaderboard);
router.get('/:battleId/leaderboard', getBattleLeaderboard);
router.post('/:battleId/join', joinBattle);
router.put('/:battleId/drafts/:questionId', saveBattleDraft);
router.post('/:battleId/questions/:questionId/run', battleRateLimiter, runBattleCode);
router.post('/:battleId/questions/:questionId/submit', battleRateLimiter, submitBattleCode);
router.get('/:battleId', getBattle);

module.exports = router;
