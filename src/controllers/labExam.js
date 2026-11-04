const mongoose = require('mongoose');
const LabExam = require('../models/labExam');
const ExamQuestion = require('../models/examQuestion');
const ExamAttempt = require('../models/examAttempt');
const ExamSubmission = require('../models/examSubmission');
const ProctoringEvent = require('../models/proctoringEvent');
const Problem = require('../models/problem');
const User = require('../models/user');
const { getLanguageById, submitBatch, submitToken } = require('../utils/problemUtility');
const { emitExamActivity } = require('../services/examRealtime');
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

const PROCTORING_KEYS = [
    'tabVisibility', 'windowFocus', 'clipboard', 'contextMenu', 'fullscreen',
    'camera', 'microphone', 'facePresence', 'audioActivity'
];
const EVENT_CONFIG = {
    tab_hidden: 'tabVisibility',
    window_blur: 'windowFocus',
    copy: 'clipboard',
    paste: 'clipboard',
    cut: 'clipboard',
    context_menu: 'contextMenu',
    fullscreen_exit: 'fullscreen',
    camera_disconnected: 'camera',
    microphone_disconnected: 'microphone',
    face_missing: 'facePresence',
    multiple_faces: 'facePresence',
    audio_activity: 'audioActivity'
};
const SUBJECTS = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
const objectIdIsValid = (id) => mongoose.Types.ObjectId.isValid(id);
const asId = (value) => String(value?._id || value || '');

const managePermission = canManageExam;

const paginate = (query) => ({
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25))
});

const normalizeTestCases = (cases, { requireOne = false } = {}) => {
    if (!Array.isArray(cases)) throw new Error('Test cases must be an array.');
    if (requireOne && cases.length === 0) throw new Error('At least one hidden test case is required.');
    if (cases.length > 100) throw new Error('Each question may contain at most 100 test cases.');
    return cases.map((testCase) => {
        if (typeof testCase?.input !== 'string' || typeof testCase?.output !== 'string') {
            throw new Error('Every test case needs input and output strings.');
        }
        return {
            input: testCase.input,
            output: testCase.output,
            explanation: String(testCase.explanation || '').slice(0, 2000)
        };
    });
};

const normalizeStarterCode = (entries = []) => {
    if (!Array.isArray(entries)) throw new Error('Starter code must be an array.');
    const seen = new Set();
    return entries.reduce((result, entry) => {
        const language = normalizeLanguage(entry?.language);
        if (language && !seen.has(language)) {
            seen.add(language);
            result.push({ language, code: String(entry.code ?? entry.initialCode ?? '').slice(0, 100000) });
        }
        return result;
    }, []);
};

const normalizeProctoring = (value = {}) => {
    const config = {};
    for (const key of PROCTORING_KEYS) config[key] = Boolean(value?.[key]);
    config.clipboard = true;
    config.fullscreen = true;
    const configuredLimit = value?.maxViolations == null ? 3 : Number(value.maxViolations);
    config.maxViolations = Math.min(100, Math.max(0, Number.isFinite(configuredLimit) ? configuredLimit : 3));
    config.autoSubmitOnMaxViolations = (value?.autoSubmitOnMaxViolations == null || Boolean(value.autoSubmitOnMaxViolations)) && config.maxViolations >= 3;
    config.terminateOnRouteChange = value?.terminateOnRouteChange !== false;
    return config;
};

const normalizeTargets = (values, field) => {
    if (values == null) return [];
    if (!Array.isArray(values)) throw new Error(`${field} must be a list.`);
    if (values.length > 500) throw new Error(`${field} may contain at most 500 entries.`);
    return values.map((value) => {
        const text = String(value).trim();
        if (field === 'targetStudents' && !objectIdIsValid(text)) throw new Error('A target student id is invalid.');
        if (field === 'targetGroups' && (!text || text.length > 80)) throw new Error('A target group is invalid.');
        return text;
    });
};

const makeQuestionSpecFromProblem = (problem, marks, order) => ({
    sourceProblemId: problem._id,
    title: problem.title,
    description: problem.description,
    constraints: problem.constraints || '',
    examples: (problem.visibleTestCases || []).map((item) => ({
        input: item.input,
        output: item.output,
        explanation: item.explanation || ''
    })),
    visibleTestCases: normalizeTestCases(problem.visibleTestCases || []),
    hiddenTestCases: normalizeTestCases(problem.hiddenTestCases || [], { requireOne: true }),
    starterCode: normalizeStarterCode((problem.startCode || []).map((entry) => ({
        language: entry.language,
        code: entry.initialCode
    }))),
    marks,
    order
});

const makeCustomQuestionSpec = (question, order) => {
    const title = String(question?.title || '').trim();
    const description = String(question?.description || '').trim();
    const marks = Number(question?.marks);
    if (!title || title.length > 160 || !description || description.length > 20000) {
        throw new Error('Each examination question needs a title and description.');
    }
    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) throw new Error('Question marks must be between 1 and 1000.');
    const visibleTestCases = normalizeTestCases(question.visibleTestCases || []);
    const hiddenTestCases = normalizeTestCases(question.hiddenTestCases || [], { requireOne: true });
    return {
        sourceProblemId: null,
        title,
        description,
        constraints: String(question.constraints || '').slice(0, 5000),
        examples: normalizeTestCases(question.examples || visibleTestCases),
        visibleTestCases,
        hiddenTestCases,
        starterCode: normalizeStarterCode(question.starterCode || []),
        marks,
        order
    };
};

const buildQuestionSpecs = async (questions, subject) => {
    if (!Array.isArray(questions) || questions.length === 0 || questions.length > 30) {
        throw new Error('Choose between 1 and 30 examination questions.');
    }
    const problemEntries = questions.filter((question) => question?.problemId);
    const problemIds = problemEntries.map((question) => String(question.problemId));
    if (problemIds.some((id) => !objectIdIsValid(id))) throw new Error('A selected problem id is invalid.');
    const problems = problemIds.length ? await Problem.find({ _id: { $in: problemIds } }) : [];
    const problemMap = new Map(problems.map((problem) => [asId(problem._id), problem]));
    if (problemMap.size !== new Set(problemIds).size) throw new Error('One or more selected problems do not exist.');

    const specs = [];
    for (const [order, input] of questions.entries()) {
        if (input?.problemId) {
            const problem = problemMap.get(String(input.problemId));
            if (problem.subject !== subject) throw new Error('Selected problem subjects must match the examination subject.');
            const marks = Number(input.marks);
            if (!Number.isInteger(marks) || marks < 1 || marks > 1000) throw new Error('Question marks must be between 1 and 1000.');
            specs.push(makeQuestionSpecFromProblem(problem, marks, order));
        } else {
            specs.push(makeCustomQuestionSpec(input, order));
        }
    }
    return specs;
};

const parseMetadata = (body, existing = null) => {
    const title = String(body.title ?? existing?.title ?? '').trim();
    const description = String(body.description ?? existing?.description ?? '').trim();
    const subject = body.subject ?? existing?.subject;
    const startAt = new Date(body.startAt ?? existing?.startAt);
    const endAt = new Date(body.endAt ?? existing?.endAt);
    const durationMinutes = Number(body.durationMinutes ?? existing?.durationMinutes);
    const maxAttempts = Number(body.maxAttempts ?? existing?.maxAttempts ?? 1);
    const gracePeriodSeconds = Number(body.gracePeriodSeconds ?? existing?.gracePeriodSeconds ?? 0);
    if (!title || title.length > 160 || !description || description.length > 10000) throw new Error('A title and description are required.');
    if (!SUBJECTS.includes(subject)) throw new Error('A valid subject is required.');
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
        throw new Error('The examination end time must be after its start time.');
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) throw new Error('Duration must be between 1 and 600 minutes.');
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error('Maximum attempts must be between 1 and 10.');
    if (!Number.isInteger(gracePeriodSeconds) || gracePeriodSeconds < 0 || gracePeriodSeconds > 3600) throw new Error('Grace period must be between 0 and 3600 seconds.');
    return {
        title,
        description,
        subject,
        semester: String(body.semester ?? existing?.semester ?? '').trim().slice(0, 40),
        batch: String(body.batch ?? existing?.batch ?? '').trim().slice(0, 80),
        targetStudents: normalizeTargets(body.targetStudents ?? existing?.targetStudents?.map(asId), 'targetStudents'),
        targetGroups: normalizeTargets(body.targetGroups ?? existing?.targetGroups, 'targetGroups'),
        startAt,
        endAt,
        durationMinutes,
        maxAttempts,
        gracePeriodSeconds,
        autoSubmit: body.autoSubmit == null ? (existing?.autoSubmit ?? true) : Boolean(body.autoSubmit),
        proctoring: normalizeProctoring(body.proctoring ?? existing?.proctoring)
    };
};

const insertQuestionSpecs = async (exam, specs) => {
    const docs = await ExamQuestion.insertMany(specs.map((spec) => ({ ...spec, examId: exam._id })));
    exam.questions = docs.map((question, index) => ({
        questionId: question._id,
        marks: question.marks,
        order: index
    }));
    exam.totalMarks = docs.reduce((sum, question) => sum + question.marks, 0);
    await exam.save();
    return docs;
};

const safeExamSummary = (exam, { includeTargets = false } = {}) => {
    const summary = {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        subject: exam.subject,
        semester: exam.semester,
        batch: exam.batch,
        startAt: exam.startAt,
        endAt: exam.endAt,
        durationMinutes: exam.durationMinutes,
        gracePeriodSeconds: exam.gracePeriodSeconds,
        maxAttempts: exam.maxAttempts,
        totalMarks: exam.totalMarks,
        questionCount: exam.questions?.length || 0,
        questions: (exam.questions || []).map((item) => ({
            questionId: item.questionId,
            marks: item.marks,
            order: item.order
        })),
        proctoring: normalizeProctoring(exam.proctoring),
        autoSubmit: exam.autoSubmit,
        published: exam.published,
        status: deriveExamStatus(exam),
        createdBy: exam.createdBy,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt
    };
    if (includeTargets) {
        summary.targetStudents = exam.targetStudents;
        summary.targetGroups = exam.targetGroups;
    }
    return summary;
};

const synchronizeExamLifecycle = async (exam, now = new Date()) => {
    if (!exam?.published || exam.status === 'CANCELLED') return exam;
    const currentStatus = deriveExamStatus(exam, now);
    if (currentStatus !== exam.status) {
        await LabExam.updateOne({ _id: exam._id, status: exam.status }, { $set: { status: currentStatus } });
        exam.status = currentStatus;
    }
    return exam;
};

const loadExamForManager = async (examId, user, res) => {
    if (!objectIdIsValid(examId)) {
        res.status(400).json({ message: 'Invalid examination id.' });
        return null;
    }
    const exam = await LabExam.findById(examId);
    if (!exam) {
        res.status(404).json({ message: 'Examination not found.' });
        return null;
    }
    if (!managePermission(exam, user)) {
        res.status(403).json({ message: 'Only the examination creator or an administrator may manage it.' });
        return null;
    }
    return exam;
};

const listExams = async (req, res) => {
    try {
        const { page, limit } = paginate(req.query);
        const isManager = ['teacher', 'admin'].includes(req.result.role);
        let exams;
        if (isManager) {
            const filter = req.result.role === 'admin' ? {} : { createdBy: req.result._id };
            const total = await LabExam.countDocuments(filter);
            exams = await LabExam.find(filter).sort({ startAt: -1 }).skip((page - 1) * limit).limit(limit);
            await Promise.all(exams.map((exam) => synchronizeExamLifecycle(exam)));
            return res.json({ success: true, exams: exams.map((exam) => safeExamSummary(exam, { includeTargets: true })), page, limit, total });
        }

        exams = await LabExam.find({ published: true, status: { $ne: 'CANCELLED' } }).sort({ startAt: 1 });
        await Promise.all(exams.map((exam) => synchronizeExamLifecycle(exam)));
        exams = exams.filter((exam) => isStudentEligible(exam, req.result));
        const total = exams.length;
        const pageExams = exams.slice((page - 1) * limit, page * limit);
        const attempts = await ExamAttempt.find({
            studentId: req.result._id,
            examId: { $in: pageExams.map((exam) => exam._id) }
        }).sort({ attemptNumber: -1 });
        const latestAttempts = new Map();
        const attemptCounts = new Map();
        for (const attempt of attempts) {
            const key = asId(attempt.examId);
            attemptCounts.set(key, (attemptCounts.get(key) || 0) + 1);
            if (!latestAttempts.has(key)) latestAttempts.set(key, attempt);
        }
        return res.json({
            success: true,
            exams: pageExams.map((exam) => ({
                ...safeExamSummary(exam),
                attemptCount: attemptCounts.get(asId(exam._id)) || 0,
                latestAttempt: latestAttempts.get(asId(exam._id)) ? {
                    _id: latestAttempts.get(asId(exam._id))._id,
                    attemptNumber: latestAttempts.get(asId(exam._id)).attemptNumber,
                    status: latestAttempts.get(asId(exam._id)).status,
                    totalScore: latestAttempts.get(asId(exam._id)).totalScore
                } : null
            })),
            page,
            limit,
            total
        });
    } catch (error) {
        console.error('Unable to list lab examinations:', error);
        return res.status(500).json({ message: 'Unable to list examinations.' });
    }
};

const createExam = async (req, res) => {
    let exam;
    try {
        const metadata = parseMetadata(req.body);
        const specs = await buildQuestionSpecs(req.body.questions, metadata.subject);
        exam = await LabExam.create({
            ...metadata,
            totalMarks: specs.reduce((sum, question) => sum + question.marks, 0),
            status: 'DRAFT',
            published: false,
            createdBy: req.result._id
        });
        await insertQuestionSpecs(exam, specs);
        return res.status(201).json({ success: true, exam: safeExamSummary(exam, { includeTargets: true }) });
    } catch (error) {
        if (exam?._id) {
            await ExamQuestion.deleteMany({ examId: exam._id }).catch(() => {});
            await LabExam.findByIdAndDelete(exam._id).catch(() => {});
        }
        return res.status(400).json({ message: error.message || 'Unable to create examination.' });
    }
};

const updateExam = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        if (Date.now() >= new Date(exam.startAt).getTime()) return res.status(409).json({ message: 'An examination cannot be edited after its scheduled start.' });
        if (await ExamAttempt.exists({ examId: exam._id })) return res.status(409).json({ message: 'An examination with attempts cannot be edited.' });

        const metadata = parseMetadata(req.body, exam);
        if (exam.published && metadata.startAt.getTime() <= Date.now()) {
            return res.status(400).json({ message: 'A published examination must keep a future start time until it begins.' });
        }
        const specs = req.body.questions ? await buildQuestionSpecs(req.body.questions, metadata.subject) : null;
        Object.assign(exam, metadata);
        if (specs) {
            await ExamQuestion.deleteMany({ examId: exam._id });
            exam.questions = [];
            await exam.save();
            await insertQuestionSpecs(exam, specs);
        } else {
            await exam.save();
        }
        return res.json({ success: true, exam: safeExamSummary(exam, { includeTargets: true }) });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to update examination.' });
    }
};

const deleteExam = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        if (Date.now() >= new Date(exam.startAt).getTime()) return res.status(409).json({ message: 'An examination can only be deleted before it starts.' });
        if (await ExamAttempt.exists({ examId: exam._id })) return res.status(409).json({ message: 'An examination with attempts cannot be deleted.' });
        await Promise.all([
            ExamQuestion.deleteMany({ examId: exam._id }),
            LabExam.findByIdAndDelete(exam._id)
        ]);
        return res.json({ success: true, message: 'Examination deleted.' });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to delete examination.' });
    }
};

const publishExam = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        if (exam.status === 'CANCELLED' || Date.now() >= new Date(exam.startAt).getTime()) {
            return res.status(409).json({ message: 'Publish the examination before its scheduled start time.' });
        }
        if (!exam.questions.length) return res.status(400).json({ message: 'Add at least one question before publishing.' });
        exam.published = true;
        exam.status = 'SCHEDULED';
        await exam.save();
        return res.json({ success: true, exam: safeExamSummary(exam, { includeTargets: true }) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to publish examination.' });
    }
};

const unpublishExam = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        if (Date.now() >= new Date(exam.startAt).getTime() || await ExamAttempt.exists({ examId: exam._id })) {
            return res.status(409).json({ message: 'An examination cannot be unpublished after it starts or has attempts.' });
        }
        exam.published = false;
        exam.status = 'DRAFT';
        await exam.save();
        return res.json({ success: true, exam: safeExamSummary(exam, { includeTargets: true }) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to unpublish examination.' });
    }
};

const cancelExam = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        await synchronizeExamLifecycle(exam);
        if (!['SCHEDULED', 'ACTIVE'].includes(exam.status)) {
            return res.status(409).json({ message: 'Only scheduled or active examinations can be cancelled.' });
        }
        exam.status = 'CANCELLED';
        await exam.save();
        await ExamAttempt.updateMany({ examId: exam._id, status: 'in_progress' }, {
            $set: { status: 'expired', studentStatus: 'submitted', submittedAt: new Date() }
        });
        emitExamActivity(exam._id, 'exam_cancelled');
        return res.json({ success: true, exam: safeExamSummary(exam, { includeTargets: true }) });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to cancel examination.' });
    }
};

const getExam = async (req, res) => {
    try {
        const exam = await LabExam.findById(req.params.examId);
        if (!exam) return res.status(404).json({ message: 'Examination not found.' });
        await synchronizeExamLifecycle(exam);
        const isManager = managePermission(exam, req.result);
        if (!isManager && (!exam.published || !isStudentEligible(exam, req.result))) {
            return res.status(403).json({ message: 'You are not eligible to view this examination.' });
        }
        return res.json({ success: true, exam: safeExamSummary(exam, { includeTargets: isManager }) });
    } catch (error) {
        return res.status(400).json({ message: 'Unable to load examination.' });
    }
};

const expireAttemptIfNeeded = async (exam, attempt, now = new Date()) => {
    if (attempt.status === 'in_progress' && new Date(now).getTime() > getAttemptDeadline(exam, attempt).getTime()) {
        attempt.status = 'expired';
        attempt.studentStatus = 'submitted';
        attempt.submittedAt = now;
        await attempt.save();
        emitExamActivity(exam._id, 'attempt_expired', { attemptId: String(attempt._id) });
        if (exam.autoSubmit) await autoGradeAttemptDrafts(exam, attempt);
    }
    return attempt;
};

const joinExam = async (req, res) => {
    try {
        const exam = await LabExam.findById(req.params.examId);
        if (!exam) return res.status(404).json({ message: 'Examination not found.' });
        const now = new Date();
        await synchronizeExamLifecycle(exam, now);
        if (!exam.published || !isStudentEligible(exam, req.result)) return res.status(403).json({ message: 'You are not eligible to join this examination.' });
        if (deriveExamStatus(exam, now) !== 'ACTIVE') return res.status(409).json({ message: 'This examination is not currently open.' });

        let activeAttempt = await ExamAttempt.findOne({ examId: exam._id, studentId: req.result._id, status: 'in_progress' });
        if (activeAttempt) {
            await expireAttemptIfNeeded(exam, activeAttempt, now);
            if (activeAttempt.status === 'in_progress') {
                emitExamActivity(exam._id, 'student_reconnected', { attemptId: String(activeAttempt._id) });
                return res.json({ success: true, attempt: { _id: activeAttempt._id, attemptNumber: activeAttempt.attemptNumber, status: activeAttempt.status } });
            }
        }

        const otherAttempt = await ExamAttempt.findOne({ studentId: req.result._id, status: 'in_progress' }).sort({ startedAt: -1 });
        if (otherAttempt) {
            const otherExam = await LabExam.findById(otherAttempt.examId);
            if (otherExam) await expireAttemptIfNeeded(otherExam, otherAttempt, now);
            if (otherAttempt.status === 'in_progress') {
                return res.status(409).json({ message: 'Finish or reconnect to your currently active examination before joining another.' });
            }
        }

        const attemptsUsed = await ExamAttempt.countDocuments({ examId: exam._id, studentId: req.result._id });
        if (attemptsUsed >= exam.maxAttempts) return res.status(409).json({ message: 'You have used all examination attempts.' });

        const questionProgress = exam.questions.map((item) => ({ questionId: item.questionId, bestScore: 0 }));
        const attempt = await ExamAttempt.create({
            examId: exam._id,
            studentId: req.result._id,
            attemptNumber: attemptsUsed + 1,
            joinedAt: now,
            startedAt: now,
            lastActivityAt: now,
            expiresAt: new Date(Math.min(now.getTime() + exam.durationMinutes * 60000, new Date(exam.endAt).getTime())),
            questionProgress
        });
        emitExamActivity(exam._id, 'student_joined', { attemptId: String(attempt._id) });
        return res.status(201).json({ success: true, attempt: { _id: attempt._id, attemptNumber: attempt.attemptNumber, status: attempt.status } });
    } catch (error) {
        if (error.code === 11000) {
            const attempt = await ExamAttempt.findOne({ examId: req.params.examId, studentId: req.result._id, status: 'in_progress' });
            if (attempt) return res.json({ success: true, attempt: { _id: attempt._id, attemptNumber: attempt.attemptNumber, status: attempt.status } });
            return res.status(409).json({ message: 'An examination attempt is already being created.' });
        }
        console.error('Unable to join lab examination:', error);
        return res.status(500).json({ message: 'Unable to start examination.' });
    }
};

const getMyActiveAttempt = async (req, res) => {
    try {
        const attempt = await ExamAttempt.findOne({ studentId: req.result._id, status: 'in_progress' }).sort({ startedAt: -1 });
        if (!attempt) return res.json({ success: true, attempt: null, serverNow: new Date() });
        const exam = await LabExam.findById(attempt.examId);
        if (!exam) return res.json({ success: true, attempt: null, serverNow: new Date() });
        await expireAttemptIfNeeded(exam, attempt);
        if (attempt.status !== 'in_progress') return res.json({ success: true, attempt: null, serverNow: new Date() });
        return res.json({
            success: true,
            serverNow: new Date(),
            attempt: { _id: attempt._id, examId: exam._id, status: attempt.status }
        });
    } catch (_error) {
        return res.status(500).json({ message: 'Unable to check your active examination.' });
    }
};

const loadAttemptContext = async (attemptId, user, res, { allowManager = false, allowFinal = false } = {}) => {
    if (!objectIdIsValid(attemptId)) {
        res.status(400).json({ message: 'Invalid attempt id.' });
        return null;
    }
    const attempt = await ExamAttempt.findById(attemptId);
    if (!attempt) {
        res.status(404).json({ message: 'Attempt not found.' });
        return null;
    }
    const exam = await LabExam.findById(attempt.examId);
    if (!exam) {
        res.status(404).json({ message: 'Examination not found.' });
        return null;
    }
    const owner = asId(attempt.studentId) === asId(user._id);
    const manager = allowManager && managePermission(exam, user);
    if (!owner && !manager) {
        res.status(403).json({ message: 'You do not have access to this attempt.' });
        return null;
    }
    await expireAttemptIfNeeded(exam, attempt);
    if (!allowFinal && attempt.status !== 'in_progress') {
        res.status(410).json({ message: 'This examination attempt is no longer active.' });
        return null;
    }
    if (!allowFinal && (!exam.published || exam.status === 'CANCELLED')) {
        res.status(410).json({ message: 'This examination is no longer active.' });
        return null;
    }
    return { exam, attempt, manager };
};

const getAttempt = async (req, res) => {
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res, { allowFinal: true });
        if (!context) return;
        const { exam, attempt } = context;
        const questions = await ExamQuestion.find({ examId: exam._id }).sort({ order: 1 });
        const submissions = await ExamSubmission.find({ attemptId: attempt._id })
            .select('_id questionId language status testCasesPassed testCasesTotal score runtime memory errorMessage createdAt')
            .sort({ createdAt: -1 }).limit(100);
        return res.json({
            success: true,
            serverNow: new Date(),
            exam: safeExamSummary(exam),
            attempt: {
                _id: attempt._id,
                attemptNumber: attempt.attemptNumber,
                status: attempt.status,
                startedAt: attempt.startedAt,
                expiresAt: attempt.expiresAt,
                deadline: getAttemptDeadline(exam, attempt),
                submittedAt: attempt.submittedAt,
                totalScore: attempt.totalScore,
                questionProgress: attempt.questionProgress,
                drafts: attempt.drafts,
                violationCount: attempt.violationCount,
                flagged: attempt.flagged,
                terminationReason: attempt.terminationReason
            },
            questions: questions.map(serializeQuestionForStudent),
            submissions
        });
    } catch (error) {
        console.error('Unable to load examination attempt:', error);
        return res.status(500).json({ message: 'Unable to load attempt.' });
    }
};

const loadAttemptQuestion = async (context, questionId, res) => {
    if (!objectIdIsValid(questionId)) {
        res.status(400).json({ message: 'Invalid question id.' });
        return null;
    }
    const member = context.exam.questions.some((item) => asId(item.questionId) === String(questionId));
    if (!member) {
        res.status(403).json({ message: 'This question is not part of the examination.' });
        return null;
    }
    const question = await ExamQuestion.findOne({ _id: questionId, examId: context.exam._id });
    if (!question) {
        res.status(404).json({ message: 'Question not found.' });
        return null;
    }
    return question;
};

const saveDraft = async (req, res) => {
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res);
        if (!context) return;
        const question = await loadAttemptQuestion(context, req.params.questionId, res);
        if (!question) return;
        const language = normalizeLanguage(req.body.language);
        if (!language) return res.status(400).json({ message: 'Choose a supported programming language.' });
        if (typeof req.body.code !== 'string' || req.body.code.length > 100000) return res.status(400).json({ message: 'Code must be a string under 100 KB.' });

        const draft = context.attempt.drafts.find((item) => asId(item.questionId) === asId(question._id) && item.language === language);
        const savedAt = new Date();
        if (draft) {
            draft.language = language;
            draft.code = req.body.code;
            draft.updatedAt = savedAt;
        } else {
            context.attempt.drafts.push({ questionId: question._id, language, code: req.body.code, updatedAt: savedAt });
        }
        context.attempt.studentStatus = 'active';
        context.attempt.lastActivityAt = savedAt;
        await context.attempt.save();
        return res.json({ success: true, savedAt });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to save draft.' });
    }
};

const executeCases = async (code, language, cases) => {
    const languageId = getLanguageById(language);
    if (!languageId) throw new Error('Unsupported programming language.');
    const queued = await submitBatch(cases.map((testCase) => ({
        source_code: code,
        language_id: languageId,
        stdin: testCase.input,
        expected_output: testCase.output
    })));
    if (!Array.isArray(queued) || queued.length !== cases.length || queued.some((item) => !item?.token)) {
        throw new Error('Judge0 could not queue the code for evaluation.');
    }
    const results = await submitToken(queued.map((item) => item.token));
    if (!Array.isArray(results) || results.length !== cases.length) throw new Error('Judge0 returned incomplete results.');
    return results;
};

const isExecutionError = (statusId) => [5, 6, 7, 8, 9, 10, 11, 12, 13].includes(Number(statusId));
const errorText = (result) => String(result?.stderr || result?.compile_output || result?.message || result?.status?.description || '').slice(0, 2000);

const updateAttemptScore = async (attemptId, questionId, submissionId, score, status) => {
    await ExamAttempt.updateOne({ _id: attemptId }, [
        { $set: {
            questionProgress: {
                $map: {
                    input: '$questionProgress',
                    as: 'progress',
                    in: {
                        $cond: [
                            { $eq: ['$$progress.questionId', questionId] },
                            { $mergeObjects: ['$$progress', {
                                bestScore: { $max: ['$$progress.bestScore', score] },
                                latestStatus: status,
                                lastSubmissionId: submissionId
                            }] },
                            '$$progress'
                        ]
                    }
                }
            }
        } },
        { $set: { totalScore: { $sum: '$questionProgress.bestScore' } } }
    ]);
};

const autoGradeAttemptDrafts = async (exam, attempt) => {
    const questions = await ExamQuestion.find({ examId: exam._id });
    const latestDrafts = new Map();
    for (const draft of attempt.drafts || []) {
        const key = asId(draft.questionId);
        const current = latestDrafts.get(key);
        if (!current || new Date(draft.updatedAt) > new Date(current.updatedAt)) latestDrafts.set(key, draft);
    }

    for (const question of questions) {
        const draft = latestDrafts.get(asId(question._id));
        if (!draft || !String(draft.code || '').trim() || !question.hiddenTestCases.length) continue;
        const previous = await ExamSubmission.findOne({
            attemptId: attempt._id,
            questionId: question._id,
            language: draft.language,
            code: draft.code,
            status: { $ne: 'pending' }
        });
        if (previous) continue;

        let submission;
        try {
            const autoId = `auto:${question._id}:${new Date(draft.updatedAt).getTime()}`;
            submission = await ExamSubmission.create({
                examId: exam._id,
                attemptId: attempt._id,
                studentId: attempt.studentId,
                questionId: question._id,
                clientSubmissionId: autoId,
                code: draft.code,
                language: draft.language,
                receivedAt: new Date(),
                testCasesTotal: question.hiddenTestCases.length
            });
        } catch (error) {
            if (error.code === 11000) continue;
            console.error('Unable to create automatic exam submission:', error);
            continue;
        }

        try {
            const results = await executeCases(draft.code, draft.language, question.hiddenTestCases);
            const passed = results.filter((item) => Number(item?.status_id) === 3).length;
            const executionError = results.find((item) => isExecutionError(item?.status_id));
            const status = passed === results.length ? 'accepted' : executionError ? 'error' : 'wrong';
            const score = Math.floor((passed / question.hiddenTestCases.length) * question.marks);
            const runtime = results.reduce((sum, item) => sum + (Number.parseFloat(item?.time) || 0), 0) * 1000;
            const memory = results.reduce((max, item) => Math.max(max, Number(item?.memory) || 0), 0);
            const message = executionError ? errorText(executionError) : '';
            await ExamSubmission.updateOne({ _id: submission._id }, {
                $set: { status, testCasesPassed: passed, score, runtime, memory, errorMessage: message }
            });
            await updateAttemptScore(attempt._id, question._id, submission._id, score, status);
        } catch (error) {
            await ExamSubmission.updateOne({ _id: submission._id, status: 'pending' }, {
                $set: { status: 'error', errorMessage: String(error.message || 'Automatic evaluation failed.').slice(0, 2000) }
            }).catch(() => {});
            console.error('Automatic exam submission evaluation failed:', error.message);
        }
    }
};

const runQuestion = async (req, res) => {
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res);
        if (!context) return;
        const question = await loadAttemptQuestion(context, req.params.questionId, res);
        if (!question) return;
        const language = normalizeLanguage(req.body.language);
        const code = req.body.code;
        if (!language || typeof code !== 'string' || !code.trim()) return res.status(400).json({ message: 'Code and a supported language are required.' });
        if (code.length > 100000) return res.status(413).json({ message: 'Code must be under 100 KB.' });
        if (!question.visibleTestCases.length) return res.status(400).json({ message: 'This question has no visible tests to run.' });

        const results = await executeCases(code, language, question.visibleTestCases);
        const cases = results.map((result, index) => ({
            input: question.visibleTestCases[index].input,
            expectedOutput: question.visibleTestCases[index].output,
            actualOutput: result?.stdout || '',
            passed: Number(result?.status_id) === 3,
            status: result?.status?.description || 'Unknown status',
            error: errorText(result)
        }));
        const passed = cases.filter((item) => item.passed).length;
        return res.json({ success: passed === cases.length, testCasesPassed: passed, testCasesTotal: cases.length, testCases: cases });
    } catch (error) {
        console.error('Exam code run failed:', error);
        return res.status(502).json({ message: error.message || 'Code execution failed.' });
    }
};

const submitQuestion = async (req, res) => {
    let submission;
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res);
        if (!context) return;
        const question = await loadAttemptQuestion(context, req.params.questionId, res);
        if (!question) return;
        const language = normalizeLanguage(req.body.language);
        const code = req.body.code;
        const clientSubmissionId = typeof req.body.clientSubmissionId === 'string' ? req.body.clientSubmissionId.slice(0, 80) : null;
        if (!language || typeof code !== 'string' || !code.trim()) return res.status(400).json({ message: 'Code and a supported language are required.' });
        if (code.length > 100000) return res.status(413).json({ message: 'Code must be under 100 KB.' });
        if (!question.hiddenTestCases.length) return res.status(400).json({ message: 'This question has no hidden test cases configured.' });

        if (clientSubmissionId) {
            const previous = await ExamSubmission.findOne({ attemptId: context.attempt._id, clientSubmissionId });
            if (previous) return res.json({ success: true, submission: {
                _id: previous._id, status: previous.status, testCasesPassed: previous.testCasesPassed,
                testCasesTotal: previous.testCasesTotal, score: previous.score, errorMessage: previous.errorMessage
            } });
        }
        const receivedAt = new Date();
        if (!isSubmissionAllowed(context.exam, context.attempt, receivedAt)) {
            return res.status(410).json({ message: 'The examination submission deadline has passed.', deadline: getAttemptDeadline(context.exam, context.attempt) });
        }

        submission = await ExamSubmission.create({
            examId: context.exam._id,
            attemptId: context.attempt._id,
            studentId: req.result._id,
            questionId: question._id,
            clientSubmissionId,
            code,
            language,
            receivedAt,
            testCasesTotal: question.hiddenTestCases.length
        });
        const results = await executeCases(code, language, question.hiddenTestCases);
        const passed = results.filter((item) => Number(item?.status_id) === 3).length;
        const executionError = results.find((item) => isExecutionError(item?.status_id));
        const status = passed === results.length ? 'accepted' : executionError ? 'error' : 'wrong';
        const score = Math.floor((passed / question.hiddenTestCases.length) * question.marks);
        const runtime = results.reduce((sum, item) => sum + (Number.parseFloat(item?.time) || 0), 0) * 1000;
        const memory = results.reduce((max, item) => Math.max(max, Number(item?.memory) || 0), 0);
        const message = executionError ? errorText(executionError) : '';

        await ExamSubmission.updateOne({ _id: submission._id }, {
            $set: { status, testCasesPassed: passed, score, runtime, memory, errorMessage: message }
        });
        await updateAttemptScore(context.attempt._id, question._id, submission._id, score, status);
        context.attempt.studentStatus = 'active';
        await context.attempt.save().catch(() => {});
        emitExamActivity(context.exam._id, 'submission_recorded', { attemptId: String(context.attempt._id), questionId: String(question._id) });
        return res.status(201).json({ success: true, submission: {
            _id: submission._id,
            status,
            testCasesPassed: passed,
            testCasesTotal: question.hiddenTestCases.length,
            score,
            maxScore: question.marks,
            runtime,
            memory,
            errorMessage: message
        } });
    } catch (error) {
        if (error.code === 11000) {
            if (req.body.clientSubmissionId) {
                const previous = await ExamSubmission.findOne({ attemptId: req.params.attemptId, clientSubmissionId: req.body.clientSubmissionId });
                if (previous) return res.status(200).json({ success: true, submission: previous });
            }
            return res.status(409).json({ message: 'A submission for this question is already being evaluated.' });
        }
        if (submission?._id) {
            await ExamSubmission.updateOne({ _id: submission._id, status: 'pending' }, { $set: { status: 'error', errorMessage: String(error.message || 'Evaluation failed.').slice(0, 2000) } }).catch(() => {});
        }
        console.error('Exam submission failed:', error);
        return res.status(502).json({ message: error.message || 'Unable to evaluate submission.' });
    }
};

const finishAttempt = async (req, res) => {
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res, { allowFinal: true });
        if (!context) return;
        if (context.attempt.status === 'in_progress') {
            const now = new Date();
            context.attempt.status = isSubmissionAllowed(context.exam, context.attempt, now) ? 'submitted' : 'expired';
            context.attempt.studentStatus = 'submitted';
            context.attempt.submittedAt = now;
            await context.attempt.save();
            await autoGradeAttemptDrafts(context.exam, context.attempt);
        }
        const savedAttempt = await ExamAttempt.findById(context.attempt._id).select('status totalScore submittedAt');
        emitExamActivity(context.exam._id, 'attempt_submitted', { attemptId: String(context.attempt._id), status: savedAttempt.status });
        return res.json({ success: true, status: savedAttempt.status, totalScore: savedAttempt.totalScore, submittedAt: savedAttempt.submittedAt });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to finish attempt.' });
    }
};

const heartbeatAttempt = async (req, res) => {
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res);
        if (!context) return;
        const serverNow = new Date();
        const wasDisconnected = context.attempt.studentStatus === 'disconnected';
        context.attempt.lastActivityAt = serverNow;
        context.attempt.studentStatus = 'active';
        await context.attempt.save();
        if (wasDisconnected) emitExamActivity(context.exam._id, 'student_reconnected', { attemptId: String(context.attempt._id) });
        return res.json({ success: true, serverNow });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to update connection status.' });
    }
};

const reportProctoringEvent = async (req, res) => {
    try {
        const context = await loadAttemptContext(req.params.attemptId, req.result, res);
        if (!context) return;
        const eventType = String(req.body.eventType || '');
        if (!Object.hasOwn(EVENT_CONFIG, eventType) && !['connection_interrupted', 'route_navigation'].includes(eventType)) {
            return res.status(400).json({ message: 'Unsupported proctoring event.' });
        }
        const proctoringPolicy = normalizeProctoring(context.exam.proctoring);
        const immediateEvent = ['fullscreen_exit', 'copy', 'paste', 'cut'].includes(eventType);
        const isDeviceDisconnectEnabled = eventType === 'camera_disconnected'
            ? proctoringPolicy.camera || proctoringPolicy.facePresence
            : eventType === 'microphone_disconnected'
                ? proctoringPolicy.microphone || proctoringPolicy.audioActivity
                : null;
        if (EVENT_CONFIG[eventType] && !immediateEvent && !(isDeviceDisconnectEnabled ?? proctoringPolicy[EVENT_CONFIG[eventType]])) {
            return res.status(400).json({ message: 'This proctoring check is not enabled for the examination.' });
        }

        const receivedAt = new Date();
        const maxViolations = proctoringPolicy.maxViolations;
        const useViolationThreshold = Boolean(proctoringPolicy.autoSubmitOnMaxViolations && maxViolations >= 3);
        const routeNavigationTerminates = eventType === 'route_navigation' && proctoringPolicy.terminateOnRouteChange;
        const countsAsViolation = eventType !== 'connection_interrupted';
        const immediateTermination = immediateEvent || routeNavigationTerminates
            ? shouldTerminateAttempt(proctoringPolicy, eventType, (Number(context.attempt.violationCount) || 0) + (countsAsViolation ? 1 : 0))
            : false;
        const nextViolationCount = countsAsViolation
            ? { $add: [{ $ifNull: ['$violationCount', 0] }, 1] }
            : { $ifNull: ['$violationCount', 0] };
        const terminationCondition = { $or: [
            { $literal: immediateTermination },
            { $and: [
                { $literal: countsAsViolation },
                { $literal: useViolationThreshold },
                { $gte: [nextViolationCount, { $literal: maxViolations }] }
            ] }
        ] };
        const updatedAttempt = await ExamAttempt.findOneAndUpdate({ _id: context.attempt._id, status: 'in_progress' }, [
            { $set: {
                violationCount: nextViolationCount,
                lastActivityAt: { $literal: receivedAt },
                studentStatus: { $cond: [terminationCondition, 'submitted', 'active'] },
                status: { $cond: [terminationCondition, 'terminated', '$status'] },
                submittedAt: { $cond: [terminationCondition, { $literal: receivedAt }, '$submittedAt'] },
                terminationReason: { $cond: [
                    terminationCondition,
                    { $cond: [
                        { $literal: routeNavigationTerminates },
                        'route_navigation',
                        { $cond: [
                            { $literal: eventType === 'fullscreen_exit' },
                            'fullscreen_exit',
                            { $cond: [{ $literal: immediateEvent }, 'clipboard_violation', 'violation_threshold'] }
                        ] }
                    ] },
                    { $ifNull: ['$terminationReason', ''] }
                ] },
                flagged: { $or: [
                    { $ifNull: ['$flagged', false] },
                    { $and: [{ $literal: countsAsViolation }, { $gte: [nextViolationCount, { $literal: 3 }] }] },
                    { $literal: immediateTermination }
                ] }
            } }
        ], { new: true });
        if (!updatedAttempt) return res.status(410).json({ message: 'This attempt is no longer active.' });
        const terminated = updatedAttempt.status === 'terminated';
        const severity = eventType === 'connection_interrupted'
            ? 'warning'
            : eventType === 'route_navigation' || terminated
                ? 'flagged'
                : proctoringSeverity(updatedAttempt.violationCount);
        const metadata = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
        const serializedMetadata = JSON.stringify(metadata);
        const safeMetadata = serializedMetadata.length <= 2000
            ? JSON.parse(serializedMetadata)
            : { truncated: true };
        await ProctoringEvent.create({
            examId: context.exam._id,
            attemptId: updatedAttempt._id,
            studentId: req.result._id,
            eventType,
            severity,
            metadata: safeMetadata,
            receivedAt
        });
        emitExamActivity(context.exam._id, terminated ? 'attempt_terminated' : 'proctoring_event', {
            attemptId: String(updatedAttempt._id), severity, terminationReason: updatedAttempt.terminationReason || ''
        });
        if (terminated && context.exam.autoSubmit) await autoGradeAttemptDrafts(context.exam, updatedAttempt);
        return res.status(201).json({
            success: true,
            event: { eventType, severity, receivedAt },
            violationCount: updatedAttempt.violationCount,
            flagged: updatedAttempt.flagged,
            terminated,
            terminationReason: updatedAttempt.terminationReason || '',
            autoSubmitted: terminated && context.exam.autoSubmit
        });
    } catch (error) {
        console.error('Unable to record proctoring event:', error);
        return res.status(500).json({ message: 'Unable to record proctoring event.' });
    }
};

const listParticipants = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        const { page, limit } = paginate(req.query);
        const cutoff = new Date(Date.now() - 45000);
        const eligibleStudents = { role: 'user' };
        if (exam.targetStudents.length) eligibleStudents._id = { $in: exam.targetStudents };
        if (exam.targetGroups.length) eligibleStudents.studentGroup = { $in: exam.targetGroups };
        if (exam.semester) eligibleStudents.semester = exam.semester;
        if (exam.batch) eligibleStudents.batch = exam.batch;
        const [enrolledStudents, total, active, disconnected, submitted, flagged, attempts] = await Promise.all([
            User.countDocuments(eligibleStudents),
            ExamAttempt.countDocuments({ examId: exam._id }),
            ExamAttempt.countDocuments({ examId: exam._id, status: 'in_progress', lastActivityAt: { $gte: cutoff } }),
            ExamAttempt.countDocuments({ examId: exam._id, status: 'in_progress', lastActivityAt: { $lt: cutoff } }),
            ExamAttempt.countDocuments({ examId: exam._id, status: { $in: ['submitted', 'expired', 'terminated'] } }),
            ExamAttempt.countDocuments({ examId: exam._id, flagged: true }),
            ExamAttempt.find({ examId: exam._id }).populate('studentId', 'firstName lastName emailID studentGroup').sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit)
        ]);
        return res.json({
            success: true, page, limit, total,
            summary: { enrolledStudents, joinedAttempts: total, active, disconnected, submitted, flagged },
            participants: attempts.map((attempt) => ({
                attemptId: attempt._id,
                student: attempt.studentId,
                attemptNumber: attempt.attemptNumber,
                joinedAt: attempt.joinedAt,
                status: attempt.status,
                studentStatus: attempt.status === 'in_progress' && Date.now() - new Date(attempt.lastActivityAt || attempt.updatedAt).getTime() > 45000
                    ? 'disconnected'
                    : attempt.studentStatus,
                submittedAt: attempt.submittedAt,
                totalScore: attempt.totalScore,
                violationCount: attempt.violationCount,
                flagged: attempt.flagged,
                latestActivity: attempt.lastActivityAt || attempt.updatedAt
            }))
        });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to list participants.' });
    }
};

const listResults = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        const { page, limit } = paginate(req.query);
        const [total, attempts] = await Promise.all([
            ExamAttempt.countDocuments({ examId: exam._id }),
            ExamAttempt.find({ examId: exam._id }).populate('studentId', 'firstName lastName emailID').sort({ totalScore: -1, submittedAt: 1 }).skip((page - 1) * limit).limit(limit)
        ]);
        const submissions = await ExamSubmission.find({ examId: exam._id, attemptId: { $in: attempts.map((attempt) => attempt._id) } })
            .populate('questionId', 'title marks order').sort({ createdAt: -1 });
        const byAttempt = new Map();
        for (const submission of submissions) {
            const key = asId(submission.attemptId);
            if (!byAttempt.has(key)) byAttempt.set(key, []);
            byAttempt.get(key).push({
                _id: submission._id,
                question: submission.questionId,
                status: submission.status,
                language: submission.language,
                code: submission.code,
                testCasesPassed: submission.testCasesPassed,
                testCasesTotal: submission.testCasesTotal,
                score: submission.score,
                runtime: submission.runtime,
                submittedAt: submission.createdAt
            });
        }
        return res.json({
            success: true, page, limit, total,
            results: attempts.map((attempt) => ({
                attemptId: attempt._id,
                student: attempt.studentId,
                attemptNumber: attempt.attemptNumber,
                status: attempt.status,
                totalScore: attempt.totalScore,
                totalMarks: exam.totalMarks,
                submittedAt: attempt.submittedAt,
                flagged: attempt.flagged,
                violationCount: attempt.violationCount,
                questionProgress: attempt.questionProgress,
                submissions: byAttempt.get(asId(attempt._id)) || []
            }))
        });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load examination results.' });
    }
};

const exportResultsCsv = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        const attempts = await ExamAttempt.find({ examId: exam._id }).populate('studentId', 'firstName lastName emailID').sort({ totalScore: -1, submittedAt: 1 }).limit(10000);
        const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [['Student', 'Email', 'Attempt', 'Status', 'Score', 'Total marks', 'Submitted at', 'Flagged', 'Violations']];
        for (const attempt of attempts) {
            const student = attempt.studentId;
            rows.push([
                `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
                student?.emailID || '', attempt.attemptNumber, attempt.status,
                attempt.totalScore, exam.totalMarks, attempt.submittedAt?.toISOString() || '',
                attempt.flagged, attempt.violationCount
            ]);
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="exam-${exam._id}-results.csv"`);
        return res.send(rows.map((row) => row.map(escape).join(',')).join('\r\n'));
    } catch (error) {
        return res.status(500).json({ message: 'Unable to export results.' });
    }
};

const listProctoringEvents = async (req, res) => {
    try {
        const exam = await loadExamForManager(req.params.examId, req.result, res);
        if (!exam) return;
        const { page, limit } = paginate(req.query);
        const [total, events] = await Promise.all([
            ProctoringEvent.countDocuments({ examId: exam._id }),
            ProctoringEvent.find({ examId: exam._id }).populate('studentId', 'firstName lastName emailID').sort({ receivedAt: -1 }).skip((page - 1) * limit).limit(limit)
        ]);
        return res.json({ success: true, page, limit, total, events });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to load proctoring events.' });
    }
};

const processExpiredAttempts = async () => {
    try {
        const now = new Date();
        await Promise.all([
            LabExam.updateMany({ published: true, status: 'SCHEDULED', startAt: { $lte: now }, endAt: { $gt: now } }, { $set: { status: 'ACTIVE' } }),
            LabExam.updateMany({ published: true, status: { $in: ['SCHEDULED', 'ACTIVE'] }, endAt: { $lte: now } }, { $set: { status: 'COMPLETED' } })
        ]);
        const attemptCollection = ExamAttempt.collection.name;
        const examCollection = LabExam.collection.name;
        const expired = await mongoose.connection.collection(attemptCollection).aggregate([
            { $match: { status: 'in_progress' } },
            { $lookup: { from: examCollection, localField: 'examId', foreignField: '_id', as: 'exam' } },
            { $unwind: '$exam' },
            { $set: {
                serverDeadline: {
                    $add: [
                        { $min: ['$expiresAt', '$exam.endAt'] },
                        { $multiply: [{ $ifNull: ['$exam.gracePeriodSeconds', 0] }, 1000] }
                    ]
                }
            } },
            { $match: { serverDeadline: { $lt: now } } },
            { $limit: 50 },
            { $project: { _id: 1, examId: 1 } }
        ]).toArray();
        for (const candidate of expired) {
            const [attempt, exam] = await Promise.all([
                ExamAttempt.findById(candidate._id),
                LabExam.findById(candidate.examId)
            ]);
            if (attempt && exam) await expireAttemptIfNeeded(exam, attempt, now);
        }
        const staleAttempts = await ExamAttempt.find({
            status: 'in_progress',
            studentStatus: 'active',
            lastActivityAt: { $lt: new Date(now.getTime() - 45000) }
        }).select('_id examId studentId').limit(100);
        for (const attempt of staleAttempts) {
            const disconnected = await ExamAttempt.findOneAndUpdate({
                _id: attempt._id,
                status: 'in_progress',
                studentStatus: 'active',
                lastActivityAt: { $lt: new Date(now.getTime() - 45000) }
            }, { $set: { studentStatus: 'disconnected' } }, { new: true }).select('_id examId');
            if (disconnected) emitExamActivity(disconnected.examId, 'student_disconnected', { attemptId: String(disconnected._id) });
        }
    } catch (error) {
        console.error('Expired exam attempt processing failed:', error.message);
    }
};

module.exports = {
    cancelExam,
    createExam,
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
    processExpiredAttempts,
    reportProctoringEvent,
    runQuestion,
    saveDraft,
    submitQuestion,
    unpublishExam,
    updateExam
};
