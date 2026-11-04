const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const teacherMiddleware = require('../middleware/teacherMiddleware');
const {
    deriveExamStatus,
    canManageExam,
    getAttemptDeadline,
    isStudentEligible,
    isSubmissionAllowed,
    normalizeLanguage,
    proctoringSeverity,
    serializeQuestionForStudent,
    shouldTerminateAttempt
} = require('../utils/examRules');

const originalFindById = User.findById;
const testSecret = 'exam-rules-test-secret';
const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

before(() => { process.env.JWT_KEY = testSecret; });
after(() => { User.findById = originalFindById; delete process.env.JWT_KEY; });

test('exam lifecycle uses server timestamps and publication state', () => {
    const exam = {
        published: true,
        status: 'SCHEDULED',
        startAt: new Date('2026-10-31T10:00:00Z'),
        endAt: new Date('2026-10-31T11:00:00Z')
    };
    assert.equal(deriveExamStatus({ ...exam, published: false }, new Date('2026-10-31T09:00:00Z')), 'DRAFT');
    assert.equal(deriveExamStatus(exam, new Date('2026-10-31T09:59:59Z')), 'SCHEDULED');
    assert.equal(deriveExamStatus(exam, new Date('2026-10-31T10:00:00Z')), 'ACTIVE');
    assert.equal(deriveExamStatus(exam, new Date('2026-10-31T11:00:00Z')), 'COMPLETED');
    assert.equal(deriveExamStatus({ ...exam, status: 'CANCELLED' }, new Date('2026-10-31T10:30:00Z')), 'CANCELLED');
});

test('target student, group, semester and batch rules must all match', () => {
    const exam = {
        targetStudents: ['student-1'],
        targetGroups: ['CSE-A'],
        semester: '4',
        batch: '2024'
    };
    assert.equal(isStudentEligible(exam, { _id: 'student-1', studentGroup: 'CSE-A', semester: '4', batch: '2024' }), true);
    assert.equal(isStudentEligible(exam, { _id: 'student-2', studentGroup: 'CSE-A', semester: '4', batch: '2024' }), false);
    assert.equal(isStudentEligible(exam, { _id: 'student-1', studentGroup: 'CSE-B', semester: '4', batch: '2024' }), false);
    assert.equal(isStudentEligible({ targetStudents: [], targetGroups: [], semester: '', batch: '' }, { _id: 'student-2' }), true);
});

test('attempt deadline includes configured grace but uses the earlier exam or attempt end', () => {
    const exam = { published: true, status: 'ACTIVE', endAt: new Date('2026-10-31T11:00:00Z'), gracePeriodSeconds: 30 };
    const attempt = { expiresAt: new Date('2026-10-31T10:45:00Z'), status: 'in_progress' };
    assert.equal(getAttemptDeadline(exam, attempt).toISOString(), '2026-10-31T10:45:30.000Z');
    assert.equal(isSubmissionAllowed(exam, attempt, new Date('2026-10-31T10:45:30Z')), true);
    assert.equal(isSubmissionAllowed(exam, attempt, new Date('2026-10-31T10:45:31Z')), false);
    assert.equal(isSubmissionAllowed({ ...exam, status: 'CANCELLED' }, attempt, new Date('2026-10-31T10:45:00Z')), false);
});

test('student question serialization never includes hidden tests or reference code', () => {
    const safe = serializeQuestionForStudent({
        _id: 'question-1', title: 'Add two values', description: 'Return the sum.',
        visibleTestCases: [{ input: '1 2', output: '3' }],
        hiddenTestCases: [{ input: '999 1', output: '1000' }],
        referenceSolution: [{ language: 'javascript', completeCode: 'secret' }],
        starterCode: [{ language: 'javascript', code: 'function solve() {}' }],
        marks: 10, order: 0
    });
    assert.equal(safe.visibleTestCases.length, 1);
    assert.equal(Object.hasOwn(safe, 'hiddenTestCases'), false);
    assert.equal(Object.hasOwn(safe, 'referenceSolution'), false);
    assert.equal(JSON.stringify(safe).includes('999 1'), false);
    assert.equal(JSON.stringify(safe).includes('secret'), false);
});

test('language normalization and backend violation thresholds are stable', () => {
    assert.equal(normalizeLanguage('cpp'), 'c++');
    assert.equal(normalizeLanguage('JavaScript'), 'javascript');
    assert.equal(normalizeLanguage('ruby'), null);
    assert.equal(proctoringSeverity(1), 'warning');
    assert.equal(proctoringSeverity(2), 'strong_warning');
    assert.equal(proctoringSeverity(3), 'flagged');
    assert.equal(proctoringSeverity(8), 'flagged');
});

test('teacher authorization accepts teacher and admin accounts but rejects students', async () => {
    const runMiddleware = async (role) => {
        User.findById = async () => ({ _id: 'user-id', authVersion: 0, role });
        const token = jwt.sign({ _id: 'user-id', authVersion: 0, role: 'user' }, testSecret);
        const req = { cookies: { token } };
        const res = makeResponse();
        let nextCalled = false;
        await teacherMiddleware(req, res, () => { nextCalled = true; });
        return { req, res, nextCalled };
    };
    assert.equal((await runMiddleware('teacher')).nextCalled, true);
    assert.equal((await runMiddleware('admin')).nextCalled, true);
    const student = await runMiddleware('user');
    assert.equal(student.nextCalled, false);
    assert.equal(student.res.statusCode, 403);
});

test('only the creator or an administrator can manage and monitor an examination', () => {
    const exam = { createdBy: 'teacher-1' };
    assert.equal(canManageExam(exam, { _id: 'teacher-1', role: 'teacher' }), true);
    assert.equal(canManageExam(exam, { _id: 'admin-1', role: 'admin' }), true);
    assert.equal(canManageExam(exam, { _id: 'teacher-2', role: 'teacher' }), false);
    assert.equal(canManageExam(exam, { _id: 'student-1', role: 'user' }), false);
});

test('serious proctoring policy terminates route exits and threshold violations server-side', () => {
    assert.equal(shouldTerminateAttempt({ terminateOnRouteChange: true }, 'route_navigation', 1), true);
    assert.equal(shouldTerminateAttempt({ terminateOnRouteChange: false }, 'route_navigation', 1), false);
    assert.equal(shouldTerminateAttempt({ fullscreen: true }, 'fullscreen_exit', 1), true);
    assert.equal(shouldTerminateAttempt({ clipboard: true }, 'copy', 1), true);
    assert.equal(shouldTerminateAttempt({ clipboard: true }, 'paste', 1), true);
    assert.equal(shouldTerminateAttempt({ clipboard: true }, 'cut', 1), true);
    assert.equal(shouldTerminateAttempt({ autoSubmitOnMaxViolations: true, maxViolations: 3 }, 'tab_hidden', 2), false);
    assert.equal(shouldTerminateAttempt({ autoSubmitOnMaxViolations: true, maxViolations: 3 }, 'tab_hidden', 3), true);
    assert.equal(shouldTerminateAttempt({ autoSubmitOnMaxViolations: true, maxViolations: 2 }, 'tab_hidden', 5), false);
});
