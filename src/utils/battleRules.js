const subjects = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
const difficulties = ['easy', 'medium', 'hard'];
const MAX_BATTLE_PLAYERS = 16;

const validateBattleConfig = (body = {}) => {
    const subject = body.subject;
    const difficulty = String(body.difficulty || '').toLowerCase();
    const durationMinutes = Number(body.durationMinutes ?? 20);
    const questionCount = Number(body.questionCount ?? 1);
    const playerCount = Number(body.playerCount ?? 4);
    const topic = String(body.topic || '').trim().slice(0, 80);
    if (!subjects.includes(subject)) throw new Error('Choose a valid battle subject.');
    if (!difficulties.includes(difficulty)) throw new Error('Choose easy, medium or hard difficulty.');
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) throw new Error('Battle duration must be 1 to 180 minutes.');
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 5) throw new Error('Choose 1 to 5 questions.');
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > MAX_BATTLE_PLAYERS) {
        throw new Error(`Choose a battle size from 2 to ${MAX_BATTLE_PLAYERS} players.`);
    }
    return { subject, difficulty, topic, durationMinutes, questionCount, playerCount };
};

const isValidBattleGroup = (userIds) => {
    if (!Array.isArray(userIds) || userIds.length < 2 || userIds.length > MAX_BATTLE_PLAYERS) return false;
    const normalizedIds = userIds.map((id) => String(id?._id || id || ''));
    return normalizedIds.every(Boolean) && new Set(normalizedIds).size === normalizedIds.length;
};

const isBattleMember = (battle, userId) => Boolean(battle?.players?.some((player) => (
    String(player.userId?._id || player.userId) === String(userId?._id || userId)
)));

const scoreSubmission = ({ status, alreadyAccepted, points, penalty, currentScore }) => {
    const accepted = status === 'accepted' && !alreadyAccepted;
    const scoreDelta = status === 'accepted'
        ? (alreadyAccepted ? 0 : points)
        : -Math.min(penalty, currentScore);

    return {
        accepted,
        scoreDelta,
        score: Math.max(0, currentScore + scoreDelta)
    };
};

const compareBattleRank = (first, second) => {
    const solvedDifference = (Number(second.acceptedCount) || 0) - (Number(first.acceptedCount) || 0);
    if (solvedDifference) return solvedDifference;
    const scoreDifference = (Number(second.score) || 0) - (Number(first.score) || 0);
    if (scoreDifference) return scoreDifference;
    const firstFinish = first.finishedAt ? new Date(first.finishedAt).getTime() : Number.POSITIVE_INFINITY;
    const secondFinish = second.finishedAt ? new Date(second.finishedAt).getTime() : Number.POSITIVE_INFINITY;
    const normalizedFirst = Number.isFinite(firstFinish) ? firstFinish : Number.POSITIVE_INFINITY;
    const normalizedSecond = Number.isFinite(secondFinish) ? secondFinish : Number.POSITIVE_INFINITY;
    if (normalizedFirst === normalizedSecond) return 0;
    return normalizedFirst - normalizedSecond;
};

const determineWinners = (players) => {
    const ranked = (players || []).filter((player) => !player.forfeitedAt).slice().sort(compareBattleRank);
    if (!ranked.length) return [];
    const firstPlace = ranked[0];
    return ranked.filter((player) => compareBattleRank(firstPlace, player) === 0).map((player) => player.userId);
};

const determineWinner = (players) => {
    const winners = determineWinners(players);
    return winners.length === 1 ? winners[0] : null;
};

module.exports = {
    compareBattleRank,
    determineWinner,
    determineWinners,
    isBattleMember,
    isValidBattleGroup,
    MAX_BATTLE_PLAYERS,
    scoreSubmission,
    validateBattleConfig
};
