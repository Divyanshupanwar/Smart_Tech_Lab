const test = require('node:test');
const assert = require('node:assert/strict');
const { determineWinner, determineWinners, isBattleMember, isValidBattleGroup, scoreSubmission, validateBattleConfig } = require('../utils/battleRules');
const { buildQueueKey } = require('../services/battleQueue');

test('accepted solutions award points once and duplicate accepts do not change score', () => {
    assert.deepEqual(scoreSubmission({ status: 'accepted', alreadyAccepted: false, points: 100, penalty: 10, currentScore: 20 }), {
        accepted: true,
        scoreDelta: 100,
        score: 120
    });
    assert.deepEqual(scoreSubmission({ status: 'accepted', alreadyAccepted: true, points: 100, penalty: 10, currentScore: 120 }), {
        accepted: false,
        scoreDelta: 0,
        score: 120
    });
});

test('incorrect submissions apply a capped penalty without making score negative', () => {
    assert.deepEqual(scoreSubmission({ status: 'wrong', alreadyAccepted: false, points: 100, penalty: 10, currentScore: 40 }), {
        accepted: false,
        scoreDelta: -10,
        score: 30
    });
    assert.deepEqual(scoreSubmission({ status: 'error', alreadyAccepted: false, points: 100, penalty: 10, currentScore: 4 }), {
        accepted: false,
        scoreDelta: -4,
        score: 0
    });
});

test('winner is selected from any group by solved questions, score, then earliest finish time', () => {
    const players = [
        { userId: 'a', acceptedCount: 1, score: 100, finishedAt: null },
        { userId: 'b', acceptedCount: 2, score: 80, finishedAt: null },
        { userId: 'c', acceptedCount: 2, score: 90, finishedAt: null },
        { userId: 'd', acceptedCount: 2, score: 90, finishedAt: '2026-10-01T12:00:01Z' }
    ];
    assert.equal(determineWinner(players), 'd');
    assert.equal(determineWinner([
        { userId: 'a', acceptedCount: 2, score: 100, finishedAt: null },
        { userId: 'b', acceptedCount: 2, score: 80, finishedAt: null },
        { userId: 'c', acceptedCount: 2, score: 90, finishedAt: null }
    ]), 'a');
    assert.equal(determineWinner([
        { userId: 'a', acceptedCount: 2, score: 100, finishedAt: '2026-10-01T12:00:02Z' },
        { userId: 'b', acceptedCount: 2, score: 100, finishedAt: '2026-10-01T12:00:01Z' }
    ]), 'b');
});

test('equal result and finish time is recorded as a draw', () => {
    assert.equal(determineWinner([
        { userId: 'a', acceptedCount: 2, score: 100, finishedAt: '2026-10-01T12:00:01Z' },
        { userId: 'b', acceptedCount: 2, score: 100, finishedAt: '2026-10-01T12:00:01Z' }
    ]), null);
    assert.deepEqual(determineWinners([
        { userId: 'a', acceptedCount: 2, score: 100, finishedAt: null },
        { userId: 'b', acceptedCount: 2, score: 80, finishedAt: null },
        { userId: 'c', acceptedCount: 2, score: 100, finishedAt: null }
    ]), ['a', 'c']);
});

test('forfeited players are excluded from winner selection', () => {
    assert.deepEqual(determineWinners([
        { userId: 'a', acceptedCount: 3, score: 300, forfeitedAt: new Date() },
        { userId: 'b', acceptedCount: 1, score: 100 },
        { userId: 'c', acceptedCount: 2, score: 120 }
    ]), ['c']);
});

test('battle configuration validates filters and applies bounded defaults', () => {
    assert.deepEqual(validateBattleConfig({ subject: 'DSA', difficulty: 'HARD', topic: ' graph ', questionCount: '2' }), {
        subject: 'DSA', difficulty: 'hard', topic: 'graph', durationMinutes: 20, questionCount: 2, playerCount: 4
    });
    assert.equal(validateBattleConfig({ subject: 'DSA', difficulty: 'easy', playerCount: '8' }).playerCount, 8);
    assert.equal(validateBattleConfig({ subject: 'DSA', difficulty: 'easy', playerCount: 2 }).playerCount, 2);
    assert.equal(validateBattleConfig({ subject: 'DSA', difficulty: 'easy', playerCount: 16 }).playerCount, 16);
    assert.throws(() => validateBattleConfig({ subject: 'Unknown', difficulty: 'easy' }), /valid battle subject/);
    assert.throws(() => validateBattleConfig({ subject: 'DSA', difficulty: 'easy', durationMinutes: 181 }), /duration/);
    assert.throws(() => validateBattleConfig({ subject: 'DSA', difficulty: 'easy', questionCount: 6 }), /questions/);
    assert.throws(() => validateBattleConfig({ subject: 'DSA', difficulty: 'easy', playerCount: 1 }), /battle size/);
    assert.throws(() => validateBattleConfig({ subject: 'DSA', difficulty: 'easy', playerCount: 17 }), /battle size/);
});

test('battle groups require 2 to 16 distinct players and membership checks deny spectators', () => {
    assert.equal(isValidBattleGroup(['student-a', 'student-b']), true);
    assert.equal(isValidBattleGroup(['student-a', 'student-b', 'student-c']), true);
    assert.equal(isValidBattleGroup(Array.from({ length: 16 }, (_, index) => `student-${index}`)), true);
    assert.equal(isValidBattleGroup(['student-a', 'student-a']), false);
    assert.equal(isValidBattleGroup(['student-a']), false);
    assert.equal(isValidBattleGroup(Array.from({ length: 17 }, (_, index) => `student-${index}`)), false);
    const battle = { players: [{ userId: { _id: 'student-a' } }, { userId: 'student-b' }] };
    assert.equal(isBattleMember(battle, 'student-a'), true);
    assert.equal(isBattleMember(battle, 'spectator'), false);
});

test('different battle sizes use separate matchmaking queues', () => {
    const base = { subject: 'DSA', difficulty: 'easy', durationMinutes: 20, questionCount: 1, topic: '' };
    assert.notEqual(buildQueueKey({ ...base, playerCount: 4 }), buildQueueKey({ ...base, playerCount: 8 }));
});
