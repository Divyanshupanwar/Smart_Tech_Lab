const mongoose = require('mongoose');
const Battle = require('../models/battle');
const BattleSubmission = require('../models/battleSubmission');
const BattleInvitation = require('../models/battleInvitation');
const StudentBattleStats = require('../models/studentBattleStats');
const User = require('../models/user');
const Problem = require('../models/problem');
const redisClient = require('../config/redis');
const { getLanguageById, submitBatch, submitToken } = require('../utils/problemUtility');
const { compareBattleRank, determineWinners, isBattleMember, isValidBattleGroup, scoreSubmission, validateBattleConfig } = require('../utils/battleRules');
const { emitToBattle, emitToUser } = require('../services/battleRealtime');
const {
    acquireLock,
    buildQueueKey,
    cancelQueue,
    findBattleGroup,
    playerKey,
    releaseBattlePlayers,
    releaseLock,
    releaseMatchedPlayers,
    releaseReservedPlayers,
    reservePlayers,
    setBattlePlayers
} = require('../services/battleQueue');

const objectIdIsValid = (value) => mongoose.Types.ObjectId.isValid(value);
const asId = (value) => String(value?._id || value || '');
const languages = ['javascript', 'java', 'c++'];
const statusError = (statusId) => [5, 6, 7, 8, 9, 10, 11, 12, 13].includes(Number(statusId));
const resultError = (result) => String(result?.stderr || result?.compile_output || result?.message || result?.status?.description || '').slice(0, 2000);
const safeStudent = (user) => user ? {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName || '',
    emailID: user.emailID
} : null;

const normalizeStarterCode = (entries = []) => (entries || []).reduce((acc, entry) => {
    const language = String(entry.language || '').toLowerCase().replace('cpp', 'c++');
    if (languages.includes(language) && !acc.some((item) => item.language === language)) {
        acc.push({ language, code: String(entry.initialCode || '').slice(0, 100000) });
    }
    return acc;
}, []);

const questionSnapshot = (problem, points) => ({
    problemId: problem._id,
    title: problem.title,
    description: problem.description,
    constraints: problem.constraints || '',
    examples: (problem.visibleTestCases || []).map((test) => ({ input: test.input, output: test.output, explanation: test.explanation || '' })),
    visibleTestCases: (problem.visibleTestCases || []).map((test) => ({ input: test.input, output: test.output, explanation: test.explanation || '' })),
    hiddenTestCases: (problem.hiddenTestCases || []).map((test) => ({ input: test.input, output: test.output })),
    starterCode: normalizeStarterCode(problem.startCode),
    points
});

const pickQuestions = async (config) => {
    const match = { subject: config.subject, difficulty: config.difficulty, hiddenTestCases: { $ne: [] } };
    if (config.topic) match.tags = config.topic;
    const problems = await Problem.aggregate([
        { $match: match },
        { $sample: { size: config.questionCount } },
        { $project: { title: 1, description: 1, subject: 1, difficulty: 1, visibleTestCases: 1, hiddenTestCases: 1, startCode: 1 } }
    ]);
    if (problems.length !== config.questionCount) throw new Error('Not enough questions match those battle settings.');
    return problems.map((problem) => questionSnapshot(problem, 100));
};

const safeBattle = (battle, currentUserId) => {
    const playerViews = battle.players.map((player) => {
        const populated = player.userId && typeof player.userId === 'object' && player.userId.firstName;
        return {
            user: safeStudent(populated ? player.userId : null) || { _id: player.userId },
            score: player.score,
            acceptedCount: player.acceptedCount,
            connectionStatus: player.connectionStatus,
            disconnectedAt: player.disconnectedAt,
            forfeitedAt: player.forfeitedAt,
            finishedAt: player.finishedAt,
            isYou: asId(player.userId) === String(currentUserId)
        };
    });
    return {
        _id: battle._id,
        mode: battle.mode,
        status: battle.status,
        subject: battle.subject,
        difficulty: battle.difficulty,
        topic: battle.topic,
        durationMinutes: battle.durationMinutes,
        pointsPerQuestion: battle.pointsPerQuestion,
        incorrectPenalty: battle.incorrectPenalty,
        matchedAt: battle.matchedAt,
        startsAt: battle.startsAt,
        endsAt: battle.endsAt,
        completedAt: battle.completedAt,
        winnerId: battle.winnerId,
        winnerIds: battle.winnerIds?.length ? battle.winnerIds : (battle.winnerId ? [battle.winnerId] : []),
        playerCount: battle.playerCount || battle.players.length,
        resultReason: battle.resultReason,
        players: playerViews,
        questions: battle.questions.map((question, index) => ({
            _id: question._id,
            title: question.title,
            description: question.description,
            constraints: question.constraints,
            examples: question.examples,
            visibleTestCases: question.visibleTestCases,
            starterCode: question.starterCode,
            points: question.points,
            order: index
        })),
        drafts: (battle.drafts || []).filter((draft) => asId(draft.userId) === String(currentUserId)).map((draft) => ({
            questionId: draft.questionId,
            language: draft.language,
            code: draft.code,
            updatedAt: draft.updatedAt
        }))
    };
};

const emitMatch = async (battle) => {
    const populated = await Battle.findById(battle._id).populate('players.userId', 'firstName lastName emailID');
    for (const player of battle.players) {
        const payload = {
            battle: safeBattle(populated, player.userId),
            battleId: String(battle._id),
            startsAt: battle.startsAt,
            endsAt: battle.endsAt
        };
        emitToUser(player.userId, 'battle:matched', payload);
        emitToUser(player.userId, 'battle:countdown', payload);
    }
};

const createBattle = async ({ userIds, config, mode, invitationId = null, reservationToken = null }) => {
    if (!isValidBattleGroup(userIds)) throw new Error('A battle requires 2 to 16 different students.');
    const questions = await pickQuestions(config);
    const now = new Date();
    const startsAt = new Date(now.getTime() + 5000);
    const battle = await Battle.create({
        mode,
        status: 'MATCHED',
        subject: config.subject,
        difficulty: config.difficulty,
        topic: config.topic,
        durationMinutes: config.durationMinutes,
        pointsPerQuestion: 100,
        incorrectPenalty: 10,
        questions,
        players: userIds.map((userId) => ({ userId, score: 0, acceptedCount: 0, connectionStatus: 'connected', acceptedQuestions: [] })),
        playerCount: userIds.length,
        invitationId,
        matchedAt: now,
        startsAt,
        endsAt: new Date(startsAt.getTime() + config.durationMinutes * 60000)
    });
    const ttl = config.durationMinutes * 60 + 600;
    try {
        if (reservationToken) {
            const moved = await Promise.all(userIds.map((id) => redisClient.eval(
                `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1 else return 0 end`,
                { keys: [playerKey(String(id))], arguments: [reservationToken, String(battle._id), String(ttl)] }
            )));
            if (moved.some((result) => Number(result) !== 1)) throw new Error('Battle reservations expired. Please try again.');
        } else {
            await setBattlePlayers(userIds, battle._id, ttl);
        }
    } catch (error) {
        await Battle.updateOne({ _id: battle._id, status: 'MATCHED' }, {
            $set: { status: 'CANCELLED', completedAt: new Date(), resultReason: 'match_setup_failed' }
        }).catch(() => {});
        await releaseBattlePlayers(userIds, battle._id).catch(() => {});
        if (reservationToken) await releaseReservedPlayers(userIds, reservationToken).catch(() => {});
        throw error;
    }
    try {
        await emitMatch(battle);
    } catch (error) {
        console.error('Battle push notification failed:', error.message);
    }
    return battle;
};

const findStudents = async (req, res) => {
    try {
        const search = String(req.query.q || '').trim().slice(0, 80);
        if (search.length < 2) return res.json({ success: true, students: [] });
        const safeRegex = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = await User.find({
            role: 'user',
            _id: { $ne: req.result._id },
            $or: [
                { firstName: { $regex: safeRegex, $options: 'i' } },
                { lastName: { $regex: safeRegex, $options: 'i' } },
                { emailID: { $regex: safeRegex, $options: 'i' } }
            ]
        }).select('_id firstName lastName emailID').sort({ firstName: 1 }).limit(20);
        return res.json({ success: true, students: users.map(safeStudent) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to search students.' });
    }
};

const sendInvitation = async (req, res) => {
    try {
        const config = validateBattleConfig(req.body);
        const toUserId = String(req.body.toUserId || '');
        if (!objectIdIsValid(toUserId) || toUserId === asId(req.result._id)) return res.status(400).json({ message: 'Choose another student to challenge.' });
        const target = await User.findOne({ _id: toUserId, role: 'user' }).select('_id firstName lastName emailID');
        if (!target) return res.status(404).json({ message: 'Student not found.' });
        if (await Battle.exists({ 'players.userId': { $in: [req.result._id, target._id] }, status: { $in: ['COUNTDOWN', 'ACTIVE'] } })) {
            return res.status(409).json({ message: 'One of the students already has an active battle.' });
        }
        const invitation = await BattleInvitation.create({
            fromUserId: req.result._id,
            toUserId: target._id,
            subject: config.subject,
            difficulty: config.difficulty,
            topic: config.topic,
            durationMinutes: config.durationMinutes,
            questionCount: config.questionCount,
            expiresAt: new Date(Date.now() + 2 * 60000)
        });
        emitToUser(target._id, 'battle:invitation', { invitation: {
            _id: invitation._id,
            fromUser: safeStudent(req.result),
            subject: invitation.subject,
            difficulty: invitation.difficulty,
            durationMinutes: invitation.durationMinutes,
            questionCount: invitation.questionCount,
            expiresAt: invitation.expiresAt
        } });
        return res.status(201).json({ success: true, invitation });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to send invitation.' });
    }
};

const listInvitations = async (req, res) => {
    try {
        const [incoming, outgoing] = await Promise.all([
            BattleInvitation.find({ toUserId: req.result._id, status: 'pending', expiresAt: { $gt: new Date() } }).populate('fromUserId', 'firstName lastName emailID').sort({ createdAt: -1 }).limit(50),
            BattleInvitation.find({ fromUserId: req.result._id }).populate('toUserId', 'firstName lastName emailID').sort({ createdAt: -1 }).limit(50)
        ]);
        return res.json({ success: true, incoming, outgoing });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load battle invitations.' });
    }
};

const acceptInvitation = async (req, res) => {
    const userIds = [];
    let reservationToken;
    let invitation;
    try {
        if (!objectIdIsValid(req.params.invitationId)) return res.status(400).json({ message: 'Invalid invitation id.' });
        invitation = await BattleInvitation.findOneAndUpdate({
            _id: req.params.invitationId,
            toUserId: req.result._id,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }, { $set: { status: 'accepted' } }, { new: true });
        if (!invitation) return res.status(404).json({ message: 'Invitation expired or already answered.' });
        userIds.push(invitation.fromUserId, invitation.toUserId);
        reservationToken = await reservePlayers(userIds);
        if (!reservationToken) {
            invitation.status = 'cancelled';
            await invitation.save();
            return res.status(409).json({ message: 'One of the students already has an active battle.' });
        }
        const config = {
            subject: invitation.subject,
            difficulty: invitation.difficulty,
            topic: invitation.topic,
            durationMinutes: invitation.durationMinutes,
            questionCount: invitation.questionCount
        };
        const battle = await createBattle({ userIds, config, mode: 'friend', invitationId: invitation._id, reservationToken });
        invitation.battleId = battle._id;
        await invitation.save();
        return res.status(201).json({ success: true, battle: safeBattle(await Battle.findById(battle._id).populate('players.userId', 'firstName lastName emailID'), req.result._id) });
    } catch (error) {
        if (invitation && !invitation.battleId) {
            invitation.status = 'cancelled';
            await invitation.save().catch(() => {});
        }
        if (reservationToken) await releaseReservedPlayers(userIds, reservationToken).catch(() => {});
        console.error('Unable to accept battle invitation:', error);
        return res.status(400).json({ message: error.message || 'Unable to accept invitation.' });
    }
};

const rejectInvitation = async (req, res) => {
    try {
        const invitation = await BattleInvitation.findOneAndUpdate({
            _id: req.params.invitationId,
            toUserId: req.result._id,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }, { $set: { status: 'rejected' } }, { new: true });
        if (!invitation) return res.status(404).json({ message: 'Invitation expired or already answered.' });
        emitToUser(invitation.fromUserId, 'battle:invitation:rejected', { invitationId: invitation._id });
        return res.json({ success: true, status: invitation.status });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to reject invitation.' });
    }
};

const findMatch = async (req, res) => {
    let matchedIds = [];
    try {
        const config = validateBattleConfig(req.body);
        if (!redisClient.isOpen) return res.status(503).json({ message: 'Redis matchmaking is unavailable.' });
        if (await Battle.exists({ 'players.userId': req.result._id, status: { $in: ['COUNTDOWN', 'ACTIVE'] } })) {
            return res.status(409).json({ message: 'You already have an active battle.' });
        }
        const result = await findBattleGroup(req.result._id, config);
        if (result.state === 'already_active') {
            if (result.activeValue === 'WAITING') return res.json({ success: true, status: 'WAITING' });
            return res.status(409).json({ message: 'You already have an active battle.' });
        }
        if (result.state === 'waiting') return res.status(202).json({ success: true, status: 'WAITING' });

        const userIds = [req.result._id, ...result.playerIds.map((id) => new mongoose.Types.ObjectId(id))];
        matchedIds = userIds;
        const battle = await createBattle({ userIds, config, mode: 'random' });
        return res.status(201).json({ success: true, status: battle.status, battle: safeBattle(await Battle.findById(battle._id).populate('players.userId', 'firstName lastName emailID'), req.result._id) });
    } catch (error) {
        if (matchedIds.length) await releaseMatchedPlayers(matchedIds).catch(() => {});
        console.error('Random matchmaking failed:', error);
        return res.status(400).json({ message: error.message || 'Unable to find an opponent.' });
    }
};

const cancelMatchmaking = async (req, res) => {
    try {
        const cancelled = await cancelQueue(req.result._id);
        if (!cancelled) return res.status(409).json({ message: 'No waiting matchmaking request was found.' });
        return res.json({ success: true, status: 'CANCELLED' });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to cancel matchmaking.' });
    }
};

const cancelBattle = async (req, res) => {
    try {
        const battle = await Battle.findById(req.params.battleId);
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        if (!isBattleMember(battle, req.result._id)) return res.status(403).json({ message: 'You are not a player in this battle.' });
        if (!['MATCHED', 'COUNTDOWN'].includes(battle.status) || new Date() >= battle.startsAt) {
            return res.status(409).json({ message: 'A battle can only be cancelled before it starts.' });
        }
        const cancelled = await Battle.findOneAndUpdate({ _id: battle._id, status: { $in: ['MATCHED', 'COUNTDOWN'] } }, {
            $set: { status: 'CANCELLED', completedAt: new Date(), resultReason: 'cancelled_before_start' }
        }, { new: true });
        if (!cancelled) return res.status(409).json({ message: 'Battle has already started.' });
        await releaseBattlePlayers(cancelled.players.map((player) => player.userId), cancelled._id);
        emitToBattle(cancelled._id, 'battle:completed', { battleId: cancelled._id, status: 'CANCELLED', reason: cancelled.resultReason });
        for (const player of cancelled.players) emitToUser(player.userId, 'battle:completed', { battleId: cancelled._id, status: 'CANCELLED', reason: cancelled.resultReason });
        return res.json({ success: true, status: cancelled.status });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to cancel battle.' });
    }
};

const getActiveBattle = async (req, res) => {
    try {
        const battle = await Battle.findOne({ 'players.userId': req.result._id, status: { $in: ['COUNTDOWN', 'ACTIVE'] } })
            .populate('players.userId', 'firstName lastName emailID').sort({ createdAt: -1 });
        if (!battle) return res.json({ success: true, battle: null });
        return res.json({ success: true, battle: safeBattle(battle, req.result._id) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load active battle.' });
    }
};

const getBattle = async (req, res) => {
    try {
        if (!objectIdIsValid(req.params.battleId)) return res.status(400).json({ message: 'Invalid battle id.' });
        const battle = await Battle.findById(req.params.battleId).populate('players.userId', 'firstName lastName emailID');
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        if (!isBattleMember(battle, req.result._id)) return res.status(403).json({ message: 'You are not a player in this battle.' });
        return res.json({ success: true, serverNow: new Date(), battle: safeBattle(battle, req.result._id) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load battle.' });
    }
};

const joinBattle = async (req, res) => {
    try {
        const battle = await Battle.findById(req.params.battleId);
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        const player = battle.players.find((item) => asId(item.userId) === asId(req.result._id));
        if (!player) return res.status(403).json({ message: 'You are not a player in this battle.' });
        await Battle.updateOne({ _id: battle._id, 'players.userId': req.result._id }, {
            $set: { 'players.$.connectionStatus': 'connected', 'players.$.disconnectedAt': null }
        });
        emitToBattle(battle._id, 'battle:presence', { userId: asId(req.result._id), status: 'connected', serverTime: new Date().toISOString() });
        return res.json({ success: true, battle: safeBattle(await Battle.findById(battle._id).populate('players.userId', 'firstName lastName emailID'), req.result._id) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to reconnect to battle.' });
    }
};

const saveBattleDraft = async (req, res) => {
    try {
        const battle = await Battle.findById(req.params.battleId);
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        if (!isBattleMember(battle, req.result._id)) return res.status(403).json({ message: 'You are not a player in this battle.' });
        if (battle.status !== 'ACTIVE' || Date.now() > new Date(battle.endsAt).getTime()) return res.status(410).json({ message: 'This battle is no longer active.' });
        if (!battle.questions.id(req.params.questionId)) return res.status(404).json({ message: 'Question not found in this battle.' });
        const language = String(req.body.language || '').toLowerCase().replace('cpp', 'c++');
        if (!languages.includes(language) || typeof req.body.code !== 'string' || req.body.code.length > 100000) {
            return res.status(400).json({ message: 'Draft code and a supported language are required.' });
        }
        const savedAt = new Date();
        const questionId = new mongoose.Types.ObjectId(req.params.questionId);
        const draft = {
            userId: req.result._id,
            questionId,
            language,
            code: req.body.code,
            updatedAt: savedAt
        };
        const withoutCurrentDraft = {
            $filter: {
                input: { $ifNull: ['$drafts', []] },
                as: 'draft',
                cond: {
                    $not: {
                        $and: [
                            { $eq: ['$$draft.userId', req.result._id] },
                            { $eq: ['$$draft.questionId', questionId] },
                            { $eq: ['$$draft.language', language] }
                        ]
                    }
                }
            }
        };
        const result = await Battle.updateOne({
            _id: battle._id,
            status: 'ACTIVE',
            endsAt: { $gt: savedAt },
            'players.userId': req.result._id,
            'questions._id': questionId
        }, [{ $set: { drafts: { $concatArrays: [withoutCurrentDraft, [{ $literal: draft }]] }, updatedAt: savedAt } }]);
        if (result.modifiedCount !== 1) return res.status(410).json({ message: 'This battle is no longer active.' });
        return res.json({ success: true, savedAt });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to save battle draft.' });
    }
};

const runBattleCode = async (req, res) => {
    try {
        const battle = await Battle.findById(req.params.battleId);
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        if (!isBattleMember(battle, req.result._id)) return res.status(403).json({ message: 'You are not a player in this battle.' });
        const now = new Date();
        if (battle.status !== 'ACTIVE' || now >= battle.endsAt) return res.status(410).json({ message: 'This battle is not active.' });
        const question = battle.questions.id(req.params.questionId);
        if (!question) return res.status(404).json({ message: 'Question not found in this battle.' });
        const code = req.body.code;
        const language = String(req.body.language || '').toLowerCase().replace('cpp', 'c++');
        if (!languages.includes(language) || typeof code !== 'string' || !code.trim()) return res.status(400).json({ message: 'Code and a supported language are required.' });
        if (code.length > 100000) return res.status(413).json({ message: 'Code must be under 100 KB.' });
        const languageId = getLanguageById(language);
        const queued = await submitBatch(question.visibleTestCases.map((test) => ({ source_code: code, language_id: languageId, stdin: test.input, expected_output: test.output })));
        if (!Array.isArray(queued) || queued.length !== question.visibleTestCases.length || queued.some((item) => !item?.token)) throw new Error('Judge0 could not queue the code.');
        const results = await submitToken(queued.map((item) => item.token));
        if (!Array.isArray(results) || results.length !== question.visibleTestCases.length) throw new Error('Judge0 returned incomplete results.');
        const testCases = results.map((result, index) => ({
            input: question.visibleTestCases[index].input,
            expectedOutput: question.visibleTestCases[index].output,
            actualOutput: result.stdout || '',
            passed: Number(result.status_id) === 3,
            status: result.status?.description || 'Unknown status',
            error: resultError(result)
        }));
        return res.json({ success: testCases.every((item) => item.passed), testCases, testCasesPassed: testCases.filter((item) => item.passed).length, testCasesTotal: testCases.length });
    } catch (error) {
        return res.status(502).json({ message: error.message || 'Code execution failed.' });
    }
};

const updateLiveLeaderboard = async (battle) => {
    if (!redisClient.isOpen) return;
    const key = `battle:leaderboard:${battle._id}`;
    await redisClient.zAdd(key, battle.players.map((player) => ({ score: player.score, value: asId(player.userId) })));
    await redisClient.expire(key, Math.max(300, Math.floor((new Date(battle.endsAt).getTime() - Date.now()) / 1000) + 3600));
};

const isoWeekKey = (now = new Date()) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const applyFinalStats = async (battle) => {
    const weekKey = isoWeekKey(battle.completedAt || new Date());
    const winnerIds = (battle.winnerIds?.length ? battle.winnerIds : (battle.winnerId ? [battle.winnerId] : [])).map(asId);
    for (const player of battle.players) {
        const id = player.userId;
        const isWinner = winnerIds.includes(asId(id));
        const isDraw = winnerIds.length === 0 || (winnerIds.length > 1 && isWinner);
        const loss = !isWinner && !isDraw;
        const ratingChange = winnerIds.length === 1 && isWinner ? 20 : loss ? -15 : 0;
        const stats = await StudentBattleStats.findOneAndUpdate({ studentId: id }, {
            $inc: {
                wins: winnerIds.length === 1 && isWinner ? 1 : 0,
                losses: loss ? 1 : 0,
                draws: isDraw ? 1 : 0,
                totalBattles: 1,
                totalScore: player.score,
                rating: ratingChange
            }
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
        if (redisClient.isOpen) {
            await redisClient.zAdd('battle:leaderboard:global', { score: stats.rating, value: asId(id) });
            await redisClient.zIncrBy(`battle:leaderboard:weekly:${weekKey}`, Math.max(0, player.score), asId(id));
            await redisClient.expire(`battle:leaderboard:weekly:${weekKey}`, 60 * 60 * 24 * 90);
        }
    }
};

const completeBattle = async (battle, winners, reason, now = new Date()) => {
    const requestedWinnerIds = Array.isArray(winners) ? winners : (winners ? [winners] : []);
    const participantIds = new Set(battle.players.map((player) => asId(player.userId)));
    const winnerIds = [...new Set(requestedWinnerIds.map(asId).filter((id) => participantIds.has(id)))];
    const completed = await Battle.findOneAndUpdate({
        _id: battle._id,
        status: { $in: ['COUNTDOWN', 'ACTIVE', 'MATCHED'] },
        pendingSubmissions: 0
    }, {
        $set: {
            status: 'COMPLETED',
            winnerId: winnerIds.length === 1 ? winnerIds[0] : null,
            winnerIds,
            completedAt: now,
            resultReason: reason
        }
    }, { new: true });
    if (!completed) return null;
    await applyFinalStats(completed);
    const ids = completed.players.map((player) => player.userId);
    await releaseBattlePlayers(ids, completed._id).catch(() => {});
    await updateLiveLeaderboard(completed).catch(() => {});
    const payload = { battleId: completed._id, winnerId: completed.winnerId, winnerIds: completed.winnerIds, status: completed.status, reason, completedAt: completed.completedAt };
    emitToBattle(completed._id, 'battle:completed', payload);
    for (const id of ids) emitToUser(id, 'battle:completed', payload);
    return completed;
};

const submitBattleCode = async (req, res) => {
    let submission;
    let lockToken;
    let pendingSlotHeld = false;
    const battleId = req.params.battleId;
    const playerId = req.result._id;
    try {
        const battle = await Battle.findById(battleId);
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        if (!isBattleMember(battle, playerId)) return res.status(403).json({ message: 'You are not a player in this battle.' });
        if (battle.status !== 'ACTIVE' || new Date() >= battle.endsAt) return res.status(410).json({ message: 'This battle has ended.' });
        const question = battle.questions.id(req.params.questionId);
        if (!question) return res.status(404).json({ message: 'Question not found in this battle.' });
        const language = String(req.body.language || '').toLowerCase().replace('cpp', 'c++');
        const code = req.body.code;
        const clientSubmissionId = typeof req.body.clientSubmissionId === 'string' ? req.body.clientSubmissionId.slice(0, 80) : null;
        if (!languages.includes(language) || typeof code !== 'string' || !code.trim()) return res.status(400).json({ message: 'Code and a supported language are required.' });
        if (code.length > 100000) return res.status(413).json({ message: 'Code must be under 100 KB.' });
        if (!question.hiddenTestCases.length) return res.status(400).json({ message: 'This battle question has no hidden tests.' });
        if (clientSubmissionId) {
            const previous = await BattleSubmission.findOne({ battleId, playerId, clientSubmissionId });
            if (previous) return res.json({ success: true, submission: { _id: previous._id, status: previous.status, testCasesPassed: previous.testCasesPassed, testCasesTotal: previous.testCasesTotal, scoreDelta: previous.scoreDelta } });
        }
        const receivedAt = new Date();
        const reservation = await Battle.updateOne({ _id: battleId, status: 'ACTIVE', endsAt: { $gt: receivedAt } }, { $inc: { pendingSubmissions: 1 } });
        if (reservation.modifiedCount !== 1) return res.status(410).json({ message: 'This battle has ended.' });
        pendingSlotHeld = true;
        submission = await BattleSubmission.create({
            battleId,
            playerId,
            questionId: question._id,
            clientSubmissionId,
            code,
            language,
            receivedAt,
            testCasesTotal: question.hiddenTestCases.length
        });
        const languageId = getLanguageById(language);
        const queued = await submitBatch(question.hiddenTestCases.map((test) => ({ source_code: code, language_id: languageId, stdin: test.input, expected_output: test.output })));
        if (!Array.isArray(queued) || queued.length !== question.hiddenTestCases.length || queued.some((item) => !item?.token)) throw new Error('Judge0 could not queue the code.');
        const results = await submitToken(queued.map((item) => item.token));
        if (!Array.isArray(results) || results.length !== question.hiddenTestCases.length) throw new Error('Judge0 returned incomplete results.');
        const passed = results.filter((item) => Number(item.status_id) === 3).length;
        const errorResult = results.find((item) => statusError(item.status_id));
        const status = passed === results.length ? 'accepted' : errorResult ? 'error' : 'wrong';
        const runtime = results.reduce((sum, item) => sum + (Number.parseFloat(item.time) || 0), 0) * 1000;
        const memory = results.reduce((max, item) => Math.max(max, Number(item.memory) || 0), 0);
        const errorMessage = errorResult ? resultError(errorResult) : '';
        lockToken = await acquireLock(`battle:lock:${battleId}`);
        if (!lockToken) return res.status(409).json({ message: 'Battle is busy. Retry this submission.' });
        const latestBattle = await Battle.findById(battleId);
        if (!latestBattle || latestBattle.status !== 'ACTIVE' || submission.receivedAt > latestBattle.endsAt) {
            await BattleSubmission.updateOne({ _id: submission._id }, { $set: { scoreDelta: 0, errorMessage: 'Battle ended before this result was recorded.' } });
            return res.status(410).json({ message: 'Battle ended before the result could be recorded.' });
        }
        const player = latestBattle.players.find((item) => asId(item.userId) === asId(playerId));
        const alreadyAccepted = player.acceptedQuestions.some((id) => asId(id) === asId(question._id));
        const scoring = scoreSubmission({
            status,
            alreadyAccepted,
            points: question.points,
            penalty: latestBattle.incorrectPenalty,
            currentScore: player.score
        });
        if (scoring.accepted) {
            player.acceptedQuestions.push(question._id);
            player.acceptedCount += 1;
            if (player.acceptedCount >= latestBattle.questions.length && !player.finishedAt) player.finishedAt = new Date();
        }
        const scoreDelta = scoring.scoreDelta;
        player.score = scoring.score;
        await latestBattle.save();
        await BattleSubmission.updateOne({ _id: submission._id }, { $set: { status, testCasesPassed: passed, runtime, memory, errorMessage, scoreDelta } });
        await Battle.updateOne({ _id: battleId, pendingSubmissions: { $gt: 0 } }, { $inc: { pendingSubmissions: -1 } });
        pendingSlotHeld = false;
        await updateLiveLeaderboard(latestBattle);
        const scorePayload = {
            battleId,
            status: latestBattle.status,
            players: latestBattle.players.map((item) => ({ userId: asId(item.userId), score: item.score, acceptedCount: item.acceptedCount })),
            latestSubmission: { userId: asId(playerId), questionId: asId(question._id), status, scoreDelta }
        };
        emitToBattle(battleId, 'battle:score', scorePayload);
        const response = {
            _id: submission._id,
            status,
            testCasesPassed: passed,
            testCasesTotal: question.hiddenTestCases.length,
            scoreDelta,
            score: player.score,
            acceptedCount: player.acceptedCount,
            runtime,
            memory,
            errorMessage
        };
        const currentBattle = await Battle.findById(battleId);
        const allPlayersFinished = currentBattle?.players?.every((item) => item.finishedAt || item.forfeitedAt);
        const completed = currentBattle?.pendingSubmissions === 0 && allPlayersFinished
            ? await completeBattle(currentBattle, determineWinners(currentBattle.players), 'all_players_finished', new Date())
            : null;
        if (completed) response.battleStatus = completed.status;
        return res.status(201).json({ success: true, submission: response });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Duplicate submission request.' });
        if (submission?._id) await BattleSubmission.updateOne({ _id: submission._id, status: 'pending' }, { $set: { status: 'error', errorMessage: String(error.message || 'Evaluation failed.').slice(0, 2000) } }).catch(() => {});
        console.error('Battle submission failed:', error);
        return res.status(502).json({ message: error.message || 'Unable to evaluate submission.' });
    } finally {
        if (pendingSlotHeld) {
            await Battle.updateOne({ _id: battleId, pendingSubmissions: { $gt: 0 } }, { $inc: { pendingSubmissions: -1 } }).catch(() => {});
            if (submission?._id) await BattleSubmission.updateOne({ _id: submission._id, status: 'pending' }, {
                $set: { status: 'error', errorMessage: 'Submission did not finish before its server reservation expired.' }
            }).catch(() => {});
            const latestBattle = await Battle.findOne({ _id: battleId, status: 'ACTIVE', pendingSubmissions: 0 }).catch(() => null);
            if (latestBattle?.players?.every((player) => player.finishedAt || player.forfeitedAt)) {
                await completeBattle(latestBattle, determineWinners(latestBattle.players), 'all_players_finished', new Date()).catch(() => {});
            }
        }
        await releaseLock(`battle:lock:${battleId}`, lockToken).catch(() => {});
    }
};

const getBattleLeaderboard = async (req, res) => {
    try {
        const battle = await Battle.findById(req.params.battleId);
        if (!battle) return res.status(404).json({ message: 'Battle not found.' });
        if (!isBattleMember(battle, req.result._id)) return res.status(403).json({ message: 'You are not a player in this battle.' });
        const players = battle.players.slice().sort(compareBattleRank);
        const users = await User.find({ _id: { $in: players.map((player) => player.userId) } }).select('_id firstName lastName emailID');
        const userMap = new Map(users.map((user) => [asId(user._id), user]));
        return res.json({ success: true, leaderboard: players.map((player, index) => ({
            rank: index + 1,
            student: safeStudent(userMap.get(asId(player.userId))),
            score: player.score,
            acceptedCount: player.acceptedCount,
            connectionStatus: player.connectionStatus,
            forfeited: Boolean(player.forfeitedAt)
        })) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load battle leaderboard.' });
    }
};

const listLeaderboard = async (req, res) => {
    try {
        if (!redisClient.isOpen) return res.status(503).json({ message: 'Redis leaderboard is unavailable.' });
        const type = req.query.period === 'weekly' ? 'weekly' : 'global';
        const key = type === 'weekly' ? `battle:leaderboard:weekly:${isoWeekKey()}` : 'battle:leaderboard:global';
        const entries = await redisClient.zRangeWithScores(key, 0, 49, { REV: true });
        const ids = entries.map((entry) => entry.value);
        const [users, stats] = await Promise.all([
            User.find({ _id: { $in: ids } }).select('_id firstName lastName emailID'),
            StudentBattleStats.find({ studentId: { $in: ids } }).select('studentId wins losses draws totalBattles rating')
        ]);
        const userMap = new Map(users.map((user) => [asId(user._id), user]));
        const statsMap = new Map(stats.map((item) => [asId(item.studentId), item]));
        return res.json({ success: true, period: type, leaderboard: entries.map((entry, index) => ({
            rank: index + 1,
            student: safeStudent(userMap.get(entry.value)),
            score: entry.score,
            stats: statsMap.get(entry.value) || { wins: 0, losses: 0, draws: 0, totalBattles: 0, rating: 1000 }
        })) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load leaderboard.' });
    }
};

const getMyStats = async (req, res) => {
    try {
        const [stats, history] = await Promise.all([
            StudentBattleStats.findOne({ studentId: req.result._id }),
            Battle.find({ 'players.userId': req.result._id, status: 'COMPLETED' }).populate('players.userId', 'firstName lastName emailID').sort({ completedAt: -1 }).limit(50)
        ]);
        return res.json({ success: true, stats: stats || { wins: 0, losses: 0, draws: 0, totalBattles: 0, rating: 1000, totalScore: 0 }, history: history.map((battle) => safeBattle(battle, req.result._id)) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load battle history.' });
    }
};

const processBattles = async () => {
    const now = new Date();
    try {
        const matched = await Battle.find({ status: 'MATCHED' }).limit(100);
        for (const battle of matched) {
            const countdown = await Battle.findOneAndUpdate({ _id: battle._id, status: 'MATCHED' }, { $set: { status: 'COUNTDOWN' } }, { new: true });
            if (countdown) emitToBattle(countdown._id, 'battle:countdown', { battleId: countdown._id, startsAt: countdown.startsAt, endsAt: countdown.endsAt, serverTime: now.toISOString() });
        }
        const starting = await Battle.find({ status: 'COUNTDOWN', startsAt: { $lte: now } }).limit(100);
        for (const battle of starting) {
            const active = await Battle.findOneAndUpdate({ _id: battle._id, status: 'COUNTDOWN' }, { $set: { status: 'ACTIVE' } }, { new: true });
            if (active) emitToBattle(active._id, 'battle:started', { battleId: active._id, startsAt: active.startsAt, endsAt: active.endsAt, serverTime: now.toISOString() });
        }

        const disconnectCutoff = new Date(now.getTime() - 60000);
        const disconnected = await Battle.find({
            status: 'ACTIVE',
            players: { $elemMatch: { connectionStatus: 'disconnected', disconnectedAt: { $lte: disconnectCutoff }, finishedAt: null, forfeitedAt: null } }
        }).limit(100);
        for (const battle of disconnected) {
            const expiredPlayers = battle.players.filter((player) => (
                player.connectionStatus === 'disconnected'
                && player.disconnectedAt
                && player.disconnectedAt <= disconnectCutoff
                && !player.finishedAt
                && !player.forfeitedAt
            ));
            for (const player of expiredPlayers) {
                await Battle.updateOne({
                    _id: battle._id,
                    status: 'ACTIVE',
                    players: { $elemMatch: {
                        userId: player.userId,
                        connectionStatus: 'disconnected',
                        disconnectedAt: { $lte: disconnectCutoff },
                        finishedAt: null,
                        forfeitedAt: null
                    } }
                }, { $set: { 'players.$.forfeitedAt': now } });
            }
            const current = await Battle.findOne({ _id: battle._id, status: 'ACTIVE' });
            if (!current) continue;
            const eligiblePlayers = current.players.filter((player) => !player.forfeitedAt);
            const allDone = current.players.every((player) => player.finishedAt || player.forfeitedAt);
            if (eligiblePlayers.length <= 1 || allDone) {
                await completeBattle(current, determineWinners(current.players), eligiblePlayers.length <= 1 ? 'player_forfeit' : 'all_players_finished', now);
            }
        }

        const ending = await Battle.find({ status: 'ACTIVE', endsAt: { $lte: now }, pendingSubmissions: 0 }).limit(100);
        for (const battle of ending) {
            await completeBattle(battle, determineWinners(battle.players), 'time_expired', now);
        }
    } catch (error) {
        console.error('Battle lifecycle worker failed:', error.message);
    }
};

module.exports = {
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
    processBattles,
    rejectInvitation,
    runBattleCode,
    saveBattleDraft,
    sendInvitation,
    submitBattleCode
};
