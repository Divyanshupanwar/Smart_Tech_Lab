const mongoose = require('mongoose');
const { Schema } = mongoose;

const examSubmissionSchema = new Schema({
    examId: { type: Schema.Types.ObjectId, ref: 'labExam', required: true },
    attemptId: { type: Schema.Types.ObjectId, ref: 'examAttempt', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'examQuestion', required: true },
    clientSubmissionId: { type: String, maxlength: 80, default: null },
    code: { type: String, required: true, maxlength: 100000 },
    language: { type: String, enum: ['javascript', 'java', 'c++'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'wrong', 'error'], default: 'pending' },
    testCasesPassed: { type: Number, default: 0, min: 0 },
    testCasesTotal: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0, min: 0 },
    runtime: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    errorMessage: { type: String, default: '', maxlength: 2000 },
    receivedAt: { type: Date, required: true }
}, { timestamps: true });

examSubmissionSchema.index({ attemptId: 1, createdAt: -1 });
examSubmissionSchema.index({ examId: 1, studentId: 1, createdAt: -1 });
examSubmissionSchema.index(
    { attemptId: 1, questionId: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } }
);
examSubmissionSchema.index(
    { attemptId: 1, clientSubmissionId: 1 },
    { unique: true, partialFilterExpression: { clientSubmissionId: { $type: 'string' } } }
);

module.exports = mongoose.model('examSubmission', examSubmissionSchema);
