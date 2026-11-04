const mongoose = require('mongoose');
const { Schema } = mongoose;

const draftSchema = new Schema({
    questionId: { type: Schema.Types.ObjectId, ref: 'examQuestion', required: true },
    language: { type: String, enum: ['javascript', 'java', 'c++'], required: true },
    code: { type: String, default: '', maxlength: 100000 },
    updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const progressSchema = new Schema({
    questionId: { type: Schema.Types.ObjectId, ref: 'examQuestion', required: true },
    bestScore: { type: Number, min: 0, default: 0 },
    latestStatus: { type: String, default: 'not_submitted' },
    lastSubmissionId: { type: Schema.Types.ObjectId, ref: 'examSubmission', default: null }
}, { _id: false });

const examAttemptSchema = new Schema({
    examId: { type: Schema.Types.ObjectId, ref: 'labExam', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['in_progress', 'submitted', 'expired', 'terminated'], default: 'in_progress' },
    joinedAt: { type: Date, required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, required: true },
    drafts: { type: [draftSchema], default: [] },
    questionProgress: { type: [progressSchema], default: [] },
    totalScore: { type: Number, default: 0, min: 0 },
    violationCount: { type: Number, default: 0, min: 0 },
    flagged: { type: Boolean, default: false },
    terminationReason: { type: String, enum: ['', 'route_navigation', 'fullscreen_exit', 'clipboard_violation', 'violation_threshold'], default: '' },
    studentStatus: { type: String, enum: ['active', 'disconnected', 'submitted'], default: 'active' }
}, { timestamps: true });

examAttemptSchema.index({ examId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });
examAttemptSchema.index(
    { examId: 1, studentId: 1 },
    { unique: true, partialFilterExpression: { status: 'in_progress' } }
);
examAttemptSchema.index({ studentId: 1, status: 1, startedAt: -1 });
examAttemptSchema.index(
    { studentId: 1 },
    { unique: true, partialFilterExpression: { status: 'in_progress' } }
);

module.exports = mongoose.model('examAttempt', examAttemptSchema);
