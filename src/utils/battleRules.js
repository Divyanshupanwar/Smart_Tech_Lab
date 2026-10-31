const subjects = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
const difficulties = ['easy', 'medium', 'hard'];

const validateBattleConfig = (body = {}) => {
    const subject = body.subject;
    const difficulty = String(body.difficulty || '').toLowerCase();
    const durationMinutes = Number(body.durationMinutes ?? 20);
    const questionCount = Number(body.questionCount ?? 1);
    const topic = String(body.topic || '').trim().slice(0, 80);
    if (!subjects.includes(subject)) throw new Error('Choose a valid battle subject.');
    if (!difficulties.includes(difficulty)) throw new Error('Choose easy, medium or hard difficulty.');
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) throw new Error('Battle duration must be 1 to 180 minutes.');
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 5) throw new Error('Choose 1 to 5 questions.');
    return { subject, difficulty, topic, durationMinutes, questionCount };
};

const isValidBattlePair = (userIds) => Array.isArray(userIds)
    && userIds.length === 2
    && String(userIds[0]?._id || userIds[0]) !== String(userIds[1]?._id || userIds[1]);

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

const determineWinner = (players) => {
    if (!players || players.length !== 2) return null;
    const [first, second] = players;
    if (first.acceptedCount !== second.acceptedCount) return first.acceptedCount > second.acceptedCount ? first.userId : second.userId;
    if (first.score !== second.score) return first.score > second.score ? first.userId : second.userId;
    if (first.finishedAt && second.finishedAt && new Date(first.finishedAt).getTime() !== new Date(second.finishedAt).getTime()) {
        return new Date(first.finishedAt) < new Date(second.finishedAt) ? first.userId : second.userId;
    }
    if (first.finishedAt && !second.finishedAt) return first.userId;
    if (second.finishedAt && !first.finishedAt) return second.userId;
    return null;
};

module.exports = { determineWinner, isBattleMember, isValidBattlePair, scoreSubmission, validateBattleConfig };
