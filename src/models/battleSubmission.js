const mongoose = require('mongoose');
const { Schema } = mongoose;

const battleSubmissionSchema = new Schema({
    battleId: { type: Schema.Types.ObjectId, ref: 'battle', required: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    questionId: { type: Schema.Types.ObjectId, required: true },
    clientSubmissionId: { type: String, maxlength: 80 },
    code: { type: String, required: true, maxlength: 100000 },
    language: { type: String, enum: ['javascript', 'java', 'c++'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'wrong', 'error'], default: 'pending' },
    testCasesPassed: { type: Number, default: 0 },
    testCasesTotal: { type: Number, default: 0 },
    scoreDelta: { type: Number, default: 0 },
    runtime: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    errorMessage: { type: String, default: '', maxlength: 2000 },
    receivedAt: { type: Date, required: true }
}, { timestamps: true });

battleSubmissionSchema.index({ battleId: 1, playerId: 1, createdAt: -1 });
battleSubmissionSchema.index({ battleId: 1, questionId: 1, playerId: 1 });
battleSubmissionSchema.index(
    { battleId: 1, playerId: 1, clientSubmissionId: 1 },
    { unique: true, partialFilterExpression: { clientSubmissionId: { $type: 'string' } } }
);

module.exports = mongoose.model('battleSubmission', battleSubmissionSchema);
