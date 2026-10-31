const SUPPORTED_LANGUAGES = ['javascript', 'java', 'c++'];

const normalizeLanguage = (value) => {
    const language = String(value || '').trim().toLowerCase();
    if (language === 'cpp' || language === 'c') return 'c++';
    return SUPPORTED_LANGUAGES.includes(language) ? language : null;
};

const deriveExamStatus = (exam, now = new Date()) => {
    if (!exam) return 'DRAFT';
    if (exam.status === 'CANCELLED') return 'CANCELLED';
    if (!exam.published) return 'DRAFT';
    const startAt = new Date(exam.startAt).getTime();
    const endAt = new Date(exam.endAt).getTime();
    const currentTime = new Date(now).getTime();
    if (currentTime < startAt) return 'SCHEDULED';
    if (currentTime < endAt) return 'ACTIVE';
    return 'COMPLETED';
};

const isStudentEligible = (exam, student) => {
    if (!exam || !student) return false;
    const studentId = String(student._id || student.id || '');
    const targets = (exam.targetStudents || []).map((id) => String(id?._id || id));
    const groups = exam.targetGroups || [];
    const matchesStudent = targets.length === 0 || targets.includes(studentId);
    const studentGroup = student.studentGroup || student.batch || '';
    const matchesGroup = groups.length === 0 || groups.includes(studentGroup);
    const matchesSemester = !exam.semester || exam.semester === (student.semester || '');
    const matchesBatch = !exam.batch || exam.batch === (student.batch || '');
    return matchesStudent && matchesGroup && matchesSemester && matchesBatch;
};

const canManageExam = (exam, user) => Boolean(
    exam && user && (user.role === 'admin' || String(exam.createdBy?._id || exam.createdBy) === String(user._id))
);

const shouldTerminateAttempt = (proctoring, eventType, nextViolationCount) => Boolean(
    (eventType === 'route_navigation' && proctoring?.terminateOnRouteChange !== false)
    || (proctoring?.autoSubmitOnMaxViolations
        && Number(proctoring.maxViolations) >= 3
        && nextViolationCount >= Number(proctoring.maxViolations))
);

const getAttemptDeadline = (exam, attempt) => {
    const examEnd = new Date(exam.endAt).getTime();
    const attemptEnd = new Date(attempt.expiresAt).getTime();
    const baseDeadline = Math.min(examEnd, attemptEnd);
    return new Date(baseDeadline + Math.max(0, Number(exam.gracePeriodSeconds) || 0) * 1000);
};

const isSubmissionAllowed = (exam, attempt, now = new Date()) => (
    Boolean(exam?.published) && exam?.status !== 'CANCELLED' && attempt?.status === 'in_progress' &&
    new Date(now).getTime() <= getAttemptDeadline(exam, attempt).getTime()
);

const serializeQuestionForStudent = (question) => {
    const plain = typeof question?.toObject === 'function' ? question.toObject() : question;
    return {
        _id: plain._id,
        title: plain.title,
        description: plain.description,
        constraints: plain.constraints || '',
        examples: (plain.examples || []).map(({ input, output, explanation }) => ({ input, output, explanation })),
        visibleTestCases: (plain.visibleTestCases || []).map(({ input, output, explanation }) => ({ input, output, explanation })),
        starterCode: (plain.starterCode || []).map(({ language, code }) => ({ language, code })),
        marks: plain.marks,
        order: plain.order
    };
};

const proctoringSeverity = (violationCount) => {
    if (violationCount >= 3) return 'flagged';
    if (violationCount === 2) return 'strong_warning';
    return 'warning';
};

module.exports = {
    SUPPORTED_LANGUAGES,
    canManageExam,
    deriveExamStatus,
    getAttemptDeadline,
    isStudentEligible,
    isSubmissionAllowed,
    normalizeLanguage,
    proctoringSeverity,
    serializeQuestionForStudent,
    shouldTerminateAttempt
};
