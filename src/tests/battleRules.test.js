const test = require('node:test');
const assert = require('node:assert/strict');
const { determineWinner, isBattleMember, isValidBattlePair, scoreSubmission, validateBattleConfig } = require('../utils/battleRules');

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

test('winner is selected by solved questions, score, then earliest finish time', () => {
    const players = [
        { userId: 'a', acceptedCount: 1, score: 100, finishedAt: null },
        { userId: 'b', acceptedCount: 2, score: 80, finishedAt: null }
    ];
    assert.equal(determineWinner(players), 'b');
    assert.equal(determineWinner([
        { userId: 'a', acceptedCount: 2, score: 100, finishedAt: null },
        { userId: 'b', acceptedCount: 2, score: 80, finishedAt: null }
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
});

test('battle configuration validates filters and applies bounded defaults', () => {
    assert.deepEqual(validateBattleConfig({ subject: 'DSA', difficulty: 'HARD', topic: ' graph ', questionCount: '2' }), {
        subject: 'DSA', difficulty: 'hard', topic: 'graph', durationMinutes: 20, questionCount: 2
    });
    assert.throws(() => validateBattleConfig({ subject: 'Unknown', difficulty: 'easy' }), /valid battle subject/);
    assert.throws(() => validateBattleConfig({ subject: 'DSA', difficulty: 'easy', durationMinutes: 181 }), /duration/);
    assert.throws(() => validateBattleConfig({ subject: 'DSA', difficulty: 'easy', questionCount: 6 }), /questions/);
});

test('battle creation rejects self matches and membership checks deny spectators', () => {
    assert.equal(isValidBattlePair(['student-a', 'student-b']), true);
    assert.equal(isValidBattlePair(['student-a', 'student-a']), false);
    const battle = { players: [{ userId: { _id: 'student-a' } }, { userId: 'student-b' }] };
    assert.equal(isBattleMember(battle, 'student-a'), true);
    assert.equal(isBattleMember(battle, 'spectator'), false);
});
